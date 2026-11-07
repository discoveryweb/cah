#!/usr/bin/env node
/**
 * Search engines and link previews.
 *
 * A single-page site is one page, so every fact a crawler can learn lives in the
 * shell: the title, the description, the canonical URL, the social card and the
 * structured data. This checks the built shell, the sitemap, robots and the
 * manifest against each other — a canonical that disagrees with `og:url` or a
 * sitemap pointing at a host the canonical does not use is worse than silence.
 *
 * `npm run seo:check`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");
const ORIGIN = "https://cahen.ir";

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

if (!fs.existsSync(DIST)) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(...parts));

const html = read(DIST, "index.html");
/* Vite keeps the author's line breaks inside tags, so the head is read with its
   whitespace flattened. Every value compared below is whitespace-free. */
const head = html.replace(/\s+/g, " ");
const meta = (property) => {
  const byProperty = new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(head);
  if (byProperty) return byProperty[1];
  const byName = new RegExp(`<meta name="${property}" content="([^"]*)"`).exec(head);
  return byName ? byName[1] : null;
};
const link = (rel) => {
  const match = new RegExp(`<link rel="${rel}"[^>]*href="([^"]*)"`).exec(head);
  return match ? match[1] : null;
};

/* ------------------------------------------------------------------ shell */

check("the document declares Persian and reads right-to-left", /<html lang="fa" dir="rtl">/.test(head));
check("the shell has a charset before any content", /<meta charset="UTF-8" \/>/.test(head));
check("the viewport covers the notch", /viewport-fit=cover/.test(html));

const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "";
check("exactly one title is present", (html.match(/<title>/g) || []).length === 1 && title.length > 0);
check("the title fits a result line", title.length >= 15 && title.length <= 70, `${title.length} chars`);
check("the title names the studio and what it does", /CAHEN/.test(title) && /دیجیتال|طراحی/.test(title));

const description = meta("description") ?? "";
check("a meta description exists", Boolean(description));
check(
  "the description fits a snippet",
  description.length >= 70 && description.length <= 200,
  `${description.length} chars`,
);
check("exactly one meta description exists", (head.match(/name="description"/g) || []).length === 1);
check(
  "the page invites indexing, with a large preview",
  /content="index, follow, max-image-preview:large/.test(head),
);
check("the theme colour matches both grounds", /name="theme-color" content="#f8f7fc"/.test(head) && /name="color-scheme" content="light dark"/.test(head));

/* -------------------------------------------------------- canonical / urls */

