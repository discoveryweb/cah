import { useEffect, useState } from "react";
import { NAV_LINKS } from "../data";
import { onScrollFrame } from "../utils/scrollFrame";

/**
 * Tracks which chapter currently owns the reading position. Pass `false` when
 * the caller is not on screen (the phone dock, on desktop) so no listener runs.
 */
export function useActiveSection(enabled = true): string {
  const [active, setActive] = useState<string>("home");

  useEffect(() => {
    if (!enabled) return;

    const update = (y: number) => {
      const probe = y + window.innerHeight * 0.34;
      let current: string = NAV_LINKS[0].id;

      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (!section) continue;
        if (section.getBoundingClientRect().top + window.scrollY <= probe) current = link.id;
      }

      const doc = document.documentElement;
      if (window.innerHeight + y >= doc.scrollHeight - 6) {
        current = NAV_LINKS[NAV_LINKS.length - 1].id;
      }

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

    const update = () => {
      const y =
        position === "middle"
          ? window.innerHeight / 2
          : parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue("--header-h") || "78"
            ) / 2;
      let found = false;
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.top <= y && rect.bottom >= y) {
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
