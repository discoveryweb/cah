/**
 * The opening screen's object.
 *
 * A hand-written WebGL2 renderer — no three.js, no scene graph, no loader — for
 * one full-screen fragment shader that turns the studio mark into a machined
 * relief of violet metal, and lets you disturb it.
 *
 * Why this shape of solution:
 *   • It is the studio's own mark, so the first screen is the identity rather
 *     than a stock render; and it reads as a physical, lit object, which is the
 *     difference between a picture of a logo and a piece of brand material.
 *   • It costs one 86 KB texture (39 KB on a phone) and one pass over the
 *     pixels. Nothing is downloaded before it can draw, nothing is decoded.
 *   • Everything is per-pixel and analytic: no geometry, no vertices to upload,
 *     no post-processing chain, no texture feedback.
 *
 * The interaction is the part that matters: the relief behaves like liquid
 * mercury under a finger. Hovering bends the surface and drags a lens of
 * refraction with it; dragging sheds ripples; a tap lands a shockwave whose
 * crest splits the spectrum (the chromatic dispersion that gives good WebGL
 * its "physical glass" feel). It is the same family of effect the reference
 * studios use — chromatic aberration over displaced refraction — but it is
 * computed from the studio's own mark, so it cannot be mistaken for a template.
 *
 * Performance ladder:
 *   1. full quality     — device pixel ratio 2 (1.5 on a phone), 60 fps
 *   2. reduced          — ratio 1.25, 30 fps, fewer ripple slots
 *   3. still            — one frame, then nothing (reduced motion)
 *   4. CSS              — the violet field the page already has, no shader
 */
import { useEffect, useRef, useState } from "react";
import { createRectCache } from "./canvasui/rect-cache";

const FULL = "/hero/mark-relief.webp";
const COMPACT = "/hero/mark-relief@512.webp";

/** Four concurrent disturbances: enough to feel continuous, bounded in cost. */
const RIPPLE_SLOTS = 4;
/** How long a shockwave lives, in seconds. */
const RIPPLE_LIFE = 2.6;

const VERT = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform vec2  uPointer;
uniform float uReveal;
uniform float uCompact;
uniform float uAnimate;
uniform sampler2D uMark;

/* The disturbance: where the finger is, how strongly it presses, and up to four
   shockwaves, each (uv.x, uv.y, age in seconds, strength). */
uniform vec3  uCursor;
uniform vec4  uRipples[4];

/* --- helpers ------------------------------------------------------------ */

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

/*
 * The mark lives in its own texture space, and so does every disturbance: a
 * finger at screen uv must be converted by the *same* projection the fragment
 * uses, or the lens surfaces somewhere the finger is not. This is that
 * projection, and it is the only place the mapping exists.
 */
vec2 heroFocus() {
  return mix(vec2(0.42, 0.04), vec2(0.0, 0.16), uCompact);
}

/* The height, in screen units, that the texture square spans: a larger number
   draws a larger object. Phone gets its own value because a 0.5-aspect viewport
   magnifies the same number twice over. */
float heroScale() {
  return mix(1.62, 0.74, uCompact);
}

vec2 markSpace(vec2 screenUv) {
  vec2 s = screenUv * 2.0 - 1.0;
  s.x *= uRes.x / uRes.y;
  vec2 q = s - heroFocus();
  vec2 parallax = uPointer * 0.022 * (1.0 - 0.5 * uCompact);
  // gl_FragCoord.y runs up while the texture's v runs down: negate once, here.
  return vec2(q.x, -q.y) / heroScale() + 0.5 + parallax;
}

vec3 violetRamp(float t) {
  // The studio's ramp: deep indigo → violet → lilac → porcelain.
  vec3 c0 = vec3(0.086, 0.063, 0.227);
  vec3 c1 = vec3(0.251, 0.165, 0.620);
  vec3 c2 = vec3(0.486, 0.345, 0.941);
  vec3 c3 = vec3(0.690, 0.561, 1.000);
  vec3 c4 = vec3(0.839, 0.769, 1.000);
  vec3 c5 = vec3(0.965, 0.945, 1.000);
  t = clamp(t, 0.0, 1.0) * 5.0;
  if (t < 1.0) return mix(c0, c1, t);
  if (t < 2.0) return mix(c1, c2, t - 1.0);
  if (t < 3.0) return mix(c2, c3, t - 2.0);
  if (t < 4.0) return mix(c3, c4, t - 3.0);
  return mix(c4, c5, t - 4.0);
}

