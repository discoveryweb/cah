import { useEffect, useRef } from "react";
import { onScrollFrame } from "../utils/scrollFrame";
import { documentLayoutVersion } from "../utils/documentMetrics";

type Point = { x: number; y: number };
type Wave = { x: number; y: number; start: number };
type Rect = { left: number; top: number; right: number; bottom: number; height: number };

/**
 * A liquid surface under the page, made with an SVG displacement map.
 *
 * The filter samples the real, already-painted backdrop; it never paints a ring
 * or duplicates text. A small displacement field is the only generated image,
 * and the text stays in the DOM — shaped, selectable and accessible.
 *
 * Everything in the frame loop is bounded and precomputed, because this runs on
 * the compositor's budget:
 *
 *   • the displacement field is a coarse grid (a few hundred cells across), so
 *     the per-frame loop is tens of thousands of cells and not millions of
 *     pixels;
 *   • the grain-scale noise depends only on the cell index, so it is generated
 *     once per resize instead of twice per cell per frame;
 *   • which cells sit on shaped text is a mask built when the text is measured,
 *     so the inner loop is one array lookup instead of a search through every
 *     text rect for every cell;
 *   • only the disturbed rectangle is encoded and uploaded, not the viewport;
 *   • the whole thing idles: no input, no frame.
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
    /** The crop that is actually encoded and uploaded each frame. */
    const patch = document.createElement("canvas");
    const patchCtx = patch.getContext("2d", { alpha: false });

    const points = new Map<number, Point>();
    const waves: Wave[] = [];
    let width = 0, height = 0, cols = 0, rows = 0, sx = 1, sy = 1;
    let dx = new Float32Array(0), dy = new Float32Array(0), vx = new Float32Array(0), vy = new Float32Array(0);
    let noiseX = new Float32Array(0), noiseY = new Float32Array(0);
    let mask = new Float32Array(0);
    let field: ImageData;
    let frame = 0, last = 0, rects: Rect[] = [], rectsVersion = -1, measured = false;
    let alive = false;
    const maxWaves = 3;
    const radius = matchMedia("(pointer: coarse)").matches ? 86 : 72;
    const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const selector = "main h1, main h2, main h3, main p, .nav__link, .menu__link, .hero__actions .btn, .header__cta, .cta__button, .gallery__open, .modal__title, .modal__desc";

    const resize = () => {
      width = window.innerWidth; height = window.innerHeight;
      // Keep the map bounded on high-resolution screens and inexpensive on phones.
      cols = Math.min(250, Math.ceil(width / 5));
      rows = Math.min(180, Math.ceil(height / 5));
      sx = width / cols; sy = height / rows;
      canvas.width = cols; canvas.height = rows;
      field = ctx.createImageData(cols, rows);
      const cells = cols * rows;
      dx = new Float32Array(cells); dy = new Float32Array(cells);
      vx = new Float32Array(cells); vy = new Float32Array(cells);
      // The grain is fixed to the cell, so it never changes while the page lives.
      noiseX = new Float32Array(cells); noiseY = new Float32Array(cells);
      for (let i = 0; i < cells; i++) {
        noiseX[i] = Math.sin(i * 12.9898) * 3.6;
        noiseY[i] = Math.sin(i * 78.233) * 3.6;
      }
      mask = new Float32Array(cells);
      rebuildMask();
      measured = false; points.clear(); waves.length = 0;
      overlay.style.display = "none";
      alive = false;
    };

    /* Which cells sit on shaped text, and how strongly they should follow it:
       1 for a heading, 0.55 for small type. Built from the measured rects, so
       the frame loop never searches them. */
    const rebuildMask = () => {
      if (!mask.length) return;
      mask.fill(0);
      if (!rects.length) return;
      for (const rect of rects) {
        const force = rect.height < 38 ? 0.55 : 1;
        const c0 = Math.max(0, Math.floor((rect.left - 8) / sx));
        const c1 = Math.min(cols - 1, Math.ceil((rect.right + 8) / sx));
        const r0 = Math.max(0, Math.floor((rect.top - 8) / sy));
        const r1 = Math.min(rows - 1, Math.ceil((rect.bottom + 8) / sy));
        for (let row = r0; row <= r1; row++) {
          const base = row * cols;
          for (let col = c0; col <= c1; col++) if (force > mask[base + col]) mask[base + col] = force;
        }
      }
    };

    const maskAt = (x: number, y: number) => {
      const col = Math.floor(x / sx), row = Math.floor(y / sy);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return 0;
      return mask[row * cols + col];
    };

    /** Text fragments near the viewport, in viewport coordinates. */
    /* A walk over every text node measures each one, so it runs when the layout
       changed (or after a scroll invalidated the viewport coordinates) and never
       as a timed poll. */
    const textRects = () => {
      if (measured && rectsVersion === documentLayoutVersion()) return rects;
      rectsVersion = documentLayoutVersion();
      measured = true;
      const next: Rect[] = [];
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
          for (const rect of range.getClientRects()) {
            if (rect.width && rect.height) {
              next.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, height: rect.height });
            }
          }
          range.detach();
        }
      });
      rects = next;
      rebuildMask();
      return rects;
    };

    const wake = () => {
      if (motion.matches || frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };

    const move = (event: PointerEvent) => {
      if (motion.matches || (event.pointerType === "touch" && event.buttons === 0)) return;
      const x = event.clientX, y = event.clientY;
      textRects();
      const overText = maskAt(x, y) > 0;
      const hadPoint = points.has(event.pointerId);
      if (overText && (points.size < 3 || hadPoint)) points.set(event.pointerId, { x, y });
      else points.delete(event.pointerId);
      if (overText || hadPoint) wake();
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
    const invalidate = () => { measured = false; if (points.size) { points.clear(); wake(); } };
    const leave = (event: PointerEvent) => { if (!event.relatedTarget) clearPoints(); };

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
      const activePoints = [...points.values()].slice(0, 3);
      const pointCount = activePoints.length;
      const activeWaves = waves.length
        ? waves.map((wave) => {
            const age = (now - wave.start) / 950;
            return { x: wave.x, y: wave.y, crest: 10 + age * 142, strength: (1 - age) ** 2 };
          })
        : null;
      const waveCount = activeWaves ? activeWaves.length : 0;

      let minX = width, minY = height, maxX = 0, maxY = 0, moving = false, painted = false;
      for (let row = 0, i = 0; row < rows; row++) {
        const y = (row + .5) * sy;
        for (let col = 0; col < cols; col++, i++) {
          const x = (col + .5) * sx;
          let tx = 0, ty = 0;

          if (pointCount) {
            for (let p = 0; p < pointCount; p++) {
              const point = activePoints[p];
              const rx = x - point.x, ry = y - point.y;
              const d2 = rx * rx + ry * ry;
              if (d2 >= radius * radius) continue;
              const force = mask[i];
              if (!force) continue;
              const d = Math.sqrt(d2) || 1;
              const influence = (1 - d / radius) ** 1.35 * force;
              // A fixed grain-scale disturbance breaks up glyph edges. The vector
              // points toward the cursor because displacement maps sample backwards.
              tx += (-rx / d * 7.5 + noiseX[i]) * influence;
              ty += (-ry / d * 7.5 + noiseY[i]) * influence;
            }
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
          if (waveCount) {
            for (let w = 0; w < waveCount; w++) {
              const wave = activeWaves![w];
              const rx = x - wave.x, ry = y - wave.y;
              if (Math.abs(rx) > wave.crest + 30 || Math.abs(ry) > wave.crest + 30) continue;
              const distance = Math.hypot(rx, ry) || 1;
              const edge = distance - wave.crest;
              if (Math.abs(edge) > 30) continue;
              const envelope = Math.exp(-edge * edge / 220) * wave.strength;
              const amount = Math.sin(edge / 6) * envelope * 6;
              wx += rx / distance * amount; wy += ry / distance * amount;
            }
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

        /* Encode the crop, not the viewport: a wheel of PNG pixels is a real
           cost at 60 fps, and most of the map is flat. */
        const col0 = Math.max(0, Math.floor(left / sx));
        const row0 = Math.max(0, Math.floor(top / sy));
        const gw = Math.min(cols - col0, Math.max(1, Math.ceil(w / sx)));
        const gh = Math.min(rows - row0, Math.max(1, Math.ceil(h / sy)));
        ctx.putImageData(field, 0, 0);
        if (patchCtx && gw > 0 && gh > 0) {
          if (patch.width !== gw) patch.width = gw;
          if (patch.height !== gh) patch.height = gh;
          patchCtx.drawImage(canvas, col0, row0, gw, gh, 0, 0, gw, gh);
          image.setAttribute("href", patch.toDataURL("image/png"));
        }
        image.setAttribute("x", "0");
        image.setAttribute("y", "0");
        image.setAttribute("width", String(w));
        image.setAttribute("height", String(h));
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

    resize();

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
