import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE = "cahen_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_LIMIT = 8;

const IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
]);

const ROLES = new Set(["owner", "editor", "viewer"]);
const ROLE_RANK = { owner: 3, editor: 2, viewer: 1 };

class ApiError extends Error {
  constructor(status, code, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const json = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
};

const fail = (response, error) => {
  if (error instanceof ApiError) {
    json(response, error.status, { ok: false, code: error.code, message: error.message });
    return;
  }
  console.error("[admin-api]", error);
  json(response, 500, { ok: false, code: "server_error", message: "خطای غیرمنتظره در سرور." });
};

function parseCookies(header = "") {
  const cookies = new Map();
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    cookies.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return cookies;
}

async function readBody(request, limit) {
  const advertised = Number(request.headers["content-length"] ?? 0);
  if (advertised > limit) throw new ApiError(413, "payload_too_large");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, "payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  const buffer = await readBody(request, MAX_JSON_BYTES);
  if (!buffer.length) return {};
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiError(400, "invalid_payload");
    }
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json");
  }
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = String(request.headers.host ?? "").toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Reject prototype-polluting keys before anything is stored or merged. */
function assertSafeContent(value, depth = 0) {
  if (depth > 12) throw new ApiError(400, "content_too_deep");
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeContent(item, depth + 1));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new ApiError(400, "invalid_content");
    }
    assertSafeContent(value[key], depth + 1);
  }
}

const hashPassword = async (password) => {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
};

