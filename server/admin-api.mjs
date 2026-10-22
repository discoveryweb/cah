import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import path from "node:path";
import {
  getDummyHash,
  hashPassword,
  loadAdminConfig,
  normaliseEmail,
  passwordIssue,
  publicAccount,
  verifyPassword,
} from "./admin-config.mjs";
import { deleteOrder, readOrders, retryOrder, retryPendingOrders, smsSummary } from "./orders.mjs";
import { createFsStorage } from "./storage-fs.mjs";

const SESSION_COOKIE = "cahen_admin";
const MAX_JSON_BYTES = 1024 * 1024;
// Netlify buffers at most 6 MB per request and base64-encodes binary bodies
// (+33%), so 4 MB is the largest upload that reliably reaches the function.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const IP_LOGIN_LIMIT = 12;
const EMAIL_LOGIN_LIMIT = 6;
const MAX_TRACKED_KEYS = 4000;

const ROLES = new Set(["owner", "editor", "viewer"]);
const ROLE_RANK = { owner: 3, editor: 2, viewer: 1 };

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class ApiError extends Error {
  constructor(status, code, message = code, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

const applySecurityHeaders = (response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.setHeader("Vary", "Origin, Cookie");
};

const json = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.end(JSON.stringify(payload));
};

const fail = (response, error) => {
  applySecurityHeaders(response);
  if (error instanceof ApiError) {
    for (const [key, value] of Object.entries(error.headers)) response.setHeader(key, value);
    json(response, error.status, { ok: false, code: error.code, message: error.message });
    return;
  }
  const name = String(error?.name ?? "");
  if (
    name === "MissingBlobsEnvironmentError" ||
    name === "BlobsInternalError" ||
    name === "BlobsConsistencyError" ||
    name === "InvalidBlobsRegionError"
  ) {
    console.error("[admin-api] storage", name);
    json(response, 503, {
      ok: false,
      code: "storage_unavailable",
      message: "دسترسی به فضای ذخیره‌سازی پنل ممکن نشد. تنظیمات Netlify Blobs را بررسی کنید.",
    });
    return;
  }
  console.error("[admin-api]", error);
  json(response, 500, { ok: false, code: "server_error", message: "خطای غیرمنتظره در سرور." });
};

function parseCookies(header = "") {
  const cookies = new Map();
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    try {
      cookies.set(key, decodeURIComponent(part.slice(index + 1).trim()));
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

async function readBody(request, limit) {
  const advertised = Number(request.headers?.["content-length"] ?? 0);
  if (Number.isFinite(advertised) && advertised > limit) {
    throw new ApiError(413, "payload_too_large", "حجم درخواست بیش از حد مجاز است.");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, "payload_too_large", "حجم درخواست بیش از حد مجاز است.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const headerValue = (request, name) => {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

async function readJson(request) {
  const contentType = String(headerValue(request, "content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType && contentType !== "application/json") {
    throw new ApiError(415, "unsupported_media_type", "بدنهٔ درخواست باید JSON باشد.");
  }
  const buffer = await readBody(request, MAX_JSON_BYTES);
  if (!buffer.length) return {};
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid_json", "بدنهٔ درخواست معتبر نیست.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "invalid_payload", "بدنهٔ درخواست معتبر نیست.");
  }
  return parsed;
}

const requestHost = (request, trustForwardedHost) => {
  if (trustForwardedHost) {
    const forwarded = String(headerValue(request, "x-forwarded-host") ?? "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    if (forwarded) return forwarded;
  }
  return String(headerValue(request, "host") ?? "")
    .trim()
    .toLowerCase();
};

/**
 * Same-site check for every state-changing request. Browsers send Origin for
 * POST/PUT/DELETE and `Sec-Fetch-Site` on modern clients; a request carrying
 * neither is rejected instead of trusted.
 */
function assertSameOrigin(request, trustForwardedHost) {
  const fetchSite = String(headerValue(request, "sec-fetch-site") ?? "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new ApiError(403, "bad_origin", "درخواست از مبدأ مجاز ارسال نشده است.");
  }
  const origin = headerValue(request, "origin");
  const host = requestHost(request, trustForwardedHost);
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(String(origin)).host.toLowerCase();
    } catch {
      throw new ApiError(403, "bad_origin", "درخواست از مبدأ مجاز ارسال نشده است.");
    }
    if (!host || originHost !== host) {
      throw new ApiError(403, "bad_origin", "درخواست از مبدأ مجاز ارسال نشده است.");
    }
    return;
  }
  if (!fetchSite) {
    throw new ApiError(403, "bad_origin", "درخواست از مبدأ مجاز ارسال نشده است.");
  }
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Reject prototype-polluting keys before anything is stored or merged. */
function assertSafeContent(value, depth = 0) {
  if (depth > 12) throw new ApiError(400, "content_too_deep", "ساختار محتوا بیش از حد تودرتو است.");
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeContent(item, depth + 1));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new ApiError(400, "invalid_content", "ساختار محتوا معتبر نیست.");
    }
    assertSafeContent(value[key], depth + 1);
  }
}

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (buffer.length >= 6) {
    const head = buffer.subarray(0, 6).toString("ascii");
    if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 12) {
    const brand = buffer.subarray(4, 12).toString("ascii");
    if (brand === "ftypavif" || brand === "ftypavis") return "image/avif";
  }
  return null;
}

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");

