/**
 * Order + SMS delivery checks. Run with `npm run sms:check`.
 * Melipayamak is never contacted: every call uses a stub fetch.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildOrderParts,
  providerResponseIsSuccessful,
  readSmsConfiguration,
  sendOrderSms,
} from "../server/order-sms.mjs";
import { createAdminApi } from "../server/admin-api.mjs";
import { createOrderHandler } from "../server/order-api.mjs";
import { appendOrder, readOrders, retryOrder, retryPendingOrders } from "../server/orders.mjs";
import { createFsStorage } from "../server/storage-fs.mjs";
import { createWebHandler } from "../server/web-adapter.mjs";

let passed = 0;
const failures = [];
const check = (name, fn) => {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
};
const checkAsync = async (name, fn) => {
  try {
    await fn();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
};

const configured = {
  MELIPAYAMAK_USERNAME: "studio",
  MELIPAYAMAK_API_KEY: "secret-key",
  MELIPAYAMAK_FROM: "30001234",
  ORDER_MANAGER_PHONE: "09121234567",
};

const order = {
  id: "a1b2c3d4e5f6a7b8c9d0",
  code: "C-A1B2C3",
  at: "2026-10-22T09:30:00.000Z",
  name: "سارا محمدی",
  phone: "+989121234567",
  email: "sara@example.com",
  service: "طراحی برند",
  message: "یک هویت بصری کامل برای استودیو می‌خواهم.",
};

const stubFetch = (answers, calls = []) => async (url, init) => {
  calls.push({ url, body: new URLSearchParams(String(init.body)) });
  const answer = answers[calls.length - 1] ?? answers[answers.length - 1];
  return new Response(String(answer ?? "1001"), { status: 200 });
};

check("configuration is incomplete without every key", () => {
  const config = readSmsConfiguration({});
  assert.equal(config.configured, false);
  assert.ok(config.missing.length >= 3);
});

check("configuration normalises the recipient to local form", () => {
  const config = readSmsConfiguration(configured);
  assert.equal(config.configured, true);
  assert.equal(config.to, "09121234567");
  assert.deepEqual(config.missing, []);
});

check("provider responses are classified", () => {
  assert.equal(providerResponseIsSuccessful("1234"), true);
  assert.equal(providerResponseIsSuccessful("2"), false);
  assert.equal(providerResponseIsSuccessful("-110"), false);
  assert.equal(providerResponseIsSuccessful('{"RetStatus":1,"Value":"9"}'), true);
  assert.equal(providerResponseIsSuccessful('{"RetStatus":-2}'), false);
  assert.equal(providerResponseIsSuccessful(""), false);
});

check("long orders split into numbered parts", () => {
  const parts = buildOrderParts({ ...order, message: "توضیح ".repeat(40) });
  assert.ok(parts.length > 1, "expected multiple parts");
  parts.forEach((part, index) => {
    assert.ok(part.startsWith(`${index + 1}/${parts.length}`), `part ${index + 1} prefix`);
    assert.ok(part.length <= 90, "part stays small enough for one SMS");
  });
});

await checkAsync("missing configuration queues instead of dropping the order", async () => {
  let called = false;
  const result = await sendOrderSms(order, {
    env: {},
    fetchImpl: async () => {
      called = true;
      return new Response("1");
    },
  });
  assert.equal(result.status, "pending");
  assert.equal(called, false);
  assert.equal(result.error, "sms_not_configured");
  assert.ok(result.missing.length > 0);
});

await checkAsync("configured send posts every field to Melipayamak", async () => {
  const calls = [];
  const result = await sendOrderSms(order, { env: configured, fetchImpl: stubFetch(["1001"], calls) });
  assert.equal(result.status, "sent");
  assert.equal(result.parts, calls.length);
  assert.equal(result.references.length, result.parts);
  assert.ok(calls.length >= 1);
  assert.match(calls[0].url, /rest\.payamak-panel\.com/);
  assert.equal(calls[0].body.get("username"), "studio");
  assert.equal(calls[0].body.get("password"), "secret-key");
  assert.equal(calls[0].body.get("to"), "09121234567");
  assert.equal(calls[0].body.get("from"), "30001234");
  const combined = calls.map((call) => call.body.get("text")).join("\n");
  assert.match(combined, /C-A1B2C3/);
  assert.match(combined, /09121234567/);
  assert.match(combined, /sara@example\.com/);
  assert.match(combined, /طراحی برند/);
});

await checkAsync("provider error code marks the order failed", async () => {
  const result = await sendOrderSms(order, { env: configured, fetchImpl: stubFetch(["2"]) });
  assert.equal(result.status, "failed");
  assert.equal(result.sentParts, 0);
  assert.equal(result.error, "provider_200");
});

await checkAsync("multi-part delivery records partial when a later part fails", async () => {
  const longOrder = { ...order, message: "توضیح ".repeat(40) };
  const calls = [];
  const result = await sendOrderSms(longOrder, {
    env: configured,
    fetchImpl: stubFetch(["1001", "0"], calls),
  });
  assert.ok(result.parts > 1);
  assert.equal(result.status, "partial");
  assert.equal(result.sentParts, 1);
  assert.equal(result.references.length, 1);
});

await checkAsync("network failure never throws", async () => {
  const result = await sendOrderSms(order, {
    env: configured,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error, "provider_unreachable");
});

const directory = mkdtempSync(path.join(tmpdir(), "cahen-orders-"));
const storage = createFsStorage({ dataDirectory: directory });

await checkAsync("orders are stored before delivery and keep their status", async () => {
  const pending = await appendOrder(storage, order);
  assert.match(pending.code, /^C-[0-9A-F]{6}$/);
  const stored = await readOrders(storage);
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].sms.status, "pending");

  const sent = await retryOrder(storage, pending.id, {
    env: configured,
    fetchImpl: stubFetch(["1001"]),
  });
  assert.equal(sent.sms.status, "sent");
  assert.equal(sent.sms.attempts, 1);
  assert.ok(sent.sms.sentAt);

  const again = await readOrders(storage);
  assert.equal(again.items[0].sms.status, "sent");
});

await checkAsync("a late configuration heals queued orders automatically", async () => {
  const pendingOrder = await appendOrder(storage, { ...order, phone: "+989121234569" });
  const beforeSend = await readOrders(storage);
  assert.equal(
    beforeSend.items.find((entry) => entry.id === pendingOrder.id).sms.status,
    "pending"
  );
  const sent = await retryPendingOrders(storage, {
    env: configured,
    fetchImpl: async () => new Response("1001", { status: 200 }),
  });
  assert.ok(sent >= 1);
  const afterSend = await readOrders(storage);
  assert.equal(afterSend.items.find((entry) => entry.id === pendingOrder.id).sms.status, "sent");
});

await checkAsync("a storage write is enough to keep the order when SMS is down", async () => {
  const created = await appendOrder(storage, { ...order, phone: "+989121234568" });
  const before = await readOrders(storage);
  assert.ok(before.items.some((entry) => entry.id === created.id));
});

/* --------------------------- public order endpoint -------------------------- */
const apiStorage = createFsStorage({ dataDirectory: path.join(directory, "api") });
const apiEnv = { ...configured, NETLIFY: "true" };
const handler = createOrderHandler({
  storage: apiStorage,
  env: apiEnv,
  fetchImpl: async () => new Response("1001", { status: 200 }),
});
const apiServer = createServer((request, response) => void handler(request, response));
await new Promise((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`;
let ipCounter = 0;
const post = async (payload, { origin = apiOrigin, ip = `198.51.100.${(ipCounter += 1)}` } = {}) => {
  const response = await fetch(`${apiOrigin}/api/collaboration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "x-nf-client-connection-ip": ip,
    },
    body: JSON.stringify(payload),
  });
  return { status: response.status, payload: await response.json() };
};

