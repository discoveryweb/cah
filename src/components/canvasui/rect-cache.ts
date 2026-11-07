import { onScrollFrame } from "../../utils/scrollFrame";

export function createRectCache(element: Element) {
  let current = element.getBoundingClientRect();
  let stale = false;

  /* Scroll and resize only *invalidate*. The measurement itself happens on the
     first read after that, so a page that scrolls without anyone asking for the
     box — which is most scrolling — never touches layout at all. Measuring on
     every scroll frame, as this used to, is a forced relayout per frame. */
  const invalidate = () => {
    stale = true;
  };

  const observer = new ResizeObserver(invalidate);
  observer.observe(element);
  window.addEventListener("resize", invalidate, { passive: true });
  const stopWatchingScroll = onScrollFrame(invalidate);

  return {
    get current() {
      if (stale) {
        current = element.getBoundingClientRect();
        stale = false;
      }
      return current;
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", invalidate);
      stopWatchingScroll();
    },
  };
}
