#!/usr/bin/env node
/**
 * Guards the scroll-scrubbed hero film, including the performance regression
 * that made it feel broken:
 *
 *   • the film must never play by itself
 *   • half the scroll must be half the clip, and scrolling back must retrace it
 *   • a scroll must NOT re-render React or recalculate styles for the hero
 *     (the earlier engine wrote React state and a CSS custom property per frame)
 *   • the clip must never reload mid-scroll (a source swap showed another scene)
 *
 * Runs the real component in jsdom with a stubbed media element, so it needs no
 * browser. `npm run hero:check`.
 */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".hero-check");
const DURATION = 13.4;

const ENTRY = `
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContentProvider } from "../../src/content/ContentProvider";
import { Hero } from "../../src/components/Hero";

const root = createRoot(document.getElementById("root"));
act(() => {
  root.render(<ContentProvider><Hero onOrder={() => {}} /></ContentProvider>);
});

/** 2400px track inside a 900px viewport; scroll to a fraction of the travel. */
window.__scrollTo = async (fraction, settle = 2400) => {
  const track = document.querySelector(".hero__track");
  if (!track) return null;
  const height = 2400;
  const travel = height - 900;
  const top = -travel * fraction;
  track.getBoundingClientRect = () => ({
    top, height, bottom: top + height, left: 0, right: 1440, width: 1440, x: 0, y: top,
    toJSON: () => ({}),
  });
  Object.defineProperty(window, "scrollY", { value: travel * fraction, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => setTimeout(resolve, settle));
  const video = document.querySelector("video");
  const bar = document.querySelector(".hero__progress");
  return {
    currentTime: video ? Number(video.currentTime.toFixed(3)) : null,
    paused: video ? video.paused : null,
    bar: bar ? bar.style.transform : null,
    seeks: window.__seeks.length,
    seekLog: window.__seeks.slice(),
  };
};

/**
 * Counts DOM mutations during a synthetic scroll. A React re-render or a
 * per-frame CSS custom property shows up here immediately.
 */
window.__mutationProbe = async (steps = 40) => {
  const track = document.querySelector(".hero__track");
  const hero = document.querySelector(".hero");
  const records = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(hero, { attributes: true, subtree: true, childList: true, characterData: true });
  const height = 2400;
  const travel = height - 900;
  for (let i = 0; i <= steps; i += 1) {
    const top = -(travel * i) / steps;
    track.getBoundingClientRect = () => ({
      top, height, bottom: top + height, left: 0, right: 1440, width: 1440, x: 0, y: top,
      toJSON: () => ({}),
    });
    Object.defineProperty(window, "scrollY", { value: (travel * i) / steps, configurable: true });
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 24));
  }
  await new Promise((resolve) => setTimeout(resolve, 600));
  observer.disconnect();
  const touched = records.map((record) => {
    const node = record.target;
    return (node.className || node.nodeName || "").toString().slice(0, 40);
  });
  const counts = {};
  for (const name of touched) counts[name] = (counts[name] || 0) + 1;
  return {
    total: records.length,
    touched: Array.from(new Set(touched)),
    counts,
    textChanges: records.filter((r) => r.type === "characterData").length,
  };
};

window.__report = () => {
  const hero = document.querySelector(".hero");
  const video = document.querySelector("video");
  const overlay = document.querySelector(".hero__overlay");
  const poster = document.querySelector(".hero__poster--full");
  return {
    mode: hero ? hero.getAttribute("data-film") : null,
    ready: hero ? hero.getAttribute("data-film-ready") : null,
    className: hero ? hero.className : "",
    video: video
      ? {
          src: video.getAttribute("src"),
          autoplay: video.autoplay,
          muted: video.muted,
          loop: video.loop,
          controls: video.controls,
          preload: video.getAttribute("preload"),
        }
      : null,
    overlayFilmP: overlay ? overlay.style.getPropertyValue("--film-p") : null,
    overlayOpacity: overlay ? overlay.style.opacity : null,
    posterSrc: poster ? poster.getAttribute("src") : null,
    plays: window.__events.filter((e) => e === "play").length,
    pauses: window.__events.filter((e) => e === "pause").length,
    loads: window.__events.filter((e) => e === "load").length,
  };
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
  loader: { ".jpg": "dataurl", ".png": "dataurl", ".webp": "dataurl", ".svg": "text", ".css": "empty" },
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  logLevel: "error",
});

const script = fs.readFileSync(path.join(WORK, "bundle.js"), "utf8");

async function mount({ reducedMotion = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost:5173/",
  });
  const { window } = dom;

  window.IS_REACT_ACT_ENVIRONMENT = true;
  window.__events = [];
  window.__seeks = [];
  window.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  window.matchMedia = (query) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : query.includes("min-width: 901px"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });

  const quiet = (method) => {
    const original = window.console[method].bind(window.console);
    window.console[method] = (...args) => {
      if (args.map(String).join(" ").includes("act(")) return;
      original(...args);
    };
  };
  quiet("error");
  quiet("warn");

  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  let currentTime = 0;
  window.__paused = true;
  Object.defineProperty(window.HTMLMediaElement.prototype, "duration", { configurable: true, get: () => DURATION });
  Object.defineProperty(window.HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(window.HTMLMediaElement.prototype, "seeking", { configurable: true, get: () => false });
  Object.defineProperty(window.HTMLMediaElement.prototype, "buffered", {
    configurable: true,
    get: () => ({ length: 1, start: () => 0, end: () => DURATION }),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: () => window.__paused,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "currentTime", {
    configurable: true,
    get: () => currentTime,
    set(value) {
      currentTime = value;
      window.__seeks.push(Number(value.toFixed(3)));
      this.dispatchEvent(new window.Event("seeked"));
    },
  });
  window.HTMLMediaElement.prototype.play = function play() {
    window.__events.push("play");
    window.__paused = false;
    this.dispatchEvent(new window.Event("playing"));
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function pause() {
    window.__events.push("pause");
    window.__paused = true;
  };
  window.HTMLMediaElement.prototype.load = function load() {
    window.__events.push("load");
  };
  window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  window.eval(script);
  const video = window.document.querySelector("video");
  for (const event of ["loadedmetadata", "loadeddata", "canplay", "progress"]) {
    video?.dispatchEvent(new window.Event(event));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  return window;
}

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;

/* ---------------------------------------------------------------- scenarios */

{
  const window = await mount();
  const report = window.__report();

  check("the hero is in scrub mode", report.mode === "scrub");
  check(
    "it loads the lightweight, all-keyframe scrub encode",
    Boolean(report.video?.src?.includes("/film/hero-scrub-1152.mp4")),
    String(report.video?.src),
  );
  check("the video is muted, inline, loopless and has no controls",
    Boolean(report.video?.muted && !report.video?.controls && !report.video?.loop));
  check("it is never asked to autoplay", report.video?.autoplay === false);
  check("it preloads fully, so seeks never hit the network", report.video?.preload === "auto");
  check("the film is shown only once it is usable", report.ready === "true");
  check("no CSS custom property is animated per frame", report.overlayFilmP === "");
  check("the overlay is driven by a plain opacity", report.overlayOpacity !== "");
  check("the poster stays behind it, versioned", Boolean(report.posterSrc?.includes("hero-poster.jpg?v=")));

  const start = await window.__scrollTo(0);
  check("at the top the film rests on its first frame", near(start.currentTime, 0, 0.1), String(start.currentTime));
  check("at the top it is paused, not playing", start.paused === true);

  const mid = await window.__scrollTo(0.5);
  check(
    "half the scroll is half the film",
    near(mid.currentTime, DURATION / 2, 0.6),
    `${mid.currentTime} vs ${DURATION / 2}`,
  );
  check("the film is still paused mid-scroll", mid.paused === true);
  const barValue = Number((/scaleX\(([\d.]+)\)/.exec(mid.bar || "") || [])[1]);
  check("the progress bar tracks the film", barValue > 0.42 && barValue <= 0.52, String(mid.bar));

  const end = await window.__scrollTo(1);
  check("the end of the scroll is the end of the film", end.currentTime >= DURATION - 1.2, String(end.currentTime));

  const back = await window.__scrollTo(0.25);
  check(
    "scrolling back retraces the same frames",
    near(back.currentTime, DURATION * 0.25, 0.55),
    `${back.currentTime} vs ${DURATION * 0.25}`,
  );
  check("the film never plays on its own", end.paused === true && back.paused === true);
  check("the source is never swapped after mount", report.loads <= 1, `loads=${report.loads}`);

  // The regression that broke the hero: per-frame React state + style recalc.
  const probe = await window.__mutationProbe();
  // Only the two compositor layers may change per frame; the section gets a
  // handful of one-off flags (active on/off) and nothing else may move.
  const perFrame = new Set(["hero__overlay", "hero__progress"]);
  const oneOff = new Set(["hero hero--film", "hero hero--film is-still"]);
  const unexpected = probe.touched.filter((name) => !perFrame.has(name) && !oneOff.has(name));
  const leaked = Object.entries(probe.counts).filter(([name, count]) => oneOff.has(name) && count > 4);
  check(
    "scrolling mutates only the two compositor layers",
    probe.touched.length > 0 && unexpected.length === 0 && leaked.length === 0,
    `${probe.total} mutations: ${JSON.stringify(probe.counts)}`,
  );
  check("React never re-renders the hero while scrolling", probe.textChanges === 0, `text changes=${probe.textChanges}`);
  check(
    "no text is re-rendered while scrolling",
    !probe.touched.some((name) => /hero__title|hero__lede|hero__line|MARQUEE|span/i.test(name)),
    probe.touched.join(", "),
  );
}

{
  const window = await mount({ reducedMotion: true });
  const report = window.__report();
  check("reduced motion renders no video at all", report.video === null);
  check("reduced motion keeps the poster", Boolean(report.posterSrc?.includes("hero-poster.jpg")));
  check("reduced motion never reports the film as ready", report.ready === null || report.ready === "false");
}

{
  // The stylesheet itself must stay free of the two per-frame costs.
  const css = fs.readFileSync(path.join(ROOT, "src/styles/hero.css"), "utf8");
  check("no animated CSS custom property in the hero", !/var\(--film-p\)/.test(css));
  check("no blend-mode layer over the film", !/mix-blend-mode/.test(css));
  const filmRule = /\.hero__film-media\s*\{([^}]*)\}/.exec(css);
  check(
    "the film surface is never transformed (no per-frame re-raster)",
    Boolean(filmRule) && !/transform:|will-change/.test(filmRule[1]),
    filmRule ? filmRule[1].replace(/\s+/g, " ").trim() : "rule missing",
  );
}

/* -------------------------------------------------------------------- done */

await fsp.rm(WORK, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} hero film checks passed`);
process.exit(failed ? 1 : 0);
