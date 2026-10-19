import { useEffect, useRef, useState, type CSSProperties } from "react";

type MorphLayout = {
  width: number;
  height: number;
  maxWidth?: number;
  logoScale?: number;
};

type ParticleMorphProps = {
  images: readonly string[];
  labels: readonly string[];
  layout: MorphLayout;
  particleDensity: number;
  particleSize: number;
  colors?: readonly string[];
  color?: string;
  transitionDuration: number;
  interval: number;
  dispersion: number;
  glow: number;
  pointerStrength: number;
  className?: string;
};

type MorphArray = Float32Array<ArrayBuffer>;
type SamplePoint = { x: number; y: number; r: number; g: number; b: number };
type SampledLogo = { points: SamplePoint[] };
type PlacedLogo = { positions: MorphArray; colors: MorphArray };

const SAMPLE_SIZE = 176;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const PARTICLE_BUDGET = 760;
const CORE_COUNT = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
/** Lower-powered machines keep the motion but render fewer, larger particles. */
const BUDGET_SCALE = CORE_COUNT <= 2 ? 0.62 : CORE_COUNT <= 4 ? 0.85 : 1;
const FRAME_INTERVAL = 1000 / 45;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function parseColor(value: string): [number, number, number] {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[\da-f]{6}$/i.test(hex)) {
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  return [197, 162, 255];
}

function colorMix(from: number, to: number, progress: number) {
  return Math.round(from + (to - from) * progress);
}

function toCssColor(r: number, g: number, b: number) {
  return `rgb(${r} ${g} ${b})`;
}

