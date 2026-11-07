import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const read = (): Theme =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dark"
    ? "dark"
    : "light";

/**
 * The active theme, for the few canvases that have to be *drawn* in it.
 *
 * A CSS `filter` over a canvas that repaints while you scroll re-runs a
 * full-surface filter pass every frame. Where a canvas only needs different
 * ink, it is cheaper — and sharper — to hand it the right colours than to
 * filter it.
 */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
