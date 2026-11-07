/**
 * One site, two windows.
 *
 * The panel and the site are the same installation talking to the same store:
 * a save in the control room has to reach a page that is already open, not only
 * the next one. There is no socket here and there should not be one — a Netlify
 * function per keystroke would be a worse trade than a message between tabs and
 * a refetch when a tab comes back into view.
 *
 * Two channels, because they cover different distances:
 *
 *   • `cahen-content` (BroadcastChannel) — instant, same browser, panel tab to
 *     site tab. This is the case that matters most: an editor saves, switches
 *     to the site and sees it.
 *   • the storage key — the same announcement for browsers without
 *     BroadcastChannel, since a `storage` event crosses tabs as well.
 *
 * A tab on another device picks the change up on its next focus or visibility
 * change (`ContentProvider` refetches there), which is the cheapest honest
 * answer for a site whose content is one small JSON document.
 */
export const CONTENT_CHANNEL = "cahen-content";
export const CONTENT_STORAGE_KEY = "cahen:content-saved";

/** Called by the panel the moment a save lands. */
export function announceContentSaved(at: string) {
  try {
    localStorage.setItem(CONTENT_STORAGE_KEY, at);
  } catch {
    /* storage can be denied; the channel below still works */
  }
  try {
    if (typeof BroadcastChannel === "function") {
      const channel = new BroadcastChannel(CONTENT_CHANNEL);
      channel.postMessage({ at });
      channel.close();
    }
  } catch {
    /* not every engine has it; the site also refetches when it is focused */
  }
}
