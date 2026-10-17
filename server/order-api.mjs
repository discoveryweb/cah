import { normalizePhoneNumber } from "../src/utils/phone.mjs";

const MELIPAYAMAK_ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/SendSMS";
const MAX_BODY_BYTES = 12 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 3;
const rateBuckets = new Map();
const DOCUMENTED_FAILURE_CODES = new Set([
  "0", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "14", "15", "16", "17", "18", "35",
  "-108", "-109", "-110",
]);

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
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const advertisedSize = Number(request.headers["content-length"] ?? 0);
  if (advertisedSize > MAX_BODY_BYTES) throw new RequestError(413, "payload_too_large", "درخواست بیش از حد بزرگ است.");

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RequestError(413, "payload_too_large", "درخواست بیش از حد بزرگ است.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "invalid_json", "ساختار درخواست معتبر نیست.");
  }
}

function isSameOrigin(request) {
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

function getClientAddress(request) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
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
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
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

function getConfiguration() {
  const username = String(process.env.MELIPAYAMAK_USERNAME ?? "").trim();
  const credential = String(process.env.MELIPAYAMAK_API_KEY || process.env.MELIPAYAMAK_PASSWORD || "").trim();
  const from = String(process.env.MELIPAYAMAK_FROM ?? "").trim();
  const managerPhone = normalizePhoneNumber(String(process.env.ORDER_MANAGER_PHONE ?? ""));
  if (!username || !credential || !from || !managerPhone) return null;

  // Melipayamak examples use the Iranian local form for mobile recipients.
  const to = managerPhone.startsWith("+98") ? `0${managerPhone.slice(3)}` : managerPhone.slice(1);
  return { username, credential, from, to };
}

function buildSmsText(lead) {
  const lines = [
    "درخواست همکاری جدید CAHEN",
    `نام: ${lead.name}`,
    lead.phone ? `شماره: ${lead.phone}` : null,
    lead.email ? `ایمیل: ${lead.email}` : null,
    lead.service ? `موضوع: ${lead.service}` : null,
    lead.message ? `توضیح: ${lead.message}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

function providerResponseIsSuccessful(responseText) {
  const text = responseText.trim();
  if (!text) return false;

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const status = parsed.RetStatus ?? parsed.retStatus ?? parsed.status;
      if (status !== undefined) return Number(status) === 1;
      const value = parsed.Value ?? parsed.value ?? parsed.ReturnValue ?? parsed.returnValue ?? parsed.SendSimpleSMS2Result;
      if (value !== undefined) return providerResponseIsSuccessful(String(value));
    }
  } catch {
    // The documented REST method may return a plain numeric RecId or an error code.
  }

  const value = text.match(/^-?\d+$/)?.[0] ?? text.match(/>(-?\d+)</)?.[1];
  if (!value) return false;
  if (DOCUMENTED_FAILURE_CODES.has(value)) return false;
  return Number(value) > 0;
}

async function sendManagerSms(lead, configuration, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  timeout.unref?.();
  const fields = new URLSearchParams({
    username: configuration.username,
    password: configuration.credential,
    to: configuration.to,
    from: configuration.from,
    text: buildSmsText(lead),
    isflash: "false",
  });

  try {
    const response = await fetchImpl(MELIPAYAMAK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", Accept: "application/json, text/plain, */*" },
      body: fields,
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (!response.ok || !providerResponseIsSuccessful(responseText)) {
      const error = new Error("Melipayamak rejected the notification request.");
      error.code = `provider_${response.status}`;
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function createOrderHandler({ fetchImpl = fetch } = {}) {
  return async (request, response, next) => {
    try {
      if (request.method !== "POST") {
        response.setHeader("Allow", "POST");
        return sendJson(response, 405, { ok: false, code: "method_not_allowed" });
      }
      if (!isSameOrigin(request)) return sendJson(response, 403, { ok: false, code: "origin_not_allowed" });
      if (!String(request.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
        return sendJson(response, 415, { ok: false, code: "json_required" });
      }

      const payload = await readJson(request);
      if (cleanText(payload?.website, 160)) return sendJson(response, 200, { ok: true });
      const lead = validatePayload(payload);
      const configuration = getConfiguration();
      if (!configuration) return sendJson(response, 503, { ok: false, code: "not_configured" });
      if (!checkRateLimit(getClientAddress(request))) return sendJson(response, 429, { ok: false, code: "rate_limited" });

      await sendManagerSms(lead, configuration, fetchImpl);
      return sendJson(response, 200, { ok: true });
    } catch (error) {
      if (error instanceof RequestError) {
        return sendJson(response, error.status, {
          ok: false,
          code: error.code,
          ...(error.fields ? { fields: error.fields } : {}),
        });
      }

      if (error?.name === "AbortError") {
        console.error("[collaboration-api] SMS provider request timed out");
      } else {
        console.error("[collaboration-api] SMS provider request failed", error?.code ?? error?.name ?? "unknown");
      }
      return sendJson(response, 502, { ok: false, code: "sms_provider_error" });
    }
  };
}
