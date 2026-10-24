#!/usr/bin/env node
/**
 * The phone contract.
 *
 * A phone is the first screen for most visitors, so the mobile layer is not
 * allowed to regress quietly. This runs the real Header, MobileDock and
 * Preloader in jsdom at a phone viewport and pins:
 *
 *   • the dock exists, stays out of the film, and arrives afterwards
 *   • the dock opens the index and the project sheet
 *   • the entrance shares the hero's own frame
 *   • safe areas, tap targets, the 62 px bar and the bottom sheet are present
 *   • nothing in the phone layer relies on backdrop blur over the film
 *
 * `npm run mobile:check`.
 */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".mobile-check");

const ENTRY = `
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContentProvider } from "../../src/content/ContentProvider";
import { Header } from "../../src/components/Header";
import { MobileDock } from "../../src/components/MobileDock";
import { Preloader } from "../../src/components/Preloader";

window.__orders = 0;

const root = createRoot(document.getElementById("root"));
act(() => {
  root.render(
    <ContentProvider>
      <Header onOrder={() => { window.__orders += 1; }} ready />
      <MobileDock onOrder={() => { window.__orders += 1; }} />
    </ContentProvider>
  );
});

const settle = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));

window.__scroll = async (y) => {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  await settle();
  const dock = document.querySelector(".dock");
  const meter = document.querySelector(".dock__meter");
  return {
    dock: dock ? dock.className : null,
    meter: meter ? meter.style.transform : null,
    chapter: document.querySelector(".dock__name") ? document.querySelector(".dock__name").textContent : null,
    numeral: document.querySelector(".dock__num") ? document.querySelector(".dock__num").textContent : null,
    cta: document.querySelector(".dock__cta") ? document.querySelector(".dock__cta").textContent.trim() : null,
    tabbable: Array.from(document.querySelectorAll(".dock button")).map((b) => b.tabIndex),
  };
};

window.__activate = async (selector) => {
  const node = document.querySelector(selector);
  if (!node) return null;
  act(() => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await settle(220);
  return {
    orders: window.__orders,
    menu: document.querySelector(".menu") ? document.querySelector(".menu").className : null,
  };
};

window.__menuSocials = () =>
  Array.from(document.querySelectorAll(".menu__social-link")).map((link) => ({
    href: link.getAttribute("href"),
    label: link.getAttribute("aria-label"),
    name: link.querySelector(".menu__social-name")?.textContent ?? null,
    platform: link.querySelector(".menu__social-platform")?.textContent ?? null,
    icon: link.querySelector(".menu__social-icon img")?.getAttribute("src") ?? null,
    arrow: Boolean(link.querySelector(".menu__social-arrow")),
  }));

window.__menuMail = () => document.querySelector(".menu__mail")?.getAttribute("href") ?? null;

window.__blurOverFilm = () => {
  const dock = document.querySelector(".dock");
  const header = document.querySelector(".header");
  return [dock, header].filter(Boolean).length;
};

window.__mountPreloader = async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const inner = createRoot(host);
  act(() => { inner.render(<Preloader onDone={() => {}} />); });
  await settle(60);
  const backdrop = host.querySelector(".preloader__backdrop");
  const value = {
    backdrop: backdrop ? backdrop.innerHTML + backdrop.className : null,
    hasCanvas: Boolean(host.querySelector(".preloader__sand-canvas")),
    marks: Boolean(host.querySelector(".preloader__mark")),
  };
  act(() => inner.unmount());
  host.remove();
  return value;
};
`;

await fsp.mkdir(WORK, { recursive: true });
await fsp.writeFile(path.join(WORK, "entry.tsx"), ENTRY);

await build({
  entryPoints: [path.join(WORK, "entry.tsx")],
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: path.join(WORK, "bundle.js"),
  loader: { ".jpg": "dataurl", ".png": "dataurl", ".webp": "dataurl", ".svg": "dataurl", ".css": "empty" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "error",
});

const script = fs.readFileSync(path.join(WORK, "bundle.js"), "utf8");

/* ------------------------------------------------------------------ mount */

const dom = new JSDOM(`<!doctype html><html lang="fa" dir="rtl"><body><div id="root"></div></body></html>`, {
  runScripts: "outside-only",
  pretendToBeVisual: true,
  url: "http://localhost:5173/",
});
const { window } = dom;

window.IS_REACT_ACT_ENVIRONMENT = true;
window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });

/** A phone: 390 × 844 CSS px, coarse pointer, no hover. */
const PHONE = { width: 390, height: 844 };

window.matchMedia = (query) => {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query);
  const min = /\(min-width:\s*(\d+)px\)/.exec(query);
  let matches = false;
  if (max) matches = PHONE.width <= Number(max[1]);
  else if (min) matches = PHONE.width >= Number(min[1]);
  else if (/pointer:\s*coarse/.test(query)) matches = true;
  else if (/hover:\s*hover/.test(query)) matches = false;
  else if (/prefers-reduced-motion/.test(query)) matches = false;
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
};

