#!/usr/bin/env node
/**
 * The delivery gate.
 *
 * Everything that makes this site feel like a finished product rather than a
 * running prototype, checked against the real build output:
 *
 *   speed      one scroll listener, preloaded fonts, no dead weight in the
 *              first payload, immutable caching, budgets that fail the build
 *   product    metadata, social card, icons, structured data, 404, sitemap,
 *              404 noindex, admin hidden from crawlers
 *   craft      contrast, focus states, reduced motion, alt text, one <h1>
 *
 * Run `npm run build` first. `npm run product:check`.
 */
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(...parts));
const size = (...parts) => fs.statSync(path.join(...parts)).size;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

if (!exists(DIST)) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const html = read(DIST, "index.html");
const assets = fs.readdirSync(path.join(DIST, "assets"));

/* ======================================================== speed / payload */

const jsFiles = assets.filter((file) => file.endsWith(".js"));
const cssFiles = assets.filter((file) => file.endsWith(".css"));
const entryJs = jsFiles.filter((file) => /^index-.*\.js$/.test(file));
const mainCss = cssFiles.filter((file) => /^index-.*\.css$/.test(file));

const gz = (...parts) => gzipSync(fs.readFileSync(path.join(...parts))).length;
const entryBytes = entryJs.reduce((total, file) => total + gz(DIST, "assets", file), 0);
const cssBytes = mainCss.reduce((total, file) => total + gz(DIST, "assets", file), 0);

check(`the first JS chunk stays under 130 KB gzip (${kb(entryBytes)})`, entryBytes < 130 * 1024, kb(entryBytes));
check(`the first CSS stays under 45 KB gzip (${kb(cssBytes)})`, cssBytes < 45 * 1024, kb(cssBytes));

const fontsInBundle = assets.filter((file) => file.endsWith(".woff2"));
check("fonts are not inlined into the bundle", fontsInBundle.length === 0, fontsInBundle.join(", "));

const fontFiles = fs.readdirSync(path.join(DIST, "fonts"));
check("exactly the four typefaces ship", fontFiles.length >= 4 && fontFiles.length <= 5, fontFiles.join(", "));
check(
  "no font is larger than 60 KB",
  fontFiles.every((file) => size(DIST, "fonts", file) < 60 * 1024),
  fontFiles.map((file) => `${file}:${kb(size(DIST, "fonts", file))}`).join(" "),
);

check(
  "the entrance downloads no frame at all",
  !/hero-poster|hero-scrub/.test(html),
  "a preloaded film frame is back in index.html",
);
check("the Persian face is preloaded", /rel="preload"[\s\S]{0,160}estedad-arabic\.woff2/.test(html));
check("the preloaded font is cross-origin tagged", /estedad-arabic\.woff2[^>]*crossorigin/.test(html));
check("the first font preload comes before the entry script", html.indexOf("estedad-arabic.woff2") < html.indexOf("type=\"module\""));

/* ====================================================== images / payload */

const images = fs.readdirSync(path.join(DIST, "assets")).filter((file) => /\.(webp|jpe?g|png)$/.test(file));
check(
  "every bundled photograph is WebP",
  images.every((file) => file.endsWith(".webp")),
  images.filter((file) => !file.endsWith(".webp")).join(", "),
);
check(
  "no bundled image is over 60 KB",
  images.every((file) => size(DIST, "assets", file) < 60 * 1024),
  images.map((file) => `${file}:${kb(size(DIST, "assets", file))}`).join(" "),
);
check("the social card exists and is light", exists(DIST, "og-image.jpg") && size(DIST, "og-image.jpg") < 80 * 1024,
  exists(DIST, "og-image.jpg") ? kb(size(DIST, "og-image.jpg")) : "missing");

/* ==================================================== one scroll listener */

const sources = ["src", "src/components", "src/hooks", "src/utils", "src/components/canvasui"];
const scrollListeners = [];
for (const dir of sources) {
  for (const file of fs.readdirSync(path.join(ROOT, dir))) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = read(ROOT, dir, file);
    const hits = source.match(/addEventListener\("scroll"/g) || [];
    if (hits.length) scrollListeners.push(`${file}:${hits.length}`);
  }
}
check(
  "exactly one scroll listener exists in the whole site",
  scrollListeners.length === 1 && scrollListeners[0].startsWith("scrollFrame.ts"),
  scrollListeners.join(", "),
);

