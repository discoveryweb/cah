import { useRef } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { RichText, renderRichText } from "../content/RichText";
import { useParallax } from "../hooks/useParallax";
import { Button, Magnetic, Marquee } from "./ui";

export function Hero({ onOrder }: { onOrder: () => void }) {
  const figureRef = useRef<HTMLElement>(null);
  useParallax(figureRef, 0.055);
  const content = useContent();
  const { hero } = content;
  const [firstLine, secondLine] = hero.lines;

  return (
    <section id="home" className="hero" aria-labelledby="hero-title">
      <div className="frame">
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

        <div className="hero__grid">
          <div className="hero__main">
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

            <div className="hero__bottom">
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
            </div>
          </div>

          <aside className="hero__aside">
            <figure className="hero__figure" ref={figureRef}>
              <img
                src={hero.figure.image}
                alt={hero.figure.alt}
                width={1122}
                height={1402}
                fetchPriority="high"
                decoding="async"
              />
              <span className="hero__index" dir="ltr">
                {hero.figure.index}
              </span>
              <span className="hero__figure-tag" dir="ltr">
                {hero.figure.tag}
              </span>
            </figure>

            <figcaption className="hero__caption">
              <span>{hero.figure.caption}</span>
              <span dir="ltr">FIG. I</span>
            </figcaption>

            <a href="#about" className="hero__scroll" aria-label="رفتن به بخش استودیو">
              <span>اسکرول کنید</span>
              <span className="hero__scroll-line" aria-hidden="true" />
              <ArrowUpLeft aria-hidden="true" />
            </a>
          </aside>
        </div>
      </div>

      <div className="hero__ticker">
        <Marquee items={hero.ticker} speed={68} />
      </div>
    </section>
  );
}
