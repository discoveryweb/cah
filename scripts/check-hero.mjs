#!/usr/bin/env node
/**
 * Guards the scroll-scrubbed hero film. These are the failures a visitor sees
 * but a code review cannot: the film playing on its own, the timeline not
 * following the scroll, a dead zone at the start, or the film running backwards
 * only when the page is scrolled up.
 *
 * Runs the real React component in jsdom with a stubbed media element (seeks are
 * recorded, not decoded), so it needs no browser. `npm run hero:check`.
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

/**
 * Pretend the tall track is 2400px in a 900px viewport, then scroll to a
 * fraction of the scrub distance and report what the film did.
 */
window.__scrollTo = async (fraction, settle = 2600) => {
  const track = document.querySelector(".hero__track");
  if (!track) return null;
  const height = 2400;
  const travel = height - 900;
  track.getBoundingClientRect = () => ({
    top: -travel * fraction, height, bottom: height - travel * fraction,
    left: 0, right: 1440, width: 1440, x: 0, y: -travel * fraction,
    toJSON: () => ({}),
  });
  Object.defineProperty(window, "scrollY", { value: travel * fraction, configurable: true });
  window.dispatchEvent(new Event("scroll"));
  // The engine eases with a ~1s time constant: settle before asserting.
  await new Promise((resolve) => setTimeout(resolve, settle));
  const video = document.querySelector("video");
  const media = document.querySelector(".hero__film-media");
  return {
    fraction,
    currentTime: video ? Number(video.currentTime.toFixed(3)) : null,
    paused: video ? video.paused : null,
    transform: media ? media.style.transform : null,
    overlayOpacity: document.querySelector(".hero__overlay")
      ? getComputedStyle(document.querySelector(".hero__overlay")).opacity
      : null,
    overlayVar: document.querySelector(".hero__overlay")
      ? document.querySelector(".hero__overlay").style.getPropertyValue("--film-p")
      : null,
    progress: Number(document.querySelector(".hero").getAttribute("data-film-progress")),
    className: document.querySelector(".hero").className,
    seeks: window.__seeks.length,
    seekLog: window.__seeks.slice(),
  };
};

window.__report = () => {
  const hero = document.querySelector(".hero");
  const video = document.querySelector("video");
  const poster = document.querySelector(".hero__poster--full");
  return {
    className: hero ? hero.className : "",
    mode: hero ? hero.getAttribute("data-film") : null,
    progress: hero ? Number(hero.getAttribute("data-film-progress")) : null,
    trackHeight: document.querySelector(".hero__track")
      ? getComputedStyle(document.querySelector(".hero__track")).height
      : null,
    video: video
      ? {
          src: video.getAttribute("src"),
          autoplay: video.autoplay,
          muted: video.muted,
          controls: video.controls,
          preload: video.getAttribute("preload"),
          poster: video.getAttribute("poster"),
        }
      : null,
    posterSrc: poster ? poster.getAttribute("src") : null,
    seeks: window.__seeks.slice(),
    played: window.__events.filter((e) => e === "play").length,
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
      const text = args.map(String).join(" ");
      if (text.includes("act(")) return;
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

  /* A video that only reports metadata: any play() must not stick. */
  let currentTime = 0;
  Object.defineProperty(window.HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => DURATION,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(window.HTMLMediaElement.prototype, "seeking", { configurable: true, get: () => false });
  Object.defineProperty(window.HTMLMediaElement.prototype, "paused", {
    configurable: true,
    get: () => window.__paused,
  });
  window.__paused = true;

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
    // Report success, then behave like a video that stops immediately: the
    // scrubber must keep it paused regardless.
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
  video?.dispatchEvent(new window.Event("loadedmetadata"));
  video?.dispatchEvent(new window.Event("loadeddata"));
  video?.dispatchEvent(new window.Event("canplay"));
  await new Promise((resolve) => setTimeout(resolve, 120));
  return window;
}

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

const near = (a, b, tolerance = 0.35) => Math.abs(a - b) <= tolerance;

/* ---------------------------------------------------------------- scenarios */

{
  const window = await mount();
  const report = window.__report();

  check("the hero is in scrub mode", report.mode === "scrub");
  check(
    "the film is the all-keyframe scrub encode",
    Boolean(report.video?.src?.includes("/film/hero-scrub-1920".replace("1920", "1440"))),
    String(report.video?.src),
  );
  check("the video element is muted, inline and has no controls", Boolean(report.video?.muted && !report.video?.controls));
  check("it is not asked to autoplay", report.video?.autoplay === false, JSON.stringify(report.video));
  check("it is preloaded fully, so seeks are instant", report.video?.preload === "auto");
  check("the poster is behind it, versioned", Boolean(report.posterSrc?.includes("hero-poster.jpg?v=")));

  // The track must be tall enough to make the scrub feel deliberate. jsdom has
  // no CSS engine, so read the declaration straight from the stylesheet.
  const css = fs.readFileSync(path.join(ROOT, "src/styles/hero.css"), "utf8");
  const trackRule = /\.hero__track \{[^}]*height:\s*(\d+)svh/.exec(css);
  check(
    "the scroll track is several screens tall",
    Boolean(trackRule) && Number(trackRule[1]) >= 250,
    trackRule ? trackRule[0].replace(/\s+/g, " ") : "height not found",
  );

  const start = await window.__scrollTo(0);
  check("at the top the film is at its first frame", near(start.currentTime, 0, 0.1), String(start.currentTime));
  check("at the top it is paused, not playing", start.paused === true);
  check("the reader is told the film has not started", near(start.progress, 0, 0.02), String(start.progress));

  const mid = await window.__scrollTo(0.5);
  check(
    "half way through the scroll shows the middle of the film",
    near(mid.currentTime, DURATION / 2, 0.6),
    `${mid.currentTime} vs ${DURATION / 2}`,
  );
  check("…and it is still paused", mid.paused === true);
  check(
    "…with the progress readout tracking the film",
    mid.progress > 0.4 && mid.progress <= 0.51,
    String(mid.progress),
  );

  const end = await window.__scrollTo(1);
  check(
    "the end of the scroll is the end of the film",
    end.currentTime >= DURATION - 1.2 && end.currentTime <= DURATION,
    String(end.currentTime),
  );
  check("the film never plays on its own", end.paused === true);

  const back = await window.__scrollTo(0.25);
  check(
    "scrolling back walks the film backwards symmetrically",
    near(back.currentTime, DURATION * 0.25, 0.6),
    `${back.currentTime} vs ${DURATION * 0.25}`,
  );
  check("the transform follows the scroll too", back.transform.includes("translate3d"));
  const uniqueTimes = new Set(back.seekLog.map((value) => value.toFixed(2)));
  check(
    "seeks are coalesced instead of one per animation frame",
    back.seeks < 240 && uniqueTimes.size > 8,
    `seeks=${back.seeks}, distinct=${uniqueTimes.size}`,
  );
}

{
  const window = await mount({ reducedMotion: true });
  const report = window.__report();
  check("reduced motion renders no video at all", report.video === null);
  check("reduced motion keeps the poster", Boolean(report.posterSrc?.includes("hero-poster.jpg")));
}

/* -------------------------------------------------------------------- done */

await fsp.rm(WORK, { recursive: true, force: true });

const failed = results.filter((item) => !item.ok).length;
console.log(`\n${results.length - failed}/${results.length} hero film checks passed`);
process.exit(failed ? 1 : 0);
