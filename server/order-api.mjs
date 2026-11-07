import path from "node:path";
import { normalizePhoneNumber } from "../src/utils/phone.mjs";
import { appendOrder, deliverOrder, readOrders } from "./orders.mjs";
import { createFsStorage } from "./storage-fs.mjs";

const MAX_BODY_BYTES = 12 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 3;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const rateBuckets = new Map();

class RequestError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const advertisedSize = Number(request.headers["content-length"] ?? 0);
  if (advertisedSize > MAX_BODY_BYTES) {
    throw new RequestError(413, "payload_too_large", "درخواست بیش از حد بزرگ است.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new RequestError(413, "payload_too_large", "درخواست بیش از حد بزرگ است.");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "invalid_json", "ساختار درخواست معتبر نیست.");
  }
}

function headerValue(request, name) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function isSameOrigin(request) {
  const origin = headerValue(request, "origin");
  if (!origin) return true;
  const host = String(headerValue(request, "host") ?? "").toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function getClientAddress(request, env) {
  const trustProxy =
    String(env.TRUST_PROXY ?? "").toLowerCase() === "true" ||
    Boolean(env.NETLIFY) ||
    Boolean(env.NETLIFY_BLOBS_CONTEXT) ||
    Boolean(env.SITE_ID);
  if (trustProxy) {
    const netlify = headerValue(request, "x-nf-client-connection-ip");
    if (netlify) return String(netlify).split(",")[0].trim().slice(0, 100);
    const forwarded = String(headerValue(request, "x-forwarded-for") ?? "").split(",")[0].trim();
    if (forwarded) return forwarded.slice(0, 100);
  }
  return String(request.socket?.remoteAddress ?? "unknown").slice(0, 100);
}

function checkRateLimit(address, now = Date.now()) {
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (rateBuckets.get(address) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= RATE_LIMIT) {
    rateBuckets.set(address, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(address, recent);

  if (rateBuckets.size > 4000) {
    for (const [key, timestamps] of rateBuckets) {
      if (!timestamps.some((timestamp) => timestamp > cutoff)) rateBuckets.delete(key);
    }
  }
  return true;
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new RequestError(400, "invalid_payload", "اطلاعات درخواست معتبر نیست.");
  }

  const name = cleanText(payload.name, 80);
  const rawPhone = cleanText(payload.phone, 40);
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : "";
  const email = cleanText(payload.email, 254).toLowerCase();
  const service = cleanText(payload.service, 80);
  const message = cleanText(payload.message, 400);
  const fields = {};

  if (name.length < 2) fields.name = "نام را وارد کنید.";
  if (!rawPhone) fields.phone = "شمارهٔ موبایل را وارد کنید.";
  else if (!phone) fields.phone = "شمارهٔ تماس معتبر نیست.";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "نشانی ایمیل معتبر نیست.";
  if (String(payload.message ?? "").length > 400) fields.message = "توضیح از سقف مجاز طولانی‌تر است.";

  if (Object.keys(fields).length) {
    throw new RequestError(400, "validation", "بعضی اطلاعات نیاز به اصلاح دارد.", fields);
  }
  return { name, phone, email, service, message };
}

const isRecentDuplicate = (orders, phone, now = Date.now()) =>
  orders.items.some(
    (entry) =>
      entry.phone === phone &&
      entry.sms?.status !== "failed" &&
      now - new Date(entry.at).getTime() < DUPLICATE_WINDOW_MS
  );

export function createOrderHandler({
  storage,
  root = process.cwd(),
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  const activeStorage =
    storage ?? createFsStorage({ dataDirectory: path.join(root, "data") });

  return async (request, response, context) => {
    try {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        return sendJson(response, 405, { ok: false, code: "method_not_allowed" });
      }
      if (!isSameOrigin(request)) {
        return sendJson(response, 403, { ok: false, code: "origin_not_allowed" });
      }
      if (!String(headerValue(request, "content-type") ?? "").toLowerCase().includes("application/json")) {
        return sendJson(response, 415, { ok: false, code: "json_required" });
      }

      const payload = await readJson(request);
      // Honeypot field: bots fill it, humans never see it.
      if (cleanText(payload?.website, 160)) return sendJson(response, 200, { ok: true });

      const lead = validatePayload(payload);
      if (!checkRateLimit(getClientAddress(request, env))) {
        return sendJson(response, 429, { ok: false, code: "rate_limited" });
      }

      const orders = await readOrders(activeStorage);
      if (isRecentDuplicate(orders, lead.phone)) {
        return sendJson(response, 200, { ok: true, duplicate: true });
      }

      const order = await appendOrder(activeStorage, lead);

      // The order is stored before this point; a provider problem only changes
      // its delivery status, which the panel surfaces with a retry action.
      const delivery = deliverOrder(activeStorage, order, { env, fetchImpl }).catch((error) => {
        console.error("[collaboration-api] delivery failed", error?.code ?? error?.name ?? "unknown");
        return null;
      });

      // On Netlify the function has a `waitUntil` context: answer the visitor
      // immediately and keep sending the SMS parts in the background. This
      // keeps the request well below the rewrite/execution timeouts.
      if (typeof context?.waitUntil === "function") {
        context.waitUntil(delivery);
        return sendJson(response, 200, { ok: true, queued: true });
      }

      const delivered = await delivery;
      return sendJson(response, 200, {
        ok: true,
        queued: delivered ? delivered.sms?.status !== "sent" : true,
      });
    } catch (error) {
      if (error instanceof RequestError) {
        return sendJson(response, error.status, {
          ok: false,
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        });
      }
      console.error("[collaboration-api]", error?.code ?? error?.name ?? "unknown");
      return sendJson(response, 500, { ok: false, code: "server_error" });
    }
  };
}
