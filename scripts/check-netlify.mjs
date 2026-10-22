/**
 * Offline verification of the Netlify deployment.
 *
 *   npm run netlify:check
 *
 * 1. Checks the pieces of netlify.toml that break a deploy when wrong
 *    (redirect order, functions directory, Node version).
 * 2. Bundles the functions with the same esbuild setup Netlify uses.
 * 3. Runs the bundled function against a mock Netlify Blobs edge API and a
 *    Netlify-style Request/Response pair, covering the routes the live site
 *    depends on: session, login, content, media, orders and 404 handling.
 *
 * No network access and no Netlify account are required.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = process.cwd();
const outDir = path.join(root, ".netlify-check");
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

/* ----------------------------- configuration ---------------------------- */

const toml = await readFile(path.join(root, "netlify.toml"), "utf8");
check("netlify.toml pins Node 22", () => assert.match(toml, /NODE_VERSION = "22"/));
check("netlify.toml points at the functions directory", () =>
  assert.match(toml, /directory = "netlify\/functions"/)
);
check("netlify.toml builds the Vite output", () =>
  assert.match(toml, /command = "npm run build"/) && assert.match(toml, /publish = "dist"/)
);
check("API rewrites are listed before the SPA fallback", () => {
  const api = toml.indexOf('from = "/api/*"');
  const media = toml.indexOf('from = "/media/*"');
  const spa = toml.indexOf('from = "/*"');
  assert.ok(api > 0 && media > api && spa > media, "redirect order must be api, media, spa");
});
check("API rewrites forward to the function", () => {
  assert.match(toml, /to = "\/\.netlify\/functions\/admin\/api\/:splat"/);
  assert.match(toml, /to = "\/\.netlify\/functions\/admin\/media\/:splat"/);
});
check("control room is served by the SPA fallback", () =>
  assert.match(toml, /from = "\/shenataisoni"/)
);
check("security headers are declared", () => {
  assert.match(toml, /Content-Security-Policy/);
  assert.match(toml, /Strict-Transport-Security/);
  assert.match(toml, /X-Frame-Options/);
});

/* ------------------------------- bundling -------------------------------- */

await rm(outDir, { recursive: true, force: true });
const buildOptions = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "silent",
  sourcemap: false,
};
await build({
  ...buildOptions,
  entryPoints: [path.join(root, "netlify/functions/admin.mjs")],
  outfile: path.join(outDir, "admin.mjs"),
});
await build({
  ...buildOptions,
  entryPoints: [path.join(root, "netlify/functions/retry-orders.mjs")],
  outfile: path.join(outDir, "retry-orders.mjs"),
});
check("both functions bundle with esbuild", () => assert.ok(true));

/* ------------------------------ mock blobs ------------------------------- */

const blobs = new Map();
const blobServer = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const key = decodeURIComponent(url.pathname);
  if (request.method === "PUT") {
    blobs.set(key, { body, type: request.headers["content-type"] ?? "application/octet-stream" });
    response.writeHead(200).end();
    return;
  }
  if (request.method === "DELETE") {
    blobs.delete(key);
    response.writeHead(204).end();
    return;
  }
  const item = blobs.get(key);
  if (!item) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": item.type }).end(item.body);
});
const port = await new Promise((resolve) => {
  blobServer.listen(0, "127.0.0.1", () => resolve(blobServer.address().port));
});
const edgeURL = `http://127.0.0.1:${port}`;

process.env.ADMIN_EMAIL = "owner@cahen.studio";
process.env.ADMIN_NAME = "مالک";
process.env.ADMIN_PASSWORD = "Studio-Passphrase-1404!";
process.env.ADMIN_SESSION_SECRET = "s".repeat(48);
process.env.ADMIN_BLOB_STORE = "cahen-admin";
process.env.NETLIFY = "true";
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({ siteID: "site-test", token: "token-test", edgeURL, uncachedEdgeURL: edgeURL })
).toString("base64");
delete process.env.MELIPAYAMAK_USERNAME;
delete process.env.MELIPAYAMAK_API_KEY;
delete process.env.MELIPAYAMAK_PASSWORD;
delete process.env.MELIPAYAMAK_FROM;
delete process.env.ORDER_MANAGER_PHONE;

