#!/usr/bin/env node
/**
 * Guards the speed of the site.
 *
 * Every rule here was measured before it was written. The page used to:
 *
 *   • run a `requestAnimationFrame` loop for the custom cursor and another for
 *     the About plate, both from first paint and both forever — the compositor
 *     never idled and the phone never slept;
 *   • read `scrollHeight`, `offsetTop` and up to six `getBoundingClientRect()`
 *     boxes inside the scroll frame, i.e. force a synchronous relayout on every
 *     scrolled frame;
 *   • re-measure the hero canvas on every pointer event, at mouse polling rate;
 *   • carry eight decorative gaussian filters and a full-screen `soft-light`
 *     blend over a canvas repainting at 60 fps;
 *   • ask a phone for the whole lighting model on empty plate pixels.
 *
 * None of that is visible in a screenshot, which is exactly why it needs a
 * test. `npm run perf:check` fails if any of it comes back.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));

let passed = 0;
const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ------------------------------------------------------------------ styles */

const publicStyles = [
  "base.css",
  "hero.css",
  "footer.css",
  "work.css",
  "studio.css",
  "mark.css",
  "header.css",
  "mobile.css",
  "motion.css",
  "glass.css",
  "modal.css",
  "experience.css",
  "liquid.css",
  "light.css",
]
  .map((file) => read("src", "styles", file))
  .join("\n");

/* A gaussian filter over a full-screen gradient is a full-screen offscreen
   buffer for a softening the gradient already has. Only the small, deliberate
   backdrop blurs in glass.css/modal.css/mobile.css are allowed to survive. */
