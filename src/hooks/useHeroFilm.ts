import { useEffect, type RefObject } from "react";

export type FilmMode = "ambient" | "scrub";

type Options = {
  /** The whole hero section (used for geometry and visibility). */
  sectionRef: RefObject<HTMLElement | null>;
  /** The element that receives the scroll transform (the video wrapper). */
  mediaRef: RefObject<HTMLElement | null>;
  /** The overlay that fades as the hero is scrolled past. */
  overlayRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  mode?: FilmMode;
  /** Skip the engine entirely (poster-only fallback). */
  disabled?: boolean;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/**
 * Scroll-linked motion for the full-bleed hero film.
 *
 * Everything runs on one `requestAnimationFrame` loop that reads the scroll
 * position once per frame, eases it towards a target with a frame-rate
 * independent filter, and writes a single composited transform. That is what
 * keeps the film smooth at 120 Hz as well as on a 60 Hz laptop: no per-scroll
 * layout reads, no layout-triggering properties, no React re-renders.
 *
 * `ambient` plays the clip while the hero is on screen. The encoded files fade
 * from black and back to black at both ends, so the browser's `loop` restart is
 * invisible even though the film begins and ends on different shots.
 *
 * `scrub` pauses the clip and drives `currentTime` from the same eased progress.
 */
export function useHeroFilm({ sectionRef, mediaRef, overlayRef, videoRef, mode = "ambient", disabled = false }: Options) {
  useEffect(() => {
    const section = sectionRef.current;
    const media = mediaRef.current;
    if (!section || !media || disabled) return;

    const video = videoRef.current;
    const overlay = overlayRef.current;

    let frame = 0;
    let lastTime = 0;
    let target = 0;
    let eased = -1;
    let visible = true;
    let stageTop = 0;
    let travel = 0;
    let duration = 0;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      stageTop = rect.top + window.scrollY;
      travel = Math.max(1, rect.height - window.innerHeight);
      duration = Number.isFinite(video?.duration) && video?.duration ? video.duration : 0;
    };

    const paint = (progress: number) => {
      // 4vh of lift and a 6% push-in over the whole scroll; subtle on purpose.
      media.style.transform = `translate3d(0, ${(-progress * 4).toFixed(3)}vh, 0) scale(${(1 + progress * 0.06).toFixed(4)})`;
      if (overlay) overlay.style.setProperty("--film-p", progress.toFixed(4));
    };

    const render = (time: number) => {
      const delta = Math.min(64, Math.max(8, time - lastTime || 16.7));
      lastTime = time;
      const current = clamp01((window.scrollY - stageTop) / travel);
      if (current !== target) target = current;

      // Exponential smoothing expressed in time, so 120 Hz and 60 Hz agree.
      const follow = 1 - Math.pow(0.0016, delta / 1000);
      eased = eased < 0 ? target : eased + (target - eased) * follow;
      if (Math.abs(target - eased) < 0.0002) eased = target;

      paint(eased);

      if (mode === "scrub" && video && duration > 0.1) {
        const wanted = Math.min(duration - 0.05, eased * (duration - 0.05));
        if (Math.abs(video.currentTime - wanted) > 1 / 48 && !video.seeking) {
          try {
            video.currentTime = wanted;
          } catch {
            /* Safari can throw while the buffer is empty */
          }
        }
      }

      if (eased !== target) {
        frame = window.requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const wake = () => {
      if (frame) return;
      lastTime = 0;
      frame = window.requestAnimationFrame(render);
    };

    const play = () => {
      if (!video || mode !== "ambient") return;
      const ability = video.play();
      if (ability && typeof ability.catch === "function") ability.catch(() => {});
    };

    const pause = () => {
      if (video && !video.paused) video.pause();
    };

    const sync = () => {
      if (mode !== "ambient" || !video) return;
      if (visible && !document.hidden) play();
      else pause();
    };

    const onMeta = () => {
      duration = Number.isFinite(video?.duration) && video?.duration ? video.duration : 0;
      if (mode === "scrub") video?.pause();
      else play();
    };

    const onVisibility = () => sync();

    measure();
    paint(0);
    sync();

    const resizeObserver = new ResizeObserver(() => {
      measure();
      wake();
    });
    resizeObserver.observe(section);

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
        if (visible) wake();
      },
      { rootMargin: "10% 0px" },
    );
    observer.observe(section);

    video?.addEventListener("loadedmetadata", onMeta);
    video?.addEventListener("canplay", sync);

    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      observer.disconnect();
      video?.removeEventListener("loadedmetadata", onMeta);
      video?.removeEventListener("canplay", sync);
      window.removeEventListener("scroll", wake);
      window.removeEventListener("resize", wake);
      document.removeEventListener("visibilitychange", onVisibility);
      media.style.removeProperty("transform");
      overlay?.style.removeProperty("--film-p");
    };
  }, [sectionRef, mediaRef, overlayRef, videoRef, mode, disabled]);
}
