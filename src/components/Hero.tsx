import { useRef } from "react";
import { ArrowDown, ArrowUpLeft } from "lucide-react";
import heroStill from "../assets/hero-still.jpg";
import { TICKER } from "../data";
import { useParallax } from "../hooks/useParallax";
import { Button, Magnetic, Marquee } from "./ui";

export function Hero({ onOrder }: { onOrder: () => void }) {
  const figureRef = useRef<HTMLElement>(null);
  useParallax(figureRef, 0.055);

  return (
    <section id="home" className="hero" aria-labelledby="hero-title">
      <div className="frame">
        <div className="hero__meta">
          <span className="hero__status">
            <i aria-hidden="true" />
            پذیرش پروژه برای زمستان ۱۴۰۴
          </span>
          <div className="hero__meta-right">
            <span className="label label--plain" dir="ltr">
              TEHRAN, IR — 35.6892° N / 51.3890° E
            </span>
            <span className="hero__meta-index" dir="ltr">
              I / VI
            </span>
          </div>
        </div>

        <div className="hero__grid">
          <div className="hero__main">
            <h1 className="hero__title" id="hero-title">
              <span className="hero__line">
                <span className="hero__line-inner">دیده‌شدن،</span>
              </span>
              <span className="hero__line hero__line--2">
                <span className="hero__line-inner" style={{ transitionDelay: "150ms" }}>
                  حقِ کارِ خوب است
                  <span className="hero__dot" aria-hidden="true" />
                  <span className="hero__annotation" dir="ltr">
                    FORM / I
                  </span>
                </span>
              </span>
            </h1>

            <p className="hero__translation" dir="ltr">
              <span className="hero__translation-line" aria-hidden="true" />
              <em>The work deserves to be seen.</em>
              <span className="hero__translation-src">CAHEN — STUDIO NOTE</span>
            </p>

            <div className="hero__bottom">
              <p className="hero__lede">
                ما در <strong>CAHEN</strong> برندها و محصولات دیجیتال را از دلِ مسئله طراحی می‌کنیم؛ با
                استراتژی روشن، فرمِ دقیق و کدی که طرح را همان‌قدر که هست، نشان می‌دهد.
              </p>
              <div className="hero__actions">
                <Magnetic>
                  <Button onClick={onOrder}>شروع یک پروژه</Button>
                </Magnetic>
                <a href="#work" className="hero__secondary" data-cursor="hover">
                  <span>دیدن کارها</span>
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <aside className="hero__aside">
            <figure className="hero__figure" ref={figureRef}>
              <img
                src={heroStill}
                alt="ترکیب‌بندی استودیویی از فرم‌های کاغذی و یک دایرهٔ بنفش روی زمینهٔ کاغذ"
                width={1122}
                height={1402}
                fetchPriority="high"
                decoding="async"
              />
              <span className="hero__index" dir="ltr">
                SOMA / 2025
              </span>
              <span className="hero__figure-tag" dir="ltr">
                SELECTED WORK
              </span>
            </figure>

            <figcaption className="hero__caption">
              <span>یک کار منتخب از مجموعهٔ ۲۰۲۵</span>
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
        <Marquee items={TICKER} speed={68} />
      </div>
    </section>
  );
}
