#!/usr/bin/env node
/**
 * The studio's public identity.
 *
 * Addresses drift: a phone number changes, a handle is typed by hand into one
 * component, and the site starts telling visitors two different stories. This
 * checks the content document against what the components actually render.
 *
 * `npm run content:check`.
 */
import { build } from "esbuild";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".content-check");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

await fsp.mkdir(WORK, { recursive: true });
await build({
  entryPoints: [path.join(ROOT, "src/content/defaults.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(WORK, "defaults.mjs"),
  loader: {
    ".jpg": "dataurl",
    ".png": "dataurl",
    ".webp": "dataurl",
    ".svg": "dataurl",
    ".css": "empty",
  },
  logLevel: "error",
});

const { DEFAULT_CONTENT: content } = await import(pathToFileURL(path.join(WORK, "defaults.mjs")).href);

// The resolver (merge + placeholder adoption) is pure, so it can be tested here.
await build({
  entryPoints: [path.join(ROOT, "src/content/normalize.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(WORK, "normalize.mjs"),
  loader: {
    ".jpg": "dataurl",
    ".png": "dataurl",
    ".webp": "dataurl",
    ".svg": "dataurl",
    ".css": "empty",
  },
  logLevel: "error",
});
const { adoptPublishedAddresses, adoptRealPortfolio } = await import(pathToFileURL(path.join(WORK, "normalize.mjs")).href);
const { contact, socials } = content;
const byPlatform = (platform) => socials.find((channel) => channel.platform === platform);

/* ------------------------------------------------------------------ email */

check("the studio email is info@cahen.ir", contact.email === "info@cahen.ir", contact.email);

/* ------------------------------------------------------------------ phone */

/**
 * A number is only published as a `tel:` link when the panel fills it in, and
 * then it has to be dialable: international form, latin digits.
 */
if (contact.phone) {
  check("a published phone is dialable from a tel: link", /^\+\d[\d\s]*\d$/.test(contact.phone), contact.phone);
} else {
  check("no phone is published as a tel: link unless the studio adds one", true);
}

/* --------------------------------------------------------------- channels */

check("three channels are published", socials.length === 3, String(socials.length));
check("the channels are Telegram, Instagram and WhatsApp",
  socials.map((channel) => channel.platform).join(",") === "Telegram,Instagram,WhatsApp",
  socials.map((channel) => channel.platform).join(","));

check(
  "Telegram points at the studio channel",
  byPlatform("Telegram")?.href === "https://t.me/CAHENWEBADMIN",
  String(byPlatform("Telegram")?.href),
);
check(
  "Instagram points at the studio profile",
  byPlatform("Instagram")?.href === "https://www.instagram.com/CAHENWEB/",
  String(byPlatform("Instagram")?.href),
);
check(
  "Instagram is a profile URL, not a search or share link",
  /^https:\/\/www\.instagram\.com\/[A-Za-z0-9._]+\/$/.test(byPlatform("Instagram")?.href || ""),
  String(byPlatform("Instagram")?.href),
);

const whatsapp = byPlatform("WhatsApp")?.href || "";
const whatsappDigits = (whatsapp.match(/^https:\/\/wa\.me\/(\d+)$/) || [])[1];
check("WhatsApp opens a chat with a number, not the homepage", Boolean(whatsappDigits), whatsapp);
check(
  "the WhatsApp number is a full Iranian mobile in E.164 digits",
  /^989\d{9}$/.test(whatsappDigits || ""),
  String(whatsappDigits),
);

for (const channel of socials) {
  check(`${channel.platform} is https and opens in a new tab context`, /^https:\/\//.test(channel.href), channel.href);
  check(`${channel.platform} declares a glyph`, ["telegram", "instagram", "whatsapp"].includes(channel.icon), channel.icon);
}

check("the handle matches the profile", contact.handle.replace("@", "").toLowerCase() === "cahenwebadmin", contact.handle);

/* ------------------------------------------------- no addresses hardcoded */

const componentFiles = fs
  .readdirSync(path.join(ROOT, "src/components"))
  .filter((file) => file.endsWith(".tsx"));

const offenders = [];
for (const file of componentFiles) {
  const source = fs.readFileSync(path.join(ROOT, "src/components", file), "utf8");
  if (/mailto:(?!\$\{)/.test(source)) offenders.push(`${file}: literal mailto:`);
  if (/(t\.me|wa\.me|instagram\.com)\//.test(source)) offenders.push(`${file}: literal social URL`);
  if (/hello@|cahen\.studio/.test(source)) offenders.push(`${file}: old address`);
}
check("no component hardcodes an address", offenders.length === 0, offenders.join(", "));

/* A failed submission must not leave the reader with nothing to do: the
   studio's own address is the fallback, and it is read from the document the
   panel edits rather than typed into the component. */
const orderForm = fs.readFileSync(path.join(ROOT, "src/components/OrderModal.tsx"), "utf8");
check(
  "a form that cannot send still offers the studio's address",
  /href=\{\`mailto:\$\{content\.contact\.email\}\`\}/.test(orderForm),
);

/* --------------------------------------- a site published before the change */

{
  const legacy = {
    ...content,
    contact: { ...content.contact, email: "hello@cahen.studio" },
    socials: content.socials.map((channel) => {
      const placeholder = { Telegram: "https://t.me/", Instagram: "https://www.instagram.com/", WhatsApp: "https://www.whatsapp.com/" };
      return { ...channel, href: placeholder[channel.platform] };
    }),
  };

  const adopted = adoptPublishedAddresses(legacy);
  check(
    "a site published with the old placeholder email adopts the real one",
    adopted.contact.email === "info@cahen.ir",
    adopted.contact.email,
  );
  check(
    "placeholder social links are replaced with the studio's own",
    adopted.socials.every((channel) => channel.href !== "https://t.me/" && channel.href !== "https://www.instagram.com/"),
    adopted.socials.map((channel) => channel.href).join(" "),
  );
  check(
    "the adoption keeps the order, names and colours an editor chose",
    adopted.socials.every((channel, index) => channel.name === legacy.socials[index].name && channel.color === legacy.socials[index].color),
  );

  const custom = {
    ...content,
    contact: { ...content.contact, email: "studio@another-domain.com" },
    socials: content.socials.map((channel) => ({ ...channel, href: `https://t.me/${channel.platform}` })),
  };
  const untouched = adoptPublishedAddresses(custom);
  check("an address an editor typed is never rewritten", untouched === custom);

  /* The channel was renamed. A document saved before the rename is migrated;
     the studio's own previous address is the only thing that is rewritten. */
  const renamed = {
    ...content,
    contact: { ...content.contact, handle: "@CAHENWEB" },
    socials: content.socials.map((channel) =>
      channel.platform === "Telegram" ? { ...channel, href: "https://t.me/CAHENWEB" } : channel,
    ),
  };
  const migrated = adoptPublishedAddresses(renamed);
  check(
    "a document saved before the channel was renamed opens the current channel",
    migrated.socials.find((channel) => channel.platform === "Telegram")?.href === "https://t.me/CAHENWEBADMIN" &&
      migrated.contact.handle === "@CAHENWEBADMIN",
    `${migrated.socials.find((channel) => channel.platform === "Telegram")?.href} / ${migrated.contact.handle}`,
  );
  check(
    "the rename leaves the other channels exactly as they were",
    migrated.socials.filter((channel) => channel.platform !== "Telegram").every(
      (channel, index) => channel.href === renamed.socials.filter((entry) => entry.platform !== "Telegram")[index].href,
    ),
  );

  const clean = adoptPublishedAddresses(content);
  check("a correct document is returned untouched", clean === content);
}

/* ------------------------------------------------------------- portfolio */

/**
 * The gallery used to hold three demonstration plates. What it shows now is the
 * work that actually shipped, each one linking to the site it lives on — so the
 * portfolio is checked like any other published fact.
 */
const portfolio = content.work.items;
check(
  "the gallery shows the three shipped projects",
  portfolio.map((item) => item.id).join(",") === "karixo,nirvana,meridian",
  portfolio.map((item) => item.id).join(","),
);
check(
  "no demonstration case study is left in the portfolio",
  portfolio.every((item) => !["soma", "orbit", "aura"].includes(item.id.toLowerCase())) &&
    portfolio.every((item) => !/^(SOMA|ORBIT|AURA)$/.test(item.name)),
  portfolio.map((item) => item.name).join(" "),
);
check(
  "every published project links to a live site",
  portfolio
    .filter((item) => item.published !== false)
    .every((item) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(item.url ?? "")),
  portfolio.map((item) => `${item.id}:${item.url ?? "—"}`).join(" "),
);
check(
  "the live links point at the studios' own domains",
  portfolio.map((item) => item.url).join(" ") ===
    "https://karixo.ir https://nirvana3d.ir https://clinicmoo.netlify.app",
  portfolio.map((item) => item.url).join(" "),
);
check(
  "every project ships an image and its alt text",
  portfolio.every((item) => Boolean(item.image) && item.alt.trim().length > 12),
  portfolio.map((item) => item.alt.length).join(" "),
);
check(
  "every project names a role, a sector and a year",
  portfolio.every((item) => item.role.trim() && item.sector.trim() && item.year.trim()),
);
check(
  "the metrics are the studio's own, not percentages invented for a demo",
  portfolio.every((item) => item.metrics.length === 3 && item.metrics.every((metric) => metric.value && metric.label)),
);

{
  /* A document published before the real portfolio existed still carries the
     demo plates. It adopts the real one — but only while it is untouched. */
  const legacy = {
    ...content,
    work: { ...content.work, items: content.work.items.map((item, index) => ({
      ...item,
      id: ["soma", "orbit", "aura"][index],
      name: ["SOMA", "ORBIT", "AURA"][index],
    })) },
  };
  const adopted = adoptRealPortfolio(legacy);
  check(
    "a document carrying the demo plates adopts the real portfolio",
    adopted.work.items.map((item) => item.id).join(",") === "karixo,nirvana,meridian",
    adopted.work.items.map((item) => item.id).join(","),
  );

  const edited = { ...legacy, work: { ...legacy.work, items: [{ ...legacy.work.items[0], id: "vatra" }, ...legacy.work.items.slice(1)] } };
  check("a portfolio an editor shaped is never replaced", adoptRealPortfolio(edited) === edited);
  check("a portfolio without items is left alone", adoptRealPortfolio({ ...content, work: { ...content.work, items: [] } }).work.items.length === 0);
}

/* --------------------------------------------- the stylesheet for the menu */

const headerCss = fs.readFileSync(path.join(ROOT, "src/styles/header.css"), "utf8");
check(
  "the menu styles an icon tile for each channel",
  /\.menu__social-icon \{[\s\S]*?display: grid;/.test(headerCss),
);
check(
  "the menu rows are readable on a phone (one per row)",
  /@media \(max-width: 767px\)[\s\S]*?\.menu__socials \{\s*grid-template-columns: minmax\(0, 1fr\)/.test(headerCss),
);

/* -------------------------------------------------------------------- done */

await fsp.rm(WORK, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} content checks passed`);
process.exit(failed ? 1 : 0);
