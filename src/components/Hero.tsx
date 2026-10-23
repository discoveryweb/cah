import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { RichText, renderRichText } from "../content/RichText";
import { FILM, prefersLightData, preferredSource } from "../content/film";
import { useHeroFilm } from "../hooks/useHeroFilm";
import { Button, Magnetic, Marquee } from "./ui";

export function Hero({ onOrder }: { onOrder: () => void }) {
  const content = useContent();
  const { hero } = content;
  const [firstLine, secondLine] = hero.lines;

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  /** Fixed for the session: a metered reader never downloads the clip. */
  const [lightData] = useState(prefersLightData);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState(preferredSource);
  const triedFallback = useRef(false);
  const debug = useFilmDebug();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setReducedMotion(reduce.matches);
    decide();
    reduce.addEventListener("change", decide);
    return () => reduce.removeEventListener("change", decide);
  }, []);

  /** Written by the engine on the section; React never re-renders for it. */
  const handleReady = useCallback(() => {}, []);

  useHeroFilm({
    trackRef,
    overlayRef,
    progressRef,
    sectionRef,
    videoRef,
    onReady: handleReady,
  });

  /** A broken encode leaves the poster in place instead of an empty panel. */
  const handleError = useCallback(() => {
    if (!triedFallback.current) {
      triedFallback.current = true;
      setSource((current) => (current === FILM.desktop ? FILM.mobile : FILM.desktop));
      return;
    }
    setFailed(true);
  }, []);

  const still = reducedMotion || lightData || failed;

  return (
    <section
      id="home"
      ref={sectionRef}
      className={`hero hero--film${still ? " is-still" : ""}`}
      aria-labelledby="hero-title"
      data-film="scrub"
    >
      <div className="hero__track" ref={trackRef}>
        <div className="hero__stage">
          <div className="hero__film" aria-hidden="true">
            <div className="hero__film-media">
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
              {!still && (
                <video
                  ref={videoRef}
                  className="hero__video"
                  src={source}
                  muted
                  playsInline
                  /* The engine promotes this to "auto" when the page is idle. */
                  preload="none"
                  disablePictureInPicture
                  disableRemotePlayback
                  tabIndex={-1}
                  onError={handleError}
                />
              )}
            </div>
            <div className="hero__film-scrim" />
          </div>

          {debug && <FilmDebugOverlay videoRef={videoRef} />}

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
                  <span className="hero__scroll-label">اسکرول کنید</span>
                  {/* Phones get the instruction that actually matters: the film
                      is the scroll. Desktop can see the cursor and the rail. */}
                  <span className="hero__scroll-hint">با اسکرول، صحنه پیش می‌رود</span>
                  <ArrowUpLeft aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <i className="hero__progress" ref={progressRef} aria-hidden="true" />
        </div>
      </div>

      <div className="hero__ticker">
        <Marquee items={hero.ticker} speed={68} />
      </div>
    </section>
  );
}

/** `?film=debug` prints the real media state; useful when a browser misbehaves. */
function useFilmDebug() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setEnabled(new URLSearchParams(window.location.search).get("film") === "debug");
  }, []);
  return enabled;
}

function FilmDebugOverlay({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const [info, setInfo] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const id = window.setInterval(() => {
      const v = videoRef.current;
      const track = document.querySelector(".hero__track");
      setInfo({
        videoElement: Boolean(v),
        src: v?.getAttribute("src") ?? null,
        readyState: v?.readyState ?? null,
        currentTime: v ? Number(v.currentTime.toFixed(2)) : null,
        duration: v && Number.isFinite(v.duration) ? Number(v.duration.toFixed(2)) : null,
        seeking: v?.seeking ?? null,
        paused: v?.paused ?? null,
        buffered: v && v.buffered.length ? Number(v.buffered.end(v.buffered.length - 1).toFixed(2)) : null,
        error: v?.error ? `${v.error.code}: ${v.error.message || "media error"}` : null,
        track: track ? `${Math.round(track.getBoundingClientRect().top)}px top` : null,
      });
    }, 400);
    return () => window.clearInterval(id);
  }, [videoRef]);

  return (
    <pre className="hero__debug" dir="ltr">
      {JSON.stringify(info, null, 1)}
    </pre>
  );
}
