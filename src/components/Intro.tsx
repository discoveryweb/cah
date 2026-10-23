import { useRef } from "react";
import { ArrowUpLeft } from "lucide-react";
import cahenMark from "../assets/cahen-mark.png";
import { useContent } from "../content/ContentProvider";
import { renderRichText } from "../content/RichText";
import { useParallax } from "../hooks/useParallax";
import { MarkStage } from "./MarkStage";
import { Numeral, Reveal, SectionHead } from "./ui";

export function Intro() {
  const portraitRef = useRef<HTMLDivElement>(null);
  useParallax(portraitRef, 0.04);
  const content = useContent();
  const { about, principles } = content;

  return (
    <section id="about" className="chapter theme-paper intro section" aria-labelledby="intro-title">
      <div className="frame">
        <SectionHead
          index="I"
          label="درباره"
          latin="The Practice"
          id="intro-title"
          title={renderRichText(about.title)}
          note={about.note}
        />

        <div className="intro__identity">
          <Reveal className="intro__identity-stage" variant="scale" delay={60}>
            <MarkStage />
            <figcaption className="intro__identity-caption">
              <span>{about.identityCaption}</span>
              <span dir="ltr">FIG. II</span>
            </figcaption>
          </Reveal>
        </div>

        <div className="intro__grid">
          <div className="intro__main">
            <div className="intro__statement">
              {about.statementLines.map((line, index) => (
                <Reveal
                  key={`${index}-${line}`}
                  className="intro__line"
                  variant="mask"
                  as="span"
                  delay={index * 110}
                >
                  <span>{renderRichText(line)}</span>
                </Reveal>
              ))}
            </div>

            <div className="intro__body">
              {about.copy.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <a href="#studio" className="link-arrow">
                <span>{about.ctaLabel}</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
            </div>

            <ul className="intro__principles" aria-label="اصول کاری کاهن">
              {principles.map((principle, index) => (
                <li className="intro__principle" key={`${index}-${principle.title}`}>
                  <Numeral value={index + 1} className="intro__principle-num" />
                  <div>
                    <p className="intro__principle-title">{principle.title}</p>
                    <p className="intro__principle-text">{principle.text}</p>
                  </div>
                  <ArrowUpLeft aria-hidden="true" />
                </li>
              ))}
            </ul>
          </div>

          <Reveal className="intro__portrait" variant="scale" delay={120} as="figure">
            <div className="intro__portrait-frame" ref={portraitRef}>
              <img
                src={about.portrait.image}
                alt={about.portrait.alt}
                width={1200}
                height={896}
                loading="lazy"
                decoding="async"
              />
            </div>
            <span className="intro__badge" aria-hidden="true">
              <img className="intro__badge-star" src={cahenMark} alt="" width={736} height={600} decoding="async" />
              <span>
                CAHEN
                <br />
                STUDIO
              </span>
            </span>
            <figcaption className="intro__caption">
              <span>{about.portrait.caption}</span>
              <span dir="ltr">PLATE II</span>
            </figcaption>
          </Reveal>
        </div>

      </div>
    </section>
  );
}
