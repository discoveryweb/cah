import { useEffect, type RefObject } from "react";

export type FilmMode = "ambient" | "scrub";

type Options = {
  /** The scroll distance that maps to the whole clip (the tall track). */
  sectionRef: RefObject<HTMLElement | null>;
  /** The element that receives the parallax/zoom transform. */
  mediaRef: RefObject<HTMLElement | null>;
  /** The element whose `--film-p` drives the copy fade. */
  overlayRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 0–1 progress driven by the scroll; reported for UI affordances. */
  onProgress?: (progress: number) => void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Frame-accurate scrub needs every frame to be seekable; we allow ~1 frame of drift. */
const FRAME_SLOP = 1 / 45;

/**
 * Scroll-scrubbed film.
 *
 * The clip is not played: its timeline is a function of the scroll position, so
 * scrolling down walks the film forwards and scrolling up walks it backwards,
 * frame for frame. The default `scrub` implementation in browsers is jumpy —
 * it issues a seek per scroll event and paints whatever finished decoding last —
 * so this engine does three things instead:
 *
 *  1. Reads `scrollY` once per animation frame and eases it with a filter whose
 *     strength is expressed in time, so 60 Hz, 120 Hz and 144 Hz feel identical.
 *  2. Writes only `currentTime` (no React state, no layout reads) and coalesces
 *     seeks: one in flight at a time, then the freshest target.
 *  3. Applies "frame snapping": a seek is skipped until the target has moved at
 *     least ~1 frame, which removes the duplicate-frame judder you get when the
 *     element is asked to display a frame it is already on.
 *
 * The encode is all-keyframe (`-g 1`), so each seek is a decode of a single
 * frame rather than a GOP walk; that is what makes the motion feel continuous.
 */
export function useHeroFilm({ sectionRef, mediaRef, overlayRef, videoRef, onProgress }: Options) {
  useEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    const video = videoRef.current;
    if (!section || !media || !video) return;

    const overlay = overlayRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    let lastTime = 0;
    let target = 0;
    let eased = -1;
    let scrollTop = 0;
    let travel = 1;
    let duration = 0;
    let ready = false;
    let seeking = false;
    let wanted = 0;
    let painted = -1;
    let reported = -1;
    let disposed = false;
    const timers: number[] = [];

    const later = (fn: () => void, ms: number) => {
      timers.push(window.setTimeout(fn, ms));
    };

    /** The clip is not a video to watch: keep it paused and only seek it. */
    const freeze = () => {
      video.pause();
      video.autoplay = false;
      if (!video.loop) video.loop = false;
    };

    const measure = () => {
      const rect = section.getBoundingClientRect();
      // Absolute top, so the maths holds at any scroll offset.
      scrollTop = rect.top + window.scrollY;
      travel = Math.max(1, rect.height - window.innerHeight);
      duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    };

    const paint = (progress: number) => {
      if (reduceMotion) return;
      // A little lift and push-in: the film itself is the main motion.
      media.style.transform = `translate3d(0, ${(-progress * 2.4).toFixed(3)}vh, 0) scale(${(1 + progress * 0.05).toFixed(4)})`;
      if (overlay) overlay.style.setProperty("--film-p", progress.toFixed(4));
    };

    /**
     * Frame snapping with sub-frame easing. `wanted` is the exact time the
     * scroll asks for; we only issue a seek once it is at least one frame away
     * from what is on screen.
     */
    const seek = () => {
      if (!ready || duration <= 0 || disposed) return;
      if (Math.abs(wanted - painted) < FRAME_SLOP) return;
      if (seeking) return; // the `seeked` handler picks up the newest target

      const time = Math.min(duration - 0.04, Math.max(0, wanted));
      if (Math.abs(video.currentTime - time) < FRAME_SLOP && !video.seeking) {
        painted = time;
        return;
      }
      seeking = true;
      try {
        video.currentTime = time;
      } catch {
        seeking = false;
      }
    };

    const onSeeked = () => {
      seeking = false;
      painted = video.currentTime;
      // A newer target may have arrived while this seek was in flight.
      if (Math.abs(wanted - painted) >= FRAME_SLOP) seek();
    };

    const onLoaded = () => {
      ready = true;
      measure();
      // Decode one frame immediately so the hero never shows the bare poster.
      wanted = eased > 0 ? eased * duration : 0;
      seek();
    };

    const render = (time: number) => {
      const delta = Math.min(64, Math.max(8, time - lastTime || 16.7));
      lastTime = time;

      const current = clamp01((window.scrollY - scrollTop) / travel);
      if (current !== target) target = current;

      // Time-based smoothing: identical feel at any refresh rate, and no
      // overshoot, so reversing mid-scroll mirrors the forward path exactly.
      const follow = 1 - Math.pow(0.0009, delta / 1000);
      eased = eased < 0 ? target : eased + (target - eased) * follow;
      if (Math.abs(target - eased) < 0.0004) eased = target;

      paint(eased);
      // The readout follows the eased value (what is on screen), not the raw
      // scroll position, so the bar agrees with the frame being shown.
      if (Math.abs(eased - reported) > 0.004) {
        reported = eased;
        onProgress?.(eased);
      }

      if (duration > 0) {
        wanted = eased * (duration - 0.04);
        seek();
      }

      if (eased !== target) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
        flush();
        if (duration > 0) {
          wanted = target * (duration - 0.04);
          seek();
        }
      }
    };

    /** After settling, push the final value so the UI matches the last frame. */
    const flush = () => {
      if (Math.abs(eased - reported) > 0.0005) {
        reported = eased;
        onProgress?.(eased);
      }
    };

    const wake = () => {
      if (frame) return;
      lastTime = 0;
      frame = window.requestAnimationFrame(render);
    };

    /* ------------------------------------------------------------- wiring */

    freeze();
    measure();
    paint(0);

    // The whole clip must be buffered for instant seeking. `preload="auto"` is on
    // the element; asking to play once is the reliable way to make some browsers
    // actually fetch every byte, after which we pause and seek ourselves.
    const prime = () => {
      freeze();
      const attempt = video.play();
      if (attempt && typeof attempt.then === "function") {
        attempt.then(
          () => {
            freeze();
            video.currentTime = 0;
          },
          () => {
            freeze();
          },
        );
      }
    };

    const onCanPlay = () => {
      ready = true;
      freeze();
      prime();
    };

    video.addEventListener("loadedmetadata", measure);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("seeked", onSeeked);
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
    observer?.observe(section);

    // Late layout (fonts, images, the preloader unlocking the page) changes the
    // hero's height; re-measure a few times and on the first paint after load.
    later(() => {
      measure();
      wake();
    }, 300);
    later(() => {
      measure();
      wake();
    }, 1200);
    window.addEventListener("load", onResize, { once: true });

    wake();

    return () => {
      disposed = true;
      for (const timer of timers) window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      video.removeEventListener("loadedmetadata", measure);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("durationchange", measure);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("load", onResize);
      observer?.disconnect();
      media.style.removeProperty("transform");
      overlay?.style.removeProperty("--film-p");
    };
  }, [sectionRef, mediaRef, overlayRef, videoRef, onProgress]);
}
