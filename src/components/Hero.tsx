import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { RichText, renderRichText } from "../content/RichText";
import { useHeroFilm, type FilmMode } from "../hooks/useHeroFilm";
import { isLowEndDevice } from "../utils/capabilities";
import { Button, Magnetic, Marquee } from "./ui";

/**
 * The hero film. `npm run film:video -- <clip>` writes exactly these files;
 * `hero-1280` is served to narrow screens so phones never pull the 1080p file.
 */
const FILM = {
  desktop: "/film/hero-1920.mp4",
  mobile: "/film/hero-1280.mp4",
  poster: "/film/hero-poster.jpg",
  /** "ambient" loops the clip; "scrub" drives it from the scroll position. */
  mode: "ambient" as FilmMode,
};

export function Hero({ onOrder }: { onOrder: () => void }) {
  const content = useContent();
  const { hero } = content;
  const [firstLine, secondLine] = hero.lines;

  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [posterOnly, setPosterOnly] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Start light: phones pick the 1280 file on their first render, desktops swap
  // to 1920 only after mount, so the large file is never requested twice.
  const [source, setSource] = useState(FILM.mobile);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setPosterOnly(reduce.matches || isLowEndDevice());
    decide();
    setSource(window.matchMedia("(max-width: 900px)").matches ? FILM.mobile : FILM.desktop);
    reduce.addEventListener("change", decide);
    return () => reduce.removeEventListener("change", decide);
  }, []);

  useHeroFilm({
    sectionRef: trackRef,
    mediaRef,
    overlayRef,
    videoRef,
    mode: FILM.mode,
    disabled: posterOnly,
  });

  return (
    <section
      id="home"
      ref={sectionRef}
      className={`hero hero--film${playing ? " is-playing" : ""}${posterOnly ? " is-still" : ""}`}
      aria-labelledby="hero-title"
      data-film={FILM.mode}
    >
      <div className="hero__track" ref={trackRef}>
        <div className="hero__stage">
          <div className="hero__film" aria-hidden="true">
            <div className="hero__film-media" ref={mediaRef}>
              <img
                className="hero__poster"
                src={FILM.poster}
                alt=""
                width={1600}
                height={900}
                fetchPriority="high"
                decoding="async"
              />
              {!posterOnly && (
                <video
                  ref={videoRef}
                  className="hero__video"
                  src={source}
                  poster={FILM.poster}
                  muted
                  loop={FILM.mode === "ambient"}
                  playsInline
                  preload="auto"
                  disablePictureInPicture
                  tabIndex={-1}
                  onPlaying={() => setPlaying(true)}
                  onError={() => setPlaying(false)}
                />
              )}
            </div>
            <div className="hero__film-scrim" />
            <div className="hero__film-grain" />
          </div>

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
