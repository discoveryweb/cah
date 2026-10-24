/**
 * Document measurements that only change when the document changes.
 *
 * Reading `scrollHeight`, `offsetTop` or `getBoundingClientRect()` forces the
 * browser to flush pending style and layout work. Doing that inside a scroll
 * frame — which three pieces of chrome used to do, every frame — turns a
 * compositor-only scroll into a full synchronous relayout, and it is the most
 * common reason a page scrolls badly on Windows and on mid-range Android.
 *
 * Everything here is measured when something actually changes (a resize, a
 * font swap, an image arriving, content growing) and read from memory in the
 * scroll frame. `ResizeObserver` on the body catches content growth; the font
 * and load events catch the rest.
 */

export type DocumentMetrics = {
  /** Highest scroll position, i.e. `scrollHeight - innerHeight`. */
  max: number;
  /** Absolute document offset of the hero's bottom edge. */
  heroBottom: number;
  viewport: number;
};

let metrics: DocumentMetrics | null = null;
let observer: ResizeObserver | null = null;
let observedHero: Element | null = null;
let listening = false;
let version = 0;

function measure() {
  if (typeof document === "undefined") return;
  const viewport = window.innerHeight;
  const hero = document.getElementById("home");
  // Rect + scrollY is offset-parent independent, so it stays right whatever the
  // hero is nested in.
  const heroBottom = hero
    ? hero.getBoundingClientRect().bottom + (window.scrollY || window.pageYOffset || 0)
    : viewport;

  metrics = {
    max: Math.max(0, (document.documentElement.scrollHeight || 0) - viewport),
    heroBottom,
    viewport,
  };

  if (hero && hero !== observedHero) {
    observedHero = hero;
    observer?.observe(hero);
  }
  // Anything that depends on where things sit can compare this and re-measure.
  version += 1;
}

/** Bumped every time the document is re-measured. Compare, don't recompute. */
export function documentLayoutVersion(): number {
  if (!metrics) {
    measure();
    listen();
  }
  return version;
}

function listen() {
  if (listening) return;
  listening = true;

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (observedHero) observer.observe(observedHero);
  }

  window.addEventListener("resize", measure, { passive: true });
  window.addEventListener("orientationchange", measure, { passive: true });
  window.addEventListener("load", measure, { once: true });
  // A font swapping in reflows every line of type on the page.
  void document.fonts?.ready.then(measure).catch(() => {});
}

/** Cached measurements. Cheap enough to call from inside a scroll frame. */
export function documentMetrics(): DocumentMetrics {
  if (!metrics) {
    measure();
    listen();
  }
  return metrics!;
}

/** Force a re-measure, e.g. after content the observer cannot see changed. */
export function refreshDocumentMetrics() {
  measure();
}
