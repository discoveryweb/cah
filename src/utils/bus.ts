/**
 * Two or three pieces of site chrome need to talk to each other without a
 * store: the dock opens the header's menu, and the menu is owned by the header.
 * A DOM event keeps them decoupled and keeps state where it belongs.
 */
export const SITE_MENU_EVENT = "cahen:menu";

export function openSiteMenu() {
  window.dispatchEvent(new CustomEvent(SITE_MENU_EVENT));
}
