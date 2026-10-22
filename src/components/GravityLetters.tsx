import { useEffect, useRef, type CSSProperties } from "react";
import { cn } from "../utils/cn";

type RebuildOrder = "sweep" | "rise" | "random";

export interface GravityLettersProps {
  /** Headline rendered as grain sand. Read aloud as plain text. */
  text: string;
  className?: string;
  style?: CSSProperties;
  /** Largest font size in CSS pixels; the word shrinks to fit its box. */
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  /** [colour of the standing letters, colour of loose sand] */
  colors?: readonly [string, string];
  grainSize?: number;
  grainScale?: number;
  gravity?: number;
  /** Swipe with the pointer to slice letters; grains spray along the swipe. */
  cut?: boolean;
  cutWidth?: number;
  throwForce?: number;
  /** Click (or tap) to knock the whole word loose, then rebuild. */
  clickToCollapse?: boolean;
  collapseSpeed?: number;
  /** Seconds the collapsed sand rests before the word rebuilds. */
  holdTime?: number;
  rebuild?: RebuildOrder;
  /** Seconds each grain takes to fly home. */
  rebuildDuration?: number;
  paused?: boolean;
}

const ANCHORED = 0;
const FALLING = 1;
const RESTING = 2;
const RETURNING = 3;
const PENDING = 4;

const MAX_GRAINS = 9000;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface Grains {
  homeX: Float32Array;
  homeY: Float32Array;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  fromX: Float32Array;
  fromY: Float32Array;
  floor: Float32Array;
  timer: Float32Array;
  progress: Float32Array;
  delay: Float32Array;
  seed: Float32Array;
  size: Float32Array;
  state: Uint8Array;
  count: number;
}

/**
 * A headline made of grain sand: press and swipe to slice it, click to let it
 * collapse under gravity, then watch it pour back into place. The word is
 * painted into an offscreen canvas once, sampled into grains, and then simulated
 * on a single 2D canvas — no dependencies.
 */