function imageReady(image: HTMLImageElement) {
  return new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Could not load particle image: ${image.src}`));
    if (image.complete) {
      if (image.naturalWidth > 0) resolve();
      else reject(new Error(`Could not load particle image: ${image.src}`));
    }
  });
}

async function sampleImage(src: string, count: number, accent?: string): Promise<SampledLogo> {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await imageReady(image);

  const scratch = document.createElement("canvas");
  scratch.width = SAMPLE_SIZE;
  scratch.height = SAMPLE_SIZE;
  const context = scratch.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas 2D is unavailable.");

  const inset = 15;
  context.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  context.drawImage(image, inset, inset, SAMPLE_SIZE - inset * 2, SAMPLE_SIZE - inset * 2);
  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const candidates: SamplePoint[] = [];
  const accentRgb = accent ? parseColor(accent) : null;

  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let x = 0; x < SAMPLE_SIZE; x += 1) {
      const index = (y * SAMPLE_SIZE + x) * 4;
      if (data[index + 3] < 56) continue;
      const mix = accentRgb ? 0.1 : 0;
      candidates.push({
        x: x / (SAMPLE_SIZE - 1),
        y: y / (SAMPLE_SIZE - 1),
        r: Math.round(data[index] * (1 - mix) + (accentRgb?.[0] ?? 0) * mix),
        g: Math.round(data[index + 1] * (1 - mix) + (accentRgb?.[1] ?? 0) * mix),
        b: Math.round(data[index + 2] * (1 - mix) + (accentRgb?.[2] ?? 0) * mix),
      });
    }
  }

  if (!candidates.length) throw new Error("Particle image has no visible pixels.");

  const random = seededRandom(src.length * 8191 + count * 313);
  const points: SamplePoint[] = new Array(count);
  const stride = candidates.length / count;
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = Math.min(candidates.length - 1, Math.floor((index + random()) * stride));
    points[index] = candidates[candidateIndex];
  }
  return { points };
}

function placeLogo(sample: SampledLogo, width: number, height: number, logoScale: number): PlacedLogo {
  const length = sample.points.length;
  const positions = new Float32Array(length * 2);
  const colors = new Float32Array(length * 3);
  const span = Math.min(width, height) * logoScale;
  const left = (width - span) / 2;
  const top = (height - span) / 2;

  sample.points.forEach((point, index) => {
    positions[index * 2] = left + point.x * span;
    positions[index * 2 + 1] = top + point.y * span;
    colors[index * 3] = point.r;
    colors[index * 3 + 1] = point.g;
    colors[index * 3 + 2] = point.b;
  });
  return { positions, colors };
}

export function ParticleMorph({
  images,
  labels,
  layout,
  particleDensity,
  particleSize,
  colors = [],
  color,
  transitionDuration,
  interval,
  dispersion,
  glow,
  pointerStrength,
  className,
}: ParticleMorphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"loading" | "active" | "static">("loading");
  const density = clamp(particleDensity, 0.25, 1);
  const imageKey = images.join("|");
  const colorsKey = colors.join("|");
  const style = {
    aspectRatio: `${layout.width} / ${layout.height}`,
    maxWidth: `${layout.maxWidth ?? layout.width}px`,
  } as CSSProperties;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    let session = 0;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let removePointerListeners = () => {};
    let visible = false;

    const teardown = () => {
      session += 1;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      resizeObserver?.disconnect();
      resizeObserver = null;
      visibilityObserver?.disconnect();
      visibilityObserver = null;
      removePointerListeners();
      removePointerListeners = () => {};
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = async () => {
      teardown();
      const run = session;
      setMode("loading");
      if (
        motionQuery.matches
        || typeof ResizeObserver === "undefined"
        || typeof IntersectionObserver === "undefined"
        || images.length < 2
      ) {
        setMode("static");
        return;
      }

      const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
      if (!context) {
        setMode("static");
        return;
      }

      try {
        const count = Math.round(PARTICLE_BUDGET * density * BUDGET_SCALE);
        const palette = images.map((_, index) => colors[index] ?? color).map((value) => value ?? "");
        const sampledLogos = await Promise.all(images.map((src, index) => sampleImage(src, count, palette[index] || undefined)));
        if (run !== session) return;

        let width = 0;
        let height = 0;
        let pixelRatio = 1;
        let placedLogos: PlacedLogo[] = [];
        let activeIndex = 0;
        let targetIndex = 1;
        let fromPositions = new Float32Array(count * 2);
        let toPositions = new Float32Array(count * 2);
        let currentPositions = new Float32Array(count * 2);
        let fromColors = new Float32Array(count * 3);
        let toColors = new Float32Array(count * 3);
        let currentColors = new Float32Array(count * 3);
        let transitionStart = 0;
        let morphing = false;
        let nextTransitionAt = 0;
        let lastFrameAt = 0;
        let pointerX = -9999;
        let pointerY = -9999;
        let pointerActive = false;
        const randomX = new Float32Array(count);
        const randomY = new Float32Array(count);
        const randomSeed = new Float32Array(count);
        const random = seededRandom(count * 911 + Math.round(dispersion * 37));
        for (let index = 0; index < count; index += 1) {
          randomX[index] = random() * 2 - 1;
          randomY[index] = random() * 2 - 1;
          randomSeed[index] = random() * Math.PI * 2;
        }

        const resize = () => {
          const rect = wrapper.getBoundingClientRect();
          if (rect.width < 24 || rect.height < 24) return;
          width = rect.width;
          height = rect.height;
          pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
          canvas.width = Math.round(width * pixelRatio);
          canvas.height = Math.round(height * pixelRatio);
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          placedLogos = sampledLogos.map((sample) => placeLogo(sample, width, height, layout.logoScale ?? 0.72));
          activeIndex = clamp(activeIndex, 0, placedLogos.length - 1);
          targetIndex = (activeIndex + 1) % placedLogos.length;
          currentPositions = placedLogos[activeIndex].positions.slice();
          currentColors = placedLogos[activeIndex].colors.slice();
          fromPositions = currentPositions.slice();
          toPositions = currentPositions.slice();
          fromColors = currentColors.slice();
          toColors = currentColors.slice();
          morphing = false;
          nextTransitionAt = performance.now() + interval;
        };

        resize();
        if (run !== session) return;
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(wrapper);

        const onPointerMove = (event: PointerEvent) => {
          const rect = canvas.getBoundingClientRect();
          pointerX = event.clientX - rect.left;
          pointerY = event.clientY - rect.top;
          pointerActive = true;
        };
        const onPointerLeave = () => { pointerActive = false; };
        canvas.addEventListener("pointermove", onPointerMove, { passive: true });
        canvas.addEventListener("pointerleave", onPointerLeave, { passive: true });
        removePointerListeners = () => {
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerleave", onPointerLeave);
        };

        const easeInOut = (value: number) => value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
        const draw = (now: number) => {
          animationFrame = 0;
          if (run !== session || !visible) return;
          if (now - lastFrameAt < FRAME_INTERVAL) {
            animationFrame = requestAnimationFrame(draw);
            return;
          }
          lastFrameAt = now;

          if (!morphing && now >= nextTransitionAt) {
            targetIndex = (activeIndex + 1) % placedLogos.length;
            fromPositions = currentPositions.slice();
            fromColors = currentColors.slice();
            toPositions = placedLogos[targetIndex].positions;
            toColors = placedLogos[targetIndex].colors;
            transitionStart = now;
            morphing = true;
          }

          const rawProgress = morphing ? clamp((now - transitionStart) / Math.max(250, transitionDuration), 0, 1) : 1;
          const progress = morphing ? easeInOut(rawProgress) : 1;
          const scatter = morphing ? Math.sin(Math.PI * rawProgress) * dispersion : 0;
          const pointerRadius = Math.min(width, height) * 0.34;
          const maxPointerShift = pointerStrength * Math.min(24, Math.min(width, height) * 0.09);

          context.clearRect(0, 0, width, height);
          const glowIndex = morphing && rawProgress > 0.55 ? targetIndex : activeIndex;
          const glowColor = palette[glowIndex] || "#a77aff";
          context.shadowColor = glowColor;
          context.shadowBlur = clamp(glow, 0, 1) * 14;
          context.lineWidth = 0;

          for (let index = 0; index < count; index += 1) {
            const px = index * 2;
            const cx = index * 3;
            const baseX = fromPositions[px] + (toPositions[px] - fromPositions[px]) * progress;
            const baseY = fromPositions[px + 1] + (toPositions[px + 1] - fromPositions[px + 1]) * progress;
            let x = baseX + randomX[index] * scatter;
            let y = baseY + randomY[index] * scatter;

            if (pointerActive) {
              const dx = x - pointerX;
              const dy = y - pointerY;
              const distance = Math.hypot(dx, dy);
              if (distance < pointerRadius && distance > 0.001) {
                const influence = 1 - distance / pointerRadius;
                const force = maxPointerShift * influence * influence;
                x += (dx / distance) * force;
                y += (dy / distance) * force;
              }
            }

            const idle = morphing ? 0 : 0.45;
            const wobble = Math.sin(now * 0.0012 + randomSeed[index]) * idle;
            const r = colorMix(fromColors[cx], toColors[cx], progress);
            const g = colorMix(fromColors[cx + 1], toColors[cx + 1], progress);
            const b = colorMix(fromColors[cx + 2], toColors[cx + 2], progress);
            context.fillStyle = color ? color : toCssColor(r, g, b);
            context.beginPath();
            context.arc(x + wobble, y - wobble * 0.65, Math.max(0.65, particleSize * 0.5), 0, Math.PI * 2);
            context.fill();
          }

          context.shadowBlur = 0;
          if (morphing && rawProgress >= 1) {
            activeIndex = targetIndex;
            currentPositions = placedLogos[activeIndex].positions.slice();
            currentColors = placedLogos[activeIndex].colors.slice();
            fromPositions = currentPositions.slice();
            toPositions = currentPositions.slice();
            fromColors = currentColors.slice();
            toColors = currentColors.slice();
            morphing = false;
            nextTransitionAt = now + Math.max(interval, transitionDuration + 650);
          }

          animationFrame = requestAnimationFrame(draw);
        };

        visibilityObserver = new IntersectionObserver(([entry]) => {
          visible = Boolean(entry?.isIntersecting);
          if (visible && !animationFrame) animationFrame = requestAnimationFrame(draw);
          if (!visible && animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          }
        }, { rootMargin: "80px 0px", threshold: 0.01 });
        visibilityObserver.observe(wrapper);
        setMode("active");
      } catch {
        if (run === session) setMode("static");
      }
    };

    const onMotionChange = () => {
      if (motionQuery.matches) {
        teardown();
        setMode("static");
      } else {
        void start();
      }
    };

    void start();
    motionQuery.addEventListener("change", onMotionChange);
    return () => {
      motionQuery.removeEventListener("change", onMotionChange);
      teardown();
    };
  }, [imageKey, colorsKey, color, density, particleSize, transitionDuration, interval, dispersion, glow, pointerStrength, layout.width, layout.height, layout.logoScale, images, colors]);

  return (
    <div
      ref={wrapperRef}
      className={`particle-morph ${className ?? ""}`.trim()}
      style={style}
      aria-hidden="true"
      data-mode={mode}
    >
      <canvas ref={canvasRef} className="particle-morph__canvas" />
      <div className="particle-morph__fallback">
        {images.map((image, index) => (
          <div className="particle-morph__fallback-item" key={`${image}-${index}`}>
            <img src={image} alt="" loading="lazy" decoding="async" />
            <span>{labels[index] ?? `Social ${index + 1}`}</span>
          </div>
        ))}
      </div>
      <span className="particle-morph__signature" dir="ltr">CAHEN / SOCIAL SIGNAL</span>
    </div>
  );
}
