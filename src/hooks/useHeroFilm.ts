import { useEffect, type RefObject } from "react";

type Options = {
  /** The tall track whose scroll distance maps onto the clip. */
  trackRef: RefObject<HTMLElement | null>;
  /** The overlay that fades as the film advances (opacity/transform only). */
  overlayRef: RefObject<HTMLElement | null>;
  /** The thin progress bar; scaled with a compositor-only transform. */
  progressRef: RefObject<HTMLElement | null>;
  /** The section element, used for one-shot `data-film-*` flags. */
  sectionRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Called once when the film can be shown (never during scrolling). */
  onReady?: () => void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Scroll-scrubbed film, built to be cheap enough to hold 60 fps.
 *
 * The previous implementation updated React state and a CSS custom property on
 * every frame; both invalidate a large subtree, so the browser recalculated
 * styles for the whole hero and re-rasterised the video surface at a new scale
 * on every scroll tick. That is what produced the lag and the shimmering, and
 * the lag is what made the film appear to jump to another scene (the scroll
 * ran ahead while the decoder was still catching up).
 *
 * This engine touches nothing React owns. Each animation frame it:
 *   • reads `scrollY` once,
 *   • eases it with a time-based filter (identical at 60/120/144 Hz),
 *   • writes at most three compositor-friendly properties (two on the overlay,
 *     one on the progress bar) and one `video.currentTime`,
 *   • and nothing else. No state, no custom properties, no layout reads.
 *
 * Seeks are coalesced (one in flight, latest target wins, ~1 frame of snapping),
 * and the clip is never played — only seeked, in both directions.
 */
export function useHeroFilm({ trackRef, overlayRef, progressRef, sectionRef, videoRef, onReady }: Options) {
  useEffect(() => {
    const track = trackRef.current;
    const video = videoRef.current;
    if (!track || !video) return;

    const overlay = overlayRef.current;
    const bar = progressRef.current;
    const section = sectionRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let lastTime = 0;
    let target = 0;
    let eased = -1;
    let paintedP = -1;
    let trackTop = 0;
    let travel = 1;
    let duration = 0;
    let ready = false;
    let announced = false;
    let disposed = false;
    /** One seek in flight; `wanted` is always the freshest target. */
    let seeking = false;
    let wanted = 0;
    let paintedFrame = -1;
    let seekStarted = 0;
    /** Buffered fraction of the clip; scrubbing is only pleasant when it is high. */
    let bufferedTo = 0;
    let activeFlag = false;
    const startedAt = performance.now();
    const timers: number[] = [];

    const FRAME = 1 / 30;

    /** The clip is something to scrub, never something to watch. */
    const freeze = () => {
      video.pause();
      video.playbackRate = 1;
    };

    const measure = () => {
      const rect = track.getBoundingClientRect();
      trackTop = rect.top + window.scrollY;
      travel = Math.max(1, rect.height - window.innerHeight);
      duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    };

    const paintChrome = (progress: number) => {
      // Skip identical values: writing a style is cheap, but doing it 120 times a
      // second for a fraction of a percent is still wasted work.
      if (Math.abs(progress - paintedP) < 0.0015) return;
      paintedP = progress;
      if (overlay) {
        overlay.style.opacity = String(Math.max(0, 1 - progress * 1.05));
        overlay.style.transform = `translate3d(0, ${(-progress * 2.4).toFixed(2)}vh, 0)`;
      }
      if (bar) bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    };

    /** Frame-snapped, coalesced seeking. */
    const seek = () => {
      if (!ready || duration <= 0 || disposed) return;
      // Stalled seek (some browsers never fire `seeked` when they get busy):
      // give up on it after 800 ms and use the freshest target.
      if (seeking && performance.now() - seekStarted > 800) seeking = false;
      if (seeking) return;

      // Snap to the encode's frame grid (30 fps): asking for a timestamp in the
      // middle of a frame lets the decoder pick either neighbour, which reads as
      // a wobble between two frames.
      const index = Math.max(0, Math.min(Math.round(duration / FRAME) - 1, Math.round(wanted / FRAME)));
      if (index === paintedFrame) return;
      const time = index * FRAME;

      seeking = true;
      seekStarted = performance.now();
      paintedFrame = index;
      try {
        video.currentTime = time;
      } catch {
        seeking = false;
      }
    };

    const onSeeked = () => {
      seeking = false;
    };

    /**
     * Reveal the film only once enough of it is buffered to seek through: a
     * half-downloaded clip stalls mid-scroll and then jumps to the frame the
     * network finally produced, which reads as "the picture changed scene".
     * After a few seconds we show it anyway — a poster is worse than a stall.
     */
    const showFilm = (force = false) => {
      if (announced || disposed) return;
      const coverage = duration > 0 ? bufferedTo / duration : 0;
      if (!force && coverage < 0.8 && performance.now() - startedAt < 3200) return;
      announced = true;
      section?.setAttribute("data-film-ready", "true");
      onReady?.();
    };

    const onLoaded = () => {
      ready = true;
      measure();
      if (!duration) return;
      // Place the film at the reader's current position, not at zero: scrolling
      // while the clip was still loading must not snap it back to the start.
      wanted = clamp01((window.scrollY - trackTop) / travel) * (duration - 0.04);
      seek();
      showFilm();
    };

    const onBuffered = () => {
      if (!video.buffered.length || !duration) return;
      bufferedTo = video.buffered.end(video.buffered.length - 1);
      showFilm();
    };

    const loop = (time: number) => {
      const delta = Math.min(50, Math.max(6, time - lastTime || 16.7));
      lastTime = time;

      if (!disposed) {
        const rect = track.getBoundingClientRect();
        // A single cheap read per frame; no `scrollY` fallback needed because the
        // rect is accurate even inside scrolling containers.
        const progress = clamp01(-rect.top / travel);
        if (progress !== target) target = progress;
      }

      // Time-constant easing (~60 ms). Exact at any refresh rate, no overshoot,
      // so reversing the scroll retraces the same frames.
      const follow = 1 - Math.exp(-delta / 60);
      eased = eased < 0 ? target : eased + (target - eased) * follow;
      const settled = Math.abs(target - eased) < 0.0004;
      if (settled) eased = target;

      paintChrome(eased);

      // While the film is on screen the fixed header sits over a surface that
      // changes every frame; a backdrop blur there would re-blur on each frame.
      const isActive = target > 0.002 && target < 0.995;
      if (isActive !== activeFlag) {
        activeFlag = isActive;
        if (isActive) section?.setAttribute("data-film-active", "true");
        else section?.removeAttribute("data-film-active");
      }

      if (duration > 0) {
        wanted = eased * (duration - 0.04);
        seek();
      }

      frame = settled ? 0 : window.requestAnimationFrame(loop);
    };

    const wake = () => {
      if (frame || disposed) return;
      lastTime = 0;
      frame = window.requestAnimationFrame(loop);
    };

    /* ------------------------------------------------------------- wiring */

    freeze();
    measure();
    paintChrome(0);

    const onMeta = () => {
      measure();
      freeze();
    };
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("canplay", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("progress", onBuffered);
    video.addEventListener("durationchange", measure);

    const onResize = () => {
      measure();
      wake();
    };
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measure();
            wake();
          })
        : null;
    observer?.observe(track);

    // The preloader and fonts change the layout after first paint; re-measure so
    // the mapping never drifts by a few hundred pixels.
    for (const delay of [400, 1200, 2400, 3600]) {
      timers.push(window.setTimeout(() => showFilm(delay >= 3600), delay));
    }

    for (const delay of [250, 900, 1800]) {
      timers.push(
        window.setTimeout(() => {
          measure();
          wake();
        }, delay),
      );
    }

    wake();

    return () => {
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("canplay", onLoaded);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("progress", onBuffered);
      video.removeEventListener("durationchange", measure);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      observer?.disconnect();
      overlay?.style.removeProperty("opacity");
      overlay?.style.removeProperty("transform");
      bar?.style.removeProperty("transform");
      if (reduceMotion) section?.removeAttribute("data-film-ready");
    };
  }, [trackRef, overlayRef, progressRef, sectionRef, videoRef, onReady]);
}
