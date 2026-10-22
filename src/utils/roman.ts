const ROMAN_MAP: ReadonlyArray<readonly [number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/**
 * Turns a section or item index such as "01", "5" or 5 into a Roman numeral.
 * Values that are not a positive integer (or are out of range) pass through
 * untouched so years, labels and mixed tokens keep working.
 */
export function toRoman(value: string | number): string {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value.replace(/[^\d]/g, ""), 10);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 4000) return String(value);

  let remainder = Math.trunc(parsed);
  let result = "";
  for (const [amount, symbol] of ROMAN_MAP) {
    while (remainder >= amount) {
      result += symbol;
      remainder -= amount;
    }
  }
  return result;
}