Object.defineProperty(window, "innerWidth", { value: PHONE.width, configurable: true });
Object.defineProperty(window, "innerHeight", { value: PHONE.height, configurable: true });
Object.defineProperty(window.document.documentElement, "scrollHeight", { value: 12000, configurable: true });
Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
window.cancelAnimationFrame = (id) => clearTimeout(id);
window.HTMLElement.prototype.scrollIntoView = () => {};
// jsdom has no 2D engine; the sand word degrades by design.
window.HTMLCanvasElement.prototype.getContext = () => null;

for (const method of ["error", "warn"]) {
  const original = window.console[method].bind(window.console);
  window.console[method] = (...args) => {
    if (args.map(String).join(" ").includes("act(")) return;
    original(...args);
  };
}

window.eval(script);

/* ----------------------------------------------------------------- checks */

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await sleep(200);

{
  const atTop = await window.__scroll(0);
  check("the dock is mounted on a phone", Boolean(atTop.dock));
  check("the hero stays clean: no dock over the film", !String(atTop.dock).includes("dock--in"));
  check(
    "hidden dock is out of the tab order",
    Array.isArray(atTop.tabbable) && atTop.tabbable.every((index) => index === -1),
    JSON.stringify(atTop.tabbable),
  );
  check("the dock names the current chapter", Boolean(atTop.chapter), String(atTop.chapter));
  check("the chapter is numbered in Roman numerals", /^[IVX]+$/.test(atTop.numeral || ""), String(atTop.numeral));
  check("the dock carries the primary action", /شروع یک پروژه/.test(atTop.cta || ""), String(atTop.cta));
}

{
  const deep = await window.__scroll(4200);
  check("the dock arrives once the film is behind you", String(deep.dock).includes("dock--in"), String(deep.dock));
  check(
    "the dock shows page progress",
    /scaleX\(0\.\d+\)/.test(deep.meter || "") && !/scaleX\(0\)/.test(deep.meter || ""),
    String(deep.meter),
  );
  check(
    "both dock controls are reachable once shown",
    Array.isArray(deep.tabbable) && deep.tabbable.every((index) => index === 0),
    JSON.stringify(deep.tabbable),
  );
}

{
  const before = window.__orders;
  const click = await window.__activate(".dock__cta");
  check("the dock CTA opens the project sheet", click && click.orders === before + 1, JSON.stringify(click));
  window.__orders = before;
}

{
  const click = await window.__activate(".dock__chapter");
  check("the chapter chip opens the index", String(click?.menu).includes("menu--open"), String(click?.menu));
}

{
  const preloader = await window.__mountPreloader();
  check(
    "the entrance paints the same light the hero is built from",
    /preloader__aurora/.test(String(preloader.backdrop)),
    String(preloader.backdrop).slice(0, 80),
  );
  check("the entrance downloads nothing to paint it", !/img|http/.test(String(preloader.backdrop)));
  check("the sand word is still the entrance", preloader.hasCanvas && preloader.marks);
}

/* ------------------------------------------------------- the channels */

{
  const channels = window.__menuSocials();
  check("the menu lists all three channels", channels.length === 3, JSON.stringify(channels.map((c) => c.name)));

  const named = (platform) => channels.find((channel) => channel.platform === platform);

  check("every channel carries its own icon in the menu", channels.every((c) => /^data:image\/svg/.test(c.icon || "")),
    JSON.stringify(channels.map((c) => c.icon?.slice(0, 24))));
  check("every channel has a visible name and platform", channels.every((c) => c.name && c.platform));
  check("every channel shows where the tap goes", channels.every((c) => c.arrow && /پنجرهٔ تازه/.test(c.label || "")));

  check("Telegram points at the studio channel", named("Telegram")?.href === "https://t.me/CAHENWEB", String(named("Telegram")?.href));
  check(
    "Instagram points at the studio profile",
    named("Instagram")?.href === "https://www.instagram.com/CAHENWEB/",
    String(named("Instagram")?.href),
  );
  check(
    "WhatsApp opens a chat with the studio in E.164 digits",
    named("WhatsApp")?.href === "https://wa.me/989023841612",
    String(named("WhatsApp")?.href),
  );
  check("the menu mail link is the studio address", window.__menuMail() === "mailto:info@cahen.ir", String(window.__menuMail()));
}

/* ------------------------------------------------------- static contracts */

const glass = fs.readFileSync(path.join(ROOT, "src/styles/glass.css"), "utf8");

