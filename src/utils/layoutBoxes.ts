import { documentLayoutVersion } from "./documentMetrics";

export type DocumentBox = {
  /** Distance from the top of the document, independent of the scroll position. */
  top: number;
  height: number;
};

/**
 * A element's box in *document* coordinates, re-measured only when the layout
 * actually changes.
 *
 * The scroll handlers used to call `getBoundingClientRect()` (and sometimes
 * `getComputedStyle` and `offsetHeight` on top of it) inside every scroll
 * frame. Each of those reads forces the browser to flush pending style and
 * layout work, which turns a compositor-only scroll into a synchronous
 * relayout — the most common reason a page stutters while scrolling, on
 * Windows especially.
 *
 * A box does not change when the page scrolls: only the viewport moves. So it
 * is measured when the layout version changes (resize, font swap, content
 * growth — see `documentMetrics`) and read from memory in between.
 */
export function createDocumentBox(element: Element) {
  let box: DocumentBox = { top: 0, height: 0 };
  let measuredAt = -1;

  const measure = (): DocumentBox => {
    const scroll = window.scrollY || window.pageYOffset || 0;
    const rect = element.getBoundingClientRect();
    box = { top: rect.top + scroll, height: rect.height };
    measuredAt = documentLayoutVersion();
    return box;
  };

  measure();

  return {
    read(): DocumentBox {
      if (measuredAt !== documentLayoutVersion()) measure();
      return box;
    },
    refresh: measure,
    /** Where the element sits right now, given the current scroll position. */
    viewportTop(scrollY: number): number {
      return this.read().top - scrollY;
    },
  };
}
