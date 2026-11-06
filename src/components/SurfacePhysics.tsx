import { useEffect, useRef } from "react";
import { onScrollFrame } from "../utils/scrollFrame";

type Point = { x: number; y: number; rects: DOMRect[] };
type Wave = { x: number; y: number; start: number };

/**
 * The filter samples the real, already-painted page; it never paints a ring or
 * duplicates text. A small displacement field is the only generated image.
 * The text stays in the DOM, fully shaped, selectable, and accessible.
 */
export function SurfacePhysics() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<SVGFEImageElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const image = imageRef.current;
    const filter = filterRef.current;
    if (!overlay || !image || !filter) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // A URL-backed backdrop filter is essential: don't fake the effect with a graphic.
    if (!CSS.supports("backdrop-filter", "url(#cahen-surface-filter)") && !CSS.supports("-webkit-backdrop-filter", "url(#cahen-surface-filter)")) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const points = new Map<number, Point>();
    const waves: Wave[] = [];
    let width = 0, height = 0, cols = 0, rows = 0, sx = 1, sy = 1;
    let dx = new Float32Array(0), dy = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0);
    let field: ImageData;
    let frame = 0, last = 0, rects: DOMRect[] = [], rectsAt = 0;
    let alive = false;
    const maxWaves = 3;
    const radius = matchMedia("(pointer: coarse)").matches ? 86 : 72;
    const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const selector = "main h1, main h2, main h3, main p, .nav__link, .menu__link, .hero__actions .btn, .header__cta, .cta__button, .gallery__open, .modal__title, .modal__desc";

    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      // Keep the map bounded on high-resolution screens and inexpensive on phones.
      cols = Math.min(300, Math.ceil(width / 4));
      rows = Math.min(220, Math.ceil(height / 4));
      sx = width / cols; sy = height / rows;
      canvas.width = cols; canvas.height = rows;
      field = ctx.createImageData(cols, rows);
      dx = new Float32Array(cols * rows); dy = new Float32Array(cols * rows);
      vx = new Float32Array(cols * rows); vy = new Float32Array(cols * rows);
      rectsAt = 0; points.clear(); waves.length = 0;
      overlay.style.display = "none";
      alive = false;
    };
    resize();

    const textRects = (now: number) => {
      if (now - rectsAt < 700 && rectsAt) return rects;
      rectsAt = now;
      const next: DOMRect[] = [];
      const seen = new WeakSet<Node>();
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (!element.offsetParent || element.closest('[aria-hidden="true"]')) return;
        const box = element.getBoundingClientRect();
        if (box.bottom < -radius || box.top > height + radius || box.right < -radius || box.left > width + radius) return;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (seen.has(node) || !node.textContent?.trim() || node.parentElement?.closest('[aria-hidden="true"]')) continue;
          seen.add(node);
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) if (rect.width && rect.height) next.push(rect);
          range.detach();
        }
      });
      rects = next;
      return rects;
    };
    const move = (event: PointerEvent) => {
      if (motion.matches || (event.pointerType === "touch" && event.buttons === 0)) return;
      const x = event.clientX, y = event.clientY;
      const nearby = textRects(performance.now()).filter((r) => x >= r.left - radius && x <= r.right + radius && y >= r.top - radius && y <= r.bottom + radius);
      const hadPoint = points.has(event.pointerId);
      if (nearby.length && (points.size < 3 || hadPoint)) points.set(event.pointerId, { x, y, rects: nearby });
      else points.delete(event.pointerId);
      if (nearby.length || hadPoint) wake();
    };
    const down = (event: PointerEvent) => {
      if (motion.matches || (event.pointerType === "mouse" && event.button !== 0)) return;
      if (waves.length === maxWaves) waves.shift();
      waves.push({ x: event.clientX, y: event.clientY, start: -1 });
      move(event);
      wake();
    };
    const release = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.type === "pointercancel") points.delete(event.pointerId);
      wake();
    };
    const clearPoints = () => { points.clear(); wake(); };
    const invalidate = () => { rectsAt = 0; if (points.size) { points.clear(); wake(); } };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clearPoints(); };
    const wake = () => {
      if (motion.matches || frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      frame = 0;
      if (motion.matches || document.hidden) { overlay.style.display = "none"; alive = false; return; }
      // Limit map uploads; no React renders, DOM splitting, or layout changes per grain.
      const frameInterval = lowPower || width <= 700 ? 33 : 16;
      if (last && now - last < frameInterval) { frame = requestAnimationFrame(tick); return; }
      const dt = last ? Math.min(.75, (now - last) / 1000) : 1 / 30;
      last = now;
      // Time-based damped springs settle at the same rate even if the device
      // drops frames. This also prevents a half-scattered word on a slow phone.
      const omega = 12, damping = .78, wd = omega * Math.sqrt(1 - damping * damping);
      const decay = Math.exp(-damping * omega * dt), cosine = Math.cos(wd * dt), sine = Math.sin(wd * dt);
      for (const wave of waves) if (wave.start < 0) wave.start = now;
      while (waves.length && now - waves[0].start > 950) waves.shift();
      const pixels = field.data;
      const activePoints = Array.from(points.values()).slice(0, 3);
      const activeWaves = waves.map((wave) => {
        const age = (now - wave.start) / 950;
        return { ...wave, crest: 10 + age * 142, strength: (1 - age) ** 2 };
      });
      let minX = width, minY = height, maxX = 0, maxY = 0, moving = false, painted = false;
      for (let row = 0, i = 0; row < rows; row++) {
        const y = (row + .5) * sy;
        for (let col = 0; col < cols; col++, i++) {
          const x = (col + .5) * sx;
          let tx = 0, ty = 0;
          for (const point of activePoints) {
            const rx = x - point.x, ry = y - point.y;
            const d2 = rx * rx + ry * ry;
            if (d2 >= radius * radius) continue;
            const text = point.rects.find((r) => x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8);
            if (!text) continue;
            const d = Math.sqrt(d2) || 1;
            const influence = (1 - d / radius) ** 1.35 * (text.height < 38 ? .55 : 1);
            // A fixed grain-scale disturbance breaks up glyph edges. The vector
            // points toward the cursor because displacement maps sample backwards.
            const noiseX = Math.sin(i * 12.9898) * 3.6;
            const noiseY = Math.sin(i * 78.233) * 3.6;
            tx += (-rx / d * 7.5 + noiseX) * influence;
            ty += (-ry / d * 7.5 + noiseY) * influence;
          }
          if (tx || ty || dx[i] || dy[i] || vx[i] || vy[i]) {
            const ox = dx[i] - tx, oy = dy[i] - ty, oldVx = vx[i], oldVy = vy[i];
            dx[i] = tx + decay * (ox * cosine + (oldVx + ox * damping * omega) / wd * sine);
            dy[i] = ty + decay * (oy * cosine + (oldVy + oy * damping * omega) / wd * sine);
            vx[i] = decay * (oldVx * cosine - (ox * omega * omega + oldVx * damping * omega) / wd * sine);
            vy[i] = decay * (oldVy * cosine - (oy * omega * omega + oldVy * damping * omega) / wd * sine);
            if ((Math.abs(vx[i]) + Math.abs(vy[i])) / omega + Math.abs(tx - dx[i]) + Math.abs(ty - dy[i]) > .045) moving = true;
            if (!tx && Math.abs(dx[i]) < .02 && Math.abs(vx[i]) < .2) dx[i] = vx[i] = 0;
            if (!ty && Math.abs(dy[i]) < .02 && Math.abs(vy[i]) < .2) dy[i] = vy[i] = 0;
          }
          let wx = 0, wy = 0;
          for (const wave of activeWaves) {
            const rx = x - wave.x, ry = y - wave.y;
            if (Math.abs(rx) > wave.crest + 30 || Math.abs(ry) > wave.crest + 30) continue;
            const distance = Math.hypot(rx, ry) || 1;
            const edge = distance - wave.crest;
            if (Math.abs(edge) > 30) continue;
            const envelope = Math.exp(-edge * edge / 220) * wave.strength;
            const amount = Math.sin(edge / 6) * envelope * 6;
            wx += rx / distance * amount; wy += ry / distance * amount;
          }
          const px = dx[i] + wx, py = dy[i] + wy;
          const o = i * 4;
          pixels[o] = Math.max(0, Math.min(255, 128 + px * 255 / 24));
          pixels[o + 1] = Math.max(0, Math.min(255, 128 + py * 255 / 24));
          pixels[o + 2] = 128; pixels[o + 3] = 255;
          if (Math.abs(px) + Math.abs(py) > .12) {
            painted = true;
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      if (painted) {
        // The backdrop surface is limited to the affected area, not a permanent
        // full-screen compositor layer. Padding hides filter-edge sampling.
        const left = Math.max(0, Math.floor(minX - 20)), top = Math.max(0, Math.floor(minY - 20));
        const w = Math.min(width - left, Math.ceil(maxX + 20) - left), h = Math.min(height - top, Math.ceil(maxY + 20) - top);
        overlay.style.left = `${left}px`; overlay.style.top = `${top}px`;
        overlay.style.width = `${w}px`; overlay.style.height = `${h}px`;
        filter.setAttribute("width", String(w)); filter.setAttribute("height", String(h));
        image.setAttribute("x", String(-left)); image.setAttribute("y", String(-top));
        image.setAttribute("width", String(width)); image.setAttribute("height", String(height));
        ctx.putImageData(field, 0, 0);
        image.setAttribute("href", canvas.toDataURL("image/png"));
        overlay.style.display = "block";
        alive = true;
      } else if (alive) { overlay.style.display = "none"; alive = false; }
      if (moving || waves.length) frame = requestAnimationFrame(tick);
    };
    const visibility = () => { if (document.hidden) { points.clear(); waves.length = 0; overlay.style.display = "none"; } else { resize(); } };
    const motionChange = () => { if (motion.matches) { points.clear(); waves.length = 0; if (frame) cancelAnimationFrame(frame); frame = 0; resize(); } };
    window.addEventListener("pointerdown", down, { passive: true, capture: true });
    window.addEventListener("pointermove", move, { passive: true, capture: true });
    window.addEventListener("pointerup", release, { passive: true, capture: true });
    window.addEventListener("pointercancel", release, { passive: true, capture: true });
    window.addEventListener("blur", clearPoints);
    window.addEventListener("pointerout", leave, { passive: true });
    const stopScroll = onScrollFrame(invalidate);
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", motionChange);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", down, true); window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", release, true); window.removeEventListener("pointercancel", release, true);
      window.removeEventListener("blur", clearPoints); window.removeEventListener("pointerout", leave); stopScroll(); window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", motionChange);
    };
  }, []);

  return <>
    <svg className="surface-filter-defs" aria-hidden="true" focusable="false">
      <filter ref={filterRef} id="cahen-surface-filter" x="0" y="0" width="1" height="1" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage ref={imageRef} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="field" />
        <feDisplacementMap in="SourceGraphic" in2="field" scale="24" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
    <div ref={overlayRef} className="surface-displacement" aria-hidden="true" />
  </>;
}
