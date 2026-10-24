import { useRef } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { RichText, renderRichText } from "../content/RichText";
import { useHeroParallax } from "../hooks/useHeroParallax";
import { Button, Magnetic, Marquee } from "./ui";
import { HeroRelief } from "./HeroRelief";

/**
 * The opening screen: type, light, and the studio's own mark.
 *
 * There is no film and no pinning. One screen of hero, the ticker still showing
 * underneath it so the page obviously continues, and a single screen of
 * parallax as it leaves. Everything a reader needs — what this is, one line
 * about it, and two ways forward — is on the first screen, immediately.
 */
export function Hero({ onOrder }: { onOrder: () => void }) {
  const content = useContent();
  const { hero } = content;
  const [firstLine, secondLine] = hero.lines;

  const sectionRef = useRef<HTMLElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useHeroParallax({ sectionRef, fieldRef, overlayRef });

  return (
    <section
      id="home"
      ref={sectionRef}
      className="hero"
      aria-labelledby="hero-title"
      data-hero="light"
    >
      <div className="hero__stage">
        <div className="hero__field" ref={fieldRef} aria-hidden="true">
          <span className="hero__aurora hero__aurora--violet" />
          <span className="hero__aurora hero__aurora--indigo" />
          <span className="hero__aurora hero__aurora--lilac" />
          <span className="hero__beam" />
          {/* Grain sits under the object: see the note in hero.css. */}
          <span className="hero__grain" />
          <HeroRelief className="hero__relief" />
          <span className="hero__veil" />
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
                <span className="hero__scroll-label">اسکرول کنید</span>
                <span className="hero__scroll-hint">ادامه در پایین</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
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