const css = fs.readFileSync(path.join(ROOT, "src/styles/mobile.css"), "utf8");
const heroCss = fs.readFileSync(path.join(ROOT, "src/styles/hero.css"), "utf8");
const headerCss = fs.readFileSync(path.join(ROOT, "src/styles/header.css"), "utf8");
const rootCss = fs.readFileSync(path.join(ROOT, "src/index.css"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

check("the viewport opts into the notch", /viewport-fit=cover/.test(html));

{
  const heroSource = fs.readFileSync(path.join(ROOT, "src/components/Hero.tsx"), "utf8");
  check(
    "the phone hero is one screen with the ticker underneath",
    /className="hero__ticker"/.test(heroSource),
  );
  check("no film is preloaded any more", !/hero-poster-blur/.test(html));
}
check("phones use a 62px bar", /--header-h:\s*62px/.test(rootCss));
check("pull-to-refresh cannot reload the film", /overscroll-behavior-y:\s*contain/.test(css));
check(
  "chrome respects every safe area",
  (css.match(/env\(safe-area-inset-/g) || []).length >= 8,
  `${(css.match(/env\(safe-area-inset-/g) || []).length} uses`,
);
check("form fields are 16px, so iOS never zooms on focus", /\.field__input,\s*\n\s*\.field__textarea\s*\{\s*\n\s*font-size:\s*16px/.test(css)
  || /\.field__input,?\s*\.field__textarea\s*\{[^}]*font-size:\s*16px/.test(css));
check("the order form is a bottom sheet on a phone", /\.modal__panel\s*\{[^}]*border-radius:\s*24px 24px 0 0/.test(css));
check("the dock is hidden from tablet upwards", /@media \(min-width: 768px\) \{\s*\.dock \{\s*display: none/.test(css));
check("no blur on the header while the film runs", !/\.header--solid[^{]*\{[^}]*backdrop-filter:\s*blur/.test(css));
check("the glass header blur is disabled on phones", /@media \(max-width: 767px\)[\s\S]*?\.header--solid \{[\s\S]*?backdrop-filter: none/.test(css));
check("the phone instruction for the film is hidden on desktop", /\.hero__scroll-hint \{\s*display: none;/.test(heroCss));
check("the phone shows that instruction instead", /\.hero__scroll-label \{\s*display: none;/.test(css));
check(
  "the phone hero never pins the page",
  !/\.hero__stage \{[^}]*position: sticky/.test(heroCss) && !/\.hero__track/.test(heroCss),
);
check(
  "a short phone drops the translation before the headline collides",
  /@media \(max-width: 767px\) and \(max-height: 700px\)[\s\S]{0,160}\.hero__translation \{\s*display: none/.test(css),
);
check(
  "a phone on its side still fits on one screen",
  /@media \(max-width: 767px\) and \(max-height: 520px\)[\s\S]{0,600}\.hero__title \{\s*font-size/.test(css),
);
check("tap targets are at least 44px", /min-width: 44px;\s*\n\s*min-height: 44px/.test(css));
check("presses are answered, not hovered", /\.btn:active/.test(css) && /:active/.test(css));
{
  // The one rule that must hold for the new opening screen: the aurora and the
  // canvas are moved by transform only, and never by a per-frame custom property.
  check(
    "the hero's light animates on the compositor only",
    !/var\(--(film|hero)-p\)/.test(heroCss) && /\.hero__aurora \{[^}]*will-change: transform/.test(heroCss),
  );
  check(
    "the light is dimmed for reduced motion, not removed",
    /prefers-reduced-motion: reduce\)[\s\S]{0,140}\.hero__aurora \{\s*animation: none/.test(heroCss),
  );
}

/* ---- the office plate and the glass material ---- */

check(
  "the office plate is landscape on a phone, not screen-sized",
  /\.intro__portrait-frame \{[^}]*aspect-ratio: 1\.24/.test(css),
);
check(
  "the office plate is capped and centred on a phone",
  /\.intro__portrait \{[^}]*max-width: 100%/.test(css),
);

{
  const panes = [
    ".service",
    ".gallery__card",
    ".gallery__details",
    ".cta__social-panel",
    ".cta__channel",
    ".studio__sheet",
    ".modal__panel",
  ];
  const missing = panes.filter(
    (selector) =>
      !new RegExp(`${selector.replace(".", "\\.")}[^{]*\\{[^}]*border: 1px solid var\\(--glass-rom\\)`).test(glass),
  );
  check("every card class is cut from the glass pane", missing.length === 0, missing.join(", "));
}

check(
  "the glass never steals the carousel's positioning",
  !/\.gallery__card[^{]*\{[^}]*position: relative/.test(glass),
);
check("the pane carries a reflection layer", (glass.match(/var\(--glass-sheen\)/g) || []).length >= 2);
check(
  "the reflection is laid under the content, never over it",
  /\.cta__channel::after,[\s\S]{0,160}?z-index: -1/.test(glass),
);
check(
  "cards get a real blur on a pointer device only",
  /@media \(hover: hover\) and \(pointer: fine\) and \(min-width: 900px\)[\s\S]*?backdrop-filter: blur/.test(glass),
);
check(
  "the animated carousel never gets a per-frame blur",
  !/\.gallery__card \{[^}]*backdrop-filter/.test(glass),
);
check(
  "a browser without backdrop-filter still gets a solid pane",
  /@supports not \(\(backdrop-filter/.test(glass),
);

/* -------------------------------------------------------------------- done */

await fsp.rm(WORK, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} mobile checks passed`);
process.exit(failed ? 1 : 0);