/* R = soft height, G/A = sharp coverage, B = fine detail. */
vec4 markAt(vec2 uv) {
  return texture(uMark, clamp(uv, vec2(0.0005), vec2(0.9995)));
}

/*
 * The liquid. Returns the displacement to apply to the mark lookup, and
 * reports how much energy is passing through this pixel so the shading can
 * respond (glints on a crest, dispersion at an edge).
 */
vec2 disturb(vec2 m, out float energy) {
  vec2 disp = vec2(0.0);
  energy = 0.0;

  // The finger: a lens pressed into the surface. Wide enough to read as a
  // bulge in the metal, tight enough to stay a detail and not a wobble.
  vec2 dc = m - markSpace(uCursor.xy);
  // A resting finger still breathes, so a held hover never freezes.
  float breathe = uAnimate > 0.5 ? 0.88 + 0.12 * sin(uTime * 1.7) : 1.0;
  float lens = exp(-dot(dc, dc) * 42.0) * uCursor.z * breathe;
  float core = exp(-dot(dc, dc) * 150.0) * uCursor.z * breathe;
  disp += dc * lens * 0.42 + dc * core * 0.20;
  energy += lens * 1.15 + core * 0.65;

  // Shockwaves. The crest is a moving ring; behind it, a dent that heals.
  for (int i = 0; i < 4; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.001) continue;
    vec2 d = m - markSpace(r.xy);
    float dist = length(d) + 1e-5;
    float front = r.z * 0.40;
    float ring = exp(-pow((dist - front) * 20.0, 2.0));
    // A second, faster ring trailing the first: real liquid never has one crest.
    float ring2 = exp(-pow((dist - front * 1.55) * 38.0, 2.0)) * 0.45;
    float decay = exp(-r.z * 1.35) * r.w;
    float dent = exp(-dist * dist * 200.0) * decay;
    disp += (d / dist) * (ring + ring2) * decay * 0.040;  // the crest pushes out
    disp -= (d / dist) * dent * 0.026;                    // the dent pulls in
    energy += (ring + ring2) * decay * 1.5 + dent * 1.1;
  }

  return disp;
}