const valid = {
  name: "سارا محمدی",
  phone: "09121234567",
  email: "sara@example.com",
  service: "طراحی برند",
  message: "یک هویت بصری کامل.",
};

await checkAsync("public order is stored and texted", async () => {
  const result = await post(valid);
  assert.equal(result.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.queued, false);
  const stored = await readOrders(apiStorage);
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].sms.status, "sent");
});

await checkAsync("a repeat submission is flagged, not duplicated", async () => {
  const result = await post(valid);
  assert.equal(result.payload.duplicate, true);
  const stored = await readOrders(apiStorage);
  assert.equal(stored.items.length, 1);
});

await checkAsync("cross-site submissions are refused", async () => {
  const result = await post(valid, { origin: "https://evil.example" });
  assert.equal(result.status, 403);
  assert.equal(result.payload.code, "origin_not_allowed");
});

await checkAsync("invalid payloads return field errors", async () => {
  const result = await post({ name: "x", phone: "12" });
  assert.equal(result.status, 400);
  assert.equal(result.payload.code, "validation");
  assert.ok(result.payload.fields.phone);
});

await checkAsync("honeypot submissions are dropped silently", async () => {
  const before = (await readOrders(apiStorage)).items.length;
  const result = await post({ ...valid, website: "http://spam.example" });
  assert.equal(result.payload.ok, true);
  const stored = await readOrders(apiStorage);
  assert.equal(stored.items.length, before);
});

