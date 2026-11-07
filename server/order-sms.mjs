import { normalizePhoneNumber } from "../src/utils/phone.mjs";

/**
 * Melipayamak, pattern (الگو) channel.
 *
 * The studio's line is a BaseServiceNumber pattern, not free text: the provider
 * holds the copy and this site only fills its slots. The published pattern is
 *
 *   درخواست همکاری جدید CAHEN
 *   نام: {0}
 *   موبایل: {1}
 *   CAHEN
 *
 * so exactly two values travel, in that order: the name typed into the form and
 * the mobile typed into the form. The recipient is the studio's own number.
 */
const MELIPAYAMAK_PATTERN_ENDPOINT = "https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber";

/**
 * Slot order, as the pattern above declares it. `{0}` is the name, `{1}` the
 * mobile. Anything that changes this array changes the text a reader receives,
 * so it is asserted by `npm run sms:check`.
 */
export const PATTERN_SLOTS = ["name", "phone"];

/** The longest value a pattern slot can carry without being rejected. */
const SLOT_LIMIT = 60;

const DOCUMENTED_FAILURE_CODES = new Set([
  "0", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "14", "15", "16", "17", "18", "35",
  "-108", "-109", "-110",
]);

/** Reads the pattern credentials + the recipient from the environment. */
export function readSmsConfiguration(env = process.env) {
  const username = String(env.MELIPAYAMAK_USERNAME ?? "").trim();
  const credential = String(
    env.MELIPAYAMAK_API_KEY || env.MELIPAYAMAK_PASSWORD || ""
  ).trim();
  const patternCode = String(env.MELIPAYAMAK_PATTERN_CODE ?? "").trim();
  const manager = normalizePhoneNumber(String(env.ORDER_MANAGER_PHONE ?? ""));

  const missing = [];
  if (!String(env.ORDER_MANAGER_PHONE ?? "").trim()) missing.push("شمارهٔ دریافت‌کننده");
  else if (!manager) missing.push("شمارهٔ دریافت‌کنندهٔ معتبر");
  if (!username) missing.push("نام کاربری ملی‌پیامک");
  if (!credential) missing.push("کلید یا گذرواژهٔ ملی‌پیامک");
  if (!patternCode) missing.push("کد الگوی ملی‌پیامک");

  return {
    configured: missing.length === 0,
    missing,
    username,
    credential,
    patternCode,
    // Melipayamak expects the local Iranian form for mobile recipients.
    to: manager.startsWith("+98") ? `0${manager.slice(3)}` : manager.replace(/^\+/, ""),
  };
}

/** A pattern slot is one line of text: no separators, no control characters. */
export function patternValue(value, limit = SLOT_LIMIT) {
  return String(value ?? "")
    // `;` separates the slots on the wire, so it can never reach the provider.
    .replace(/[;؛]/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, limit)
    .trim();
}

/**
 * The two slot values, in the order the pattern declares them.
 * `{0}` — the name as typed in the form. `{1}` — the mobile as typed in the form,
 * in the local `09…` form the provider expects.
 */
export function buildPatternValues(order) {
  const phone = normalizePhoneNumber(String(order.phone ?? ""));
  return {
    name: patternValue(order.name),
    phone: patternValue(phone.startsWith("+98") ? `0${phone.slice(3)}` : phone.replace(/^\+/, "")),
  };
}

/** `{0};{1}` — the wire format Melipayamak expects for a pattern body. */
export const patternText = (values) => PATTERN_SLOTS.map((slot) => values[slot]).join(";");

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
    // A rejected pattern can come back as a bare numeric code.
  }
  const value = text.match(/^-?\d+$/)?.[0] ?? text.match(/>(-?\d+)</)?.[1];
  if (!value) return false;
  if (DOCUMENTED_FAILURE_CODES.has(value)) return false;
  return Number(value) > 0;
}

/** The provider's message id, when it sends one back. */
const providerReference = (responseText) => {
  const text = String(responseText ?? "").trim();
  try {
    const parsed = JSON.parse(text);
    const value = parsed?.Value ?? parsed?.value ?? parsed?.recId ?? parsed?.RecId;
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim().slice(0, 40);
    }
  } catch {
    // Not JSON: a bare id is used as is.
  }
  return text.slice(0, 40);
};

async function sendPattern(text, configuration, fetchImpl, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  timeout.unref?.();
  try {
    const fields = new URLSearchParams({
      username: configuration.username,
      password: configuration.credential,
      text,
      bodyId: configuration.patternCode,
      to: configuration.to,
    });
    const response = await fetchImpl(MELIPAYAMAK_PATTERN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Accept: "application/json, text/plain, */*",
      },
      body: fields,
      signal: controller.signal,
    });
    const answer = await response.text();
    if (!response.ok || !providerResponseIsSuccessful(answer)) {
      return { ok: false, error: `provider_${response.status}` };
    }
    return { ok: true, reference: providerReference(answer) };
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
 * Sends the pattern to the studio. Never throws: the caller stores the outcome,
 * so an order is never lost because an SMS failed.
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

  // Nothing to send without the two values the pattern promises to show.
  const values = buildPatternValues(order);
  if (!values.name || !values.phone) {
    return {
      status: "pending",
      parts: 0,
      sentParts: 0,
      error: "sms_missing_values",
      missing: [!values.name ? "نام" : null, !values.phone ? "موبایل" : null].filter(Boolean),
      references: [],
    };
  }

  const result = await sendPattern(patternText(values), configuration, fetchImpl);
  if (!result.ok) {
    return {
      status: "failed",
      parts: 1,
      sentParts: 0,
      error: result.error,
      missing: [],
      references: [],
    };
  }

  return {
    status: "sent",
    parts: 1,
    sentParts: 1,
    error: null,
    missing: [],
    references: [result.reference],
  };
}

export { MELIPAYAMAK_PATTERN_ENDPOINT };
