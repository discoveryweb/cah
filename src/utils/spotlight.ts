import { useEffect, useRef } from "react";

/**
 * Tracks the pointer inside an element and exposes its position as
 * `--spot-x` / `--spot-y` custom properties for CSS spotlights.
 */
export function useSpotlight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = element.getBoundingClientRect();
        element.style.setProperty("--spot-x", `${(event.clientX - rect.left).toFixed(1)}px`);
        element.style.setProperty("--spot-y", `${(event.clientY - rect.top).toFixed(1)}px`);
      });
    };

    element.addEventListener("pointermove", onMove);
    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
    };
  }, []);

  return ref;
}
