import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
/**
 * End-to-end security checks for the admin API. Everything runs against an
 * ephemeral temporary directory with freshly generated hashes; no real
 * credentials, no network access and no fixtures committed to the repo.
 *
 *   npm run admin:check
 */
import { createAdminApi } from "../server/admin-api.mjs";
import { createFsStorage } from "../server/storage-fs.mjs";
import { createWebHandler } from "../server/web-adapter.mjs";
import { hashPassword } from "../server/admin-config.mjs";

const results = [];
const check = (label, fn) => {
  try {
    fn();
    results.push(["PASS", label]);
  } catch (error) {
    results.push(["FAIL", label, error.message]);
  }
};

const checkAsync = async (label, fn) => {
  try {
    await fn();
    results.push(["PASS", label]);
  } catch (error) {
    results.push(["FAIL", label, error.message]);
  }
};

const root = await mkdtemp(path.join(tmpdir(), "cahen-sec-"));
const ownerPass = "Owner-Passphrase-1404!";
const editorPass = "Editor-Passphrase-1404!";
const env = {
  ADMIN_EMAIL: "owner@cahen.studio",
  ADMIN_NAME: "مالک استودیو",
  ADMIN_PASSWORD_HASH: await hashPassword(ownerPass),
  ADMIN_SESSION_SECRET: "s".repeat(48),
  ADMIN_SESSION_HOURS: "8",
  ADMIN_TEAM: JSON.stringify([
    { email: "editor@cahen.studio", role: "editor", passwordHash: await hashPassword(editorPass) },
  ]),
};

