import { useEffect, useState } from "react";
import { NAV_LINKS } from "../data";

/** Tracks which chapter currently owns the reading position. */
export function useActiveSection(): string {
  const [active, setActive] = useState<string>("home");

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const probe = window.scrollY + window.innerHeight * 0.34;
      let current: string = NAV_LINKS[0].id;

      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (!section) continue;
        if (section.getBoundingClientRect().top + window.scrollY <= probe) current = link.id;
      }

      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 6) {
        current = NAV_LINKS[NAV_LINKS.length - 1].id;
      }

      setActive((previous) => (previous === current ? previous : current));
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
    };
  }, []);

  return active;
}

/** True when an element marked data-invert sits beneath a viewport probe. */
export function useInvertAt(position: "top" | "middle"): boolean {
  const [invert, setInvert] = useState(false);

  useEffect(() => {
    let frame = 0;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-invert]"));

    const update = () => {
      frame = 0;
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
    };
  }, [position]);

  return invert;
}
