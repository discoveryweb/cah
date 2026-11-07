import { useEffect, useRef, useState, type RefObject } from "react";
import { LogoMark } from "./ui";
import { releasePage } from "../utils/bus";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toPersianDigits = (value: string) =>
  value.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);

/**
 * The brand word as an hourglass: a thread of sand pours into the letters and
 * fills them from the baseline up, exactly as fast as the page loads. The
 * letters themselves are the vessel — no glass, no funnel, just type filling
 * with sand.
 */
function SandWord({
  text,
  progressRef,
  className,
}: {
  text: string;
  progressRef: RefObject<number>;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      wrap.dataset.noCanvas = "true";
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let disposed = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;

    // Pre-rendered layers
    let outline: HTMLCanvasElement | null = null;
    let sandLayer: HTMLCanvasElement | null = null;
    let sandCtx: CanvasRenderingContext2D | null = null;

    // Grains, sorted by the fill level at which they settle.
    let thresholds: Float32Array = new Float32Array(0);
    let gx: Float32Array = new Float32Array(0);
    let gy: Float32Array = new Float32Array(0);
    let gs: Float32Array = new Float32Array(0);
    let gk: Float32Array = new Float32Array(0);
    let settled = 0;
    let grainSize = 3;
    /** What the current canvas was built from: box, ratio and the face's metrics. */
    let builtKey = "";
    let inkTop = 0;
    let inkBottom = 0;
    let surfaceGradient: CanvasGradient | null = null;
    let neckGradient: CanvasGradient | null = null;

    const stream = Array.from({ length: 110 }, () => ({
      x: 0,
      y: 0,
      vy: 0,
      w: 1,
      alive: false,
      life: 0,
    }));

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const fontStack = '"JetBrains Mono Variable", ui-monospace, SFMono-Regular, monospace';

    const drawGlyphs = (
      target: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      color: string,
      mode: "fill" | "stroke"
    ) => {
      const maxWidth = width * 0.94;
      const maxHeight = height * 0.86;
      const family = fontStack;

      target.font = `700 200px ${family}`;
      const probe = target.measureText(text);
      const inkWidth =
        (probe.actualBoundingBoxLeft + probe.actualBoundingBoxRight) || probe.width || 1;
      const inkHeight =
        (probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent) || 200;
      const fitted = Math.max(
        20,
        200 * Math.min(maxWidth / inkWidth, maxHeight / inkHeight)
      );
      target.font = `700 ${fitted}px ${family}`;
      const spaced = target as CanvasRenderingContext2D & { letterSpacing?: string };
      if ("letterSpacing" in spaced) spaced.letterSpacing = `${(-0.03 * fitted).toFixed(2)}px`;

      const metrics = target.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const baseline = height / 2 + (ascent - descent) / 2;

      target.textAlign = "center";
      target.textBaseline = "alphabetic";

      if (mode === "fill") {
        target.fillStyle = color;
        target.fillText(text, width / 2, baseline);
      } else {
        target.strokeStyle = color;
        target.lineWidth = 1;
        target.strokeText(text, width / 2, baseline);
      }
    };

    const build = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(Math.round(rect.width), 1);
      height = Math.max(Math.round(rect.height), 1);
      // Sand has no thin strokes to protect: 1.5 is indistinguishable from 2
      // here and it is 44 % fewer pixels to clear, blit and composite per frame.
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      /* The pour must not rebuild under itself. The face arriving is the one
         thing that changes the glyphs, and it is the one thing that used to
         rebuild the whole grain field mid-animation — the hitch in the
         entrance. Measure first, and only rebuild when the answer moved. */
      ctx.font = `700 200px ${fontStack}`;
      const key = `${width}x${height}@${dpr}|${ctx.measureText(text).width.toFixed(1)}`;
      if (key === builtKey) return;
      builtKey = key;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // 1. Glyph outline, drawn once: empty letters stay legible.
      outline = document.createElement("canvas");
      outline.width = canvas.width;
      outline.height = canvas.height;
      const outlineCtx = outline.getContext("2d");
      if (!outlineCtx) return;
      outlineCtx.scale(dpr, dpr);
      drawGlyphs(outlineCtx, "rgba(214, 198, 255, 0.26)", "stroke");

      // 2. Mask used to know which cells belong to a letter. It is read once at
      //    CSS resolution — the grains are sampled on a grid coarser than a
      //    pixel, so a device-resolution mask only made the read bigger.
      const mask = document.createElement("canvas");
      mask.width = width;
      mask.height = height;
      const maskCtx = mask.getContext("2d", { willReadFrequently: true });
      if (!maskCtx) return;
      drawGlyphs(maskCtx, "#ffffff", "fill");
      const pixels = maskCtx.getImageData(0, 0, mask.width, mask.height).data;

      // 3. Sample grains; each one settles at the fill level matching its row,
      //    so the sand surface climbs from the baseline to the cap height.
      grainSize = Math.max(2.4, Math.min(4.2, height / 58));
      const columns = Math.ceil(width / grainSize);
      const rows = Math.ceil(height / grainSize);
      let capacity = 0;

      // First pass: how many cells are inside the letters, and the ink bounds.
      let minRow = rows;
      let maxRow = 0;
      const inside = new Uint8Array(columns * rows);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const sx = Math.min(mask.width - 1, Math.round((column + 0.5) * grainSize));
          const sy = Math.min(mask.height - 1, Math.round((row + 0.5) * grainSize));
          if (pixels[(sy * mask.width + sx) * 4 + 3] < 120) continue;
          inside[row * columns + column] = 1;
          capacity += 1;
          if (row < minRow) minRow = row;
          if (row > maxRow) maxRow = row;
        }
      }

      thresholds = new Float32Array(capacity);
      gx = new Float32Array(capacity);
      gy = new Float32Array(capacity);
      gs = new Float32Array(capacity);
      gk = new Float32Array(capacity);

      inkTop = (minRow + 0.5) * grainSize;
      inkBottom = (Math.max(minRow + 1, maxRow) + 0.5) * grainSize;

      let index = 0;
      const span = Math.max(1, maxRow - minRow);
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if (!inside[row * columns + column]) continue;
          // 0 at the baseline, 1 at the cap height.
          const level = 1 - (row - minRow) / span;
          thresholds[index] = Math.min(1, Math.max(0, level + rand(-0.035, 0.035)));
          gx[index] = (column + 0.5) * grainSize + rand(-0.6, 0.6);
          gy[index] = (row + 0.5) * grainSize;
          gs[index] = rand(0.62, 1.12);
          gk[index] = Math.random();
          index += 1;
        }
      }

      // Sort by settling time so drawing stays incremental. A counting sort
      // over a fixed number of levels: the same order, without a comparator
      // running thousands of times inside the entrance's first frame.
      const LEVELS = 512;
      const buckets = new Uint32Array(LEVELS + 1);
      for (let i = 0; i < capacity; i += 1) {
        buckets[Math.min(LEVELS, Math.floor(thresholds[i] * LEVELS))] += 1;
      }
      for (let level = 1; level <= LEVELS; level += 1) buckets[level] += buckets[level - 1];
      const order = new Uint32Array(capacity);
      for (let i = capacity - 1; i >= 0; i -= 1) {
        const level = Math.min(LEVELS, Math.floor(thresholds[i] * LEVELS));
        buckets[level] -= 1;
        order[buckets[level]] = i;
      }
      const sortedThresholds = new Float32Array(capacity);
      const sortedX = new Float32Array(capacity);
      const sortedY = new Float32Array(capacity);
      const sortedS = new Float32Array(capacity);
      const sortedK = new Float32Array(capacity);
      for (let to = 0; to < capacity; to += 1) {
        const from = order[to];
        sortedThresholds[to] = thresholds[from];
        sortedX[to] = gx[from];
        sortedY[to] = gy[from];
        sortedS[to] = gs[from];
        sortedK[to] = gk[from];
      }
      thresholds = sortedThresholds;
      gx = sortedX;
      gy = sortedY;
      gs = sortedS;
      gk = sortedK;
      settled = 0;

      sandLayer = document.createElement("canvas");
      sandLayer.width = canvas.width;
      sandLayer.height = canvas.height;
      sandCtx = sandLayer.getContext("2d");
      sandCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sandCtx?.clearRect(0, 0, width, height);

      // Reset the pouring thread.
      stream.forEach((drop) => {
        drop.alive = false;
      });

      /* Gradients are identical every frame; building them is not free, and
         this loop runs sixty times a second. The radial one is built at the
         origin and translated onto the neck when it is painted. */
      surfaceGradient = ctx.createLinearGradient(width * 0.08, 0, width * 0.92, 0);
      surfaceGradient.addColorStop(0, "rgba(214, 198, 255, 0)");
      surfaceGradient.addColorStop(0.5, "rgba(236, 226, 255, 0.28)");
      surfaceGradient.addColorStop(1, "rgba(214, 198, 255, 0)");

      neckGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.1);
      neckGradient.addColorStop(0, "rgba(219, 199, 255, 0.34)");
      neckGradient.addColorStop(1, "rgba(219, 199, 255, 0)");
    };

    const drawSettled = (progress: number) => {
      if (!sandCtx) return;
      while (settled < thresholds.length && thresholds[settled] <= progress) {
        const x = gx[settled];
        const y = gy[settled];
        const size = grainSize * gs[settled];
        const shade = gk[settled];
        // Deeper sand is violet, the surface catches the light.
        const mix = thresholds[settled];
        sandCtx.globalAlpha = 0.72 + shade * 0.28;
        sandCtx.fillStyle =
          mix > 0.78
            ? shade > 0.5
              ? "#f6f2ff"
              : "#ded0ff"
            : mix > 0.4
              ? shade > 0.5
                ? "#c6adff"
                : "#a97dff"
              : shade > 0.5
                ? "#9068f5"
                : "#7a4fe6";
        sandCtx.fillRect(x - size / 2, y - size / 2, size, size);
        settled += 1;
      }
      sandCtx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      if (disposed) return;
      const delta = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      const progress = Math.min(1, Math.max(0, progressRef.current ?? 0));

      drawSettled(progress);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (outline) ctx.drawImage(outline, 0, 0, width, height);

      // The pour: a narrow thread from the top edge down to the rising surface.
      const frontY = inkBottom - (inkBottom - inkTop) * progress;
      if (!reduced && progress > 0.01 && progress < 0.995) {
        const spread = Math.max(8, width * 0.02);
        stream.forEach((drop, i) => {
          if (!drop.alive) {
            if (Math.random() > 0.34) return;
            drop.alive = true;
            drop.x = width / 2 + rand(-spread, spread);
            drop.y = -rand(0, height * 0.4);
            drop.vy = rand(160, 420);
            drop.w = rand(0.8, 1.9);
            drop.life = 0;
            return;
          }

          drop.vy += 1500 * delta;
          drop.y += drop.vy * delta;
          drop.life += delta;

          if (drop.y >= frontY || drop.life > 2.4) {
            drop.alive = false;
            return;
          }

          ctx.globalAlpha = 0.75;
          ctx.fillStyle = i % 3 === 0 ? "#f4efff" : "#c9adff";
          ctx.fillRect(drop.x, drop.y, drop.w, drop.w * 2.4);
        });
        ctx.globalAlpha = 1;

        // Impact glow at the neck, and a faint line where the sand stands.
        if (neckGradient) {
          ctx.save();
          ctx.translate(width / 2, frontY);
          ctx.fillStyle = neckGradient;
          ctx.fillRect(-width * 0.11, -14, width * 0.22, 30);
          ctx.restore();
        }

        if (surfaceGradient) {
          ctx.fillStyle = surfaceGradient;
          ctx.fillRect(width * 0.08, frontY, width * 0.84, 1);
        }
      }

      if (sandLayer) ctx.drawImage(sandLayer, 0, 0, width, height);

      raf = document.hidden ? 0 : window.requestAnimationFrame(frame);
    };

    let resizeTimer = 0;
    const onResize = () => {
      // Growing the window rebuilds the vessel; the fill state is derived from
      // progress, so nothing is lost. A drag across the edge fires this dozens
      // of times a second, so the rebuild waits for the drag to stop.
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (!disposed) build();
      }, 140);
    };

    build();
    raf = window.requestAnimationFrame(frame);

    /* A tab in the background has no viewer: the pour does not need to keep
       clearing and compositing a full-screen canvas behind a hidden page. */
    const onVisibility = () => {
      if (disposed) return;
      if (document.hidden) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = 0;
        raf = window.requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Re-sample once the display face is ready, so the grains trace real glyphs.
    const onFonts = () => {
      if (!disposed) build();
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(onFonts).catch(() => undefined);
    }

    const observer = new ResizeObserver(onResize);
    observer.observe(wrap);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, [progressRef, text]);

  return (
    <div ref={wrapRef} className={["preloader__sand", className].filter(Boolean).join(" ")}>
      <canvas ref={canvasRef} className="preloader__sand-canvas" aria-hidden="true" />
      <span className="preloader__word" dir="ltr">
        {text}
      </span>
    </div>
  );
}