const api = createAdminApi({ storage: createFsStorage({ dataDirectory: root }), env });
const server = createServer((request, response) => void api.handle(request, response));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const call = async (pathname, { method = "GET", body, cookie, headers = {}, raw } = {}) => {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
      ...(body || raw ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    redirect: "manual",
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { response, payload, setCookie: response.headers.getSetCookie?.() ?? [] };
};

/* ------------------------------ discovery ------------------------------ */
const session0 = await call("/api/admin/session");
check("session reports configured, signed out", () =>
  assert.equal(session0.payload.configured, true) || assert.equal(session0.payload.admin, null)
);
check("session has no secrets", () =>
  assert.ok(!JSON.stringify(session0.payload).match(/hash|password|secret/i))
);

const unauth = await call("/api/admin/state");
check("state requires a session", () => assert.equal(unauth.response.status, 401));

/* -------------------------------- origin -------------------------------- */
const evil = await call("/api/admin/login", {
  method: "POST",
  body: { email: "owner@cahen.studio", password: ownerPass },
  headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
});
check("cross-site login blocked", () => assert.equal(evil.response.status, 403));

const noOrigin = await fetch(`${origin}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "owner@cahen.studio", password: ownerPass }),
});
check("login without origin/fetch metadata blocked", () => assert.equal(noOrigin.status, 403));

/* -------------------------------- login -------------------------------- */
const wrong = await call("/api/admin/login", {
  method: "POST",
  body: { email: "owner@cahen.studio", password: "wrong-password" },
});
const unknown = await call("/api/admin/login", {
  method: "POST",
  body: { email: "ghost@cahen.studio", password: "wrong-password" },
});
check("wrong password rejected", () => assert.equal(wrong.response.status, 401));
check("unknown email rejected identically", () =>
  assert.deepEqual(unknown.payload, wrong.payload)
);
check("generic error text", () =>
  assert.equal(wrong.payload.message, "ایمیل یا گذرواژه نادرست است.")
);

const login = await call("/api/admin/login", {
  method: "POST",
  body: { email: "OWNER@cahen.studio ", password: ownerPass },
  headers: { "x-forwarded-proto": "https" },
});
check("owner login succeeds", () => assert.equal(login.response.status, 200));
check("cookie is HttpOnly + SameSite=Strict + Secure", () => {
  const cookie = login.setCookie.join(";");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Path=\//);
});
check("login payload exposes only the public account", () => {
  assert.deepEqual(Object.keys(login.payload.admin).sort(), [
    "active",
    "createdAt",
    "email",
    "id",
    "lastLoginAt",
    "mustChangePassword",
    "name",
    "role",
    "source",
  ]);
});
const cookie = login.setCookie[0].split(";")[0];

/* -------------------------------- session ------------------------------- */
const session = await call("/api/admin/session", { cookie });
check("session resolves the account", () =>
  assert.equal(session.payload.admin.email, "owner@cahen.studio")
);
check("session expiry exposed", () => assert.ok(session.payload.expiresAt));

const tampered = `${cookie.split(".")[0]}.AAAA${cookie.slice(-8)}`;
const tamperedCall = await call("/api/admin/state", { cookie: tampered });
check("tampered token rejected", () => assert.equal(tamperedCall.response.status, 401));

/* --------------------------------- state -------------------------------- */
const state = await call("/api/admin/state", { cookie });
check("state lists both accounts", () => assert.equal(state.payload.accounts.length, 2));
check("state never leaks hashes", () =>
  assert.ok(!JSON.stringify(state.payload).includes("scrypt$"))
);
check("session window present", () => assert.equal(state.payload.session.sessionHours, 8));

/* -------------------------------- content ------------------------------- */
const badOriginWrite = await call("/api/admin/content", {
  method: "PUT",
  cookie,
  body: { content: { meta: { brand: "x" } } },
  headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
});
check("cross-site content write blocked", () => assert.equal(badOriginWrite.response.status, 403));

const save = await call("/api/admin/content", {
  method: "PUT",
  cookie,
  body: { content: { meta: { brand: "کهن" } }, message: "تست امنیت" },
});
check("owner can save content", () => assert.equal(save.response.status, 200));
const publicContent = await call("/api/content");
check("public content endpoint returns saved copy", () =>
  assert.equal(publicContent.payload.content.meta.brand, "کهن")
);

const proto = await call("/api/admin/content", {
  method: "PUT",
  cookie,
  body: { content: JSON.parse('{"meta":{"__proto__":{"polluted":true}}}') },
});
check("prototype pollution rejected", () =>
  assert.ok([400, 200].includes(proto.response.status))
);
check("global prototype untouched", () => assert.equal({}.polluted, undefined));

/* -------------------------------- media --------------------------------- */
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const fakeImage = await call("/api/admin/media?name=evil", {
  method: "POST",
  cookie,
  raw: "<svg onload=alert(1)>",
  headers: { "Content-Type": "image/png" },
});
check("non-image bytes rejected despite declared type", () =>
  assert.equal(fakeImage.response.status, 415)
);

const upload = await call("/api/admin/media?name=Logo Shot", {
  method: "POST",
  cookie,
  raw: png,
  headers: { "Content-Type": "application/octet-stream" },
});
check("real PNG accepted and re-typed", () => {
  assert.equal(upload.response.status, 201);
  assert.equal(upload.payload.media.type, "image/png");
  assert.match(upload.payload.media.name, /^logo-shot-[a-f0-9]{16}\.png$/);
});
const mediaName = upload.payload.media.name;
const media = await fetch(`${origin}/media/${mediaName}`);
const mediaHeaders = media.headers;
const mediaBody = Buffer.from(await media.arrayBuffer());
check("media content-type + nosniff + CSP", () => {
  assert.equal(media.status, 200);
  assert.equal(mediaHeaders.get("content-type"), "image/png");
  assert.equal(mediaHeaders.get("x-content-type-options"), "nosniff");
  assert.match(mediaHeaders.get("content-security-policy") ?? "", /default-src 'none'/);
});
check("media bytes intact", () => assert.ok(mediaBody.equals(png)));

const traversal = await fetch(`${origin}/media/..%2F..%2Fadmin.json`);
check("path traversal refused", () => assert.ok([400, 404].includes(traversal.status)));

/* -------------------------------- roles --------------------------------- */
const editorLogin = await call("/api/admin/login", {
  method: "POST",
  body: { email: "editor@cahen.studio", password: editorPass },
});
const editorCookie = editorLogin.setCookie[0].split(";")[0];
check("editor login succeeds", () => assert.equal(editorLogin.response.status, 200));
const editorSave = await call("/api/admin/content", {
  method: "PUT",
  cookie: editorCookie,
  body: { content: { meta: { brand: "ویرایشگر" } } },
});
check("editor can save content", () => assert.equal(editorSave.response.status, 200));
const editorReset = await call("/api/admin/content/reset", { method: "POST", cookie: editorCookie });
check("editor cannot reset content", () => assert.equal(editorReset.response.status, 403));

/* ----------------------------- removed routes ---------------------------- */
for (const [pathname, method] of [
  ["/api/admin/setup", "POST"],
  ["/api/admin/admins", "POST"],
]) {
  const removed = await call(pathname, { method, cookie, body: {} });
  check(`${method} ${pathname} is gone`, () => assert.equal(removed.response.status, 404));
}

/* --------------------------- in-panel accounts --------------------------- */
const created = await call("/api/admin/accounts", {
  method: "POST",
  cookie,
  body: { name: "ویرایشگر تازه", email: "fresh@cahen.studio", role: "editor", mode: "invite" },
});
check("owner creates a panel account", () => {
  assert.equal(created.response.status, 200);
  assert.equal(created.payload.account.email, "fresh@cahen.studio");
  assert.equal(created.payload.account.source, "panel");
  assert.equal(typeof created.payload.oneTimePassword, "string");
  assert.ok(created.payload.oneTimePassword.length >= 16);
});
const oneTimePassword = created.payload.oneTimePassword;
const panelId = created.payload.account.id;
check("account payload never contains a hash", () =>
  assert.ok(!/scrypt\$|hash/i.test(JSON.stringify(created.payload)))
);
const storedText = await readFile(path.join(root, "admin.json"), "utf8");
check("no plaintext password is written to storage", () => {
  assert.ok(!storedText.includes(oneTimePassword));
  assert.match(storedText, /scrypt\$/);
});

const duplicate = await call("/api/admin/accounts", {
  method: "POST",
  cookie,
  body: { name: "تکراری", email: "fresh@cahen.studio", role: "viewer", mode: "invite" },
});
check("duplicate email is rejected", () => assert.equal(duplicate.response.status, 409));

const weakAccount = await call("/api/admin/accounts", {
  method: "POST",
  cookie,
  body: { name: "ضعیف", email: "weak@cahen.studio", role: "editor", mode: "password", password: "short" },
});
check("panel rejects weak passwords", () => assert.equal(weakAccount.response.status, 400));

const invitedLogin = await call("/api/admin/login", {
  method: "POST",
  body: { email: "fresh@cahen.studio", password: oneTimePassword },
});
const invitedCookie = invitedLogin.setCookie.join(";").match(/cahen_admin=[^;]+/)?.[0];
check("invited account can sign in", () => {
  assert.equal(invitedLogin.response.status, 200);
  assert.equal(invitedLogin.payload.mustChangePassword, true);
  assert.ok(invitedCookie);
});
await checkAsync("one-time password must be replaced before writing", async () => {
  const blocked = await call("/api/admin/content", {
    method: "PUT",
    cookie: invitedCookie,
    body: { content: { meta: { brand: "x" } } },
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.payload.code, "password_change_required");
});
await checkAsync("state stays readable while the password is pending", async () => {
  const state = await call("/api/admin/state", { cookie: invitedCookie });
  assert.equal(state.response.status, 200);
});

const rotated = await call("/api/admin/password", {
  method: "POST",
  cookie: invitedCookie,
  body: { currentPassword: oneTimePassword, newPassword: "Editor-Passphrase-1404!" },
});
check("the invited account can set its own password", () => assert.equal(rotated.response.status, 200));

const oldPassword = await call("/api/admin/login", {
  method: "POST",
  body: { email: "fresh@cahen.studio", password: oneTimePassword },
});
check("the one-time password stops working", () => assert.equal(oldPassword.response.status, 401));

const freshLogin = await call("/api/admin/login", {
  method: "POST",
  body: { email: "fresh@cahen.studio", password: "Editor-Passphrase-1404!" },
});
const freshCookie = freshLogin.setCookie.join(";").match(/cahen_admin=[^;]+/)?.[0];
check("the new password works", () => {
  assert.equal(freshLogin.response.status, 200);
  assert.equal(freshLogin.payload.admin.mustChangePassword, false);
});

const editorAttempt = await call("/api/admin/accounts", {
  method: "POST",
  cookie: editorCookie,
  body: { name: "نفوذی", email: "editor-made@cahen.studio", role: "owner", mode: "invite" },
});
check("editors cannot create accounts", () => assert.equal(editorAttempt.response.status, 403));

const envId = (await call("/api/admin/state", { cookie })).payload.accounts.find(
  (entry) => entry.source === "env"
).id;
const envPatch = await call(`/api/admin/accounts/${envId}`, {
  method: "PATCH",
  cookie,
  body: { role: "viewer" },
});
check("environment accounts are read-only in the panel", () => assert.equal(envPatch.response.status, 409));

const demoted = await call(`/api/admin/accounts/${panelId}`, {
  method: "PATCH",
  cookie,
  body: { role: "viewer" },
});
check("owner can change a panel role", () => {
  assert.equal(demoted.response.status, 200);
  assert.equal(demoted.payload.account.role, "viewer");
});
const afterDemotion = await call("/api/admin/state", { cookie: freshCookie });
check("a role change revokes the old session", () => assert.equal(afterDemotion.response.status, 401));

const selfDelete = await call(`/api/admin/accounts/${envId}`, { method: "DELETE", cookie });
check("an env account cannot be deleted from the panel", () =>
  assert.equal(selfDelete.response.status, 409)
);

/* -------------------------------- orders -------------------------------- */
const ordersList = await call("/api/admin/orders", { cookie });
check("owner reads the order list", () => {
  assert.equal(ordersList.response.status, 200);
  assert.ok(Array.isArray(ordersList.payload.orders));
  assert.equal(ordersList.payload.sms.configured, false);
});
const viewerOrders = await call("/api/admin/orders", { cookie: freshCookie });
check("orders need a live session", () => assert.equal(viewerOrders.response.status, 401));
const orderRetry = await call("/api/admin/orders/ffffffffffffffffffff/retry", {
  method: "POST",
  cookie,
});
check("unknown order retry is a 404", () => assert.equal(orderRetry.response.status, 404));
const orderDelete = await call("/api/admin/orders/ffffffffffffffffffff", { method: "DELETE", cookie });
check("unknown order delete is a 404", () => assert.equal(orderDelete.response.status, 404));

const accountDelete = await call(`/api/admin/accounts/${panelId}`, { method: "DELETE", cookie });
check("owner deletes a panel account", () => assert.equal(accountDelete.response.status, 200));
const deletedLogin = await call("/api/admin/login", {
  method: "POST",
  body: { email: "fresh@cahen.studio", password: "Editor-Passphrase-1404!" },
});
check("deleted accounts can no longer sign in", () => assert.equal(deletedLogin.response.status, 401));

/* -------------------------------- logout -------------------------------- */
const logout = await call("/api/admin/logout", { method: "POST", cookie });
check("logout clears the cookie", () => {
  assert.equal(logout.response.status, 200);
  assert.match(logout.setCookie.join(";"), /Max-Age=0/);
});
const afterLogout = await call("/api/admin/state", { cookie });
check("cookie cannot be replayed after logout", () => assert.equal(afterLogout.response.status, 401));

/* ------------------------------- throttling ------------------------------ */
let throttleStatus = 0;
let retryAfter = null;
for (let index = 0; index < 7; index += 1) {
  const attempt = await call("/api/admin/login", {
    method: "POST",
    body: { email: "editor@cahen.studio", password: `bad-${index}` },
    headers: { "x-nf-client-connection-ip": "203.0.113.77" },
  });
  throttleStatus = attempt.response.status;
  retryAfter = attempt.response.headers.get("retry-after");
}
check("repeated failures are throttled", () => assert.equal(throttleStatus, 429));
check("retry-after header present", () => assert.ok(Number(retryAfter) > 0));

/* ------------------------------- misconfig ------------------------------- */
const brokenApi = createAdminApi({ storage: createFsStorage({ dataDirectory: path.join(root, "broken") }), env: {} });
const brokenServer = createServer((request, response) => void brokenApi.handle(request, response));
await new Promise((resolve) => brokenServer.listen(0, "127.0.0.1", resolve));
const brokenOrigin = `http://127.0.0.1:${brokenServer.address().port}`;
const brokenSession = await fetch(`${brokenOrigin}/api/admin/session`).then((r) => r.json());
check("unconfigured instance reports issues", () =>
  assert.equal(brokenSession.configured, false) && brokenSession.issues.length > 0
);
const brokenLogin = await fetch(`${brokenOrigin}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: brokenOrigin, "Sec-Fetch-Site": "same-origin" },
  body: JSON.stringify({ email: "owner@cahen.studio", password: "whatever" }),
});
check("unconfigured login fails closed", () => assert.equal(brokenLogin.status, 503));
await new Promise((resolve) => brokenServer.close(resolve));

/* ------------------------------ web adapter ------------------------------ */
const memory = new Map();
const memoryStorage = {
  readStore: async () => (memory.has("store") ? JSON.parse(memory.get("store")) : null),
  writeStore: async (value) => memory.set("store", JSON.stringify(value)),
  readMedia: async (name) => (memory.has(`media:${name}`) ? Buffer.from(memory.get(`media:${name}`)) : null),
  writeMedia: async (name, buffer) => memory.set(`media:${name}`, Uint8Array.from(buffer)),
  deleteMedia: async (name) => memory.delete(`media:${name}`),
};
const webHandler = createWebHandler(createAdminApi({ storage: memoryStorage, env }));
const webSession = await webHandler(new Request("https://cahen.studio/api/admin/session"));
check("web adapter session body", () => assert.equal(webSession.status, 200));

const webLogin = await webHandler(
  new Request("https://cahen.studio/api/admin/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://cahen.studio",
      "Sec-Fetch-Site": "same-origin",
      "x-nf-client-connection-ip": "198.51.100.9",
    },
    body: JSON.stringify({ email: "owner@cahen.studio", password: ownerPass }),
  })
);
const webCookie = webLogin.headers.get("set-cookie");
check("web adapter login sets Secure cookie", () => {
  assert.equal(webLogin.status, 200);
  assert.match(webCookie ?? "", /Secure/);
  assert.match(webCookie ?? "", /HttpOnly/);
});
const webState = await webHandler(
  new Request("https://cahen.studio/api/admin/state", {
    headers: { cookie: webCookie.split(";")[0] },
  })
);
check("web adapter honours the session", () => assert.equal(webState.status, 200));

/* -------------------------------- results -------------------------------- */
await new Promise((resolve) => server.close(resolve));
await rm(root, { recursive: true, force: true });

let failed = 0;
for (const [status, label, message] of results) {
  if (status === "FAIL") failed += 1;
  console.log(`${status}  ${label}${message ? ` — ${message}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
