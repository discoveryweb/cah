/**
 * The particle mark, the phone budget, and the case-study card.
 *
 * Three separate regressions are pinned here:
 *
 *  1. The mark never appeared in production. The loader fetched a `data:` URL
 *     that the site's own CSP (`connect-src 'self'`) refuses, so the browser
 *     threw, the component fell back to the flat image, and the console said
 *     nothing a reader would notice. Inline payloads must be decoded, never
 *     fetched — and the policy must stay strict.
 *  2. A phone paid for a 9k-particle cloud and a full 2× canvas. The budget is
 *     now a quarter of that, at 1.5×, and the simulation stops when the cloud
 *     has settled instead of uploading 9k positions every frame.
 *  3. The case-study pane had no radius and no padding, so it sat next to the
 *     rounded carousel as a bare rectangle with its text against the border.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

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

/* ------------------------------------------------ 1. the mark can be drawn */

const { isInlineImageSrc, needsNetworkFetch } = await import(
  path.join(root, "src/components/canvasui/asset-source.ts")
);

check("a data payload is recognised as inline", isInlineImageSrc("data:image/png;base64,iVBORw0KGgo="));
check("a blob payload is recognised as inline", isInlineImageSrc("blob:https://cahen.netlify.app/9f2c"));
check("a plain asset URL is not inline", !isInlineImageSrc("/assets/cahen-mark-DH8K-M1E.webp"));
check("an absolute asset URL is not inline", !isInlineImageSrc("https://cahen.netlify.app/assets/x.webp"));
check("a src is mixed-case safe", isInlineImageSrc("DATA:image/webp;base64,AAA"));
check("padded srcs are still inline", isInlineImageSrc("  data:image/png;base64,AAA  "));
check("inline payloads never need a fetch", needsNetworkFetch("data:image/png;base64,AAA") === false);
check("real files are still fetched", needsNetworkFetch("/assets/mark.webp") === true);

const loader = await read("src/components/canvasui/ParticleObjectVanilla.ts");
const inlineBranch = /if \(isInlineImageSrc\(src\)\) \{([\s\S]*?)\n      \}/.exec(loader);

check("the loader branches on inline payloads", Boolean(inlineBranch));
if (inlineBranch) {
  check(
    "the inline branch decodes instead of fetching",
    /rasterizeImageUrl\(src\)/.test(inlineBranch[1]) && !/fetch\(/.test(inlineBranch[1]),
    inlineBranch[1].replace(/\s+/g, " ").trim().slice(0, 120),
  );
  check("the inline branch still reports load and error", /config\.onLoad\?\.\(\)/.test(inlineBranch[1]));
}

const fetchAt = loader.indexOf("await fetch(src)");
const guardAt = loader.indexOf("isInlineImageSrc(src)");
check(
  "the network fetch can only be reached by a real URL",
  fetchAt > 0 && guardAt > 0 && guardAt < fetchAt,
  `guard@${guardAt} fetch@${fetchAt}`,
);

/* ---------------------------------------- 2. the policy stays strict anyway */

const toml = await read("netlify.toml");
const csp = (/Content-Security-Policy = "([^"]+)"/.exec(toml) || [])[1] || "";
const connectSrc = (/connect-src ([^;]+);/.exec(csp) || [])[1] || "";

check("connect-src is still the strict 'self'", connectSrc.trim() === "'self'", connectSrc);
check(
  "the fix did not buy data: or blob: in the policy",
  !/connect-src[^;]*\b(data|blob):/.test(csp),
);
check("img-src still allows the inline mark", /img-src 'self' data: blob:/.test(csp));

/* --------------------------------------------- 3. the phone's particle budget */

