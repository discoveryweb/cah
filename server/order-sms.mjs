import { normalizePhoneNumber } from "../src/utils/phone.mjs";

const MELIPAYAMAK_ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/SendSMS";
const PART_LIMIT = 60;
const DOCUMENTED_FAILURE_CODES = new Set([
  "0", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "14", "15", "16", "17", "18", "35",
  "-108", "-109", "-110",
]);

/** Reads Melipayamak credentials + the manager recipient from the environment. */
export function readSmsConfiguration(env = process.env) {
  const username = String(env.MELIPAYAMAK_USERNAME ?? "").trim();
  const credential = String(
    env.MELIPAYAMAK_API_KEY || env.MELIPAYAMAK_PASSWORD || ""
  ).trim();
  const from = String(env.MELIPAYAMAK_FROM ?? "").trim();
  const manager = normalizePhoneNumber(String(env.ORDER_MANAGER_PHONE ?? ""));

  const missing = [];
  if (!String(env.ORDER_MANAGER_PHONE ?? "").trim()) missing.push("شمارهٔ دریافت‌کننده");
  else if (!manager) missing.push("شمارهٔ دریافت‌کنندهٔ معتبر");
  if (!username) missing.push("نام کاربری ملی‌پیامک");
  if (!credential) missing.push("کلید یا گذرواژهٔ ملی‌پیامک");
  if (!from) missing.push("شمارهٔ فرستنده");

  return {
    configured: missing.length === 0,
    missing,
    username,
    credential,
    from,
    // Melipayamak expects the local Iranian form for mobile recipients.
    to: manager.startsWith("+98") ? `0${manager.slice(3)}` : manager.replace(/^\+/, ""),
  };
}

const persianDate = (value) => {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Tehran",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

/** Every field of the order, in the order an operator wants to read it. */
export function buildOrderLines(order) {
  const phone = order.phone ? order.phone.replace(/^\+98/, "0") : "";
  return [
    "سفارش تازه کاهن",
    `کد: ${order.code}`,
    `نام: ${order.name}`,
    phone ? `موبایل: ${phone}` : null,
    order.email ? `ایمیل: ${order.email}` : null,
    order.service ? `خدمت: ${order.service}` : null,
    order.message ? `توضیح: ${order.message}` : null,
    `زمان: ${persianDate(order.at)}`,
  ].filter(Boolean);
}

/**
 * Splits the message into provider-friendly parts. Iranian SMS pricing counts
 * 70 Persian characters per part, so a full lead normally takes two or three.
 */
export function buildOrderParts(order, limit = PART_LIMIT) {
  const lines = buildOrderLines(order);
  const chunks = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const line of lines) {
    if (line.length <= limit) {
      if (!current) current = line;
      else if (`${current}\n${line}`.length <= limit) current = `${current}\n${line}`;
      else {
        flush();
        current = line;
      }
      continue;
    }
    // Very long single values (a project description) are split on spaces.
    flush();
    let rest = line;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf(" ", limit);
      if (cut < 20) cut = limit;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    current = rest;
  }
  flush();

  const total = chunks.length || 1;
  return (chunks.length ? chunks : [""]).map((chunk, index) =>
    total > 1 ? `${index + 1}/${total}\n${chunk}` : chunk
  );
}

export function providerResponseIsSuccessful(responseText) {
  const text = String(responseText ?? "").trim();
  if (!text) return false;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const status = parsed.RetStatus ?? parsed.retStatus ?? parsed.status;
      if (status !== undefined) return Number(status) === 1;
      const value =
        parsed.Value ?? parsed.value ?? parsed.ReturnValue ?? parsed.returnValue ?? parsed.SendSimpleSMS2Result;
      if (value !== undefined) return providerResponseIsSuccessful(String(value));
    }
  } catch {
    // The REST method may return a bare numeric id or error code.
  }
  const value = text.match(/^-?\d+$/)?.[0] ?? text.match(/>(-?\d+)</)?.[1];
  if (!value) return false;
  if (DOCUMENTED_FAILURE_CODES.has(value)) return false;
  return Number(value) > 0;
}

async function sendPart(part, configuration, fetchImpl, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const fields = new URLSearchParams({
      username: configuration.username,
      password: configuration.credential,
      to: configuration.to,
      from: configuration.from,
      text: part,
      isflash: "false",
    });
    const response = await fetchImpl(MELIPAYAMAK_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/plain, */*",
      },
      body: fields,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok || !providerResponseIsSuccessful(text)) {
      return { ok: false, error: `provider_${response.status}` };
    }
    return { ok: true, reference: text.trim().slice(0, 40) };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === "AbortError" ? "provider_timeout" : "provider_unreachable",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Sends every part of the order to the manager. Never throws: the caller stores
 * the outcome so an order is never lost because SMS failed.
 */
export async function sendOrderSms(order, { env = process.env, fetchImpl = fetch } = {}) {
  const configuration = readSmsConfiguration(env);
  if (!configuration.configured) {
    return {
      status: "pending",
      parts: 0,
      sentParts: 0,
      error: "sms_not_configured",
      missing: configuration.missing,
      references: [],
    };
  }

  const parts = buildOrderParts(order);
  const references = [];
  for (let index = 0; index < parts.length; index += 1) {
    const result = await sendPart(parts[index], configuration, fetchImpl);
    if (!result.ok) {
      return {
        status: index === 0 ? "failed" : "partial",
        parts: parts.length,
        sentParts: index,
        error: result.error,
        missing: [],
        references,
      };
    }
    references.push(result.reference);
  }

  return {
    status: "sent",
    parts: parts.length,
    sentParts: parts.length,
    error: null,
    missing: [],
    references,
  };
}

export { MELIPAYAMAK_ENDPOINT, PART_LIMIT };