void main() {
  vec2 uv01 = gl_FragCoord.xy / uRes;
  /* Screen space, -1..1, with the aspect carried on x so the object stays round
     at every width. The object sits right of centre on a wide screen and
     centred on a phone: the type needs the left third on desktop, and the whole
     width on a phone. */
  vec2 p = uv01 * 2.0 - 1.0;
  p.x *= uRes.x / uRes.y;
  vec2 focus = heroFocus();

  // ---- the plate behind: deep violet, a milled cross-hatch, a bloom -------
  vec2 q = p - focus;
  /* The bloom follows the long axis, so a portrait screen gets a round
     falloff instead of a squeezed one. */
  float radius = length(q * mix(vec2(0.85, 1.0), vec2(1.0, 1.45), uCompact));
  vec3 ground = vec3(0.031, 0.027, 0.086);
  vec3 groundDeep = vec3(0.016, 0.014, 0.045);
  vec3 col = mix(groundDeep, ground, clamp(1.0 - radius * 0.55, 0.0, 1.0));

  float bloom = exp(-radius * radius * 2.4);
  col += vec3(0.115, 0.058, 0.290) * bloom;

  vec2 gridUv = p * mix(190.0, 115.0, uCompact);
  float grid = smoothstep(0.985, 1.0, max(abs(sin(gridUv.x * 1.57)), abs(sin(gridUv.y * 1.57))));
  col += vec3(0.020, 0.016, 0.052) * grid;

  // ---- the relief -------------------------------------------------------
  /* Parallax moves the camera a few degrees so the object has thickness, and
     the one projection in markSpace() carries it — the pointer, the ripples
     and the fragment itself all resolve through the same maths. */
  vec2 muv = markSpace(uv01);

  float energy = 0.0;
  vec2 disp = disturb(muv, energy);
  vec2 muvD = muv + disp;

  vec4 m0 = markAt(muvD);
  float height = m0.r;
  float coverage = m0.g;

  /* The lit object only exists where the mark is. Empty plate pixels — most of
     a 16:9 hero — used to run all four normal taps, the whole lighting model
     and the dispersion for nothing. Branching here is coherent over large
     screen regions, so the GPU skips them wholesale and the shader stops
     paying for the background. */
  vec3 metal = vec3(0.0);
  if (coverage > 0.002) {

  // Per-pixel normal from the height field (central differences, 4 taps).
  float texel = 1.0 / mix(1024.0, 512.0, uCompact);
  float e = texel * 1.35;
  float hL = markAt(muvD - vec2(e, 0.0)).r;
  float hR = markAt(muvD + vec2(e, 0.0)).r;
  float hD = markAt(muvD - vec2(0.0, e)).r;
  float hU = markAt(muvD + vec2(0.0, e)).r;
  vec2 slope = vec2(hR - hL, hU - hD) / (2.0 * e);
  // Depth expressed in *texels*, not uv: (Δh/2e) · (e·K) = Δh·K/2, so the
  // relief looks identical at 1024² and 512² instead of hardening on a phone.
  float relief = e * mix(9.0, 7.0, uCompact) * (1.0 + energy * 0.55);
  vec3 normal = normalize(vec3(-slope * relief, 1.0));

  /* The disturbance also tilts the surface: the crest of a wave catches light
     even where the tool marks are flat. This is what makes it read as liquid
     rather than as a wobbling picture. */
  vec2 slopeEnergy = vec2(disp.y, -disp.x) * 22.0;
  normal = normalize(normal + vec3(slopeEnergy, 0.0) * min(energy, 1.8));

  // ---- lighting ---------------------------------------------------------
  float sweep = uTime * 0.26;
  vec3 keyDir = normalize(vec3(cos(sweep) * 0.85, 0.55 + 0.12 * sin(sweep * 0.7), 0.75));
  vec3 fillDir = normalize(vec3(-0.55, -0.35, 0.55));
  vec3 rimDir  = normalize(vec3(-0.75, 0.10, -0.45));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(keyDir + viewDir);

  float ndl = clamp(dot(normal, keyDir), 0.0, 1.0);
  float ndlFill = clamp(dot(normal, fillDir), 0.0, 1.0);
  float spec = pow(clamp(dot(normal, halfDir), 0.0, 1.0), mix(58.0, 34.0, uCompact));
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.2);
  float rim = pow(clamp(dot(normal, rimDir), 0.0, 1.0), 1.6);

  /* The caustic: light gathered under the disturbance. Deliberately tinted
     lilac-white rather than white, so even when it saturates it stays inside
     the palette and reads as light passing through glass, not a lamp. */
  float glint = pow(clamp(dot(normal, halfDir), 0.0, 1.0), 230.0) * min(energy, 2.0) * 1.45;

  // Tool marks: fine ribs that bend as they cross the relief, so they read as
  // machining rather than an overlay. Deliberately shallow, and flat on a phone.
  float ribs = 0.5 + 0.5 * sin((muvD.y * 310.0) + height * 18.0);
  ribs = mix(0.88 + 0.12 * ribs, 1.0, uCompact);

  float tone = 0.20 + ndl * 0.46 + fresnel * 0.10 + energy * 0.10;
  metal = violetRamp(tone);
  metal = mix(metal, violetRamp(0.58), fresnel * 0.40);
  metal += vec3(1.0, 0.99, 1.0) * spec * 0.85;
  metal += vec3(0.30, 0.20, 0.62) * ndlFill * 0.30;
  metal += vec3(0.52, 0.36, 0.98) * rim * 0.34;
  metal *= ribs;

  /* Dispersion: the crest of a wave separates light, exactly as a lens does at
     its edge. The ramp is sampled either side of the true tone and the two
     results are laid onto opposite flanks of the crest — the flank travelling
     one way catches the warm end, the other catches the cool end. Both ends
     live inside the studio's ramp, so the fringe reads as refraction and never
     as a rainbow. */
  float split = min(energy, 2.2) * 0.13;
  vec2 fringe = normalize(disp + 1e-6) * split * 0.0026;
  float splitSlope = markAt(muvD + fringe).r - height;
  float warmSide = clamp(splitSlope * 42.0, 0.0, 1.0) * min(energy, 1.0);
  float coolSide = clamp(-splitSlope * 42.0, 0.0, 1.0) * min(energy, 1.0);
  metal = mix(metal, violetRamp(tone + split), warmSide * 0.58);
  metal = mix(metal, violetRamp(tone - split * 0.9), coolSide * 0.58);

  metal = mix(metal, vec3(0.90, 0.84, 1.0), clamp(glint * 0.70, 0.0, 0.55));

  // A caustic: the energy travelling through the metal lights it from inside.
  // This is what makes a disturbance look alive rather than displaced.
  metal += vec3(0.46, 0.30, 1.0) * pow(min(energy, 2.2), 2.0) * 0.10;

  /* Occlusion from the form itself: where the relief is low it sits in its own
     shadow. This gives the piece weight, and unlike a shifted shadow sprite it
     cannot produce a hard-edged patch. */
  metal *= mix(0.55, 1.0, smoothstep(0.0, 0.42, height));
  metal *= 0.62 + 0.38 * ndl;

  }

  col += vec3(0.140, 0.086, 0.360) * coverage * 0.30;
  // The disturbance is not confined to the mark: its energy bleeds into the
  // plate, so the surface seems lit from behind rather than sticker-applied.
  col += vec3(0.330, 0.180, 0.850) * min(energy, 2.0) * 0.011;
  col = mix(col, metal, coverage);

  // ---- arrive: light spreads outward from the centre --------------------
  float reveal = clamp(uReveal, 0.0, 1.0);
  float front = mix(0.02, 1.9, reveal);
  float lit = 1.0 - smoothstep(front - 0.45, front, length(q));
  col *= mix(0.06, 1.0, lit);

  // ---- finish: vignette, a little grain, filmic curve -------------------
  float vig = 1.0 - 0.55 * smoothstep(0.35, 1.55, length(vec2(p.x * 0.72, p.y * 0.85)));
  col *= vig;
  float grain = hash(gl_FragCoord.xy + floor(uTime * 24.0)) - 0.5;
  col += grain * (uCompact > 0.5 ? 0.012 : 0.018);
  col = pow(max(col, 0.0), vec3(0.92));

  fragColor = vec4(col, coverage);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Fail loudly in development, never silently to a black screen.
    console.error("hero shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type Quality = { ratio: number; fps: number; still: boolean };

function decideQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compact = window.matchMedia("(max-width: 767px)").matches;
  const weak =
    (nav.hardwareConcurrency || 8) <= 4 ||
    (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory <= 4) ||
    Boolean(nav.connection?.saveData);
  if (reduce) return { ratio: 1, fps: 0, still: true };
  if (weak) return { ratio: compact ? 1 : 1.25, fps: 30, still: false };
  return { ratio: compact ? 1.5 : 2, fps: 60, still: false };
}