export function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const progressRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("is-loading");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /**
     * The page is released: the curtain is up and the hero may start drawing.
     * Everything expensive on the first screen waits for this, so the entrance
     * animation owns the main thread while it is on screen.
     */
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
      releasePage();
    };

    if (reduced) {
      progressRef.current = 1;
      setCount(100);
      setLeaving(true);
      finish();
      const quickExit = window.setTimeout(() => {
        setGone(true);
        root.classList.remove("is-loading");
      }, 360);
      return () => window.clearTimeout(quickExit);
    }

    /*
     * The pour is the entrance, and it is driven by the page, not by a timer:
     * it finishes as soon as the typefaces and the hero's first frame are in,
     * with a floor so it never flashes and a ceiling so a slow network cannot
     * hold the site hostage. A fast connection gets a quick, confident
     * entrance; a slow one still sees the whole gesture.
     */
    const phone =
      window.matchMedia("(max-width: 767px)").matches ||
      (window.matchMedia("(pointer: coarse)").matches && window.innerHeight < 900);
    const minDuration = phone ? 760 : 900;
    const maxDuration = phone ? 1420 : 1640;
    const hold = phone ? 190 : 280;
    /** Re-targeted the moment the page is ready; always >= the elapsed time. */
    let finishAt = maxDuration;
    const start = performance.now();
    let frame = 0;
    let exitTimer = 0;
    let leaveTimer = 0;
    let lastPaint = 0;

    const tick = () => {
      // Read the clock here rather than trusting the timestamp, so the pour is
      // correct in any environment.
      const now = performance.now();
      const elapsed = now - start;
      const progress = Math.min(1, Math.max(0, elapsed / Math.max(finishAt, 1)));
      // Ease-out: the pour starts fast and settles gently.
      const eased = 1 - Math.pow(1 - progress, 2.2);
      progressRef.current = eased;

      if (now - lastPaint > 40 || progress >= 1) {
        lastPaint = now;
        setCount(Math.round(eased * 100));
      }

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      progressRef.current = 1;
      setCount(100);

      // Let the full word glow for a beat, then lift the curtain and release
      // the page in the same move: the hero's lines rise while the veil is
      // still travelling, so the entrance is one gesture instead of two.
      leaveTimer = window.setTimeout(() => {
        setLeaving(true);
        finish();
        root.classList.remove("is-loading");
      }, hold);
      exitTimer = window.setTimeout(() => setGone(true), hold + 1000);
    };

    /**
     * "Ready" means the two things the first screen is waiting for: the Persian
     * typeface (so the headline does not swap under the curtain) and the hero's
     * first frame. Either one failing must not block the exit.
     */
    let settled = false;
    const ready = () => {
      if (settled || doneRef.current) return;
      settled = true;
      const elapsed = performance.now() - start;
      // Give the pour a beat to finish after the page is ready, but never
      // stretch past the ceiling or cut short the floor.
      finishAt = Math.min(maxDuration, Math.max(minDuration, elapsed + 140));
    };

    const timeout = window.setTimeout(ready, maxDuration);
    // The curtain now lifts onto light the page draws itself, so the only thing
    // worth waiting for is the typeface: the headline must not swap under it.
    Promise.resolve(document.fonts?.ready ?? null).then(ready, ready);

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(leaveTimer);
      window.clearTimeout(timeout);
      root.classList.remove("is-loading");
    };
  }, [onDone]);

  if (gone) return null;

  const persianCount = toPersianDigits(String(count));

  return (
    <div
      className={`preloader${leaving ? " preloader--leaving" : ""}${
        count >= 100 ? " preloader--full" : ""
      }`}
      aria-hidden="true"
    >
      {/* The same violet field the hero is built from: the curtain lifts off the
          picture the page already has, so the entrance is one gesture rather
          than a cut. Nothing is downloaded for it. */}
      <div className="preloader__backdrop" aria-hidden="true">
        <span className="preloader__aurora preloader__aurora--one" />
        <span className="preloader__aurora preloader__aurora--two" />
      </div>

      <span className="preloader__glow" aria-hidden="true" />

      <div className="preloader__inner">
        <div className="preloader__top">
          <span className="preloader__mark">
            <LogoMark />
            <span dir="ltr">CAHEN / DIGITAL STUDIO</span>
          </span>
          <span className="preloader__reserve" dir="ltr">
            <span className="preloader__reserve-label">SAND</span>
            <span className="preloader__reserve-track" aria-hidden="true">
              <span style={{ transform: `scaleX(${1 - count / 100})` }} />
            </span>
            <span className="preloader__reserve-label">TEHRAN</span>
          </span>
        </div>

        <div className="preloader__stage">
          <SandWord text="CAHEN" progressRef={progressRef} />
          <div className="preloader__readout">
            <span className="preloader__count" dir="ltr">
              {String(count).padStart(3, "0")}
            </span>
            <span className="preloader__caption">
              در حال ریختنِ شن — <span dir="ltr">{persianCount}٪</span>
            </span>
          </div>
        </div>

        <div className="preloader__bottom">
          <span>شکیبایی کنید؛ صحنه در حال شکل گرفتن است</span>
          <span dir="ltr">CAHEN © 2026</span>
        </div>
      </div>
    </div>
  );
}