const safeMediaName = (value) => {
  const name = path.basename(String(value ?? ""));
  return /^[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/.test(name) ? name : null;
};

const emptyStore = () => ({
  version: 2,
  content: null,
  contentUpdatedAt: null,
  contentUpdatedBy: null,
  activity: [],
  media: [],
  lastLogins: {},
  sessions: [],
  accounts: [],
});

export function createAdminApi({ root = process.cwd(), storage, env = process.env } = {}) {
  const activeStorage = storage ?? createFsStorage({ dataDirectory: path.join(root, "data") });

  let configPromise = null;
  const getConfig = () => {
    if (!configPromise) configPromise = loadAdminConfig(env);
    return configPromise;
  };

  const loginFailures = new Map();

  // Headers such as X-Forwarded-For and X-Nf-Client-Connection-Ip are only
  // trustworthy when a proxy we control sets them; otherwise a client could
  // spoof its address and dodge the login throttle.
  const trustProxyHeaders =
    String(env.TRUST_PROXY ?? "").toLowerCase() === "true" ||
    Boolean(env.NETLIFY) ||
    Boolean(env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(env.SITE_ID);

  const logActivity = (store, actor, action, detail) => {
    store.activity.unshift({
      id: randomBytes(8).toString("hex"),
      at: new Date().toISOString(),
      actor: actor || "system",
      action,
      detail,
    });
    store.activity = store.activity.slice(0, 200);
  };

  async function readStore() {
    let stored;
    try {
      stored = await activeStorage.readStore();
    } catch (error) {
      console.error("[admin-api] storage read", error?.name ?? "unknown");
      throw new ApiError(
        503,
        "storage_unavailable",
        "دسترسی به فضای ذخیره‌سازی پنل ممکن نشد. تنظیمات Netlify Blobs را بررسی کنید."
      );
    }
    if (!isPlainObject(stored)) return emptyStore();
    const store = { ...emptyStore(), ...stored };
    if (!isPlainObject(store.lastLogins)) store.lastLogins = {};
    if (!Array.isArray(store.activity)) store.activity = [];
    if (!Array.isArray(store.media)) store.media = [];
    if (!Array.isArray(store.sessions)) store.sessions = [];
    if (!Array.isArray(store.accounts)) store.accounts = [];
    // The old document carried local password hashes; they are never used now.
    delete store.admins;
    return store;
  }

  const writeStore = (store) => activeStorage.writeStore(store);

  const sign = (config, payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", config.secret).update(body).digest("base64url");
    return `${body}.${signature}`;
  };

  const unsign = (config, token) => {
    if (!token || !token.includes(".")) return null;
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    const expected = createHmac("sha256", config.secret).update(body).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    let payload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!payload || payload.v !== 1) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Date.now()) return null;
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return payload;
  };

  const cookieAttributes = (request, config) => {
    const forwardedProto = String(headerValue(request, "x-forwarded-proto") ?? "")
      .split(",")[0]
      .trim()
      .toLowerCase();
    const secure =
      config.cookieSecure || forwardedProto === "https" || Boolean(request.socket?.encrypted);
    return {
      secure,
      base: ["Path=/", "HttpOnly", "SameSite=Strict", "Priority=High"],
    };
  };

  const setSessionCookie = (request, response, config, token, maxAgeSeconds) => {
    const { secure, base } = cookieAttributes(request, config);
    const parts = [`${SESSION_COOKIE}=${token}`, ...base, `Max-Age=${maxAgeSeconds}`];
    if (secure) parts.push("Secure");
    response.setHeader("Set-Cookie", parts.join("; "));
  };

  const clearSessionCookie = (request, response, config) => {
    const { secure, base } = cookieAttributes(request, config);
    const parts = [
      `${SESSION_COOKIE}=`,
      ...base,
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ];
    if (secure) parts.push("Secure");
    response.setHeader("Set-Cookie", parts.join("; "));
  };

  const clientAddress = (request) => {
    if (trustProxyHeaders) {
      const netlify = headerValue(request, "x-nf-client-connection-ip");
      if (netlify) return String(netlify).split(",")[0].trim();
      const forwarded = headerValue(request, "x-forwarded-for");
      if (forwarded) return String(forwarded).split(",")[0].trim();
    }
    return request.socket?.remoteAddress ?? "unknown";
  };

  const pruneFailures = (now) => {
    if (loginFailures.size <= MAX_TRACKED_KEYS) return;
    for (const [key, entry] of loginFailures) {
      if (now > entry.resetAt) loginFailures.delete(key);
    }
    if (loginFailures.size > MAX_TRACKED_KEYS) loginFailures.clear();
  };

  function assertLoginAllowed(keys, now) {
    for (const { key } of keys) {
      const entry = loginFailures.get(key);
      if (!entry) continue;
      if (entry.blockedUntil && now < entry.blockedUntil) {
        const seconds = Math.ceil((entry.blockedUntil - now) / 1000);
        throw new ApiError(
          429,
          "too_many_attempts",
          "تلاش‌های ناموفق زیاد بود؛ چند دقیقه بعد دوباره تلاش کنید.",
          { "Retry-After": String(seconds) }
        );
      }
      if (now >= entry.resetAt) loginFailures.delete(key);
    }
  }

  function registerFailure(keys, now) {
    for (const { key, limit } of keys) {
      const entry = loginFailures.get(key);
      if (!entry || now > entry.resetAt) {
        loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS, blockedUntil: 0 });
        continue;
      }
      entry.count += 1;
      if (entry.count >= limit) {
        entry.blockedUntil = now + LOGIN_BLOCK_MS;
        entry.resetAt = now + LOGIN_BLOCK_MS;
      }
    }
  }

  const clearFailures = (keys) => keys.forEach(({ key }) => loginFailures.delete(key));

  const pruneSessions = (store, now = Date.now()) => {
    store.sessions = (store.sessions || []).filter(
      (entry) => entry && typeof entry.sid === "string" && Number(entry.exp) > now
    );
    if (store.sessions.length > 30) {
      store.sessions = store.sessions.slice(-30);
    }
  };

  const envView = (account) => ({
    ...publicAccount(account),
    source: "env",
    mustChangePassword: false,
    createdAt: null,
  });

  const panelView = (store, record) => ({
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    active: record.active !== false,
    source: "panel",
    mustChangePassword: Boolean(record.mustChangePassword),
    createdAt: record.createdAt ?? null,
    lastLoginAt: store.lastLogins?.[record.id] ?? record.lastLoginAt ?? null,
  });

  const findStoredAccount = (store, predicate) =>
    (store.accounts || []).find((entry) => entry && predicate(entry)) ?? null;

  async function resolveAccount(config, store, payload) {
    const envAccount = config.accounts.find((entry) => entry.id === payload.sub);
    if (envAccount) {
      if (envAccount.email !== payload.email) return null;
      return { ...envView(envAccount), hash: envAccount.hash };
    }
    const record = findStoredAccount(store, (entry) => entry.id === payload.sub);
    if (!record || record.email !== payload.email || record.active === false) return null;
    return { ...panelView(store, record), hash: record.hash };
  }

  async function getSession(request, config, store) {
    if (!config.ready) return null;
    const token = parseCookies(headerValue(request, "cookie")).get(SESSION_COOKIE);
    const payload = unsign(config, token);
    if (!payload || !payload.sid) return null;
    const account = await resolveAccount(config, store, payload);
    if (!account) return null;
    // Signed tokens are only accepted while their server-side record exists, so
    // logout and revocation take effect immediately.
    const record = (store.sessions || []).find(
      (entry) => entry.sid === payload.sid && entry.sub === account.id
    );
    if (!record || Number(record.exp) <= Date.now()) return null;
    return { account, payload };
  }

  async function requireAccount(request, config, minimum, { allowPendingPassword = false } = {}) {
    if (!config.ready) {
      throw new ApiError(
        503,
        "admin_not_configured",
        "پنل مدیریت هنوز پیکربندی نشده است. متغیرهای محیطی سرور را تنظیم کنید."
      );
    }
    const store = await readStore();
    const session = await getSession(request, config, store);
    if (!session) throw new ApiError(401, "unauthenticated", "ابتدا وارد شوید.");
    if (session.account.mustChangePassword && !allowPendingPassword) {
      throw new ApiError(
        403,
        "password_change_required",
        "پیش از ادامه، گذرواژهٔ یک‌بارمصرف خود را تغییر دهید."
      );
    }
    if (minimum && ROLE_RANK[session.account.role] < ROLE_RANK[minimum]) {
      throw new ApiError(403, "forbidden", "برای این کار دسترسی ندارید.");
    }
    return { ...session, store };
  }

  const adminPayload = (store, account) => ({
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    active: account.active !== false,
    source: account.source ?? "env",
    mustChangePassword: Boolean(account.mustChangePassword),
    createdAt: account.createdAt ?? null,
    lastLoginAt: store.lastLogins?.[account.id] ?? account.lastLoginAt ?? null,
  });

  const listAccounts = (config, store) => [
    ...config.accounts.map((entry) => adminPayload(store, envView(entry))),
    ...(store.accounts || []).map((entry) => adminPayload(store, panelView(store, entry))),
  ];

  const oneTimePassword = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = randomBytes(20);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  };

  const revokeSessions = (store, accountId, exceptSid = null) => {
    store.sessions = (store.sessions || []).filter(
      (entry) => entry.sub !== accountId || (exceptSid && entry.sid === exceptSid)
    );
  };

  async function serveMedia(request, response, rawName) {
    let decoded = rawName;
    try {
      decoded = decodeURIComponent(rawName);
    } catch {
      throw new ApiError(400, "invalid_media", "نشانی تصویر معتبر نیست.");
    }
    const name = safeMediaName(decoded);
    if (!name) throw new ApiError(400, "invalid_media", "نشانی تصویر معتبر نیست.");
    const buffer = await activeStorage.readMedia(name);
    if (!buffer) throw new ApiError(404, "not_found", "تصویر پیدا نشد.");
    const extension = path.extname(name).toLowerCase();
    const type =
      [...IMAGE_EXTENSIONS.entries()].find(([, suffix]) => suffix === extension)?.[0] ??
      "application/octet-stream";
    response.statusCode = 200;
    response.setHeader("Content-Type", type);
    response.setHeader("Content-Length", buffer.length);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    response.setHeader("Content-Disposition", `inline; filename="${name}"`);
    applySecurityHeaders(response);
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(buffer);
  }

  async function handleSession(request, response, config) {
    let store;
    try {
      store = await readStore();
    } catch {
      // A broken storage backend must not look like a network failure: report
      // it as setup work that still needs doing.
      json(response, 200, {
        ok: true,
        configured: false,
        issues: ["دسترسی به فضای ذخیره‌سازی پنل ممکن نشد."],
        sessionHours: Math.round(config.sessionTtlMs / 3_600_000),
        admin: null,
        expiresAt: null,
      });
      return;
    }
    const session = await getSession(request, config, store);
    json(response, 200, {
      ok: true,
      configured: config.ready,
      issues: config.ready ? [] : config.issues,
      sessionHours: Math.round(config.sessionTtlMs / 3_600_000),
      admin: session ? adminPayload(store, session.account) : null,
      expiresAt: session ? new Date(session.payload.exp).toISOString() : null,
    });
  }

  async function handleLogin(request, response, config) {
    if (!config.ready) {
      throw new ApiError(
        503,
        "admin_not_configured",
        "پنل مدیریت هنوز پیکربندی نشده است. متغیرهای محیطی سرور را تنظیم کنید."
      );
    }
    const body = await readJson(request);
    const email = normaliseEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || email.length > 254 || !password || password.length > 512) {
      throw new ApiError(401, "invalid_credentials", "ایمیل یا گذرواژه نادرست است.");
    }

    const now = Date.now();
    pruneFailures(now);
    const address = clientAddress(request);
    const keys = [
      { key: `ip:${sha256(address)}`, limit: IP_LOGIN_LIMIT },
      { key: `email:${sha256(email)}`, limit: EMAIL_LOGIN_LIMIT },
    ];
    assertLoginAllowed(keys, now);

    const store = await readStore();
    const envAccount = config.accounts.find((entry) => entry.email === email);
    const record = envAccount
      ? null
      : findStoredAccount(store, (entry) => entry.email === email);
    const account = envAccount
      ? { ...envView(envAccount), hash: envAccount.hash }
      : record
        ? { ...panelView(store, record), hash: record.hash }
        : null;

    // Unknown emails still pay for one scrypt derivation, so the response time
    // does not reveal whether an address exists. Disabled accounts verify too.
    const hash = account ? account.hash : await getDummyHash();
    const valid = await verifyPassword(password, hash);

    if (!account || !valid || account.active === false) {
      registerFailure(keys, now);
      throw new ApiError(401, "invalid_credentials", "ایمیل یا گذرواژه نادرست است.");
    }

    clearFailures(keys);
    const expiresAt = now + config.sessionTtlMs;
    const sid = randomBytes(18).toString("base64url");
    const token = sign(config, {
      v: 1,
      sub: account.id,
      email: account.email,
      sid,
      iat: now,
      exp: expiresAt,
    });
    pruneSessions(store, now);
    store.sessions.push({ sid, sub: account.id, iat: now, exp: expiresAt });
    store.lastLogins[account.id] = new Date(now).toISOString();
    logActivity(store, account.email, "login", "ورود موفق به پنل");
    await writeStore(store);
    setSessionCookie(request, response, config, token, Math.floor(config.sessionTtlMs / 1000));
    json(response, 200, {
      ok: true,
      admin: adminPayload(store, account),
      expiresAt: new Date(expiresAt).toISOString(),
      mustChangePassword: Boolean(account.mustChangePassword),
    });
  }

  async function handleState(request, response, config) {
    const { account, payload, store } = await requireAccount(request, config, null, {
      allowPendingPassword: true,
    });
    const orders = await readOrders(activeStorage);
    json(response, 200, {
      ok: true,
      admin: adminPayload(store, account),
      accounts: listAccounts(config, store),
      content: store.content,
      updatedAt: store.contentUpdatedAt,
      updatedBy: store.contentUpdatedBy,
      media: store.media,
      activity: store.activity.slice(0, 60),
      orderStats: {
        total: orders.items.length,
        pending: orders.items.filter((entry) => entry.sms?.status !== "sent").length,
      },
      sms: smsSummary(env),
      session: {
        expiresAt: new Date(payload.exp).toISOString(),
        sessionHours: Math.round(config.sessionTtlMs / 3_600_000),
      },
    });
  }

  async function handleUpload(request, response, config, url) {
    const { account, store } = await requireAccount(request, config, "editor");
    const buffer = await readBody(request, MAX_UPLOAD_BYTES);
    if (!buffer.length) throw new ApiError(400, "empty_media", "فایل خالی است.");
    const type = detectImageType(buffer);
    if (!type) {
      throw new ApiError(
        415,
        "unsupported_media",
        "فقط تصویر JPG، PNG، WebP، AVIF یا GIF پذیرفته می‌شود."
      );
    }
    const extension = IMAGE_EXTENSIONS.get(type);
    const requested = String(url.searchParams.get("name") ?? "image");
    const base = path
      .basename(requested, path.extname(requested))
      .replace(/[^A-Za-z0-9-_]/g, "-")
      .slice(0, 40)
      .toLowerCase();
    const name = `${base || "image"}-${randomBytes(8).toString("hex")}${extension}`;
    await activeStorage.writeMedia(name, buffer);
    const entry = {
      name,
      size: buffer.length,
      type,
      at: new Date().toISOString(),
      by: account.email,
    };
    store.media.unshift(entry);
    store.media = store.media.slice(0, 300);
    logActivity(store, account.email, "media.upload", name);
    await writeStore(store);
    json(response, 201, { ok: true, media: entry, url: `/media/${name}` });
  }

  async function handle(request, response) {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const pathname = url.pathname;
      const method = (request.method ?? "GET").toUpperCase();

      if (pathname.startsWith("/media/")) {
        if (method !== "GET" && method !== "HEAD") {
          throw new ApiError(405, "method_not_allowed", "این روش پشتیبانی نمی‌شود.");
        }
        await serveMedia(request, response, pathname.slice("/media/".length));
        return true;
      }

      if (pathname === "/api/content") {
        if (method !== "GET" && method !== "HEAD") {
          throw new ApiError(405, "method_not_allowed", "این روش پشتیبانی نمی‌شود.");
        }
        let store;
        try {
          store = await readStore();
        } catch {
          // The public site has built-in defaults; a storage outage should show
          // those instead of an error page.
          json(response, 200, { ok: true, content: null, updatedAt: null });
          return true;
        }
        json(response, 200, {
          ok: true,
          content: store.content,
          updatedAt: store.contentUpdatedAt,
        });
        return true;
      }

      if (!pathname.startsWith("/api/admin")) return false;

      applySecurityHeaders(response);
      if (method !== "GET" && method !== "HEAD") assertSameOrigin(request, trustProxyHeaders);

      const config = await getConfig();

      if (pathname === "/api/admin/session" && (method === "GET" || method === "HEAD")) {
        await handleSession(request, response, config);
        return true;
      }

      if (pathname === "/api/admin/login" && method === "POST") {
        await handleLogin(request, response, config);
        return true;
      }

      if (pathname === "/api/admin/logout" && method === "POST") {
        // Clearing the cookie must succeed even if storage is unavailable.
        clearSessionCookie(request, response, config);
        if (config.ready) {
          try {
            const store = await readStore();
            const token = parseCookies(headerValue(request, "cookie")).get(SESSION_COOKIE);
            const payload = unsign(config, token);
            if (payload?.sid) {
              const revokeAll = url.searchParams.get("all") === "1";
              store.sessions = (store.sessions || []).filter((entry) =>
                revokeAll ? entry.sub !== payload.sub : entry.sid !== payload.sid
              );
              await writeStore(store);
            }
          } catch {
            // Best effort: the cookie is already gone.
          }
        }
        json(response, 200, { ok: true });
        return true;
      }

      if (pathname === "/api/admin/state" && method === "GET") {
        await handleState(request, response, config);
        return true;
      }

      if (pathname === "/api/admin/activity" && method === "GET") {
        const { store } = await requireAccount(request, config);
        json(response, 200, { ok: true, activity: store.activity.slice(0, 120) });
        return true;
      }

      if (pathname === "/api/admin/export" && method === "GET") {
        const { store } = await requireAccount(request, config, "editor");
        json(response, 200, {
          ok: true,
          exportedAt: new Date().toISOString(),
          content: store.content,
        });
        return true;
      }

      if (pathname === "/api/admin/password" && method === "POST") {
        const { account, payload, store } = await requireAccount(request, config, null, {
          allowPendingPassword: true,
        });
        const body = await readJson(request);
        const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const next = typeof body.newPassword === "string" ? body.newPassword : "";
        if (!(await verifyPassword(current, account.hash))) {
          throw new ApiError(400, "invalid_password", "گذرواژهٔ فعلی نادرست است.");
        }
        if (account.source !== "panel") {
          throw new ApiError(409, "env_account", "گذرواژهٔ این حساب از محیط سرور خوانده می‌شود.");
        }
        const issue = passwordIssue(next, account.email);
        if (issue) throw new ApiError(400, "weak_password", issue);
        const record = findStoredAccount(store, (entry) => entry.id === account.id);
        if (!record) throw new ApiError(404, "not_found", "حساب پیدا نشد.");
        record.hash = await hashPassword(next);
        record.mustChangePassword = false;
        record.passwordChangedAt = new Date().toISOString();
        revokeSessions(store, account.id, payload.sid);
        logActivity(store, account.email, "account.password", "تغییر گذرواژه");
        await writeStore(store);
        json(response, 200, { ok: true, admin: adminPayload(store, panelView(store, record)) });
        return true;
      }

      if (pathname === "/api/admin/accounts" && method === "POST") {
        const { account, store } = await requireAccount(request, config, "owner");
        const body = await readJson(request);
        const email = normaliseEmail(body.email);
        const name = String(body.name ?? "").trim().slice(0, 80);
        const role = typeof body.role === "string" ? body.role : "";
        if (!/^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(email) || email.length > 254) {
          throw new ApiError(400, "invalid_email", "ایمیل معتبر نیست.");
        }
        if (!name) throw new ApiError(400, "invalid_name", "نام را وارد کنید.");
        if (!ROLES.has(role)) throw new ApiError(400, "invalid_role", "نقش معتبر نیست.");
        if (config.accounts.some((entry) => entry.email === email) ||
            findStoredAccount(store, (entry) => entry.email === email)) {
          throw new ApiError(409, "duplicate_email", "این ایمیل قبلاً ثبت شده است.");
        }
        if ((store.accounts || []).length >= 50) {
          throw new ApiError(409, "too_many_accounts", "تعداد حساب‌ها به سقف رسیده است.");
        }
        const invited = body.mode !== "password";
        const password = invited
          ? oneTimePassword()
          : typeof body.password === "string"
            ? body.password
            : "";
        if (!invited) {
          const issue = passwordIssue(password, email);
          if (issue) throw new ApiError(400, "weak_password", issue);
        }
        const now = new Date().toISOString();
        const record = {
          id: sha256(`cahen:${email}`).slice(0, 16),
          email,
          name,
          role,
          hash: await hashPassword(password),
          active: true,
          mustChangePassword: invited,
          createdAt: now,
          createdBy: account.email,
          passwordChangedAt: null,
        };
        store.accounts.push(record);
        logActivity(store, account.email, "account.create", `${email} · ${role}`);
        await writeStore(store);
        json(response, 200, {
          ok: true,
          account: adminPayload(store, panelView(store, record)),
          // Handed to the creating owner once; only the salted hash is stored.
          oneTimePassword: invited ? password : null,
        });
        return true;
      }

      const accountMatch = pathname.match(/^\/api\/admin\/accounts\/([A-Za-z0-9_-]{4,40})$/);
      if (accountMatch && method === "PATCH") {
        const { account, store } = await requireAccount(request, config, "owner");
        const target = findStoredAccount(store, (entry) => entry.id === accountMatch[1]);
        if (!target) {
          throw new ApiError(409, "env_account", "این حساب از محیط سرور می‌آید و اینجا قابل تغییر نیست.");
        }
        const body = await readJson(request);
        const activeOwners = [
          ...config.accounts.filter((entry) => entry.role === "owner"),
          ...(store.accounts || []).filter((entry) => entry.role === "owner" && entry.active !== false),
        ].length;
        const nextRole = ROLES.has(body.role) ? body.role : target.role;
        const nextActive = typeof body.active === "boolean" ? body.active : target.active !== false;
        if (target.role === "owner" && (nextRole !== "owner" || !nextActive) && activeOwners <= 1) {
          throw new ApiError(409, "last_owner", "حداقل یک مدیر ارشد باید فعال بماند.");
        }
        if (typeof body.name === "string") {
          const name = body.name.trim().slice(0, 80);
          if (!name) throw new ApiError(400, "invalid_name", "نام را وارد کنید.");
          target.name = name;
        }
        const changedRole = nextRole !== target.role;
        target.role = nextRole;
        target.active = nextActive;
        if (!nextActive || changedRole) revokeSessions(store, target.id);
        logActivity(store, account.email, "account.update", `${target.email} · ${nextRole}`);
        await writeStore(store);
        json(response, 200, { ok: true, account: adminPayload(store, panelView(store, target)) });
        return true;
      }

      if (accountMatch && method === "DELETE") {
        const { account, store } = await requireAccount(request, config, "owner");
        const target = findStoredAccount(store, (entry) => entry.id === accountMatch[1]);
        if (!target) {
          throw new ApiError(409, "env_account", "این حساب از محیط سرور می‌آید و اینجا قابل حذف نیست.");
        }
        if (target.id === account.id) {
          throw new ApiError(409, "self_delete", "حساب خودتان را نمی‌توانید حذف کنید.");
        }
        const activeOwners = [
          ...config.accounts.filter((entry) => entry.role === "owner"),
          ...(store.accounts || []).filter((entry) => entry.role === "owner" && entry.active !== false),
        ].length;
        if (target.role === "owner" && target.active !== false && activeOwners <= 1) {
          throw new ApiError(409, "last_owner", "حداقل یک مدیر ارشد باید فعال بماند.");
        }
        store.accounts = store.accounts.filter((entry) => entry.id !== target.id);
        revokeSessions(store, target.id);
        delete store.lastLogins?.[target.id];
        logActivity(store, account.email, "account.delete", target.email);
        await writeStore(store);
        json(response, 200, { ok: true });
        return true;
      }

      const passwordMatch = pathname.match(
        /^\/api\/admin\/accounts\/([A-Za-z0-9_-]{4,40})\/password$/
      );
      if (passwordMatch && method === "POST") {
        const { account, store } = await requireAccount(request, config, "owner");
        const target = findStoredAccount(store, (entry) => entry.id === passwordMatch[1]);
        if (!target) {
          throw new ApiError(409, "env_account", "این حساب از محیط سرور می‌آید و اینجا قابل تغییر نیست.");
        }
        const password = oneTimePassword();
        target.hash = await hashPassword(password);
        target.mustChangePassword = true;
        target.passwordChangedAt = new Date().toISOString();
        revokeSessions(store, target.id);
        logActivity(store, account.email, "account.password", `بازنشانی برای ${target.email}`);
        await writeStore(store);
        json(response, 200, { ok: true, oneTimePassword: password });
        return true;
      }

      if (pathname === "/api/admin/orders" && method === "GET") {
        await requireAccount(request, config, "editor");
        if (smsSummary(env).configured) {
          await retryPendingOrders(activeStorage, { env }).catch(() => 0);
        }
        const document = await readOrders(activeStorage);
        const requested = Number(url.searchParams.get("limit"));
        const limit = Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? requested : 100, 1), 500);
        json(response, 200, {
          ok: true,
          orders: document.items.slice(0, limit),
          total: document.items.length,
          sms: smsSummary(env),
        });
        return true;
      }

      const orderMatch = pathname.match(/^\/api\/admin\/orders\/([A-Za-z0-9_-]{4,40})\/(retry)$/);
      if (orderMatch && method === "POST") {
        const { store } = await requireAccount(request, config, "editor");
        const updated = await retryOrder(activeStorage, orderMatch[1], { env });
        if (!updated) throw new ApiError(404, "not_found", "سفارش پیدا نشد.");
        const actor = (await getSession(request, config, store))?.account.email ?? "system";
        logActivity(store, actor, "order.retry", `${updated.code} · ${updated.sms?.status ?? "-"}`);
        await writeStore(store);
        json(response, 200, { ok: true, order: updated, sms: smsSummary(env) });
        return true;
      }

      if (orderMatch && method === "DELETE") {
        const { account, store } = await requireAccount(request, config, "owner");
        const removed = await deleteOrder(activeStorage, orderMatch[1]);
        if (!removed) throw new ApiError(404, "not_found", "سفارش پیدا نشد.");
        logActivity(store, account.email, "order.delete", orderMatch[1]);
        await writeStore(store);
        json(response, 200, { ok: true });
        return true;
      }

      if (pathname === "/api/admin/content" && method === "PUT") {
        const { account, store } = await requireAccount(request, config, "editor");
        const body = await readJson(request);
        if (!isPlainObject(body.content)) {
          throw new ApiError(400, "invalid_content", "محتوای ارسال‌شده معتبر نیست.");
        }
        assertSafeContent(body.content);
        store.content = body.content;
        store.contentUpdatedAt = new Date().toISOString();
        store.contentUpdatedBy = account.email;
        logActivity(
          store,
          account.email,
          "content.save",
          String(body.message ?? "ذخیرهٔ محتوای سایت").slice(0, 160)
        );
        await writeStore(store);
        json(response, 200, {
          ok: true,
          updatedAt: store.contentUpdatedAt,
          updatedBy: store.contentUpdatedBy,
        });
        return true;
      }

      if (pathname === "/api/admin/content/reset" && method === "POST") {
        const { account, store } = await requireAccount(request, config, "owner");
        store.content = null;
        store.contentUpdatedAt = new Date().toISOString();
        store.contentUpdatedBy = account.email;
        logActivity(store, account.email, "content.reset", "بازگرداندن محتوا به پیش‌فرض");
        await writeStore(store);
        json(response, 200, { ok: true });
        return true;
      }

      if (pathname === "/api/admin/media" && method === "POST") {
        await handleUpload(request, response, config, url);
        return true;
      }

      if (pathname === "/api/admin/media" && method === "DELETE") {
        const { account, store } = await requireAccount(request, config, "editor");
        const name = safeMediaName(url.searchParams.get("name"));
        if (!name) throw new ApiError(400, "invalid_media", "نشانی تصویر معتبر نیست.");
        await activeStorage.deleteMedia(name);
        store.media = store.media.filter((entry) => entry.name !== name);
        logActivity(store, account.email, "media.delete", name);
        await writeStore(store);
        json(response, 200, { ok: true });
        return true;
      }

      throw new ApiError(404, "not_found", "این مسیر وجود ندارد.");
    } catch (error) {
      fail(response, error);
      return true;
    }
  }

  /**
   * Connect-style middleware for Vite (dev + preview). Returns true when the
   * request was handled so the caller can skip its own 404 branch.
   */
  const middleware = async (request, response) => {
    const pathname = (request.url ?? "/").split("?")[0];
    if (!pathname.startsWith("/api/") && !pathname.startsWith("/media/")) return false;
    if (pathname === "/api/collaboration") return false;
    return handle(request, response);
  };

  return {
    handle,
    middleware,
    storage: activeStorage,
    uploadsDirectory: activeStorage.uploadsDirectory,
    storePath: activeStorage.storePath,
  };
}

export function createAdminMiddleware(options) {
  return createAdminApi(options).middleware;
}
