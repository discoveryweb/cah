/**
 * One scroll listener for the whole site.
 *
 * Every piece of chrome used to install its own `scroll` listener and its own
 * `requestAnimationFrame`: the header, the progress hairline, back-to-top, the
 * chapter rail, the active-chapter hook (twice), the phone dock, the carousel,
 * the parallax and the hero engine. Ten listeners and up to ten RAF callbacks
 * per frame, each re-reading `window.scrollY` and re-measuring the same boxes.
 *
 * This hub keeps exactly one passive listener and exactly one animation frame:
 * every subscriber is notified inside that frame with the same, already-read
 * scroll position.
 */
type ScrollSubscriber = (y: number) => void;

const subscribers = new Set<ScrollSubscriber>();

let frame = 0;
let listening = false;
let lastY = 0;
/** Layout changed underneath us (resize, fonts, content): subscribers must re-measure. */
let dirty = true;

function flush() {
  frame = 0;
  lastY = window.scrollY || window.pageYOffset || 0;
  dirty = false;
  for (const subscriber of subscribers) subscriber(lastY);
}

function schedule() {
  if (frame || !subscribers.size) return;
  frame = window.requestAnimationFrame(flush);
}

function onScroll() {
  schedule();
}

function onResize() {
  dirty = true;
  schedule();
}

function onVisibility() {
  // A background tab has nothing to animate; catch up when it comes back.
  if (document.visibilityState === "visible") {
    dirty = true;
    schedule();
  }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  document.addEventListener("visibilitychange", onVisibility);
}

function unlisten() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("orientationchange", onResize);
  document.removeEventListener("visibilitychange", onVisibility);
  if (frame) window.cancelAnimationFrame(frame);
  frame = 0;
}

/**
 * Subscribe to the shared frame. The callback runs once per animation frame,
 * with the current `scrollY`, and immediately on subscribe so first paint is
 * correct without waiting for a scroll.
 */
export function onScrollFrame(subscriber: ScrollSubscriber): () => void {
  subscribers.add(subscriber);
  listen();
  schedule();
  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size) unlisten();
  };
}

/** Ask for one more frame — after a layout change, or when a panel opens. */
export function requestScrollFrame() {
  dirty = true;
  schedule();
}

/** The position from the last frame; never triggers a layout read. */
export function currentScrollY() {
  return lastY;
}

/** True when the last frame ran after a layout change. */
export function layoutChanged() {
  return dirty;
}