const verifyPassword = async (password, stored) => {
  const [scheme, saltHex, hashHex] = String(stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};

const slugId = () => randomBytes(8).toString("hex");

export function createAdminApi({ root }) {
  const dataDirectory = path.join(root, "data");
  const uploadsDirectory = path.join(dataDirectory, "uploads");
  const storePath = path.join(dataDirectory, "admin.json");
  const secretPath = path.join(dataDirectory, "session-secret");

  let writeQueue = Promise.resolve();
  let secretCache = null;
  const loginAttempts = new Map();

  async function ensureDirectories() {
    await mkdir(uploadsDirectory, { recursive: true });
  }

  async function getSecret() {
    if (secretCache) return secretCache;
    if (process.env.CAHEN_ADMIN_SECRET) {
      secretCache = process.env.CAHEN_ADMIN_SECRET;
      return secretCache;
    }
    try {
      secretCache = (await readFile(secretPath, "utf8")).trim();
    } catch {
      secretCache = randomBytes(32).toString("hex");
      await ensureDirectories();
      await writeFile(secretPath, secretCache, { mode: 0o600 });
    }
    return secretCache;
  }

  const emptyStore = () => ({
    version: 1,
    admins: [],
    content: null,
    contentUpdatedAt: null,
    contentUpdatedBy: null,
    activity: [],
    media: [],
  });

  async function readStore() {
    try {
      const raw = await readFile(storePath, "utf8");
      const parsed = JSON.parse(raw);
      return { ...emptyStore(), ...parsed };
    } catch {
      return emptyStore();
    }
  }

  function writeStore(store) {
    writeQueue = writeQueue.then(async () => {
      await ensureDirectories();
      const temporary = `${storePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
      await rename(temporary, storePath);
    });
    return writeQueue;
  }

  const publicAdmin = (admin) => ({
    id: admin.id,
    username: admin.username,
    name: admin.name,
    role: admin.role,
    active: admin.active !== false,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt ?? null,
  });

  function logActivity(store, actor, action, detail) {
    store.activity.unshift({
      id: slugId(),
      at: new Date().toISOString(),
      actor: actor ? actor.username : "system",
      action,
      detail,
    });
    store.activity = store.activity.slice(0, 200);
  }

  async function sign(payload) {
    const secret = await getSecret();
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${signature}`;
  }

  async function unsign(token) {
    if (!token || !token.includes(".")) return null;
    const [body, signature] = token.split(".");
    const secret = await getSecret();
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      if (!payload?.sub || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
      return payload;
    } catch {
      return null;
    }
  }

  function setSessionCookie(request, response, token) {
    const secure =
      request.headers["x-forwarded-proto"] === "https" || request.socket?.encrypted ? "; Secure" : "";
    response.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
        SESSION_TTL_MS / 1000
      )}${secure}`
    );
  }

  const clearSessionCookie = (response) => {
    response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  };

  async function currentAdmin(request, store) {
    const token = parseCookies(request.headers.cookie).get(SESSION_COOKIE);
    const payload = await unsign(token);
    if (!payload) return null;
    const admin = store.admins.find((entry) => entry.id === payload.sub);
    if (!admin || admin.active === false) return null;
    return admin;
  }

  async function requireRole(request, store, minimum) {
    const admin = await currentAdmin(request, store);
    if (!admin) throw new ApiError(401, "unauthenticated", "ابتدا وارد شوید.");
    if (minimum && ROLE_RANK[admin.role] < ROLE_RANK[minimum]) {
      throw new ApiError(403, "forbidden", "برای این کار دسترسی ندارید.");
    }
    return admin;
  }

  function throttleLogin(address) {
    const now = Date.now();
    const bucket = loginAttempts.get(address);
    if (!bucket || now > bucket.resetAt) {
      loginAttempts.set(address, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return;
    }
    bucket.count += 1;
    if (bucket.count > LOGIN_LIMIT) {
      throw new ApiError(429, "too_many_attempts", "تلاش‌های ناموفق زیاد بود؛ کمی بعد دوباره تلاش کنید.");
    }
  }

  const clientAddress = (request) =>
    String(request.headers["x-forwarded-for"] ?? request.socket?.remoteAddress ?? "local")
      .split(",")[0]
      .trim();

  async function serveMedia(request, response, name) {
    const safeName = path.basename(String(name ?? ""));
    if (!/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(safeName)) {
      throw new ApiError(400, "invalid_media");
    }
    const filePath = path.join(uploadsDirectory, safeName);
    if (!filePath.startsWith(uploadsDirectory)) throw new ApiError(400, "invalid_media");
    let info;
    try {
      info = await stat(filePath);
    } catch {
      throw new ApiError(404, "not_found");
    }
    if (!info.isFile()) throw new ApiError(404, "not_found");
    const extension = path.extname(safeName).toLowerCase();
    const type =
      [...IMAGE_TYPES.entries()].find(([, suffix]) => suffix === extension)?.[0] ??
      "application/octet-stream";
    response.statusCode = 200;
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Length", info.size);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  }

  async function handle(request, response) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const { pathname } = url;
    const method = request.method ?? "GET";

    if (pathname.startsWith("/media/")) {
      await serveMedia(request, response, pathname.slice("/media/".length));
      return;
    }

    if (pathname === "/api/content" && method === "GET") {
      const store = await readStore();
      json(response, 200, {
        ok: true,
        content: store.content,
        updatedAt: store.contentUpdatedAt,
      });
      return;
    }

    if (!pathname.startsWith("/api/admin")) return false;

    if (method !== "GET" && !sameOrigin(request)) {
      throw new ApiError(403, "bad_origin");
    }

    if (pathname === "/api/admin/session" && method === "GET") {
      const store = await readStore();
      const admin = await currentAdmin(request, store);
      json(response, 200, {
        ok: true,
        setupRequired: store.admins.length === 0,
        admin: admin ? publicAdmin(admin) : null,
      });
      return;
    }

    if (pathname === "/api/admin/setup" && method === "POST") {
      const body = await readJson(request);
      const store = await readStore();
      if (store.admins.length > 0) throw new ApiError(409, "already_initialised");
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim() || "مدیر ارشد";
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError(400, "invalid_username");
      if (password.length < 8) throw new ApiError(400, "weak_password");
      const admin = {
        id: slugId(),
        username,
        name,
        role: "owner",
        active: true,
        hash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      store.admins.push(admin);
      logActivity(store, admin, "setup", "حساب مالک ساخته شد");
      await writeStore(store);
      setSessionCookie(request, response, await sign({ sub: admin.id, exp: Date.now() + SESSION_TTL_MS }));
      json(response, 201, { ok: true, admin: publicAdmin(admin) });
      return;
    }

    if (pathname === "/api/admin/login" && method === "POST") {
      throttleLogin(clientAddress(request));
      const body = await readJson(request);
      const store = await readStore();
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const admin = store.admins.find((entry) => entry.username === username);
      const valid = admin ? await verifyPassword(password, admin.hash) : false;
      if (!admin || !valid || admin.active === false) {
        throw new ApiError(401, "invalid_credentials", "نام کاربری یا گذرواژه درست نیست.");
      }
      admin.lastLoginAt = new Date().toISOString();
      logActivity(store, admin, "login", "ورود به پنل");
      await writeStore(store);
      setSessionCookie(request, response, await sign({ sub: admin.id, exp: Date.now() + SESSION_TTL_MS }));
      loginAttempts.delete(clientAddress(request));
      json(response, 200, { ok: true, admin: publicAdmin(admin) });
      return;
    }

    if (pathname === "/api/admin/logout" && method === "POST") {
      clearSessionCookie(response);
      json(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/admin/state" && method === "GET") {
      const store = await readStore();
      const admin = await requireRole(request, store);
      json(response, 200, {
        ok: true,
        admin: publicAdmin(admin),
        content: store.content,
        updatedAt: store.contentUpdatedAt,
        updatedBy: store.contentUpdatedBy,
        admins: store.admins.map(publicAdmin),
        media: store.media,
        activity: store.activity.slice(0, 60),
      });
      return;
    }

    if (pathname === "/api/admin/activity" && method === "GET") {
      const store = await readStore();
      await requireRole(request, store);
      json(response, 200, { ok: true, activity: store.activity.slice(0, 120) });
      return;
    }

    if (pathname === "/api/admin/content" && method === "PUT") {
      const store = await readStore();
      const admin = await requireRole(request, store, "editor");
      const body = await readJson(request);
      if (!isPlainObject(body.content)) throw new ApiError(400, "invalid_content");
      assertSafeContent(body.content);
      store.content = body.content;
      store.contentUpdatedAt = new Date().toISOString();
      store.contentUpdatedBy = admin.username;
      logActivity(store, admin, "content.save", String(body.message ?? "ذخیرهٔ محتوای سایت"));
      await writeStore(store);
      json(response, 200, { ok: true, updatedAt: store.contentUpdatedAt, updatedBy: admin.username });
      return;
    }

    if (pathname === "/api/admin/content/reset" && method === "POST") {
      const store = await readStore();
      const admin = await requireRole(request, store, "owner");
      store.content = null;
      store.contentUpdatedAt = new Date().toISOString();
      store.contentUpdatedBy = admin.username;
      logActivity(store, admin, "content.reset", "بازگرداندن محتوا به پیش‌فرض");
      await writeStore(store);
      json(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/admin/export" && method === "GET") {
      const store = await readStore();
      await requireRole(request, store, "editor");
      json(response, 200, {
        ok: true,
        exportedAt: new Date().toISOString(),
        content: store.content,
      });
      return;
    }

    if (pathname === "/api/admin/media" && method === "POST") {
      const store = await readStore();
      const admin = await requireRole(request, store, "editor");
      const type = String(request.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
      const extension = IMAGE_TYPES.get(type);
      if (!extension) {
        throw new ApiError(415, "unsupported_media", "فقط تصویر JPG، PNG، WebP، AVIF یا GIF پذیرفته می‌شود.");
      }
      const buffer = await readBody(request, MAX_UPLOAD_BYTES);
      if (!buffer.length) throw new ApiError(400, "empty_media");
      await ensureDirectories();
      const requested = String(url.searchParams.get("name") ?? "image");
      const base = path
        .basename(requested, path.extname(requested))
        .replace(/[^A-Za-z0-9-_]/g, "-")
        .slice(0, 40)
        .toLowerCase();
      const fileName = `${base || "image"}-${slugId()}${extension}`;
      await writeFile(path.join(uploadsDirectory, fileName), buffer);
      const entry = {
        name: fileName,
        size: buffer.length,
        type,
        at: new Date().toISOString(),
        by: admin.username,
      };
      store.media.unshift(entry);
      store.media = store.media.slice(0, 300);
      logActivity(store, admin, "media.upload", fileName);
      await writeStore(store);
      json(response, 201, { ok: true, media: entry, url: `/media/${fileName}` });
      return;
    }

    if (pathname === "/api/admin/media" && method === "DELETE") {
      const store = await readStore();
      const admin = await requireRole(request, store, "editor");
      const name = path.basename(String(url.searchParams.get("name") ?? ""));
      if (!/^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(name)) throw new ApiError(400, "invalid_media");
      await unlink(path.join(uploadsDirectory, name)).catch(() => undefined);
      store.media = store.media.filter((entry) => entry.name !== name);
      logActivity(store, admin, "media.delete", name);
      await writeStore(store);
      json(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/admin/admins" && method === "POST") {
      const store = await readStore();
      const owner = await requireRole(request, store, "owner");
      const body = await readJson(request);
      const username = String(body.username ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = String(body.role ?? "editor");
      if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new ApiError(400, "invalid_username");
      if (password.length < 8) throw new ApiError(400, "weak_password");
      if (!ROLES.has(role) || role === "owner") throw new ApiError(400, "invalid_role");
      if (store.admins.some((entry) => entry.username === username)) {
        throw new ApiError(409, "username_taken");
      }
      const admin = {
        id: slugId(),
        username,
        name: String(body.name ?? "").trim() || username,
        role,
        active: true,
        hash: await hashPassword(password),
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      };
      store.admins.push(admin);
      logActivity(store, owner, "admin.create", `${username} — ${role}`);
      await writeStore(store);
      json(response, 201, { ok: true, admin: publicAdmin(admin) });
      return;
    }

    const adminMatch = pathname.match(/^\/api\/admin\/admins\/([a-f0-9]{8,32})$/);
    if (adminMatch) {
      const targetId = adminMatch[1];
      const store = await readStore();
      const actor = await requireRole(request, store);
      const target = store.admins.find((entry) => entry.id === targetId);
      if (!target) throw new ApiError(404, "not_found");

      if (method === "PATCH") {
        const body = await readJson(request);
        const self = actor.id === target.id;
        if (!self && actor.role !== "owner") throw new ApiError(403, "forbidden");

        if (typeof body.password === "string") {
          if (body.password.length < 8) throw new ApiError(400, "weak_password");
          if (self && body.currentPassword !== undefined) {
            const matches = await verifyPassword(String(body.currentPassword), target.hash);
            if (!matches) throw new ApiError(403, "invalid_credentials", "گذرواژهٔ فعلی درست نیست.");
          }
          target.hash = await hashPassword(body.password);
          logActivity(store, actor, "admin.password", target.username);
        }
        if (typeof body.name === "string" && body.name.trim()) target.name = body.name.trim().slice(0, 60);
        if (typeof body.role === "string" && actor.role === "owner" && !self) {
          if (!ROLES.has(body.role) || body.role === "owner") throw new ApiError(400, "invalid_role");
          target.role = body.role;
          logActivity(store, actor, "admin.role", `${target.username} — ${body.role}`);
        }
        if (typeof body.active === "boolean" && actor.role === "owner" && !self) {
          target.active = body.active;
          logActivity(store, actor, "admin.status", `${target.username} — ${body.active ? "فعال" : "غیرفعال"}`);
        }
        await writeStore(store);
        json(response, 200, { ok: true, admin: publicAdmin(target) });
        return;
      }

      if (method === "DELETE") {
        if (actor.role !== "owner") throw new ApiError(403, "forbidden");
        if (target.id === actor.id) throw new ApiError(400, "cannot_delete_self");
        if (target.role === "owner" && store.admins.filter((e) => e.role === "owner").length <= 1) {
          throw new ApiError(400, "last_owner");
        }
        store.admins = store.admins.filter((entry) => entry.id !== target.id);
        logActivity(store, actor, "admin.delete", target.username);
        await writeStore(store);
        json(response, 200, { ok: true });
        return;
      }
    }

    throw new ApiError(404, "not_found");
  }

  /**
   * Connect-style middleware for Vite (dev + preview). Returns true when the
   * request was handled so the caller can skip its own 404 branch.
   */
  const middleware = async (request, response) => {
    const url = request.url ?? "/";
    const pathname = url.split("?")[0];
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/media/")) return false;
    if (pathname === "/api/collaboration") return false;
    try {
      const handled = await handle(request, response);
      if (handled === false) return false;
      return true;
    } catch (error) {
      fail(response, error);
      return true;
    }
  };

  return { handle, middleware, uploadsDirectory, storePath };
}

export function createAdminMiddleware(options) {
  return createAdminApi(options).middleware;
}
