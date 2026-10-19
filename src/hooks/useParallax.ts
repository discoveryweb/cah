import { useEffect, type RefObject } from "react";

/**
 * Moves an element against the scroll direction as it passes the viewport.
 * Writes a CSS custom property (default `--parallax`) so it composes with
 * existing transforms in stylesheets.
 */
export function useParallax(
  ref: RefObject<HTMLElement | null>,
  strength = 0.08,
  property = "--parallax"
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      if (rect.bottom < -200 || rect.top > viewport + 200) return;
      const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      const offset = Math.max(-1, Math.min(1, progress)) * strength * rect.height;
      node.style.setProperty(property, `${offset.toFixed(2)}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      node.style.removeProperty(property);
    };
  }, [ref, strength, property]);
}
