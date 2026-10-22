import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { RichText, renderRichText } from "../content/RichText";
import { useHeroFilm, type FilmMode } from "../hooks/useHeroFilm";
import { Button, Magnetic, Marquee } from "./ui";

/**
 * The hero film. `npm run film:video -- <clip>` writes exactly these files;
 * `hero-1280` is served to narrow screens so phones never pull the 1080p file.
 */
const VERSION = "2026-10-23a";

const FILM = {
  desktop: `/film/hero-1920.mp4?v=${VERSION}`,
  mobile: `/film/hero-1280.mp4?v=${VERSION}`,
  poster: `/film/hero-poster.jpg?v=${VERSION}`,
  posterBlur: `/film/hero-poster-blur.jpg?v=${VERSION}`,
  /** "ambient" loops the clip; "scrub" drives it from the scroll position. */
  mode: "ambient" as FilmMode,
};

/**
 * The delivered film cuts from a dark starfield to a lit room, so a hard `loop`
 * would jump. Both files therefore fade from black and back to black (baked in
 * at encode time), which makes the restart invisible. Because frame zero is
 * black, the video layer only appears once it is genuinely playing — the poster
 * stays underneath until then, so the hero never shows an empty black panel.
 */

/** `?film=debug` prints the real playback state on the page. */
function useFilmDebug() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(new URLSearchParams(window.location.search).get("film") === "debug");
  }, []);
  return enabled;
}

export function Hero({ onOrder }: { onOrder: () => void }) {
  const content = useContent();
  const { hero } = content;
  const [firstLine, secondLine] = hero.lines;

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [reducedMotion, setReducedMotion] = useState(false);
  const [playing, setPlaying] = useState(false);
  const live = playing && !reducedMotion;
  // Start light: phones pick the 1280 file on their first render, desktops swap
  // to 1920 only after mount, so the large file is never requested twice.
  const [source, setSource] = useState(FILM.mobile);
  const [failed, setFailed] = useState(false);
  const triedFallback = useRef(false);
  const debug = useFilmDebug();

  /**
   * If the browser refuses this encode (rare codec/profile combinations), try
   * the other file once; if that also fails, keep the drifting poster instead of
   * leaving an empty black panel.
   */
  const handleError = useCallback(() => {
    if (!triedFallback.current) {
      triedFallback.current = true;
      setSource((current) => (current === FILM.desktop ? FILM.mobile : FILM.desktop));
      return;
    }
    setFailed(true);
    setPlaying(false);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wide = window.matchMedia("(min-width: 901px)");
    const decide = () => setReducedMotion(reduce.matches);
    const pick = () => setSource(wide.matches ? FILM.desktop : FILM.mobile);
    decide();
    pick();
    reduce.addEventListener("change", decide);
    wide.addEventListener("change", pick);
    return () => {
      reduce.removeEventListener("change", decide);
      wide.removeEventListener("change", pick);
    };
  }, []);

  const [blocked, setBlocked] = useState(false);

  // Stable identity: the film engine must not restart on every render.
  const handleFilmState = useCallback((state: "playing" | "idle" | "blocked") => {
    if (state === "blocked") {
      setBlocked(true);
      setPlaying(false);
      return;
    }
    setPlaying(state === "playing");
    if (state === "playing") setBlocked(false);
  }, []);

  /** An explicit click is a real user gesture, so this always succeeds. */
  const startFilm = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const result = video.play();
    if (result && typeof result.catch === "function") {
      result.catch(() => setBlocked(true));
    }
  }, []);

  useHeroFilm({
    sectionRef: trackRef,
    mediaRef,
    overlayRef,
    videoRef,
    mode: FILM.mode,
    disabled: reducedMotion,
    onState: handleFilmState,
  });

  return (
    <section
      id="home"
      ref={sectionRef}
      className={`hero hero--film${live ? " is-playing" : ""}${reducedMotion || failed ? " is-still" : ""}`}
      aria-labelledby="hero-title"
      data-film={FILM.mode}
      data-film-state={reducedMotion ? "reduced" : failed ? "fallback" : live ? "playing" : "loading"}
    >
      <div className="hero__track" ref={trackRef}>
        <div className="hero__stage">
          <div className="hero__film" aria-hidden="true">
            <div className="hero__film-media" ref={mediaRef}>
              <img
                className="hero__poster hero__poster--blur"
                src={FILM.posterBlur}
                alt=""
                width={1600}
                height={900}
                aria-hidden="true"
              />
              <img
                className="hero__poster hero__poster--full"
                src={FILM.poster}
                alt=""
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
              />
              {!reducedMotion && !failed && (
                <video
                  ref={videoRef}
                  className="hero__video"
                  src={source}
                  poster={FILM.poster}
                  autoPlay
                  muted
                  loop={FILM.mode === "ambient"}
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  disableRemotePlayback
                  tabIndex={-1}
                  onPlaying={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onError={handleError}
                />
              )}
            </div>
            <div className="hero__film-scrim" />
            <div className="hero__film-grain" />
          </div>

          {debug && <FilmDebugOverlay videoRef={videoRef} reducedMotion={reducedMotion} />}

          {blocked && !reducedMotion && !failed && (
            <button className="hero__play" type="button" onClick={startFilm}>
              <span className="hero__play-icon" aria-hidden="true" />
              پخش فیلم
            </button>
          )}

          <div className="hero__overlay" ref={overlayRef}>
            <div className="hero__inner frame">
              <div className="hero__meta">
                <span className="hero__status">
                  <i aria-hidden="true" />
                  {hero.status}
                </span>
                <div className="hero__meta-right">
                  <span className="label label--plain" dir="ltr">
                    {hero.coordinates}
                  </span>
                  <span className="hero__meta-index" dir="ltr">
                    I / V
                  </span>
                </div>
              </div>

              <div className="hero__body">
                <h1 className="hero__title" id="hero-title">
                  <span className="hero__line">
                    <span className="hero__line-inner">{renderRichText(firstLine)}</span>
                  </span>
                  <span className="hero__line hero__line--2">
                    <span className="hero__line-inner" style={{ transitionDelay: "150ms" }}>
                      {renderRichText(secondLine)}
                      <span className="hero__dot" aria-hidden="true" />
                      <span className="hero__annotation" dir="ltr">
                        {hero.annotation}
                      </span>
                    </span>
                  </span>
                </h1>

                <p className="hero__translation" dir="ltr">
                  <span className="hero__translation-line" aria-hidden="true" />
                  <em>{hero.translation}</em>
                  <span className="hero__translation-src">{hero.translationLabel}</span>
                </p>
              </div>

              <div className="hero__foot">
                <RichText className="hero__lede" as="p" text={hero.lede} />
                <div className="hero__actions">
                  <Magnetic>
                    <Button onClick={onOrder}>{hero.primaryCta}</Button>
                  </Magnetic>
                  <a href="#work" className="hero__secondary" data-cursor="hover">
                    <span>{hero.secondaryCta}</span>
                    <ArrowDown aria-hidden="true" />
                  </a>
                </div>

                <a href="#about" className="hero__scroll" aria-label="رفتن به بخش استودیو">
                  <span className="hero__scroll-line" aria-hidden="true" />
                  <span>اسکرول کنید</span>
                  <ArrowUpLeft aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hero__ticker">
        <Marquee items={hero.ticker} speed={68} />
      </div>
    </section>
  );
}