const gaussianFilters = publicStyles
  .split("\n")
  // `backdrop-filter` is a different, deliberate tool; this is about a gaussian
  // painted onto a layer just to soften a gradient.
  .filter((line) => /filter:\s*blur\(/.test(line) && !/backdrop-filter/.test(line)).length;
check("no unused gaussian filter survives in the public styles", gaussianFilters === 0, `${gaussianFilters} left`);

const headerCss = read("src", "styles", "header.css");
check("the fixed header never backdrop-blurs the page under it", !/backdrop-filter:\s*blur\(/.test(headerCss));
check(
  "the header is an opaque pane instead",
  // The pane is still opaque, but its colour is the theme's now: a literal
  // here is exactly the bar that could not follow the reader's choice.
  /\.header--solid\s*\{[^}]*background:\s*var\(--chrome-bar\)/.test(headerCss),
);
check(
  "reveals hand their compositor layer back when they settle",
  /\.reveal--settled\s*\{\s*will-change:\s*auto;/.test(read("src", "styles", "motion.css")),
);
const willChange = (publicStyles.match(/will-change:/g) ?? []).length;
check("`will-change` stays a scarce resource", willChange <= 12, `${willChange} uses`);

/* --------------------------------------------------------------- the hero */

const heroSource = read("src", "components", "HeroRelief.tsx");
const heroComponent = read("src", "components", "Hero.tsx");

check(
  "the hero holds itself to a pixel budget",
  /const budget = compact \? 2_200_000 : 4_600_000/.test(heroSource),
);
check(
  "the grain is painted under the object, not blended over it every frame",
  heroComponent.indexOf('className="hero__grain"') < heroComponent.indexOf("<HeroRelief"),
);
check("the pointer is applied once per frame", /applyPointer\(now\);/.test(heroSource));
check(
  "the canvas box is never measured inside a pointer handler",
  /createRectCache\(canvas\)/.test(heroSource) && !/toUv\(event\)/.test(heroSource),
);

/* ------------------------------------------------------------- scroll path */

const scrollChrome = ["SiteChrome.tsx", "MobileDock.tsx"].map((file) =>
  read("src", "components", file),
);
const activeSection = read("src", "hooks", "useActiveSection.ts");

check(
  "the scroll frame never measures the document",
  scrollChrome.every((source) => !/scrollHeight|getBoundingClientRect/.test(source)),
);
check(
  "the chapter rail measures on a layout version, not per frame",
  /documentLayoutVersion\(\)/.test(activeSection) &&
    /if \(layout !== measuredAt\)/.test(activeSection),
);
check(
  "document metrics are measured on change, not on scroll",
  /new ResizeObserver\(measure\)/.test(read("src", "utils", "documentMetrics.ts")),
);
check(
  "the rect cache invalidates on scroll and measures on demand",
  /let stale = false/.test(read("src", "components", "canvasui", "rect-cache.ts")) &&
    /onScrollFrame\(invalidate\)/.test(read("src", "components", "canvasui", "rect-cache.ts")),
);

/* --------------------------------------------------------------- loops --- */

const app = read("src", "App.tsx");
check("the native cursor replaces the custom animation", !/components\/Cursor|<Cursor/.test(app) && !/cursor:\s*none/.test(read("src", "styles", "base.css")));
check(
  "the hero draws its mark once (the sand copy is gone)",
  !/HeroSand/.test(read("src", "components", "Hero.tsx")) && !/hero__sand/.test(read("src", "styles", "experience.css")),
);

const markStage = read("src", "components", "MarkStage.tsx");
check(
  "the About plate only animates on screen",
  /IntersectionObserver/.test(markStage) && /if \(!frame\.current && inView\)/.test(markStage),
);
check(
  "the About plate stops when its spring settles",
  /Math\.abs\(dx\) \+ Math\.abs\(dy\) > 0\.002/.test(markStage),
);

const preloader = read("src", "components", "Preloader.tsx");
check("the preloader is removed from the DOM when it finishes", /if \(gone\) return null;/.test(preloader));

/* The entrance is the one animation the reader judges the whole site by. It
   must not be the thing that stutters, so the pour is held to a pixel budget
   and nothing is allowed to rebuild underneath it. */
check(
  "the pour is drawn below device resolution, where sand cannot tell",
  /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/.test(preloader),
);
check(
  "the glyph mask is read at CSS resolution, not device resolution",
  /mask\.width = width;/.test(preloader) && /mask\.height = height;/.test(preloader),
);
check(
  "the grain field is not rebuilt when the face measures the same",
  /if \(key === builtKey\) return;/.test(preloader),
);
check(
  "a counting sort replaces the comparator inside the first frame",
  /const buckets = new Uint32Array\(LEVELS \+ 1\)/.test(preloader) && !/\.sort\(\s*\(a, b\) =>\s*thresholds\[a\] - thresholds\[b\]/.test(preloader),
);
check("the pour stops on a hidden tab", /document\.hidden \? 0 : window\.requestAnimationFrame/.test(preloader));
check(
  "the curtain announces its release instead of an animation guessing",
  /releasePage\(\)/.test(preloader) && /RELEASE_EVENT/.test(read("src", "utils", "bus.ts")),
);

const relief = read("src", "components", "HeroRelief.tsx");
check(
  "the hero renderer waits for the entrance to hand the page over",
  /whenReleased\(begin\)/.test(relief) && /classList\.contains\("is-loading"\)/.test(relief),
);
check(
  "and a broken entrance can never leave the hero blank",
  /releaseTimer = window\.setTimeout\(onRelease, 2600\)/.test(relief),
);

/* --------------------------------------------------------------- network - */

const work = read("src", "components", "Work.tsx");
check(
  "below-the-fold photography is decoded when it is near, not at first paint",
  /loading="lazy"/.test(work) && /decoding="async"/.test(work) && /width=\{1536\}/.test(work),
);

const shell = read("index.html");
const preloads = (shell.match(/rel="preload"/g) ?? []).length;
// Three, and the four faces of the first screen: the mark, the two Estedad
// cuts the headline is set in, and the mono the entrance pours its sand into.
check("the shell preloads only what the first screen needs", preloads <= 4, `${preloads} preloads`);
check(
  "the entrance's own face is preloaded, so the word is never re-shaped mid-pour",
  /rel="preload"[\s\S]{0,120}jetbrains-mono-latin\.woff2/.test(shell),
);
check(
  "the hero texture is the highest-priority asset",
  /rel="preload" as="image" href="\/hero\/mark-relief\.webp" fetchpriority="high"/.test(shell),
);

const netlify = read("netlify.toml");
check(
  "fingerprinted assets are cached for a year",
  /for = "\/assets\/\*"[\s\S]{0,120}max-age=31536000, immutable/.test(netlify),
);
check(
  "fonts are cached for a year",
  /for = "\/fonts\/\*"[\s\S]{0,120}max-age=31536000, immutable/.test(netlify),
);
check(
  "the hero texture has its own revalidated cache",
  /for = "\/hero\/\*"[\s\S]{0,140}stale-while-revalidate/.test(netlify),
);
check("the removed film left no cache rule behind", !/\/film\//.test(netlify));

/* ------------------------------------------------------- new-surface rules - */

const header2 = read("src", "components", "Header.tsx");
check(
  "the nav list keeps one identity, so its measurement effect does not run per render",
  /const NAV_LINKS = useMemo\(/.test(header2),
);
check(
  "the header only touches React when its answer changes",
  /if \(scrolled !== wasScrolled\)/.test(header2) && /if \(hidden !== wasHidden\)/.test(header2),
);
check(
  "the nav indicator is placed inside a frame",
  /frame = window\.requestAnimationFrame\(\(\) => \{[\s\S]{0,400}offsetWidth/.test(header2),
);

const gallery = read("src", "components", "CircularGallery.tsx");
check(
  "the gallery measures its track on layout change, not on scroll",
  /createDocumentBox\(scrollArea\)\.read\(\)/.test(gallery) &&
    !/getScrollProgress\(\)/.test(gallery),
);
check(
  "gallery cards are moved with transforms, never left/top",
  !/card\.style\.left/.test(gallery) && /translate3d\(calc\(-50% \+/.test(gallery),
);
check("gallery cards are not re-filtered every frame", !/card\.style\.filter/.test(gallery));

const surface = read("src", "components", "SurfacePhysics.tsx");
check("the surface field is a coarse grid, not a pixel buffer", /Math\.min\(250, Math\.ceil\(width \/ 5\)\)/.test(surface));
check("its grain is generated once per resize", /noiseX\[i\] = Math\.sin\(i \* 12\.9898\)/.test(surface) && !/tx \+= \(-rx \/ d \* 7\.5 \+ Math\.sin/.test(surface));
check("text coverage is a mask, not a search per cell", /if \(!force\) continue;/.test(surface) && !/rects\.find\(/.test(surface));
check("only the disturbed crop is encoded", /patchCtx\.drawImage\(canvas, col0/.test(surface) && /patch\.toDataURL/.test(surface));
check("the mask refreshes on layout change, not on a timer", /rectsVersion === documentLayoutVersion\(\)/.test(surface));

const parallax = read("src", "hooks", "useParallax.ts");
check("the parallax hook reads a cached box", /createDocumentBox\(node\)/.test(parallax));

check(
  "a low-tier machine is told so before first paint",
  /dataset\.perf = 'low'/.test(read("public", "theme-init.js")),
);
check(
  "the floating bar drops its backdrop blur on a low-tier machine",
  /html\[data-perf="low"\] \.header__inner \{[\s\S]{0,160}backdrop-filter: none/.test(read("src", "styles", "experience.css")),
);
check(
  "the footer wordmark is drawn in ink, not filtered into it",
  !/footer__gravity[^{]*\{[^}]*filter: brightness/.test(read("src", "styles", "light.css")) &&
    /wordmarkInk/.test(read("src", "components", "Footer.tsx")),
);
check(
  "a settled particle cloud is drawn every other frame on a phone",
  /if \(compact && resting && pointers\.size === 0\)/.test(read("src", "components", "canvasui", "ParticleObjectVanilla.ts")),
);

/* ---------------------------------------------------------------- budgets - */

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  const assets = fs.readdirSync(path.join(dist, "assets"));
  const gzip = (file) => zlib.gzipSync(fs.readFileSync(path.join(dist, "assets", file)), { level: 9 }).length;

  const entry = assets.find((file) => /^index-.*\.js$/.test(file));
  const css = assets.find((file) => /^index-.*\.css$/.test(file));
  const entryKb = entry ? Math.round(gzip(entry) / 1024) : 0;
  const cssKb = css ? Math.round(gzip(css) / 1024) : 0;

  // The budget is a promise, not a ceiling that happens to be above today's
  // number: it was 125 kB until the Tailwind merge engine left the entry, so it
  // is 118 kB now and the win cannot be spent in silence.
  check("the entry bundle stays under 118 kB gzipped", entryKb > 0 && entryKb < 118, `${entryKb} kB`);
  check("the dual-theme stylesheet stays under 33 kB gzipped", cssKb > 0 && cssKb < 33, `${cssKb} kB`);

  const entrySource = entry ? fs.readFileSync(path.join(dist, "assets", entry), "utf8") : "";
  check("three.js is not in the entry chunk", Boolean(entry) && !/THREE\.WebGLRenderer|OrbitControls/.test(entrySource));
  check("the entry chunk never mentions the removed film", Boolean(entry) && !/hero-scrub|hero-poster/.test(entrySource));

  const fonts = fs.readdirSync(path.join(ROOT, "public", "fonts"));
  check(
    "no font file is heavier than 60 kB",
    fonts.every((file) => fs.statSync(path.join(ROOT, "public", "fonts", file)).size < 60_000),
    fonts.join(", "),
  );
  check("five subset faces, no more", fonts.length <= 5, `${fonts.length} files`);

  const hero = path.join(ROOT, "public", "hero");
  const textures = exists("public", "hero") ? fs.readdirSync(hero) : [];
  check(
    "the hero's height map stays under 90 kB",
    textures.every((file) => fs.statSync(path.join(hero, file)).size < 90_000),
    textures.join(", "),
  );
} else {
  console.log("SKIP  no build in dist/ — run `npm run build` to check the budgets");
}

console.log(`\n${passed}/${passed + failures.length} speed checks passed`);
if (failures.length) console.log(`\nFailed: ${failures.join("; ")}`);
process.exit(failures.length ? 1 : 0);