type Ripple = { x: number; y: number; born: number; strength: number };

export function HeroRelief({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    if (!gl) return;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERT);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("hero program:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    /* One triangle covering the screen: the cheapest full-screen draw there is. */
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      res: gl.getUniformLocation(program, "uRes"),
      time: gl.getUniformLocation(program, "uTime"),
      pointer: gl.getUniformLocation(program, "uPointer"),
      reveal: gl.getUniformLocation(program, "uReveal"),
      compact: gl.getUniformLocation(program, "uCompact"),
      animate: gl.getUniformLocation(program, "uAnimate"),
      cursor: gl.getUniformLocation(program, "uCursor"),
      ripples: gl.getUniformLocation(program, "uRipples[0]"),
      mark: gl.getUniformLocation(program, "uMark"),
    };

    const quality = decideQuality();
    const compact = window.matchMedia("(max-width: 767px)").matches;
    const slotCount = quality.fps === 30 ? 2 : RIPPLE_SLOTS;

    let frame = 0;
    let disposed = false;
    let visible = true;
    let startedAt = 0;
    let lastDraw = 0;
    let aimX = 0;
    let aimY = 0;
    let px = 0;
    let py = 0;
    let ready = false;

    /* Interaction state, all in the canvas's own uv space (y up). */
    const ripples: Ripple[] = [];
    const rippleData = new Float32Array(RIPPLE_SLOTS * 4);
    let cursorU = 0.5;
    let cursorV = 0.5;
    let cursorTargetU = 0.5;
    let cursorTargetV = 0.5;
    let cursorStrength = 0;
    let cursorTargetStrength = 0;
    let lastRippleAt = 0;
    let lastPointerU = -1;
    let lastPointerV = -1;

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uniforms.mark, 0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));

      /* A pixel budget, not just a ratio cap. At 2560 × 1440 and DPR 2 this
         shader would be asked for 14.7 M fragments a frame; capping the ratio
         alone still lets a big Windows display push a mid-range GPU out of its
         frame. The budget scales the ratio down on large screens (where the
         extra samples are invisible on soft metal) and never below 1. */
      const budget = compact ? 2_200_000 : 4_600_000;
      const cap = Math.sqrt(budget / (width * height));
      const ratio = Math.max(1, Math.min(window.devicePixelRatio || 1, quality.ratio, cap));

      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (quality.still && ready) draw(performance.now());
    };

    /** Adds a disturbance, dropping the oldest when the slots are full. */
    const spawnRipple = (u: number, v: number, strength: number, now: number) => {
      if (quality.still) return;
      ripples.push({ x: u, y: v, born: now, strength });
      while (ripples.length > slotCount) ripples.shift();
      lastRippleAt = now;
    };

    const draw = (now: number) => {
      const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
      const reveal = quality.still ? 1 : Math.min(1, elapsed / 2.6);

      // Ease the pointer and the press so the metal has weight and never snaps.
      px += (aimX - px) * 0.07;
      py += (aimY - py) * 0.07;
      cursorU += (cursorTargetU - cursorU) * 0.16;
      cursorV += (cursorTargetV - cursorV) * 0.16;
      cursorStrength += (cursorTargetStrength - cursorStrength) * 0.12;

      // Pack the live ripples as (x, y, ageInSeconds, strength).
      rippleData.fill(0);
      for (let i = 0; i < slotCount; i += 1) {
        const ripple = ripples[i];
        if (!ripple) continue;
        const age = Math.max(0, (now - ripple.born) / 1000);
        const strength = age > RIPPLE_LIFE ? 0 : ripple.strength * (1 - age / RIPPLE_LIFE);
        rippleData[i * 4] = ripple.x;
        rippleData[i * 4 + 1] = ripple.y;
        rippleData[i * 4 + 2] = age;
        rippleData[i * 4 + 3] = strength;
      }
      while (ripples.length && now - ripples[0].born > RIPPLE_LIFE * 1000) ripples.shift();

      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, quality.still ? 6.0 : elapsed);
      gl.uniform2f(uniforms.pointer, px, py);
      gl.uniform1f(uniforms.reveal, reveal);
      gl.uniform1f(uniforms.compact, compact ? 1 : 0);
      gl.uniform1f(uniforms.animate, quality.still ? 0 : 1);
      gl.uniform3f(uniforms.cursor, cursorU, cursorV, cursorStrength);
      gl.uniform4fv(uniforms.ripples, rippleData);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      frame = 0;
      if (disposed || !ready || !visible) return;
      const interval = 1000 / quality.fps;
      if (now - lastDraw >= interval) {
        lastDraw = now;
        applyPointer(now);
        draw(now);
      }
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      if (disposed || !ready) return;
      startedAt = performance.now();
      setLive(true);
      if (quality.still) {
        draw(startedAt);
        return;
      }
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      // The shader negates screen y itself; flipping here too would undo it.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      ready = true;
      start();
    };
    image.src = compact ? COMPACT : FULL;

    resize();

    /* ---- the touch surface -------------------------------------------------
     * The canvas is decorative and has no pointer events of its own, so the
     * hero section carries the interaction. Everything is passive: this must
     * never delay a scroll, a tap on a button, or the order form. */
    const surface: HTMLElement = canvas.closest(".hero") ?? canvas.parentElement ?? canvas;

    /**
     * The canvas box, measured once and refreshed only when it can change.
     * Reading it inside a pointer handler — which this used to do, twice per
     * event — flushes style and layout on every mouse move: at 1000 Hz that is
     * two thousand layout flushes a second, and it is the single most common
     * cause of a desktop browser feeling heavy.
     */
    const box = createRectCache(canvas);

    const toUv = (clientX: number, clientY: number) => {
      const rect = box.current;
      if (!rect.width || !rect.height) return null;
      const u = (clientX - rect.left) / rect.width;
      const v = 1 - (clientY - rect.top) / rect.height; // uv y is up
      if (u < -0.15 || u > 1.15 || v < -0.15 || v > 1.15) return null;
      return { u, v };
    };

    /* Pointer events only stamp the latest position; the work happens once per
       frame, in the frame we were going to draw anyway. */
    let pending: { x: number; y: number; touch: boolean; press: boolean } | null = null;

    const applyPointer = (now: number) => {
      if (!pending) return;
      const event = pending;
      pending = null;

      const point = toUv(event.x, event.y);
      if (!point) {
        cursorTargetStrength = 0;
        return;
      }
      cursorTargetU = point.u;
      cursorTargetV = point.v;
      cursorTargetStrength = event.press ? 1 : event.touch ? 1 : 0.85;

      if (event.press) {
        // A tap lands a shockwave: the strongest, most legible moment.
        spawnRipple(point.u, point.v, 1, now);
        lastPointerU = point.u;
        lastPointerV = point.v;
        return;
      }

      /* Dragging sheds droplets: a disturbance every 110 ms, only if the
         pointer actually travelled, so a still pointer stays calm. */
      const moved = Math.hypot(point.u - lastPointerU, point.v - lastPointerV);
      if (moved > 0.02 && now - lastRippleAt > 110) {
        spawnRipple(point.u, point.v, event.touch ? 0.75 : 0.55, now);
        lastPointerU = point.u;
        lastPointerV = point.v;
      }
    };

    const wake = () => {
      if (!frame && ready && visible && !quality.still) frame = requestAnimationFrame(loop);
    };

    const onMove = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY, touch: event.pointerType === "touch", press: false };
      wake();
    };

    const onDown = (event: PointerEvent) => {
      pending = { x: event.clientX, y: event.clientY, touch: event.pointerType === "touch", press: true };
      wake();
    };

    const onLeave = () => {
      pending = null;
      cursorTargetStrength = 0;
      wake();
    };

    surface.addEventListener("pointermove", onMove, { passive: true });
    surface.addEventListener("pointerdown", onDown, { passive: true });
    surface.addEventListener("pointerleave", onLeave, { passive: true });
    surface.addEventListener("pointercancel", onLeave, { passive: true });

    const onResize = () => {
      resize();
      if (quality.still) draw(performance.now());
      else if (!frame && ready && visible) frame = requestAnimationFrame(loop);
    };
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    observer?.observe(canvas);
    window.addEventListener("resize", onResize, { passive: true });

    const visibility =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            ([entry]) => {
              visible = Boolean(entry?.isIntersecting);
              if (visible && ready && !quality.still && !frame) {
                frame = requestAnimationFrame(loop);
              }
            },
            { rootMargin: "80px 0px" },
          )
        : null;
    visibility?.observe(canvas);

    /* Parallax follows a precise pointer only: on a touch screen the object is
       moved by the finger's disturbance instead, which is the point. */
    const precise = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onParallax = (event: PointerEvent) => {
      if (!visible) return; // the hero is behind us: not worth a layout read
      const rect = box.current;
      aimX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      aimY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    if (precise && !quality.still) {
      window.addEventListener("pointermove", onParallax, { passive: true });
    }

    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (ready && visible && !quality.still && !frame) {
        frame = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onHidden);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      box.destroy();
      observer?.disconnect();
      visibility?.disconnect();
      surface.removeEventListener("pointermove", onMove);
      surface.removeEventListener("pointerdown", onDown);
      surface.removeEventListener("pointerleave", onLeave);
      surface.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onParallax);
      document.removeEventListener("visibilitychange", onHidden);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`${className ?? ""}${live ? " is-live" : ""}`}
      aria-hidden="true"
    />
  );
}