export function GravityLetters({
  text,
  className,
  style,
  fontSize = 300,
  fontWeight = 600,
  fontFamily,
  colors = ["#f6f4ff", "#b19ee7"],
  grainSize = 4,
  grainScale = 0.82,
  gravity = 1,
  cut = true,
  cutWidth = 14,
  throwForce = 1,
  clickToCollapse = true,
  collapseSpeed = 1400,
  holdTime = 1,
  rebuild = "sweep",
  rebuildDuration = 0.8,
  paused = false,
}: GravityLettersProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const settings = useRef({
    text,
    fontSize,
    fontWeight,
    fontFamily,
    colors,
    grainSize,
    grainScale,
    gravity,
    cut,
    cutWidth,
    throwForce,
    clickToCollapse,
    collapseSpeed,
    holdTime,
    rebuild,
    rebuildDuration,
  });
  settings.current = {
    text,
    fontSize,
    fontWeight,
    fontFamily,
    colors,
    grainSize,
    grainScale,
    gravity,
    cut,
    cutWidth,
    throwForce,
    clickToCollapse,
    collapseSpeed,
    holdTime,
    rebuild,
    rebuildDuration,
  };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let grains: Grains | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let lastTime = 0;
    let clock = 0;
    let inView = false;
    let rebuildTimer = 0;
    let resolvedCell = grainSize;
    let idleFrames = 0;
    let painted = false;

    const paint = () => {
      const config = settings.current;
      if (!grains) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const [letterColor, sandColor] = config.colors;
      const base = resolvedCell * config.grainScale;
      const g = grains;

      for (let i = 0; i < g.count; i += 1) {
        const state = g.state[i];
        let px = g.x[i];
        let py = g.y[i];

        if (state === ANCHORED && clock > 0) {
          const seed = g.seed[i];
          px += Math.sin(clock * 1.1 + seed * 18) * 0.35;
          py += Math.cos(clock * 0.9 + seed * 24) * 0.35;
        }

        if (px < -40 || px > width + 40 || py < -60 || py > height + 80) continue;

        const seed = g.seed[i];
        const side = base * g.size[i];
        ctx.globalAlpha = 0.5 + seed * 0.5;
        ctx.fillStyle = state === ANCHORED ? letterColor : sandColor;
        ctx.fillRect(px - side * 0.5, py - side * 0.5, side, side);
      }

      ctx.globalAlpha = 1;
    };

    const step = (delta: number) => {
      if (!grains) return;
      const config = settings.current;
      const g = grains;
      const gravityPx = 2600 * config.gravity;
      const drag = Math.pow(0.86, delta * 60);
      let moving = false;

      for (let i = 0; i < g.count; i += 1) {
        const state = g.state[i];
        if (state !== ANCHORED) moving = true;

        if (state === PENDING) {
          g.timer[i] -= delta * 1000;
          if (g.timer[i] <= 0) {
            g.state[i] = FALLING;
            g.vx[i] = (Math.random() - 0.5) * 60;
            g.vy[i] = -40 - Math.random() * 90;
          }
          continue;
        }

        if (state === FALLING) {
          g.vy[i] += gravityPx * delta;
          g.vx[i] *= drag;
          g.x[i] += g.vx[i] * delta;
          g.y[i] += g.vy[i] * delta;

          if (g.y[i] >= g.floor[i]) {
            g.y[i] = g.floor[i];
            g.state[i] = RESTING;
            g.timer[i] = config.holdTime * 1000 + g.delay[i] * 1000;
            g.vy[i] = 0;
            g.vx[i] = 0;
          }
          continue;
        }

        if (state === RESTING) {
          g.timer[i] -= delta * 1000;
          if (g.timer[i] <= 0) {
            g.state[i] = RETURNING;
            g.progress[i] = 0;
            g.fromX[i] = g.x[i];
            g.fromY[i] = g.y[i];
          }
          continue;
        }

        if (state === RETURNING) {
          g.progress[i] += delta / Math.max(config.rebuildDuration, 0.05);
          const t = Math.min(g.progress[i], 1);
          const eased = easeOutCubic(t);
          g.x[i] = g.fromX[i] + (g.homeX[i] - g.fromX[i]) * eased;
          g.y[i] = g.fromY[i] + (g.homeY[i] - g.fromY[i]) * eased;
          if (t >= 1) {
            g.state[i] = ANCHORED;
            g.x[i] = g.homeX[i];
            g.y[i] = g.homeY[i];
          }
        }
      }

      return moving;
    };

    const frame = (now: number) => {
      if (disposed) return;
      const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
      lastTime = now;
      clock += delta;

      let moving = false;
      if (!pausedRef.current && !motionQuery.matches) {
        moving = step(delta) === true;
      }

      // Idle words still shimmer, but they do not need every frame.
      idleFrames = moving ? 0 : idleFrames + 1;
      if (moving || idleFrames % 2 === 0) paint();

      raf = window.requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || disposed) return;
      lastTime = 0;
      raf = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      window.cancelAnimationFrame(raf);
      raf = 0;
    };

    /* ---------------- Geometry + sampling ---------------- */

    const measureFont = (context: CanvasRenderingContext2D, family: string, size: number) => {
      const config = settings.current;
      context.font = `${config.fontWeight} ${size}px ${family}`;
      const spaced = context as CanvasRenderingContext2D & { letterSpacing?: string };
      if ("letterSpacing" in spaced) {
        spaced.letterSpacing = `${(-0.03 * size).toFixed(2)}px`;
      }
    };

    const build = () => {
      const config = settings.current;
      const rect = wrap.getBoundingClientRect();
      width = Math.max(Math.round(rect.width), 1);
      height = Math.max(Math.round(rect.height), 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // Reduced motion: one still rendering of the word, no simulation.
      const family =
        config.fontFamily ||
        window.getComputedStyle(wrap).fontFamily ||
        '"JetBrains Mono Variable", ui-monospace, monospace';

      if (motionQuery.matches) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        fitAndDrawText(ctx, family, config.colors[0]);
        grains = null;
        painted = true;
        stop();
        wrap.dataset.ready = "true";
        return;
      }

      const off = document.createElement("canvas");
      off.width = Math.round(width * dpr);
      off.height = Math.round(height * dpr);
      const offCtx = off.getContext("2d", { willReadFrequently: true });
      if (!offCtx) return;
      offCtx.scale(dpr, dpr);
      fitAndDrawText(offCtx, family, "#ffffff");

      const pixels = offCtx.getImageData(0, 0, off.width, off.height).data;

      // Keep the grain budget sane for very large wordmarks.
      let cell = config.grainSize;
      while (
        (width / cell) * (height / cell) > MAX_GRAINS * 2.6 &&
        cell < 40
      ) {
        cell += 1;
      }

      const cellStep = cell;
      const columns = Math.ceil(width / cellStep);
      const rows = Math.ceil(height / cellStep);
      const count = columns * rows;

      const homeX = new Float32Array(count);
      const homeY = new Float32Array(count);
      const sizes = new Float32Array(count);
      const seeds = new Float32Array(count);
      const floors = new Float32Array(count);
      let found = 0;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const sampleX = Math.min(off.width - 1, Math.round((column + 0.5) * cell * dpr));
          const sampleY = Math.min(off.height - 1, Math.round((row + 0.5) * cell * dpr));
          const offset = (sampleY * off.width + sampleX) * 4;
          const alpha = pixels[offset + 3];
          if (alpha < 96) continue;

          const seed = Math.random();
          const jitter = cell * 0.16;
          homeX[found] = (column + 0.5) * cell + (Math.random() - 0.5) * jitter;
          homeY[found] = (row + 0.5) * cell + (Math.random() - 0.5) * jitter;
          sizes[found] = 0.7 + seed * 0.55;
          seeds[found] = seed;
          floors[found] = height - cell * (0.4 + seed * 3.4);
          found += 1;
        }
      }

      const next: Grains = {
        homeX: homeX.slice(0, found),
        homeY: homeY.slice(0, found),
        x: homeX.slice(0, found),
        y: homeY.slice(0, found),
        vx: new Float32Array(found),
        vy: new Float32Array(found),
        fromX: new Float32Array(found),
        fromY: new Float32Array(found),
        floor: floors.slice(0, found),
        timer: new Float32Array(found),
        progress: new Float32Array(found),
        delay: new Float32Array(found),
        seed: seeds.slice(0, found),
        size: sizes.slice(0, found),
        state: new Uint8Array(found),
        count: found,
      };

      // Each grain returns in the chosen order once the sand has rested.
      const spread = 0.85;
      for (let i = 0; i < found; i += 1) {
        if (config.rebuild === "sweep") {
          next.delay[i] = (next.homeX[i] / Math.max(width, 1)) * spread;
        } else if (config.rebuild === "rise") {
          next.delay[i] = (1 - next.homeY[i] / Math.max(height, 1)) * spread;
        } else {
          next.delay[i] = Math.random() * spread;
        }
      }

      grains = next;
      painted = true;
      paint();
      start();
      wrap.dataset.ready = "true";
    };

    const fitAndDrawText = (
      context: CanvasRenderingContext2D,
      family: string,
      color: string
    ) => {
      const config = settings.current;
      const maxWidth = width * 0.98;
      const maxHeight = height * 0.94;

      measureFont(context, family, config.fontSize);
      const probe = context.measureText(config.text);
      const inkWidth =
        (probe.actualBoundingBoxLeft + probe.actualBoundingBoxRight) || probe.width || 1;
      const inkHeight =
        (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent) || config.fontSize;
      const scale = Math.min(maxWidth / inkWidth, maxHeight / inkHeight);
      const fitted = Math.max(12, config.fontSize * scale);

      measureFont(context, family, fitted);
      const metrics = context.measureText(config.text);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const baseline = height / 2 + (ascent - descent) / 2;

      context.textAlign = "center";
      context.textBaseline = "alphabetic";
      context.fillStyle = color;
      context.fillText(config.text, width / 2, baseline);
    };

    /* ---------------- Interaction ---------------- */

    const pointFrom = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const slice = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      if (!grains) return;
      const config = settings.current;
      const g = grains;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 1) return;
      const length = Math.sqrt(lengthSquared);
      const nx = dx / length;
      const ny = dy / length;
      const radius = config.cutWidth * 0.5;
      const power = 320 * config.throwForce;

      for (let i = 0; i < g.count; i += 1) {
        if (g.state[i] !== ANCHORED) continue;
        const px = g.homeX[i] - from.x;
        const py = g.homeY[i] - from.y;
        const projection = Math.max(0, Math.min(length, px * nx + py * ny));
        const ox = px - nx * projection;
        const oy = py - ny * projection;
        if (ox * ox + oy * oy > radius * radius) continue;

        g.state[i] = FALLING;
        g.x[i] = g.homeX[i];
        g.y[i] = g.homeY[i];
        g.vx[i] = nx * power + (Math.random() - 0.5) * 90;
        g.vy[i] = ny * power - 40 - Math.random() * 90;
      }
    };

    const collapse = (originX: number, originY: number) => {
      if (!grains) return;
      const config = settings.current;
      const g = grains;

      for (let i = 0; i < g.count; i += 1) {
        if (g.state[i] !== ANCHORED) continue;
        const distance = Math.hypot(g.homeX[i] - originX, g.homeY[i] - originY);
        g.state[i] = PENDING;
        g.timer[i] = (distance / Math.max(config.collapseSpeed, 1)) * 1000;
      }

      start();
    };

    let dragging = false;
    let moved = false;
    let downAt = { x: 0, y: 0 };
    let lastAt = { x: 0, y: 0 };

    const onPointerDown = (event: PointerEvent) => {
      if (motionQuery.matches) return;
      const point = pointFrom(event);
      dragging = true;
      moved = false;
      downAt = point;
      lastAt = point;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* older browsers simply keep the pointer on the canvas */
      }
      start();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || motionQuery.matches) return;
      if (event.pointerType === "mouse" && event.buttons === 0) {
        dragging = false;
        return;
      }
      const config = settings.current;
      const point = pointFrom(event);
      if (!moved && Math.hypot(point.x - downAt.x, point.y - downAt.y) > 6) moved = true;
      if (moved && config.cut && event.pointerType !== "touch") {
        slice(lastAt, point);
      }
      lastAt = point;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (motionQuery.matches) return;
      const config = settings.current;
      const point = pointFrom(event);
      if (!moved && config.clickToCollapse) collapse(point.x, point.y);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    /* ---------------- Lifecycle ---------------- */

    const onResize = () => {
      window.clearTimeout(rebuildTimer);
      rebuildTimer = window.setTimeout(() => {
        if (!disposed) build();
      }, 140);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(wrap);

    const visibility = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        if (inView) {
          if (!painted) build();
          if (!motionQuery.matches) start();
        } else {
          stop();
        }
      },
      { rootMargin: "120px 0px" }
    );
    visibility.observe(wrap);

    const onMotionChange = () => {
      stop();
      painted = false;
      if (inView) {
        build();
        if (!motionQuery.matches) start();
      }
    };
    motionQuery.addEventListener("change", onMotionChange);

    const ready = () => {
      if (disposed || !inView || painted) return;
      build();
    };

    // Grain sampling must use the real display font, not the fallback.
    if (document.fonts?.ready) {
      document.fonts.ready.then(ready).catch(ready);
    } else {
      ready();
    }

    return () => {
      disposed = true;
      stop();
      window.clearTimeout(rebuildTimer);
      resizeObserver.disconnect();
      visibility.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("gravity-letters", className)} style={style}>
      <span className="gravity-letters__fallback" aria-hidden="true">
        {text}
      </span>
      <canvas ref={canvasRef} className="gravity-letters__canvas" aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </div>
  );
}
