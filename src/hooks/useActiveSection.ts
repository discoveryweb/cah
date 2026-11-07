import { useEffect, useState } from "react";
import { NAV_LINKS } from "../data";
import { onScrollFrame } from "../utils/scrollFrame";
import { documentLayoutVersion, documentMetrics } from "../utils/documentMetrics";

/**
 * Tracks which chapter currently owns the reading position. Pass `false` when
 * the caller is not on screen (the phone dock, on desktop) so no listener runs.
 */
export function useActiveSection(enabled = true): string {
  const [active, setActive] = useState<string>("home");

  useEffect(() => {
    if (!enabled) return;

    /* Section positions in document space, measured when the layout version
       changes and never inside the scroll frame — six `getBoundingClientRect`
       calls per frame is six chances to force a relayout while scrolling. */
    type Span = { id: (typeof NAV_LINKS)[number]["id"]; top: number };
    let spans: Span[] = [];
    let measuredAt = -1;

    const update = (y: number) => {
      const { viewport, max } = documentMetrics();
      const layout = documentLayoutVersion();
      if (layout !== measuredAt) {
        measuredAt = layout;
        const offset = window.scrollY || 0;
        spans = NAV_LINKS.map((link): Span | null => {
          const section = document.getElementById(link.id);
          if (!section) return null;
          return { id: link.id, top: section.getBoundingClientRect().top + offset };
        }).filter((span): span is Span => span !== null);
      }

      const probe = y + viewport * 0.34;
      let current: string = NAV_LINKS[0].id;
      for (const span of spans) {
        if (span.top <= probe) current = span.id;
      }
      if (y >= max - 6) current = NAV_LINKS[NAV_LINKS.length - 1].id;

      setActive((previous) => (previous === current ? previous : current));
    };

    return onScrollFrame(update);
  }, [enabled]);

  return active;
}

/** True when an element marked data-invert sits beneath a viewport probe. */
export function useInvertAt(position: "top" | "middle"): boolean {
  const [invert, setInvert] = useState(false);

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-invert]"));

    /* Same treatment: the bands are measured once per layout version, and the
       `--header-h` custom property is read once rather than resolved through
       `getComputedStyle` on every frame. */
    let bands: { top: number; bottom: number }[] = [];
    let halfHeader = 39;
    let measuredAt = -1;

    const update = (scrollY: number) => {
      const layout = documentLayoutVersion();
      if (layout !== measuredAt) {
        measuredAt = layout;
        halfHeader =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--header-h") || "78"
          ) / 2;
        bands = nodes
          .map((node) => {
            const rect = node.getBoundingClientRect();
            return { top: rect.top + scrollY, bottom: rect.bottom + scrollY };
          })
          .filter((band) => band.bottom > band.top);
      }

      const y =
        position === "middle" ? window.innerHeight / 2 + scrollY : halfHeader + scrollY;
      let found = false;
      for (const band of bands) {
        if (band.top <= y && band.bottom >= y) {
          found = true;
          break;
        }
      }
      setInvert((previous) => (previous === found ? previous : found));
    };

    return onScrollFrame(update);
  }, [position]);

  return invert;
}
