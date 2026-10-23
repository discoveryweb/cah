/**
 * Touch feedback for phones.
 *
 * A 10-millisecond pulse on a committed action is what separates a web page
 * from a native app on Android; iOS Safari does not expose the API, so this is
 * a silent no-op there and must never be the only feedback for anything.
 */
type Pattern = "tap" | "commit" | "open";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 7,
  commit: 14,
  open: [10, 26, 12],
};

let allowed: boolean | null = null;

const supported = () => {
  if (allowed !== null) return allowed;
  allowed =
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  return allowed;
};

export function haptic(pattern: Pattern = "tap") {
  if (!supported()) return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    allowed = false;
  }
}