const logo = await read("src/components/ParticleLogo.tsx");
const budget = /const POINT_BUDGET = COMPACT \? (\d+) : (\d+)/.exec(logo);
check("the particle budget is split by viewport", Boolean(budget));
if (budget) {
  const compact = Number(budget[1]);
  const wide = Number(budget[2]);
  check("a phone builds at most a third of the cloud", compact * 3 <= wide, `${compact} vs ${wide}`);
  check("a phone still has enough points to read as particles", compact >= 1800, String(compact));
}
check("the loader applies the budget to the count", /count: Math\.round\(POINT_BUDGET/.test(logo));

const viewport = await read("src/components/canvasui/canvas-viewport.ts");
check(
  "the canvas pixel ratio is capped lower on a phone",
  /pixelRatioBudget\(\)[\s\S]{0,200}?return window\.matchMedia\("\(max-width: 767px\)"\)\.matches \? 1\.5 : 2/.test(
    viewport,
  ),
);

const settle = /if \(pushing\) \{[\s\S]{0,700}?resting = true/.test(loader);
check("the cloud stops simulating once it has settled", settle);
check("a settled cloud stops uploading its buffer", /if \(resting\) return;/.test(loader));
check(
  "a settled cloud is still drawn (the shimmer lives in the shader)",
  /uDrift \* 0\.005/.test(loader),
);

const morph = await read("src/components/ParticleMorph.tsx");
check(
  "the morph draws fewer dots, slower, on a phone",
  /const compact = window\.matchMedia\("\(max-width: 767px\)"\)\.matches;[\s\S]{0,240}?count = Math\.round\(PARTICLE_BUDGET \* density \* \(compact \? 0\.6 : 1\)\)/.test(
    morph,
  ),
);
check("the morph glow is smaller on a phone", /\* 14 \* glowScale/.test(morph));

const relief = await read("src/components/HeroRelief.tsx");
check(
  "a phone renders the hero object at a capped ratio",
  /ratio: compact \? 1\.5 : 2/.test(relief),
);
check("a phone ships the half-resolution height map", /const COMPACT = "\/hero\/mark-relief@512\.webp"/.test(relief));
check("the shader halves its work on a phone", /uCompact/.test(relief));

/* ------------------------------------------- 4. the case-study pane is a card */

const work = await read("src/styles/work.css");
const detailsRule = /\.gallery__details \{([^}]*)\}/.exec(work);
check("the case-study pane has a rule of its own", Boolean(detailsRule));
if (detailsRule) {
  const body = detailsRule[1].replace(/\s+/g, " ");
  check("the pane carries the site's card radius", /border-radius: var\(--card-radius\)/.test(body), body);
  check("the pane carries an inset", /padding: clamp\(/.test(body), body);
}
check(
  "the phone keeps the radius on the pane",
  /@media \(max-width: 767px\)[\s\S]*?\.gallery__details\s*\{[^}]*border-radius: var\(--card-radius-sm\)/.test(work),
);

// Minified CSS drops the space after `:`, so these must not assume one.
const flat = (text) => text.replace(/\s+/g, "");

const mark = await read("src/styles/mark.css");
check(
  "a phone does not filter a live canvas",
  flat(mark).includes(".mark-stage.particle-logo-canvas{filter:none"),
);

const header = await read("src/styles/header.css");
check(
  "the fixed header never re-blurs the page at any width",
  !/backdrop-filter:\s*blur\(/.test(header) && /backdrop-filter:\s*none/.test(header),
);

/* --------------------------------- 5. the shipped bundle carries the fix too */

/*
 * Source that is right and a bundle that is stale is the same black page as
 * before. When a build exists, the minified particle chunk must still guard
 * the fetch and decode inline payloads.
 */
try {
  const assetsDir = path.join(root, "dist/assets");
  const files = await readdir(assetsDir);
  const chunk = files.find((file) => /^ParticleObject-.*\.js$/.test(file));
  check("the built particle chunk exists", Boolean(chunk), files.join(", "));
  if (chunk) {
    const bundle = await readFile(path.join(assetsDir, chunk), "utf8");
    check("the bundle recognises inline payloads", /\/\^\(\?:data\|blob\):/i.test(bundle));
    check(
      "the bundle still has exactly one fetch for real URLs",
      (bundle.match(/await fetch\(/g) || []).length === 1,
      `${(bundle.match(/await fetch\(/g) || []).length} found`,
    );
  }
} catch {
  console.log("SKIP  no build in dist/ — run `npm run build` to check the bundle");
}

/* -------------------------------------------------------------------- done */

console.log(`\n${passed}/${passed + failures.length} mark, mobile and card checks passed`);
if (failures.length) {
  console.log(`\nFailed: ${failures.join("; ")}`);
  process.exitCode = 1;
}