const canonical = link("canonical");
check("a canonical URL is declared", canonical === `${ORIGIN}/`, canonical ?? "missing");
check("the canonical is absolute and https", /^https:\/\//.test(canonical ?? ""));
check("the canonical is the only one", (head.match(/rel="canonical"/g) || []).length === 1);
check(
  "the page states its language for crawlers too",
  /<link rel="alternate" hreflang="fa-IR" href="https:\/\/cahen\.ir\/"/.test(head) &&
    /<link rel="alternate" hreflang="x-default" href="https:\/\/cahen\.ir\/"/.test(head),
);
check("no resource is loaded over plain http", !/(?:src|href)="http:\/\//.test(head));

/* ------------------------------------------------------------ social card */

check("the share type is a website", meta("og:type") === "website");
check("the share URL agrees with the canonical", meta("og:url") === canonical, meta("og:url"));
check("the share card is attributed to the studio", meta("og:site_name") === "CAHEN");
check("the share locale is Persian", meta("og:locale") === "fa_IR");
check("the share title is set", Boolean(meta("og:title")));
check("the share description is set", Boolean(meta("og:description")));
check("the share image is absolute and https", meta("og:image") === `${ORIGIN}/og-image.jpg`);
check("the share image declares its type", meta("og:image:type") === "image/jpeg");
check(
  "the share card declares the 1200x630 size",
  meta("og:image:width") === "1200" && meta("og:image:height") === "630",
);
check("the share image has alt text", (meta("og:image:alt") ?? "").length > 10);
check(
  "the share image exists in the build at that size",
  exists(DIST, "og-image.jpg") && fs.statSync(path.join(DIST, "og-image.jpg")).size > 1024,
);
check("X gets a large card, not a guess", meta("twitter:card") === "summary_large_image");
check(
  "X gets its own title, description and image",
  Boolean(meta("twitter:title")) &&
    Boolean(meta("twitter:description")) &&
    meta("twitter:image") === `${ORIGIN}/og-image.jpg`,
);
check("X gets alt text for the image", (meta("twitter:image:alt") ?? "").length > 10);

/* --------------------------------------------------------- structured data */

const ldMatch = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
check("the shell carries one structured-data block", (html.match(/application\/ld\+json/g) || []).length === 1);
let graph = [];
let valid = false;
if (ldMatch) {
  try {
    const parsed = JSON.parse(ldMatch[1]);
    graph = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
    valid = parsed["@context"] === "https://schema.org";
  } catch {
    valid = false;
  }
}
check("the structured data is valid JSON on schema.org", valid);

const nodeOfType = (type) => graph.find((node) => node["@type"] === type) ?? null;
const studio = nodeOfType("ProfessionalService");
const site = nodeOfType("WebSite");
const page = nodeOfType("WebPage");

check("it describes the studio, the site and the page", Boolean(studio && site && page), graph.map((node) => node["@type"]).join(", "));
check(
  "every node is one entity under the same host",
  graph.every((node) => String(node["@id"] ?? "").startsWith(`${ORIGIN}/#`)),
  graph.map((node) => node["@id"]).join(" "),
);
check(
  "the site belongs to the studio and the page to the site",
  site?.publisher?.["@id"] === studio?.["@id"] && page?.isPartOf?.["@id"] === site?.["@id"],
);
check(
  "the studio's own facts are the published ones",
  studio?.email === "info@cahen.ir" &&
    studio?.url === `${ORIGIN}/` &&
    studio?.address?.addressCountry === "IR",
);
check(
  "the social profiles are the published handles",
  JSON.stringify(studio?.sameAs ?? []) ===
    JSON.stringify([
      "https://t.me/CAHENWEBADMIN",
      "https://www.instagram.com/CAHENWEB/",
      "https://wa.me/989023841612",
    ]),
  JSON.stringify(studio?.sameAs ?? []),
);
check(
  "the four service areas are listed as offers",
  (studio?.hasOfferCatalog?.itemListElement ?? []).length === 4 &&
    studio.hasOfferCatalog.itemListElement.every((entry) => entry?.itemOffered?.name?.trim()),
);
check(
  "the page names the share image as its primary image",
  page?.primaryImageOfPage?.url === `${ORIGIN}/og-image.jpg`,
);
check("no placeholder address survived into the markup", !/hello@cahen\.studio/.test(html));

/* ---------------------------------------------------------------- manifest */

const manifestHref = link("manifest");
check("a web app manifest is linked", manifestHref === "/site.webmanifest", manifestHref ?? "missing");
let manifest = null;
if (exists(DIST, "site.webmanifest")) {
  try {
    manifest = JSON.parse(read(DIST, "site.webmanifest"));
  } catch {
    manifest = null;
  }
}
check("the manifest is valid JSON", Boolean(manifest));
check(
  "the manifest names the studio and its language",
  manifest?.name?.includes("CAHEN") && manifest?.lang === "fa-IR" && manifest?.dir === "rtl",
);
check(
  "the manifest installs a standalone app from the home page",
  manifest?.start_url === "/" && manifest?.display === "standalone" && manifest?.scope === "/",
);
const iconSizes = (manifest?.icons ?? []).map((icon) => icon?.sizes).sort();
check("the manifest ships 192 and 512 icons", iconSizes.includes("192x192") && iconSizes.includes("512x512"), iconSizes.join(" "));
check(
  "every manifest icon exists in the build",
  (manifest?.icons ?? []).every((icon) => exists(DIST, String(icon.src).replace(/^\//, ""))),
);
check("the manifest theme matches the light ground", manifest?.theme_color === "#f8f7fc");

/* ----------------------------------------------------------------- sitemap */

const sitemap = exists(DIST, "sitemap.xml") ? read(DIST, "sitemap.xml") : "";
check("a sitemap is emitted", Boolean(sitemap));
check("the sitemap is a urlset", /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/.test(sitemap));
check("the sitemap lists exactly the public page", (sitemap.match(/<loc>/g) || []).length === 1);
check("the sitemap points at the canonical host", sitemap.includes(`<loc>${ORIGIN}/</loc>`));
check("the sitemap is dated", /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/.test(sitemap));
check("the sitemap never lists the control room", !/shenataisoni|\/api\//.test(sitemap));

/* ------------------------------------------------------------------ robots */

const robots = exists(DIST, "robots.txt") ? read(DIST, "robots.txt") : "";
check("robots.txt exists", Boolean(robots));
check("robots.txt does not close the site", !/^Disallow: \/$/m.test(robots));
check("robots.txt keeps the control room and the API out", /Disallow: \/shenataisoni/.test(robots) && /Disallow: \/api\//.test(robots));
check("robots.txt advertises the sitemap", robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`));

/* ------------------------------------------------------- error page / nav */

const notFound = exists(DIST, "404.html") ? read(DIST, "404.html") : "";
check("the 404 page exists and is Persian", /lang="fa"/.test(notFound) && /بازگشت به خانه/.test(notFound));
check("the 404 page is noindexed", /name="robots" content="noindex/.test(notFound));
check("the 404 page carries no canonical that would compete", !/rel="canonical"/.test(notFound));

/* The sections the navigation promises have to exist, or a crawler follows a
   link to nowhere. */
const nav = [
  ["home", "Hero"],
  ["work", "Work"],
  ["services", "Services"],
  ["animations", "MotionLab"],
  ["studio", "Studio"],
  ["contact", "Cta"],
];
const missing = nav.filter(([id, file]) => {
  const source = read(ROOT, "src", "components", `${file}.tsx`);
  return !new RegExp(`id="${id}"`).test(source);
});
check("every navigation target is a real section", missing.length === 0, missing.map(([id]) => id).join(" "));
const hero = read(ROOT, "src", "components", "Hero.tsx");
check("the page has exactly one <h1>", (hero.match(/<h1/g) || []).length === 1);
const sections = ["Work", "Services", "MotionLab", "Studio"].map((file) => read(ROOT, "src", "components", `${file}.tsx`));
const sharedHead = read(ROOT, "src", "components", "ui.tsx");
check(
  "each section opens with an <h2> (directly or through the shared section head)",
  sections.every((source) => /<h2/.test(source) || /<SectionHead/.test(source)) &&
    /<h2 className="section-head__title"/.test(sharedHead),
);

/* ---------------------------------------------------------------- report */

const failed = results.filter((item) => !item.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} search checks passed` +
    (failed.length ? `\n\nFailed: ${failed.map((item) => item.label).join("; ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