await checkAsync("orders survive a missing SMS configuration", async () => {
  const offline = createOrderHandler({
    storage: createFsStorage({ dataDirectory: path.join(directory, "offline") }),
    env: { NETLIFY: "true" },
  });
  const offlineServer = createServer((request, response) => void offline(request, response));
  await new Promise((resolve) => offlineServer.listen(0, "127.0.0.1", resolve));
  const offlineOrigin = `http://127.0.0.1:${offlineServer.address().port}`;
  const response = await fetch(`${offlineOrigin}/api/collaboration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: offlineOrigin,
      "x-nf-client-connection-ip": "198.51.100.90",
    },
    body: JSON.stringify(valid),
  });
  const payload = await response.json();
  await new Promise((resolve) => offlineServer.close(resolve));
  assert.equal(response.status, 200);
  assert.equal(payload.queued, true);
  const stored = await readOrders(createFsStorage({ dataDirectory: path.join(directory, "offline") }));
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].sms.status, "pending");
  assert.equal(stored.items[0].sms.error, "sms_not_configured");
});

await checkAsync("the Netlify adapter answers unknown API routes with 404", async () => {
  const memory = {
    readStore: async () => null,
    writeStore: async () => undefined,
    readJson: async () => null,
    writeJson: async () => undefined,
    updateJson: async (_key, updater) => updater(null),
    readMedia: async () => null,
    writeMedia: async () => undefined,
    deleteMedia: async () => undefined,
  };
  const handler = createWebHandler(createAdminApi({ storage: memory, env: { ...configured } }), {
    orderHandler: createOrderHandler({ storage: memory, env: configured }),
  });
  const response = await handler(new Request("https://cahen.studio/api/does-not-exist"));
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "not_found");

  const wrongMethod = await handler(new Request("https://cahen.studio/api/collaboration"));
  assert.equal(wrongMethod.status, 405);
});

await checkAsync("a Netlify context sends the SMS after the response", async () => {
  const documents = new Map();
  const memory = {
    readStore: async () => documents.get("store") ?? null,
    writeStore: async (value) => documents.set("store", value),
    readJson: async (key) => documents.get(key) ?? null,
    writeJson: async (key, value) => documents.set(key, value),
    updateJson: async (key, updater) => {
      const next = updater(documents.get(key) ?? null);
      documents.set(key, next);
      return next;
    },
    readMedia: async () => null,
    writeMedia: async () => undefined,
    deleteMedia: async () => undefined,
  };
  const webEnv = { ...configured, NETLIFY: "true" };
  const handler = createWebHandler(createAdminApi({ storage: memory, env: webEnv }), {
    orderHandler: createOrderHandler({
      storage: memory,
      env: webEnv,
      fetchImpl: async () => new Response("1001", { status: 200 }),
    }),
  });
  const background = [];
  const response = await handler(
    new Request("https://cahen.studio/api/collaboration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://cahen.studio",
        "x-nf-client-connection-ip": "198.51.100.51",
      },
      body: JSON.stringify({ ...valid, phone: "09121234111" }),
    }),
    { waitUntil: (promise) => background.push(promise) }
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).queued, true);
  assert.equal(background.length, 1);
  await Promise.all(background);
  const stored = await readOrders(memory);
  assert.equal(stored.items[0].sms.status, "sent");
});

await checkAsync("the Netlify web adapter routes /api/collaboration", async () => {
  const documents = new Map();
  const memory = {
    readStore: async () => documents.get("store") ?? null,
    writeStore: async (value) => documents.set("store", value),
    readJson: async (key) => documents.get(key) ?? null,
    writeJson: async (key, value) => documents.set(key, value),
    updateJson: async (key, updater) => {
      const next = updater(documents.get(key) ?? null);
      documents.set(key, next);
      return next;
    },
    readMedia: async () => null,
    writeMedia: async () => undefined,
    deleteMedia: async () => undefined,
  };
  const webEnv = { ...configured, NETLIFY: "true" };
  const adminApi = createAdminApi({ storage: memory, env: webEnv });
  const handler = createWebHandler(adminApi, {
    orderHandler: createOrderHandler({
      storage: memory,
      env: webEnv,
      fetchImpl: async () => new Response("1001", { status: 200 }),
    }),
  });
  const response = await handler(
    new Request("https://cahen.studio/api/collaboration", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://cahen.studio",
        "x-nf-client-connection-ip": "198.51.100.40",
      },
      body: JSON.stringify({ ...valid, phone: "09121234000" }),
    })
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.queued, false);
  const stored = await readOrders(memory);
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].sms.status, "sent");
});

await new Promise((resolve) => apiServer.close(resolve));

rmSync(directory, { recursive: true, force: true });

if (failures.length) {
  console.error(`\n${failures.length} failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`SMS + order checks: ${passed}/${passed} passed`);
