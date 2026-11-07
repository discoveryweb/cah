#!/usr/bin/env node
/**
 * The panel and the site are one system.
 *
 * Everything else in this repo tests one side of the contract: the admin API
 * saves, the public endpoint serves. What a reader actually experiences is the
 * seam between them, and that seam is where a site silently goes stale — the
 * save lands, and the open page keeps showing yesterday's copy until someone
 * reloads.
 *
 * This mounts the real `ContentProvider` in jsdom against a stub `/api/content`
 * and holds the behaviour that keeps the two in step:
 *
 *   • the first load paints the published document, not the seeded defaults
 *   • a tab that comes back into view picks up a document saved since
 *   • the panel's announcement reaches an open tab in the same browser
 *   • a refresh that returns the same `updatedAt` changes nothing at all —
 *     no re-render, no reflow, no lost reading position
 *   • a storage outage leaves the site standing on its defaults
 *
 *   npm run live:check
 */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".live-check");

const ENTRY = `
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContentProvider, useContent } from "../../src/content/ContentProvider";

function Brand() {
  const content = useContent();
  return <h1 id="brand">{content.meta.brand}</h1>;
}

const root = createRoot(document.getElementById("root"));
act(() => {
  root.render(<ContentProvider><Brand /></ContentProvider>);
});
window.__brand = () => document.getElementById("brand")?.textContent ?? "";
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
const script = await fsp.readFile(path.join(WORK, "bundle.js"), "utf8");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

/** A window whose `/api/content` answers from a script the test controls. */
function mount({ documents, fail = false }) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost:5173/",
  });
  const { window } = dom;
  window.IS_REACT_ACT_ENVIRONMENT = true;

  const state = { index: 0, calls: 0, urls: [] };
  window.__next = () => {
    const payload = documents[Math.min(state.index, documents.length - 1)];
    state.index += 1;
    return payload;
  };
  window.__calls = () => state.calls;
  window.__urls = () => state.urls.slice();

  window.fetch = (input, init = {}) => {
    state.calls += 1;
    state.urls.push(`${init.method ?? "GET"} ${String(input)}`);
    if (fail) return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(window.__next()),
    });
  };

  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  window.eval(script);
  // Past the first paint the test drives real events, not act(); the flag only
  // silences React's advice about updates it did not schedule.
  window.IS_REACT_ACT_ENVIRONMENT = false;
  return { window, state };
}

/** Let the pending promise chain finish. */
const settle = (window) =>
  new Promise((resolve) => window.setTimeout(resolve, 30));

const silent = { ok: true, updatedAt: "2026-01-01T00:00:00.000Z", content: { meta: { brand: "نسخه اول" } } };
const updated = { ok: true, updatedAt: "2026-01-02T00:00:00.000Z", content: { meta: { brand: "نسخه دوم" } } };

/* ------------------------------------------------ 1. the first load paints */

{
  const { window } = mount({ documents: [silent] });
  await settle(window);
  check("the first load paints the published document", window.__brand() === "نسخه اول", window.__brand());
  check("one request is enough to start", window.__calls() === 1, `${window.__calls()} calls`);
  check(
    "the document is fetched without a stale cache",
    /^GET \/api\/content$/.test(window.__urls()[0] ?? ""),
    window.__urls()[0],
  );
}

/* ------------------------------------- 2. an open tab picks up a later save */

{
  const { window } = mount({ documents: [silent, updated] });
  await settle(window);
  check("the page starts on the old document", window.__brand() === "نسخه اول", window.__brand());

  // The access throttle is real; move the clock past it rather than wait.
  const realNow = window.Date.now;
  let skew = 0;
  window.Date.now = () => realNow() + skew;
  skew += 10_000;

  window.document.dispatchEvent(new window.Event("visibilitychange"));
  await settle(window);
  check("coming back into view picks up a save made while away", window.__brand() === "نسخه دوم", window.__brand());
  check("and it did not need a reload", window.__calls() === 2, `${window.__calls()} calls`);
}

/* --------------------------------- 3. the panel announces, the tab listens */

{
  const { window } = mount({ documents: [silent, updated] });
  await settle(window);
  const realNow = window.Date.now;
  let skew = 0;
  window.Date.now = () => realNow() + skew;

  const storage = new window.Event("storage");
  storage.key = "cahen:content-saved";
  skew += 10_000;
  window.dispatchEvent(storage);
  await settle(window);
  check("a save announced by the panel reaches the open page", window.__brand() === "نسخه دوم", window.__brand());
}

/* ------------------------- 4. an unchanged document changes nothing at all */

{
  const { window } = mount({ documents: [silent, silent, silent] });
  await settle(window);
  const root = window.document.getElementById("root");
  let mutations = 0;
  const observer = new window.MutationObserver((list) => {
    mutations += list.length;
  });
  observer.observe(root, { attributes: true, subtree: true, childList: true, characterData: true });

  const realNow = window.Date.now;
  let skew = 0;
  window.Date.now = () => realNow() + skew;
  for (let round = 0; round < 3; round += 1) {
    skew += 10_000;
    window.dispatchEvent(new window.Event("focus"));
    await settle(window);
  }
  observer.disconnect();
  check("a refetch that finds the same document does not touch the DOM", mutations === 0, `${mutations} mutations`);
  check("but the page did check", window.__calls() === 4, `${window.__calls()} calls`);
}

/* -------------------- 5. a reset reaches a page that is already open too */

{
  const { window } = mount({ documents: [silent, { ok: true, updatedAt: "2026-01-03T00:00:00.000Z", content: null }] });
  await settle(window);
  check("the page starts on the saved document", window.__brand() === "نسخه اول", window.__brand());

  const realNow = window.Date.now;
  let skew = 10_000;
  window.Date.now = () => realNow() + skew;
  skew += 10_000;

  window.document.dispatchEvent(new window.Event("visibilitychange"));
  await settle(window);
  check(
    "resetting the content returns an open page to the studio's own copy",
    window.__brand() !== "نسخه اول" && window.__brand().length > 0,
    window.__brand(),
  );
}

/* ------------------------------------- 6. a storage outage is not an outage */

{
  const { window } = mount({ documents: [silent], fail: true });
  await settle(window);
  check("with the store down the site still renders its own copy", Boolean(window.__brand()), window.__brand());
  check("and asks nothing more of a broken endpoint", window.__calls() === 1, `${window.__calls()} calls`);
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} live content checks passed`);
const failures = results.filter((r) => !r.ok).map((r) => r.label);
if (failures.length) console.log(`\nFailed: ${failures.join("; ")}`);

await fsp.rm(WORK, { recursive: true, force: true });
process.exit(failures.length ? 1 : 0);
