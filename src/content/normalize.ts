import { DEFAULT_CONTENT } from "./defaults";
import type { SiteContent } from "./types";

/**
 * The first seed of this site shipped placeholder addresses: a studio email
 * that was never real, and social links pointing at the platforms' home pages
 * rather than at the studio. Anything published from the panel before the real
 * addresses existed still carries them, so a site can look "configured" while
 * its footer and menu lead nowhere.
 *
 * These exact strings are adopted from the defaults. A value an editor typed is
 * never touched: only the literal placeholders are replaced, and only when the
 * defaults actually know the real address for that channel.
 */
const PLACEHOLDER_EMAIL = "hello@cahen.studio";

const PLACEHOLDER_HREFS = new Set([
  "https://t.me/",
  "https://t.me",
  "http://t.me/",
  "https://instagram.com/",
  "https://www.instagram.com/",
  "https://whatsapp.com/",
  "https://www.whatsapp.com/",
]);

/**
 * The studio's Telegram channel was renamed, so the address the site published
 * before is no longer the studio's. A document saved from the panel still
 * carries it, and a menu that opens the old channel is a dead end that looks
 * configured. This migrates exactly those studio addresses and nothing else:
 * a link an editor typed for their own account is never rewritten.
 */
const RENAMED_CHANNEL_HANDLES = new Map([
  ["https://t.me/cahenweb", "https://t.me/CAHENWEBADMIN"],
  ["http://t.me/cahenweb", "https://t.me/CAHENWEBADMIN"],
  ["https://telegram.me/cahenweb", "https://t.me/CAHENWEBADMIN"],
]);
const RENAMED_STUDIO_HANDLE = "@cahenweb";

/**
 * The gallery was seeded with three demonstration case studies while the studio
 * had no published client work. Those demo plates are placeholders, and a
 * document saved from the panel before the real portfolio existed still carries
 * them — which would hide the work that actually shipped.
 *
 * Only a list made *entirely* of the demo ids is replaced. The moment an editor
 * adds a project, renames one or hides one, their list wins.
 */
const DEMO_WORK_IDS = new Set(["soma", "orbit", "aura"]);

export function adoptRealPortfolio(content: SiteContent): SiteContent {
  const items = content.work.items;
  if (!items.length) return content;
  if (items.some((item) => !DEMO_WORK_IDS.has(item.id))) return content;
  return { ...content, work: { ...content.work, items: DEFAULT_CONTENT.work.items } };
}

export function adoptPublishedAddresses(content: SiteContent): SiteContent {
  let changed = false;

  const email =
    content.contact.email.trim().toLowerCase() === PLACEHOLDER_EMAIL
      ? DEFAULT_CONTENT.contact.email
      : content.contact.email;
  if (email !== content.contact.email) changed = true;

  const socials = content.socials.map((channel) => {
    const renamed = RENAMED_CHANNEL_HANDLES.get(channel.href.trim().toLowerCase());
    if (renamed) {
      changed = true;
      return { ...channel, href: renamed };
    }
    if (!PLACEHOLDER_HREFS.has(channel.href.trim())) return channel;
    const replacement = DEFAULT_CONTENT.socials.find(
      (candidate) => candidate.platform === channel.platform || candidate.icon === channel.icon,
    );
    if (!replacement) return channel;
    changed = true;
    return { ...channel, href: replacement.href };
  });

  const handle =
    content.contact.handle.trim().toLowerCase() === RENAMED_STUDIO_HANDLE
      ? DEFAULT_CONTENT.contact.handle
      : content.contact.handle;
  if (handle !== content.contact.handle) changed = true;

  if (!changed) return content;
  return { ...content, contact: { ...content.contact, email, handle }, socials };
}
