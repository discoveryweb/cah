const DIGIT_MAP = new Map([
  ...Array.from("۰۱۲۳۴۵۶۷۸۹", (digit, index) => [digit, String(index)]),
  ...Array.from("٠١٢٣٤٥٦٧٨٩", (digit, index) => [digit, String(index)]),
]);

export function toLatinDigits(value) {
  return String(value ?? "").replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP.get(digit) ?? digit);
}

/** Normalize Iranian mobile numbers and explicit international numbers to E.164. */
export function normalizePhoneNumber(value) {
  const compact = toLatinDigits(value).trim().replace(/[\s().-]/g, "");
  if (!compact) return "";

  const digits = compact.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  if (/^0098\d{10}$/.test(digits)) return `+${digits.slice(2)}`;
  if (/^98\d{10}$/.test(digits)) return `+${digits}`;

  const explicitlyInternational = compact.startsWith("+") || compact.startsWith("00");
  if (explicitlyInternational && digits.length >= 8 && digits.length <= 15) return `+${digits.replace(/^00/, "")}`;
  return "";
}
