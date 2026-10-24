#!/usr/bin/env node
/**
 * Guards the opening screen.
 *
 * The previous hero pinned the page for 3.4 viewports and scrubbed a 3–5 MB
 * stock film with the scroll. It was heavy, it was someone else's picture, and
 * it put two extra screens of resistance in front of the first thing a reader
 * does. The replacement is one screen of type and light: no film, nothing
 * pinned, nothing downloaded, and the page moves the moment a reader scrolls.
 *
 * This test mounts the real component in jsdom and holds every one of those
 * promises, plus the ones that are easy to lose in a rewrite:
 *
 *   • no video, no film request, no pinning, one screen of hero with the ticker
 *     and a sliver of the next section visible
 *   • the mark is drawn as particles (the sampler really runs, and the canvas
 *     pixel ratio is capped)
 *   • scrolling writes only transform/opacity, never re-renders React, and
 *     stops writing once the hero is behind us
 *   • reduced motion draws one still plate and starts no loop at all
 *   • the copy, the two calls to action and the accessible name survive
 *
 *   npm run hero:check
 */
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const WORK = path.join(ROOT, "node_modules", ".hero-check");
const VIEWPORT_W = 1200;
const VIEWPORT_H = 800;

const ENTRY = `
import { createRoot } from "react-dom/client";
import { act } from "react";
import { ContentProvider } from "../../src/content/ContentProvider";
import { Hero } from "../../src/components/Hero";

const root = createRoot(document.getElementById("root"));
act(() => {
  root.render(<ContentProvider><Hero onOrder={() => window.__ordered = true} /></ContentProvider>);
});

/** Scroll to a multiple of the hero's own height. */
window.__scrollTo = async (fraction, settle = 260) => {
  const hero = document.querySelector(".hero");
  const height = hero ? hero.offsetHeight || 800 : 800;
  const y = height * fraction;
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  window.dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => setTimeout(resolve, settle));
  const overlay = document.querySelector(".hero__overlay");
  const field = document.querySelector(".hero__field");
  return {
    y,
    overlayTransform: overlay ? overlay.style.transform : null,
    overlayOpacity: overlay ? overlay.style.opacity : null,
    fieldTransform: field ? field.style.transform : null,
    fieldOpacity: field ? field.style.opacity : null,
  };
};

/** Any React re-render shows up as character or child changes under the hero. */
window.__mutationProbe = async (steps = 24) => {
  const hero = document.querySelector(".hero");
  const records = [];
  const observer = new MutationObserver((list) => records.push(...list));
  observer.observe(hero, { attributes: true, subtree: true, childList: true, characterData: true });
  const height = hero.offsetHeight || 800;
  for (let i = 0; i <= steps; i += 1) {
    Object.defineProperty(window, "scrollY", { value: (height * 1.4 * i) / steps, configurable: true, writable: true });
    window.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await new Promise((resolve) => setTimeout(resolve, 120));
  observer.disconnect();
  const textMutations = records.filter((r) => r.type === "characterData" || r.type === "childList").length;
  const attributeNames = [...new Set(records.filter((r) => r.type === "attributes").map((r) => r.attributeName))];
  return { records: records.length, textMutations, attributeNames };
};

/** What the fake 2D context was actually asked to paint. */
window.__paint = () => ({
  arcs: window.__ctx.arcs,
  fills: window.__ctx.fills,
  fillRects: window.__ctx.fillRects,
  drawImages: window.__ctx.drawImages,
  gradients: window.__ctx.gradients,
  clears: window.__ctx.clears,
  canvasWidth: document.querySelector(".hero__constellation")?.width ?? 0,
  canvasHeight: document.querySelector(".hero__constellation")?.height ?? 0,
});
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

/* ------------------------------------------------------------------ harness */

/** A 2D context that records what it is asked to do and returns a fake mark. */
function makeContext() {
  const stats = {
    arcs: 0,
    fills: 0,
    fillRects: 0,
    drawImages: 0,
    gradients: 0,
    clears: 0,
    fillStyle: "",
  };
  const gradient = { addColorStop() {} };
  const context = {
    canvas: null,
    globalAlpha: 1,
    fillStyle: "#000",
    shadowBlur: 0,
    shadowColor: "",
    lineWidth: 0,
    setTransform() {},
    clearRect() {
      stats.clears += 1;
    },
    fillRect() {
      stats.fillRects += 1;
    },
    drawImage() {
      stats.drawImages += 1;
    },
    createRadialGradient() {
      stats.gradients += 1;
      return gradient;
    },
    beginPath() {},
    moveTo() {},
    arc() {
      stats.arcs += 1;
    },
    fill() {
      stats.fills += 1;
      stats.fillStyle = String(context.fillStyle);
    },
    getContext() {
      return context;
    },
    /** A synthetic mark: a bright ring on transparent ground. */
    getImageData(_x, _y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      const cx = width / 2;
      const cy = height / 2;
      const outer = Math.min(width, height) * 0.42;
      const inner = outer * 0.55;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const distance = Math.hypot(x - cx, y - cy);
          if (distance > outer || distance < inner) continue;
          const i = (y * width + x) * 4;
          const shade = 120 + Math.round(120 * (1 - Math.abs(distance - (inner + outer) / 2) / 40));
          data[i] = shade;
          data[i + 1] = shade;
          data[i + 2] = 255;
          data[i + 3] = 230;
        }
      }
      return { data, width, height };
    },
  };
  return { context, stats };
}

async function mount({ reducedMotion = false, compact = false } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url: "http://localhost:5173/",
  });
  const { window } = dom;
  window.IS_REACT_ACT_ENVIRONMENT = true;

  // The hero no longer asks the network for anything, so a fetch is a failure.
  window.__fetches = [];
  window.fetch = (input) => {
    window.__fetches.push(String(input));
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  };

  window.matchMedia = (query) => {
    const matches =
      query.includes("prefers-reduced-motion")
        ? reducedMotion
        : query.includes("max-width: 767px")
          ? compact
          : query.includes("min-width: 901px")
            ? !compact
            : query.includes("hover: hover")
              ? !compact
              : false;
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

  const { context, stats } = makeContext();
  window.__ctx = stats;
  /* A recording WebGL2 context: jsdom has no GPU, and a component that cannot
     get a context is exactly the "no canvas" path — so the harness has to
     provide one to exercise the real renderer. */
  const gpu = { draws: 0, textures: [], programs: 0, errors: [], cursor: [0, 0, 0], ripples: [] };
  const glStub = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, ARRAY_BUFFER: 3, STATIC_DRAW: 4,
    TEXTURE_2D: 5, TEXTURE_MIN_FILTER: 6, TEXTURE_MAG_FILTER: 7, LINEAR: 8,
    TEXTURE_WRAP_S: 9, TEXTURE_WRAP_T: 10, CLAMP_TO_EDGE: 11, TEXTURE0: 12,
    RGBA: 13, UNSIGNED_BYTE: 14, UNPACK_PREMULTIPLY_ALPHA_WEBGL: 15,
    TRIANGLES: 16, COMPILE_STATUS: 17, LINK_STATUS: 18,
    createShader: () => ({}),
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => "",
    createProgram: () => (gpu.programs++, {}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => "",
    useProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    getUniformLocation: (_p, name) => name,
    createTexture: () => ({}),
    activeTexture: () => {},
    bindTexture: () => {},
    texParameteri: () => {},
    texImage2D: (_t, _l, _f, _ff, _type, image) => gpu.textures.push(String(image && image.src)),
    pixelStorei: () => {},
    uniform1i: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform3f: (_l, x, y, z) => { gpu.cursor = [x, y, z]; },
    uniform4fv: (_l, data) => { gpu.ripples = Array.from(data); },
    viewport: () => {},
    drawArrays: () => gpu.draws++,
    deleteTexture: () => {},
    deleteBuffer: () => {},
    deleteProgram: () => {},
    deleteShader: () => {},
    getExtension: () => null,
  };
  window.__draws = () => gpu.draws;
  window.__cursor = () => gpu.cursor.slice();
  window.__ripples = () => gpu.ripples.slice();
  window.__textures = () => gpu.textures.slice();
  window.HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    if (kind === "webgl2") return glStub;
    context.canvas = this;
    return context;
  };

  // jsdom lays nothing out; give the hero and its canvas real boxes.
  const rect = (width, height) => () => ({
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const heroRect = rect(VIEWPORT_W, VIEWPORT_H);
  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList?.contains("hero__constellation")) return rect(VIEWPORT_W, VIEWPORT_H)();
    if (this.classList?.contains("hero")) return { ...heroRect(), height: VIEWPORT_H };
    return rect(VIEWPORT_W, VIEWPORT_H)();
  };
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.classList?.contains("hero") ? VIEWPORT_H : 0;
    },
  });

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
      this.callback([{ isIntersecting: true, target }]);
    }
    unobserve() {}
    disconnect() {}
  };

  // The mark decodes from an <img>, never a fetch: fire onload with real numbers.
  window.Image = class {
    constructor() {
      this.naturalWidth = 1024;
      this.naturalHeight = 1024;
      this.width = 1024;
      this.height = 1024;
      this.complete = true;
      this.decoding = "async";
    }
    set src(value) {
      this._src = value;
      setTimeout(() => this.onload?.(), 0);
    }
    get src() {
      return this._src;
    }
  };

  const quiet = (method) => {
    const original = window.console[method].bind(window.console);
    window.console[method] = (...args) => {
      const line = args.map(String).join(" ");
      if (line.includes("act(") || line.includes("Not implemented")) return;
      original(...args);
    };
  };
  quiet("error");
  quiet("warn");

  window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 700));
  return { window, stats };
}

/* ------------------------------------------------------------------ assertions */

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

/* ---- 1. The film is gone for real: no element, no request, no bytes ---- */

const { window } = await mount();
const document = window.document;

check("the hero renders no video element", document.querySelectorAll("video").length === 0);
// The content API is the site's own plumbing; media is what must be zero.
const mediaRequests = window.__fetches.filter((url) => /film|\.mp4|\.webm|\.webp|\.jpg/.test(url));
check("the opening screen downloads no media at all", mediaRequests.length === 0, mediaRequests.join(", "));
check(
  "the page preloads no film frame",
  !/hero-poster|hero-scrub/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")),
);
check(
  "the film files are gone from the build input",
  !fs.existsSync(path.join(ROOT, "public/film")),
  fs.readdirSync(path.join(ROOT, "public")).join(", "),
);

/* ---- 1b. The surface answers a finger, all the way to the GPU ---- */

{
  const hero = document.querySelector(".hero");
  const at = (kind, x, y) =>
    hero.dispatchEvent(new window.MouseEvent(kind, { clientX: x, clientY: y, bubbles: true }));

  at("pointermove", 420, 300);
  at("pointerdown", 420, 300);
  await new Promise((resolve) => setTimeout(resolve, 700));

  const cursor = window.__cursor();
  const ripples = window.__ripples();
  check("a press reaches the shader as a lens", cursor[2] > 0.25, `strength ${cursor[2]}`);
  check(
    "the lens sits where the finger is",
    Math.abs(cursor[0] - 420 / VIEWPORT_W) < 0.05 && Math.abs(cursor[1] - (1 - 300 / VIEWPORT_H)) < 0.05,
    cursor.slice(0, 2).join(", "),
  );
  check(
    "a press lands a shockwave in the ring buffer",
    ripples.some((value, index) => index % 4 === 3 && value > 0.4),
    JSON.stringify(ripples),
  );
  check("the ring buffer is bounded", ripples.length === 16, String(ripples.length));

  at("pointerleave", 0, 0);
  await new Promise((resolve) => setTimeout(resolve, 700));
  check("letting go releases the lens", window.__cursor()[2] < 0.3, `strength ${window.__cursor()[2]}`);
}

/* ---- 2. Nothing is pinned; the page moves when the reader scrolls ---- */

const heroCss = fs.readFileSync(path.join(ROOT, "src/styles/hero.css"), "utf8");
const stageRule = /\.hero__stage \{([^}]*)\}/.exec(heroCss);
check("there is no scroll track at all", !/\.hero__track\b/.test(heroCss));
check("the stage is not sticky and not fixed", Boolean(stageRule) && !/position: (sticky|fixed)/.test(stageRule[1]));

const stageMin = /min-height: min\(calc\(100svh - (\d+)px\), (\d+)px\)/.exec(heroCss);
check("the hero is a screen minus a deliberate peek", Boolean(stageMin), stageMin?.[0] ?? "pattern missing");
check(
  "the ticker sits under the hero so the page obviously continues",
  Boolean(document.querySelector(".hero__stage + .hero__ticker")),
);
check(
  "the phone gets the same one-screen rule",
  /@media \(max-width: 767px\) \{\s*\.hero__stage \{\s*min-height: calc\(100svh - 52px\)/.test(heroCss),
);

/* ---- 3. The light: layers, order, and no extra downloads ---- */

const field = document.querySelector(".hero__field");
const layers = field ? [...field.children].map((node) => node.className) : [];
check("the field has three aurora layers", layers.filter((name) => name.includes("hero__aurora")).length === 3, layers.join(" | "));
check("the field carries a raking beam", layers.some((name) => name.includes("hero__beam")));
check("the field carries the shader canvas", Boolean(field?.querySelector("canvas.hero__relief")));
check("the field carries a grain plate", layers.some((name) => name.includes("hero__grain")));
check("the field carries a scrim for the type", layers.some((name) => name.includes("hero__veil")));

const overlayIndex = [...document.querySelectorAll(".hero > *")].indexOf(document.querySelector(".hero__stage"));
const overlay = document.querySelector(".hero__overlay");
check("the type is painted above the light", Boolean(overlay) && overlayIndex >= 0);
check(
  "the grain is a data URI, not a request",
  /\.hero__grain \{[\s\S]{0,220}?url\("data:image\/svg\+xml;base64,/.test(heroCss),
);

/* ---- 4. The mark is really drawn, from the studio's own asset ---- */

const reliefSource = fs.readFileSync(path.join(ROOT, "src/components/HeroRelief.tsx"), "utf8");

/* The shader must be real GLSL, and it must parse. */
const vertSrc = /const VERT = `([\s\S]*?)`;/.exec(reliefSource)?.[1] ?? "";
const fragSrc = /const FRAG = `([\s\S]*?)`;/.exec(reliefSource)?.[1] ?? "";
check("the hero has a vertex shader", vertSrc.length > 40 && vertSrc.includes("#version 300 es"));
check("the hero has a fragment shader", fragSrc.length > 800 && fragSrc.includes("#version 300 es"));
{
  const { parser } = await import("@shaderfrog/glsl-parser");
  let ok = true;
  let detail = "";
  const muted = console.warn;
  console.warn = () => {};
  try {
    parser.parse(vertSrc);
    parser.parse(fragSrc);
  } catch (error) {
    ok = false;
    detail = error.message;
  }
  console.warn = muted;
  check("both shaders parse as GLSL ES 3.00", ok, detail);
/* A stray backtick inside a GLSL comment closes the template literal early and
   the shader is silently truncated — the page then compiles and draws nothing.
   The last statement of the shader must survive extraction. */
check(
  "the shader literal is not truncated",
  fragSrc.trimEnd().endsWith("fragColor = vec4(col, coverage);\n}") ||
    fragSrc.trimEnd().endsWith("fragColor = vec4(col, coverage);\n} "),
  fragSrc.trimEnd().slice(-60),
);
}

/* A lit object, not a picture: normals, a key light, specular, fresnel. */
check("the shader derives a normal from the height field", /vec3 normal = normalize\(vec3\(-slope \* relief, 1\.0\)\)/.test(fragSrc));
check("the shader has a moving key light", /float sweep = uTime \* 0\.26/.test(fragSrc));
check("the shader has a specular lobe", /pow\(clamp\(dot\(normal, halfDir\)/.test(fragSrc));
check("the shader has a fresnel term", /float fresnel = pow\(1\.0 - clamp\(dot\(normal, viewDir\)/.test(fragSrc));
check("the relief is suppressed on a phone, not just slowed", /mix\(0\.88 \+ 0\.12 \* ribs, 1\.0, uCompact\)/.test(fragSrc));
check("the piece is occluded by its own form", /smoothstep\(0\.0, 0\.42, height\)/.test(fragSrc));

/* Orientation is a correctness requirement, not a taste: gl_FragCoord.y runs up
   while the texture's v runs down, so the mapping must negate y exactly once,
   and the upload must not flip it back. */
const negations = (fragSrc.match(/-q\.y/g) ?? []).length;
check("the mark's texcoord negates screen y exactly once", negations === 1, `${negations} negations`);
check(
  "the negation lives in the one shared projection",
  /vec2 markSpace\(vec2 screenUv\)[\s\S]{0,400}vec2\(q\.x, -q\.y\) \/ heroScale\(\)/.test(fragSrc),
);
check("the upload does not flip the texture back", /UNPACK_FLIP_Y_WEBGL, false/.test(reliefSource));
check("there is no second, private projection", !/vec2 muv = vec2\(/.test(fragSrc));

/* The interaction: one projection for the pointer, the ripples and the pixel. */
check("the cursor is converted through that projection", /markSpace\(uCursor\.xy\)/.test(fragSrc));
check("each shockwave is converted the same way", /markSpace\(r\.xy\)/.test(fragSrc));
check("the fragment itself uses it too", /vec2 muv = markSpace\(uv01\)/.test(fragSrc));
check("the finger drags the surface", /disp \+= dc \* lens/.test(fragSrc));
check("a shockwave pushes a crest outward", /\* decay \* 0\.040/.test(fragSrc));
check("and pulls a dent behind it", /\* dent \* 0\.026/.test(fragSrc));
check("a resting hover still breathes", /float breathe = uAnimate > 0\.5 \? 0\.88 \+ 0\.12 \* sin\(uTime \* 1\.7\)/.test(fragSrc));
check("the disturbance tilts the normal", /vec2 slopeEnergy = vec2\(disp\.y, -disp\.x\)/.test(fragSrc));
check(
  "the caustic is blended, never added",
  /metal = mix\(metal, vec3\(0\.90, 0\.84, 1\.0\), clamp\(glint/.test(fragSrc),
);
check(
  "dispersion stays inside the studio ramp",
  /mix\(metal, violetRamp\(tone \+ split\)/.test(fragSrc) &&
    /mix\(metal, violetRamp\(tone - split \* 0\.9\)/.test(fragSrc),
);

/* The renderer's promises. */
check("the renderer uses raw WebGL2, not a 3D engine", /getContext\("webgl2"/.test(reliefSource) && !/from "three"/.test(reliefSource));
check("a device without WebGL2 simply gets no canvas", /if \(!gl\) return;/.test(reliefSource));
check("shader failures are logged, never silent", /console\.error\("hero shader:", gl\.getShaderInfoLog/.test(reliefSource));
check(
  "the shader is held to a pixel budget, not just a ratio",
  /const budget = compact \? 2_200_000 : 4_600_000/.test(reliefSource) &&
    /Math\.min\(window\.devicePixelRatio \|\| 1, quality\.ratio, cap\)/.test(reliefSource),
);
check(
  "empty plate pixels skip the lighting model",
  /if \(coverage > 0\.002\) \{/.test(fragSrc),
);
check("there is a reduced quality tier", /ratio: compact \? 1 : 1\.25, fps: 30/.test(reliefSource));
check("reduced motion draws one frame and starts no loop", /if \(quality\.still\) \{\s*draw\(startedAt\);\s*return;/.test(reliefSource));
check("the loop stops when hidden", /if \(disposed \|\| !ready \|\| !visible\) return;/.test(reliefSource));
check("the GPU resources are released on unmount", /gl\.getExtension\("WEBGL_lose_context"\)\?\.loseContext\(\)/.test(reliefSource));
check("the hero section is the pointer surface", /canvas\.closest\("\.hero"\)/.test(reliefSource));
check(
  "no interaction listener can delay a scroll or a tap",
  ["pointermove", "pointerdown", "pointerleave", "pointercancel"].every((kind) =>
    new RegExp(`addEventListener\\("${kind}", on[A-Za-z]+, \\{ passive: true \\}\\)`).test(reliefSource),
  ),
);
check("a drag sheds droplets, a still finger stays calm", /moved > 0\.02 && now - lastRippleAt > 110/.test(reliefSource));
check(
  "a tap outranks a drag",
  /if \(event\.press\) \{[\s\S]{0,160}spawnRipple\(point\.u, point\.v, 1, now\)/.test(reliefSource),
);
check(
  "the pointer is applied once per frame, not per event",
  /pending = \{ x: event\.clientX/.test(reliefSource) &&
    /applyPointer\(now\);\s*\n\s*draw\(now\);/.test(reliefSource),
);
check(
  "the canvas box is measured through a cache, never in the handler",
  /createRectCache\(canvas\)/.test(reliefSource) && !/toUv\(event\)/.test(reliefSource),
);
check("a tap is eased in, never snapped", /cursorStrength \+= \(cursorTargetStrength - cursorStrength\) \* 0\.12/.test(reliefSource));
check("reduced motion never spawns a disturbance", /if \(quality\.still\) return;\s*\n\s*ripples\.push/.test(reliefSource));
check("the weak tier keeps fewer shockwave slots", /quality\.fps === 30 \? 2 : RIPPLE_SLOTS/.test(reliefSource));
check("the hero requests no network media beyond its texture", !/https?:\/\//.test(reliefSource));
check("the texture is versioned by a stable path", /const FULL = "\/hero\/mark-relief\.webp"/.test(reliefSource));

const canvas = document.querySelector(".hero canvas");
check("the object is a canvas", Boolean(canvas));
check("the canvas is decorative to assistive tech", canvas?.getAttribute("aria-hidden") === "true");

/* ---- 5. Scrolling: compositor only, then silence ---- */

const first = await window.__scrollTo(0.35);
check("scrolling moves the field", Boolean(first.fieldTransform) && first.fieldTransform !== "none", first.fieldTransform ?? "none");
check("scrolling lifts the type away", Boolean(first.overlayTransform) && first.overlayTransform !== "none", first.overlayTransform ?? "none");
check(
  "the type fades as it leaves, and not before",
  Number(first.overlayOpacity) < 1 && Number(first.overlayOpacity) > 0,
  first.overlayOpacity ?? "unset",
);
check(
  "the field only dims a little, so the leave is gentle",
  Number(first.fieldOpacity) <= 1 && Number(first.fieldOpacity) >= 0.6,
  first.fieldOpacity ?? "unset",
);

const probe = await window.__mutationProbe();
check("a scroll never re-renders the hero", probe.textMutations === 0, `${probe.textMutations} text changes`);
check(
  "a scroll only touches transform and opacity",
  probe.attributeNames.every((name) => name === "style"),
  probe.attributeNames.join(", "),
);

const far = await window.__scrollTo(3);
const stillFar = await window.__scrollTo(3.4);
check(
  "past the hero the engine stops writing",
  far.overlayTransform === stillFar.overlayTransform && far.fieldTransform === stillFar.fieldTransform,
  `${far.fieldTransform} vs ${stillFar.fieldTransform}`,
);

const hookSource = fs.readFileSync(path.join(ROOT, "src/hooks/useHeroParallax.ts"), "utf8");
check("the parallax uses the site's single scroll frame", /onScrollFrame/.test(hookSource) && !/addEventListener\("scroll"/.test(hookSource));

/* ---- 6. Nothing below the fold was lost ---- */

const title = document.querySelector("#hero-title")?.textContent ?? "";
check("the headline keeps both lines", title.trim().length > 12, title.slice(0, 40));
check("the lede survives", Boolean(document.querySelector(".hero__lede")?.textContent?.trim()));
check("both ways forward survive", document.querySelectorAll(".hero__actions a, .hero__actions button").length >= 2);
check("the scroll link still targets the studio section", document.querySelector(".hero__scroll")?.getAttribute("href") === "#about");
check("the ticker survives with real copy", Boolean(document.querySelector(".hero__ticker .marquee__item")));
check("the hero still names the page", document.querySelector(".hero")?.getAttribute("aria-labelledby") === "hero-title");

/* ---- 7. Reduced motion: one still plate, no loop ---- */

const still = await mount({ reducedMotion: true });
check("reduced motion still paints the object once", still.window.__draws() > 0, `${still.window.__draws()} draws`);
await new Promise((resolve) => setTimeout(resolve, 300));
const stillDraws = still.window.__draws();
await new Promise((resolve) => setTimeout(resolve, 200));
check("reduced motion draws nothing more", still.window.__draws() === stillDraws, `${stillDraws} → ${still.window.__draws()}`);
check(
  "reduced motion never animates the aurora",
  /prefers-reduced-motion: reduce\)[\s\S]{0,120}\.hero__aurora \{\s*animation: none/.test(heroCss),
);

/* ---- 8. A phone gets a lighter version ---- */

const phone = await mount({ compact: true });
check("a phone loads the 512 texture", phone.window.__textures().some((src) => src.includes("@512")), phone.window.__textures().join(", "));
check("a desktop loads the 1024 texture", window.__textures().some((src) => /mark-relief\.webp$/.test(src)), window.__textures().join(", "));

/* ---- 9. The shipped bundle has no film in it ---- */

const dist = path.join(ROOT, "dist");
if (fs.existsSync(dist)) {
  const assets = fs.readdirSync(path.join(dist, "assets"));
  const entry = assets.find((file) => /^index-.*\.js$/.test(file));
  const bundle = entry ? fs.readFileSync(path.join(dist, "assets", entry), "utf8") : "";
  check("the shipped bundle never mentions the film", Boolean(entry) && !/hero-scrub|hero-poster\.jpg/.test(bundle));
  check("no film file is published", !fs.existsSync(path.join(dist, "film")));
} else {
  console.log("SKIP  no build in dist/ — run `npm run build` to check the bundle");
}

console.log(`\n${passed}/${passed + failures.length} opening screen checks passed`);
if (failures.length) console.log(`\nFailed: ${failures.join("; ")}`);

await fsp.rm(WORK, { recursive: true, force: true });
// jsdom keeps its animation frames ticking; the run is over, so say so.
process.exit(failures.length ? 1 : 0);
