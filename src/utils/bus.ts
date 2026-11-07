/**
 * Two or three pieces of site chrome need to talk to each other without a
 * store: the dock opens the header's menu, and the menu is owned by the header.
 * A DOM event keeps them decoupled and keeps state where it belongs.
 */
export const SITE_MENU_EVENT = "cahen:menu";

export function openSiteMenu() {
  window.dispatchEvent(new CustomEvent(SITE_MENU_EVENT));
}

/**
 * The entrance hands the page over exactly once. Anything that would compete
 * with it for the main thread — the hero renderer, most of all — listens for
 * this instead of guessing with a timer.
 */
export const RELEASE_EVENT = "cahen:release";

export function releasePage() {
  window.dispatchEvent(new Event(RELEASE_EVENT));
}
