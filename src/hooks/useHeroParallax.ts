import { useEffect, type RefObject } from "react";
import { onScrollFrame } from "../utils/scrollFrame";

type Options = {
  /** The hero section; its height is the whole distance of the move. */
  sectionRef: RefObject<HTMLElement | null>;
  /** The light behind everything: drifts down and dims very slightly. */
  fieldRef: RefObject<HTMLElement | null>;
  /** The type and controls: lift away a little faster than the page scrolls. */
  overlayRef: RefObject<HTMLElement | null>;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * The opening screen's whole scroll behaviour, and nothing more.
 *
 * What it replaces: the hero used to be pinned for 3.4 viewports while a film
 * was scrubbed frame by frame. The reader scrolled, the page did not move, and
 * a decoder decided how much of that they got. Even done well, that is two
 * extra screens of resistance at the exact moment someone is deciding whether
 * the site is worth their afternoon — and on a phone it was three megabytes of
 * decoding to find out.
 *
 * This keeps the one thing that was worth keeping, the sense that the opening
 * screen has depth as you leave it, and pays nothing for it: two transforms and
 * two opacities per frame, on the compositor, over a single screen of scrolling.
 * It never blocks the page, never re-measures per frame, and stops writing as
 * soon as the hero is out of view.
 */
export function useHeroParallax({ sectionRef, fieldRef, overlayRef }: Options) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let height = section.offsetHeight || window.innerHeight;
    let painted = -1;

    const paint = (y: number) => {
      // Only the first screen of scrolling is ours; past that, silence.
      const progress = clamp01(y / Math.max(height, 1));
      if (Math.abs(progress - painted) < 0.0005) return;
      painted = progress;

      if (fieldRef.current) {
        fieldRef.current.style.transform = `translate3d(0, ${(progress * height * 0.07).toFixed(2)}px, 0)`;
        fieldRef.current.style.opacity = (1 - progress * 0.28).toFixed(3);
      }
      if (overlayRef.current) {
        overlayRef.current.style.transform = `translate3d(0, ${(-progress * height * 0.05).toFixed(2)}px, 0)`;
        overlayRef.current.style.opacity = clamp01(1 - progress * 1.22).toFixed(3);
      }
    };

    const stopWatching = onScrollFrame((y) => {
      // Nothing to do once the hero is behind the header.
      if (y > height + 80) return;
      paint(y);
    });

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            height = section.offsetHeight || window.innerHeight;
            painted = -1;
          })
        : null;
    observer?.observe(section);

    return () => {
      stopWatching();
      observer?.disconnect();
      if (fieldRef.current) {
        fieldRef.current.style.removeProperty("transform");
        fieldRef.current.style.removeProperty("opacity");
      }
      if (overlayRef.current) {
        overlayRef.current.style.removeProperty("transform");
        overlayRef.current.style.removeProperty("opacity");
      }
    };
  }, [sectionRef, fieldRef, overlayRef]);
}
