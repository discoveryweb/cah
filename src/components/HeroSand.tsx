import { useEffect, useRef } from "react";
import mark from "../assets/cahen-mark.webp";
import { createRectCache } from "./canvasui/rect-cache";

/**
 * A small canvas sand study, sampled from the studio's actual mark. It is
 * independent of the relief renderer: devices without WebGL still get an
 * identity. A bounded, adaptive point budget and one draw loop keep this
 * decorative layer affordable. Input never captures a touch or blocks scroll.
 */
export function HeroSand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = canvas?.closest<HTMLElement>(".hero");
    if (!canvas || !surface) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 767px)");
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak = (nav.hardwareConcurrency || 4) <= 4 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) || Boolean(nav.connection?.saveData);
    const rectCache = createRectCache(canvas);
    const pointers = new Map<number, { x: number; y: number; vx: number; vy: number; time: number }>();
    const image = new Image();
    let width = 0, height = 0, ratio = 1, frame = 0, last = 0;
    let inView = true, disposed = false, imageReady = false;
    let x = new Float32Array(0), y = new Float32Array(0), homeX = new Float32Array(0), homeY = new Float32Array(0);
    let vx = new Float32Array(0), vy = new Float32Array(0), sizes = new Float32Array(0), tones = new Uint8Array(0);
    /* Indices grouped by tone, built once per build(): the draw used to walk
       every grain three times to split them, which is three times the work for
       the same three fills. */
    let groups: number[][] = [[], [], []];

    const draw = () => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      // Three batches avoid changing canvas state for every grain.
      const colors = document.documentElement.dataset.theme === "light"
        ? ["rgba(119, 65, 195, .62)", "rgba(129, 76, 207, .82)", "rgba(0, 151, 166, .9)"]
        : ["rgba(184, 130, 255, .56)", "rgba(229, 200, 255, .8)", "rgba(124, 245, 231, .88)"];
      for (let tone = 0; tone < colors.length; tone++) {
        ctx.fillStyle = colors[tone];
        const group = groups[tone];
        for (let g = 0; g < group.length; g++) {
          const i = group[g];
          const size = sizes[i];
          ctx.fillRect(x[i] - size / 2, y[i] - size / 2, size, size);
        }
      }
    };

    const build = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      ratio = Math.min(window.devicePixelRatio || 1, compact.matches ? 1.25 : 1.5);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      if (!imageReady) return;
      const sample = document.createElement("canvas");
      sample.width = 184; sample.height = 150;
      const sampleContext = sample.getContext("2d", { willReadFrequently: true });
      if (!sampleContext) return;
      sampleContext.drawImage(image, 0, 0, sample.width, sample.height);
      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      const candidates: number[] = [];
      for (let i = 0; i < sample.width * sample.height; i++) {
        const j = i * 4;
        const light = Math.max(pixels[j], pixels[j + 1], pixels[j + 2]);
        // The mark is a transparent or black-backed image; neither background
        // nor near-black pixels should turn into noise around the silhouette.
        if (pixels[j + 3] > 50 && light > 40) candidates.push(i);
      }
      if (!candidates.length) return;
      const count = Math.round((compact.matches ? 1900 : 4300) * (weak ? 0.68 : 1));
      x = new Float32Array(count); y = new Float32Array(count);
      homeX = new Float32Array(count); homeY = new Float32Array(count);
      vx = new Float32Array(count); vy = new Float32Array(count);
      sizes = new Float32Array(count); tones = new Uint8Array(count);
      // Keep the same aspect ratio as the source inside the orbital frame.
      const markWidth = width * 0.74;
      const markHeight = markWidth * sample.height / sample.width;
      for (let i = 0; i < count; i++) {
        const pixel = candidates[Math.min(candidates.length - 1, Math.floor((i + Math.random()) / count * candidates.length))];
        homeX[i] = width * 0.13 + ((pixel % sample.width) + Math.random()) / sample.width * markWidth;
        homeY[i] = (height - markHeight) * 0.5 + (Math.floor(pixel / sample.width) + Math.random()) / sample.height * markHeight;
        x[i] = homeX[i]; y[i] = homeY[i];
        sizes[i] = (compact.matches ? 1.2 : 1.35) + Math.random() * 1.45;
        const light = Math.max(pixels[pixel * 4], pixels[pixel * 4 + 1], pixels[pixel * 4 + 2]);
        tones[i] = Math.random() > 0.985 ? 2 : light > 170 && Math.random() > 0.4 ? 1 : 0;
      }
      groups = [[], [], []];
      for (let i = 0; i < count; i++) groups[tones[i]].push(i);
      draw();
    };

    const tick = (now: number) => {
      frame = 0;
      if (disposed || !inView || document.hidden || motion.matches) return;
      const interval = compact.matches || weak ? 1000 / 30 : 1000 / 45;
      if (!last || now - last >= interval) {
        const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 45;
        last = now;
        const damping = Math.exp(-6.8 * dt);
        const radius = compact.matches ? 112 : 145;
        let unsettled = false;
        for (let i = 0; i < x.length; i++) {
          let ax = (homeX[i] - x[i]) * 31;
          let ay = (homeY[i] - y[i]) * 31;
          for (const pointer of pointers.values()) {
            const dx = x[i] - pointer.x, dy = y[i] - pointer.y;
            const distance2 = dx * dx + dy * dy;
            if (distance2 >= radius * radius) continue;
            const distance = Math.max(1, Math.sqrt(distance2));
            const falloff = (1 - distance / radius) ** 2;
            // Repulsion with a gentle directional wake; springs pull the sand home.
            const force = distance < radius * 0.72 ? 1350 : -240;
            ax += (dx / distance * force + pointer.vx * 2.1) * falloff;
            ay += (dy / distance * force + pointer.vy * 2.1) * falloff;
          }
          vx[i] = (vx[i] + ax * dt) * damping;
          vy[i] = (vy[i] + ay * dt) * damping;
          x[i] += vx[i] * dt; y[i] += vy[i] * dt;
          if (Math.abs(vx[i]) + Math.abs(vy[i]) > 0.08 || (!pointers.size && Math.abs(homeX[i] - x[i]) + Math.abs(homeY[i] - y[i]) > 0.08)) unsettled = true;
        }
        for (const pointer of pointers.values()) { pointer.vx *= 0.86; pointer.vy *= 0.86; }
        draw();
        // Once the grains settle, stop consuming frames until new input.
        if (!unsettled) { last = 0; return; }
      }
      frame = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame && imageReady && inView && !document.hidden && !motion.matches) { last = 0; frame = requestAnimationFrame(tick); }
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; last = 0; };
    const updatePointer = (event: PointerEvent) => {
      if (motion.matches || (event.pointerType === "touch" && event.type === "pointermove" && !pointers.has(event.pointerId))) return;
      const box = rectCache.current;
      const now = performance.now();
      const px = event.clientX - box.left, py = event.clientY - box.top;
      const previous = pointers.get(event.pointerId);
      const dt = previous ? Math.max((now - previous.time) / 1000, .016) : 1;
      if (pointers.size < 3 || previous) pointers.set(event.pointerId, { x: px, y: py, vx: previous ? Math.max(-450, Math.min(450, (px - previous.x) / dt)) : 0, vy: previous ? Math.max(-450, Math.min(450, (py - previous.y) / dt)) : 0, time: now });
      start();
    };
    const releasePointer = (event: PointerEvent) => { pointers.delete(event.pointerId); start(); };
    const syncMotion = () => { pointers.clear(); if (motion.matches) { stop(); build(); } else start(); };
    const syncVisibility = () => { if (document.hidden) stop(); else start(); };
    image.onload = () => { if (!disposed) { imageReady = true; build(); start(); } };
    image.src = mark;
    surface.addEventListener("pointerdown", updatePointer, { passive: true });
    surface.addEventListener("pointermove", updatePointer, { passive: true });
    surface.addEventListener("pointerup", releasePointer, { passive: true });
    surface.addEventListener("pointercancel", releasePointer, { passive: true });
    surface.addEventListener("pointerleave", releasePointer, { passive: true });
    motion.addEventListener("change", syncMotion);
    document.addEventListener("visibilitychange", syncVisibility);
    const themeObserver = new MutationObserver(() => draw());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resize = new ResizeObserver(() => build());
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => { inView = Boolean(entry?.isIntersecting); if (inView) start(); else stop(); });
    observer.observe(canvas);
    return () => {
      disposed = true; stop(); resize.disconnect(); observer.disconnect(); themeObserver.disconnect(); rectCache.destroy(); pointers.clear();
      image.onload = null;
      surface.removeEventListener("pointerdown", updatePointer); surface.removeEventListener("pointermove", updatePointer);
      surface.removeEventListener("pointerup", releasePointer); surface.removeEventListener("pointercancel", releasePointer); surface.removeEventListener("pointerleave", releasePointer);
      motion.removeEventListener("change", syncMotion); document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero__sand" aria-hidden="true" />;
}