const adminModule = await import(pathToFileURL(path.join(outDir, "admin.mjs")).href);
const invite = (pathname, init = {}) => new Request(`https://cahen.netlify.app${pathname}`, init);
const jsonInit = (method, body, headers = {}) => ({
  method,
  headers: {
    "Content-Type": "application/json",
    Origin: "https://cahen.netlify.app",
    "Sec-Fetch-Site": "same-origin",
    "x-nf-client-connection-ip": "198.51.100.10",
    ...headers,
  },
  body: JSON.stringify(body),
});

/* --------------------------- serverless flows ---------------------------- */

const sessionResponse = await adminModule.default(invite("/api/admin/session"));
const sessionPayload = await sessionResponse.json();
await checkAsync("session route runs through the web adapter", async () => {
  assert.equal(sessionResponse.status, 200);
  assert.equal(sessionPayload.configured, true);
  assert.equal(sessionPayload.admin, null);
  assert.equal(sessionResponse.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(sessionResponse.headers.get("x-content-type-options"), "nosniff");
});

const loginResponse = await adminModule.default(
  invite("/api/admin/login", jsonInit("POST", { email: "owner@cahen.studio", password: "Studio-Passphrase-1404!" }))
);
const loginPayload = await loginResponse.json();
const cookie = (loginResponse.headers.getSetCookie?.() ?? []).map((value) => value.split(";")[0]).join("; ");
await checkAsync("login sets an HttpOnly session cookie", async () => {
  assert.equal(loginResponse.status, 200, JSON.stringify(loginPayload));
  assert.equal(loginPayload.admin.email, "owner@cahen.studio");
  assert.match(loginResponse.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(loginResponse.headers.get("set-cookie") ?? "", /Secure/);
  assert.ok(cookie);
});

const stateResponse = await adminModule.default(
  invite("/api/admin/state", { headers: { cookie } })
);
const statePayload = await stateResponse.json();
await checkAsync("admin state is served from Blobs", async () => {
  assert.equal(stateResponse.status, 200, JSON.stringify(statePayload));
  assert.equal(statePayload.admin.email, "owner@cahen.studio");
  assert.equal(statePayload.sms.configured, false);
});

const saveResponse = await adminModule.default(
  invite(
    "/api/admin/content",
    jsonInit("PUT", { content: { meta: { brand: "کهن آزمون" } } }, { cookie })
  )
);
await checkAsync("content saves into Blobs", async () => {
  assert.equal(saveResponse.status, 200, JSON.stringify(await saveResponse.clone().json()));
  const stored = [...blobs.keys()].find((key) => key.endsWith("/admin.json"));
  assert.ok(stored, "admin.json blob exists");
  const value = JSON.parse(blobs.get(stored).body.toString("utf8"));
  assert.equal(value.content.meta.brand, "کهن آزمون");
});

const publicContent = await adminModule.default(invite("/api/content"));
const publicPayload = await publicContent.json();
await checkAsync("public content reads back the saved value", async () => {
  assert.equal(publicContent.status, 200);
  assert.equal(publicPayload.content.meta.brand, "کهن آزمون");
});

const orderBackground = [];
const orderResponse = await adminModule.default(
  invite(
    "/api/collaboration",
    jsonInit("POST", {
      name: "سارا محمدی",
      phone: "09121234567",
      email: "sara@example.com",
      service: "طراحی برند",
      message: "یک هویت بصری کامل.",
    })
  ),
  { waitUntil: (promise) => orderBackground.push(promise) }
);
const orderPayload = await orderResponse.json();
await checkAsync("orders are accepted without SMS settings", async () => {
  assert.equal(orderResponse.status, 200, JSON.stringify(orderPayload));
  assert.equal(orderPayload.ok, true);
  assert.equal(orderPayload.queued, true);
  assert.equal(orderBackground.length, 1);
  await Promise.all(orderBackground);
  const stored = [...blobs.keys()].find((key) => key.endsWith("/orders.json"));
  assert.ok(stored, "orders.json blob exists");
  const value = JSON.parse(blobs.get(stored).body.toString("utf8"));
  assert.equal(value.items.length, 1);
  assert.equal(value.items[0].sms.status, "pending");
});

const ordersResponse = await adminModule.default(invite("/api/admin/orders", { headers: { cookie } }));
const ordersPayload = await ordersResponse.json();
await checkAsync("the panel can read the queued order", async () => {
  assert.equal(ordersResponse.status, 200);
  assert.equal(ordersPayload.total, 1);
  assert.equal(ordersPayload.sms.configured, false);
});

const rewritten = await adminModule.default(
  invite("/.netlify/functions/admin/api/admin/session", { headers: { cookie } })
);
await checkAsync("rewritten function URLs are normalised", async () => {
  assert.equal(rewritten.status, 200);
  const payload = await rewritten.json();
  assert.equal(payload.configured, true);
  assert.equal(payload.admin.email, "owner@cahen.studio");
});

const missingMedia = await adminModule.default(invite("/media/missing.png"));
await checkAsync("missing media returns a JSON 404", async () => {
  assert.equal(missingMedia.status, 404);
  assert.equal((await missingMedia.json()).code, "not_found");
});

const unknownApi = await adminModule.default(invite("/api/unknown-route"));
await checkAsync("unknown API routes return 404, not an empty 200", async () => {
  assert.equal(unknownApi.status, 404);
  assert.equal((await unknownApi.json()).code, "not_found");
});

const wrongMethod = await adminModule.default(invite("/api/collaboration"));
await checkAsync("non-POST order requests return 405", () =>
  assert.equal(wrongMethod.status, 405)
);

// A storage outage must degrade to the built-in defaults instead of 500s.
const savedContext = process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.NETLIFY_BLOBS_CONTEXT;
const outageModule = await import(
  `${pathToFileURL(path.join(outDir, "admin.mjs")).href}?outage=1`
);
const outageSession = await outageModule.default(invite("/api/admin/session"));
await checkAsync("a storage outage reports setup work, not a crash", async () => {
  assert.equal(outageSession.status, 200);
  const payload = await outageSession.json();
  assert.equal(payload.configured, false);
  assert.ok(payload.issues.length > 0);
});
const outageContent = await outageModule.default(invite("/api/content"));
await checkAsync("public content falls back to defaults during an outage", async () => {
  assert.equal(outageContent.status, 200);
  assert.equal((await outageContent.json()).content, null);
});
const outageLogin = await outageModule.default(
  invite("/api/admin/login", jsonInit("POST", { email: "owner@cahen.studio", password: "Studio-Passphrase-1404!" }))
);
await checkAsync("login reports storage_unavailable with 503", async () => {
  assert.equal(outageLogin.status, 503);
  assert.equal((await outageLogin.json()).code, "storage_unavailable");
});
process.env.NETLIFY_BLOBS_CONTEXT = savedContext;

/* --------------------------- scheduled function -------------------------- */

const retryModule = await import(pathToFileURL(path.join(outDir, "retry-orders.mjs")).href);
await checkAsync("the scheduled retry function is configured and safe to run", async () => {
  assert.equal(retryModule.config.schedule, "@hourly");
  await retryModule.default(new Request("https://cahen.netlify.app/"));
});

/* --------------------------------- cleanup ------------------------------- */

await new Promise((resolve) => blobServer.close(resolve));
await rm(outDir, { recursive: true, force: true });

let failed = 0;
for (const [status, label, message] of results) {
  if (status === "FAIL") failed += 1;
  console.log(`${status}  ${label}${message ? ` — ${message}` : ""}`);
}
console.log(`\n${results.length - failed}/${results.length} Netlify checks passed`);
process.exit(failed ? 1 : 0);