/**
 * Diagnostics for the film. Open `/?film=debug` to see why a browser refuses to
 * play: autoplay policy, a decode error, or a missing file all look identical
 * to the visitor otherwise.
 */
function FilmDebugOverlay({
  videoRef,
  reducedMotion,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  reducedMotion: boolean;
}) {
  const [info, setInfo] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const tick = () => {
      const v = videoRef.current;
      const p = document.querySelector(".hero__poster--full") as HTMLImageElement | null;
      setInfo({
        reducedMotion,
        videoElement: Boolean(v),
        src: v?.getAttribute("src") ?? null,
        readyState: v?.readyState ?? null,
        networkState: v?.networkState ?? null,
        paused: v?.paused ?? null,
        currentTime: v ? Number(v.currentTime.toFixed(2)) : null,
        duration: v && Number.isFinite(v.duration) ? Number(v.duration.toFixed(2)) : null,
        error: v?.error ? `${v.error.code}: ${v.error.message || "media error"}` : null,
        posterLoaded: p ? `${p.complete}/${p.naturalWidth}px` : "missing",
        hardwareConcurrency: navigator.hardwareConcurrency,
        autoplayAllowed: navigator.userAgent.includes("Chrome") ? "see paused/error" : "n/a",
      });
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [videoRef, reducedMotion]);

  return (
    <pre className="hero__debug" dir="ltr">
      {JSON.stringify(info, null, 1)}
    </pre>
  );
}