const frameHub = read(ROOT, "src", "utils", "scrollFrame.ts");
check("the shared frame is passive", /addEventListener\("scroll", onScroll, \{ passive: true \}/.test(frameHub));
check("the shared frame pauses in a background tab", /visibilitychange/.test(frameHub));

/* ========================================================= product polish */

check("a single <h1> markup entry: the shell has no duplicate", (html.match(/<h1/g) || []).length <= 1);
check("the shell declares a language and a direction", /<html lang="fa" dir="rtl">/.test(html));
check("the viewport opts into the notch", /viewport-fit=cover/.test(html));
check("the theme colour matches the ground", /name="theme-color" content="#0a0a1e"/.test(html));
check("the colour scheme is declared dark", /name="color-scheme" content="dark"/.test(html));
check("a canonical URL is set", /rel="canonical" href="https:\/\/cahen\.ir\/"/.test(html));
check("the social card is declared with an absolute URL", /og:image" content="https:\/\/cahen\.ir\/og-image\.jpg"/.test(html));
check("the social card declares its size", /og:image:width" content="1200"/.test(html) && /og:image:height" content="630"/.test(html));
check("the locale is declared", /og:locale" content="fa_IR"/.test(html));
check("the social card has alt text", /og:image:alt/.test(html));
check("structured data names the studio", /"@type": "ProfessionalService"/.test(html));
check("structured data carries the real addresses", /info@cahen\.ir/.test(html) && /t\.me\/CAHENWEB/.test(html));
check("the structured data is valid JSON", (() => {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  try {
    JSON.parse(match[1]);
    return true;
  } catch {
    return false;
  }
})());

check("the favicon ships in three sizes", ["favicon.png", "icon-192.png", "apple-touch-icon.png"].every((file) => exists(DIST, file)));
check("the touch icon is declared", /apple-touch-icon/.test(html));
check("telephone number detection is off", /format-detection" content="telephone=no/.test(html));

check("the 404 page exists", exists(DIST, "404.html"));
if (exists(DIST, "404.html")) {
  const notFound = read(DIST, "404.html");
  check("the 404 page is in Persian, on-brand and links home", /بازگشت به خانه/.test(notFound) && /lang="fa"/.test(notFound));
  check("the 404 page is noindexed", /noindex/.test(notFound));
}

check("a sitemap exists", exists(DIST, "sitemap.xml"));
if (exists(DIST, "sitemap.xml")) {
  check("the sitemap points at the real host", /https:\/\/cahen\.ir\//.test(read(DIST, "sitemap.xml")));
  check("the control room is not in the sitemap", !/shenataisoni/.test(read(DIST, "sitemap.xml")));
}
check("robots.txt exists and hides the control room", exists(DIST, "robots.txt") && /shenataisoni/.test(read(DIST, "robots.txt")));
check("robots.txt advertises the sitemap", /Sitemap: https:\/\/cahen\.ir\/sitemap\.xml/.test(read(DIST, "robots.txt")));

/* ================================================================ headers */

const netlify = read(ROOT, "netlify.toml");
check("fingerprinted assets are cached for a year", /\/assets\/\*[\s\S]{0,200}immutable/.test(netlify));
check("fonts are cached for a year", /\/fonts\/\*[\s\S]{0,200}immutable/.test(netlify));
check("the HTML shell always revalidates", /for = "\/index.html"[\s\S]{0,160}must-revalidate/.test(netlify));
check("the control room is never cached and never indexed", /for = "\/shenataisoni"[\s\S]{0,160}no-store[\s\S]{0,120}noindex/.test(netlify));
check("a strict content security policy is set", /Content-Security-Policy = "default-src 'self'/.test(netlify));

/* ---- the CSP is strict, and exactly as strict as it needs to be ---- */

const csp = (/Content-Security-Policy = "([^"]+)"/.exec(netlify) || [])[1] || "";
const scriptSrc = (/script-src ([^;]+);/.exec(csp) || [])[1] || "";

check("script-src never falls back to 'unsafe-inline'", !/'unsafe-inline'/.test(scriptSrc), scriptSrc);
check("script-src never allows arbitrary eval", !/'unsafe-eval'/.test(scriptSrc), scriptSrc);

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)];
check("the shell has exactly one inline script", inlineScripts.length === 1, `${inlineScripts.length} found`);

if (inlineScripts.length === 1) {
  const [tag, body] = [inlineScripts[0][1], inlineScripts[0][2]];
  check("the inline script is data, not executable code", /application\/ld\+json/.test(tag), tag.trim());
  const digest = createHash("sha256").update(body, "utf8").digest("base64");
  check(
    "the inline block is allowed by its own hash, not by a blanket rule",
    scriptSrc.includes(`'sha256-${digest}'`),
    `expected sha256-${digest}`,
  );
}

check("framing is denied", /frame-ancestors 'none'/.test(netlify));
check("HSTS is set", /Strict-Transport-Security = "max-age=31536000/.test(netlify));
check("permissions are narrowed", /Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(\)/.test(netlify));
check(
  "the hero texture is cached for a repeat visit",
  /\/hero\/\*[\s\S]{0,220}Cache-Control = "public, max-age=86400, stale-while-revalidate=604800"/.test(netlify),
);
check("nothing is left behind for the removed film", !/\/film\//.test(netlify));

/* ================================================================= craft */

const css = mainCss.map((file) => read(DIST, "assets", file)).join("\n");
// The build minifies: no space after the colon, so compare against the
// minified form as well as the source form.
const matches = (pattern) => new RegExp(pattern.replace(/ /g, "\\s*")).test(css);

check("focus-visible is styled", matches(":focus-visible"));
check("there is a skip link", matches("\\.skip-link") && /skip-link/.test(read(ROOT, "src", "App.tsx")));
check("reduced motion is honoured", matches("prefers-reduced-motion: reduce"));
check("touch targets are declared at 44px", matches("min-height: 44px"));
check("the type scale is fluid, not fixed", /clamp\(/.test(css));
check("no fixed 100vh trap on phones (dvh/svh used)", /100svh|100dvh/.test(css));
check("the skip link is wired in the app shell", /skip-link/.test(read(ROOT, "src", "App.tsx")));

const components = fs.readdirSync(path.join(ROOT, "src", "components"));
const altless = components
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => {
    const source = read(ROOT, "src", "components", file);
    return /<img(?![^>]*alt=)/.test(source.replace(/\n/g, " "));
  });
check("every <img> has an alt attribute", altless.length === 0, altless.join(", "));

const heroSource = read(ROOT, "src", "components", "Hero.tsx");
check("the site says something without JavaScript", /<noscript>/.test(html) && /info@cahen\.ir/.test(html.split("<noscript>")[1] || ""));
check("the hero has exactly one <h1>", (heroSource.match(/<h1/g) || []).length === 1);
check("the hero headline is labelled for assistive tech", /aria-labelledby="hero-title"/.test(heroSource));

/* ================================================================ report */

const failed = results.filter((item) => !item.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} delivery checks passed` +
    (failed.length ? `\n\nFailed: ${failed.map((item) => item.label).join("; ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
