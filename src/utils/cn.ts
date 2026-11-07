import { clsx, type ClassValue } from "clsx";

/**
 * Class names, composed.
 *
 * This used to run every className through `tailwind-merge`. Nothing on the
 * site passes Tailwind utilities through here — the classes are the stylesheet's
 * own BEM names (`nav__link`, `menu--open`), where the last writer winning is
 * exactly what `clsx` does. The merge engine was 25 kB of browser download and
 * a string parse per render to resolve conflicts that never happen.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
