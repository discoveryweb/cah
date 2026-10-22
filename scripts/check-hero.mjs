#!/usr/bin/env node
/**
 * Guards the hero film against the failure modes that are invisible in code
 * review but obvious to a visitor:
 *
 *   1. no <video> element at all (the low-end-device gate used to remove it)
 *   2. a paused clip showing frame zero, which is black (fade from black)
 *   3. a browser refusing autoplay and nothing ever starting the film
 *   4. the scroll transform never being applied
 *
 * Runs the real React component in jsdom, with the media element stubbed, so it
 * needs no browser. `npm run hero:check`.
 */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".hero-check");

const ENTRY = `
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContentProvider } from "../../src/content/ContentProvider";
import { Hero } from "../../src/components/Hero";

const root = createRoot(document.getElementById("root"));
act(() => {
  root.render(<ContentProvider><Hero onOrder={() => {}} /></ContentProvider>);
});

window.__scrollTest = async () => {
  const track = document.querySelector(".hero__track");
  const media = document.querySelector(".hero__film-media");
  if (!track || !media) return "";
  track.getBoundingClientRect = () => ({
    top: -150, height: 1200, bottom: 1050, left: 0, right: 1440, width: 1440, x: 0, y: -150,
    toJSON: () => ({}),
  });
  Object.defineProperty(window, "scrollY", { value: 150, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => setTimeout(resolve, 220));
  return media.style.transform;
};

window.__report = () => {
  const hero = document.querySelector(".hero");
  const video = document.querySelector("video");
  const poster = document.querySelector(".hero__poster--full");
  return {
    className: hero ? hero.className : "",
    state: hero ? hero.getAttribute("data-film-state") : null,
    video: video
      ? {
          src: video.getAttribute("src"),
          autoplay: video.autoplay,
          muted: video.muted,
          loop: video.loop,
          playsInline: video.playsInline,
          poster: video.getAttribute("poster"),
        }
      : null,
    posterSrc: poster ? poster.getAttribute("src") : null,
    playButton: Boolean(document.querySelector(".hero__play")),
    plays: window.__events.filter((e) => e === "play").length,
    refusals: window.__events.filter((e) => e === "play:refused").length,
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

/**
 * @param {{ cores?: number, reducedMotion?: boolean, refuseAutoplay?: boolean }} options
 */
async function mount({ cores = 8, reducedMotion = false, refuseAutoplay = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost:5173/",
  });
  const { window } = dom;

  // React warns that jsdom is not a test runner; the harness is one.
  window.IS_REACT_ACT_ENVIRONMENT = true;
  const quiet = (method) => {
    const original = window.console[method].bind(window.console);
    window.console[method] = (...args) => {
      const text = args.map(String).join(" ");
      if (text.includes("act(") || text.includes("not configured to support act")) return;
      original(...args);
    };
  };
  quiet("error");
  quiet("warn");
  window.__events = [];
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
  Object.defineProperty(window.navigator, "hardwareConcurrency", { value: cores, configurable: true });
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
    }
    observe(target) {
      this.callback([{ isIntersecting: true, target }], this);
    }
    unobserve() {}
    disconnect() {}
  };

  let refusals = refuseAutoplay ? 2 : 0;
  window.HTMLMediaElement.prototype.play = function play() {
    window.__events.push(refusals > 0 ? "play:refused" : "play");
    if (refusals > 0) {
      refusals -= 1;
      return Promise.reject(new window.DOMException("autoplay blocked", "NotAllowedError"));
    }
    Object.defineProperty(this, "paused", { value: false, configurable: true });
    this.dispatchEvent(new window.Event("playing"));
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function pause() {
    window.__events.push("pause");
    Object.defineProperty(this, "paused", { value: true, configurable: true });
  };
  window.HTMLMediaElement.prototype.load = function load() {
    window.__events.push("load");
  };
  Object.defineProperty(window.HTMLMediaElement.prototype, "duration", { configurable: true, get: () => 14.57 });
  Object.defineProperty(window.HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 140));
  return window;
}

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

/* ---------------------------------------------------------------- scenarios */

{
  const window = await mount({ cores: 8 });
  const report = window.__report();
  const transform = await window.__scrollTest();

  check(
    "the film is a real <video>, not a poster swap",
    Boolean(report.video) && report.video.src.includes("/film/hero-1920.mp4"),
    JSON.stringify(report.video),
  );
  check(
    "it is muted, inline, looping and autoplaying",
    Boolean(report.video?.autoplay && report.video?.muted && report.video?.loop && report.video?.playsInline),
    JSON.stringify(report.video),
  );
  check("playback is requested on mount", report.plays >= 1, `plays=${report.plays}`);
  check("the hero reports itself as playing", report.state === "playing", `state=${report.state}`);
  check("the video layer is revealed (is-playing)", report.className.includes("is-playing"));
  check(
    "the poster is always underneath, with a versioned URL",
    report.posterSrc?.includes("/film/hero-poster.jpg") && report.posterSrc.includes("?v="),
    String(report.posterSrc),
  );
  check(
    "scrolling drives a composited transform",
    transform.includes("translate3d") && transform.includes("scale(1.0"),
    transform,
  );
  check("no play button when autoplay works", report.playButton === false);
}

{
  // The bug: a 2-core/2 GB machine used to get no video element at all.
  const window = await mount({ cores: 2 });
  const report = window.__report();
  check(
    "a low-end device still gets the film (2 cores)",
    Boolean(report.video) && report.state === "playing",
    `state=${report.state}`,
  );
  check("…and is not permanently frozen", report.className.includes("is-playing"));
}

{
  const window = await mount({ reducedMotion: true });
  const report = window.__report();
  check("reduced motion renders no video element", report.video === null);
  check("reduced motion keeps the poster", Boolean(report.posterSrc?.includes("hero-poster.jpg")));
  check("reduced motion does not claim to be playing", !report.className.includes("is-playing"));
}

{
  const window = await mount({ refuseAutoplay: true });
  const before = window.__report();
  check("a refused autoplay never shows a black frame", before.state === "loading", `state=${before.state}`);
  check("a refused autoplay offers an explicit play control", before.playButton === true);
  check("the poster is visible while blocked", Boolean(before.posterSrc?.includes("hero-poster.jpg")));

  window.dispatchEvent(new window.Event("wheel"));
  window.dispatchEvent(new window.Event("scroll"));
  await new Promise((resolve) => setTimeout(resolve, 140));
  const after = window.__report();
  check("the first gesture starts the film", after.state === "playing", `state=${after.state}`);
  check("the play control disappears once playing", after.playButton === false);
}

/* -------------------------------------------------------------------- done */

await fsp.rm(WORK, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} hero film checks passed`);
process.exit(failed ? 1 : 0);
