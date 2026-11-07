import { useEffect, type RefObject } from "react";
import { onScrollFrame } from "../utils/scrollFrame";
import { createDocumentBox } from "../utils/layoutBoxes";

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

    /* The box is measured when the layout changes and read from memory in the
       scroll frame; `getBoundingClientRect` per frame forces a relayout. */
    const box = createDocumentBox(node);

    const update = (scrollY: number) => {
      const { top, height } = box.read();
      const rectTop = top - scrollY;
      const viewport = window.innerHeight;
      if (rectTop + height < -200 || rectTop > viewport + 200) return;
      const progress = (rectTop + height / 2 - viewport / 2) / viewport;
      const offset = Math.max(-1, Math.min(1, progress)) * strength * height;
      node.style.setProperty(property, `${offset.toFixed(2)}px`);
    };

    const stop = onScrollFrame(update);
    return () => {
      stop();
      node.style.removeProperty(property);
    };
  }, [ref, strength, property]);
}
