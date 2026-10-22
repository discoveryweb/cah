import { useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpLeft, MoveUpRight } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { renderRichText } from "../content/RichText";
import { Magnetic, Marquee, Numeral, Reveal, SectionHead } from "./ui";

function StudioSeal() {
  return (
    <div className="studio__seal" aria-hidden="true">
      <svg viewBox="0 0 132 132" className="studio__seal-type">
        <defs>
          <path
            id="studio-seal-path"
            d="M66,66 m-51,0 a51,51 0 1,1 102,0 a51,51 0 1,1 -102,0"
          />
        </defs>
        <text>
          <textPath href="#studio-seal-path" startOffset="0">
            CAHEN · DIGITAL STUDIO · TEHRAN · SINCE 2019 ·
          </textPath>
        </text>
      </svg>
      <span className="studio__seal-core">
        <b>۱۳۹۸</b>
        <i dir="ltr">EST.</i>
      </span>
      <span className="studio__seal-tick studio__seal-tick--top" />
      <span className="studio__seal-tick studio__seal-tick--bottom" />
    </div>
  );
}

function StudioLedger() {
  const content = useContent();
  return (
    <aside className="studio__sheet" aria-label="شناسنامهٔ استودیو">
      <header className="studio__sheet-head">
        <span className="studio__sheet-label" dir="ltr">
          STUDIO PROFILE
        </span>
        <span className="studio__sheet-index">
          <Numeral value={4} />
        </span>
      </header>

      <div className="studio__sheet-body">
        <StudioSeal />

        <dl className="studio__ledger">
          {content.studio.facts.map((fact, index) => (
            <div className="studio__ledger-row" key={`${index}-${fact.latin}`}>
              <dt>
                <span className="studio__ledger-label">{fact.label}</span>
                <span className="studio__ledger-latin" dir="ltr">
                  {fact.latin}
                </span>
              </dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

    </aside>
  );
}

function StudioTenets() {
  const [active, setActive] = useState(0);
  const principles = useContent().principles;

  const spotlight = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const row = event.currentTarget;
    const rect = row.getBoundingClientRect();
    row.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    row.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }, []);

  return (
    <div className="studio__tenets">
      <Reveal className="studio__tenets-head" as="header">
        <span className="studio__tenets-label" dir="ltr">
          HOW WE WORK
        </span>
        <p className="studio__tenets-title">سه اصل که کارِ ما را شکل می‌دهند</p>
        <span className="studio__tenets-count" dir="ltr">
          {String(active + 1).padStart(2, "0")} / {String(principles.length).padStart(2, "0")}
        </span>
      </Reveal>

      <div className="studio__tenets-body">
        <span className="studio__tenets-ghost" aria-hidden="true">
          <Numeral key={active} value={active + 1} />
        </span>

        <ul className="studio__tenet-list">
          {principles.map((principle, index) => (
            <Reveal
              as="li"
              key={`${index}-${principle.title}`}
              delay={index * 80}
              className="studio__tenet"
            >
              <div
                className="studio__tenet-inner"
                data-active={active === index}
                onPointerEnter={() => setActive(index)}
                onPointerMove={spotlight}
              >
                <span className="studio__tenet-num">
                  <Numeral value={index + 1} />
                </span>
                <div className="studio__tenet-copy">
                  <h3 className="studio__tenet-title">{principle.title}</h3>
                  <p className="studio__tenet-text">{principle.text}</p>
                </div>
                <span className="studio__tenet-mark" aria-hidden="true">
                  <MoveUpRight />
                </span>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Studio() {
  const content = useContent();
  const studio = content.studio;

  return (
    <section
      id="studio"
      className="chapter theme-ink studio"
      data-invert
      aria-labelledby="studio-title"
    >
      <span className="studio__aura" aria-hidden="true" />
      <span className="studio__orbit" aria-hidden="true" />
      <span className="studio__beam" aria-hidden="true" />

      <div className="frame">
        <SectionHead
          index="IV"
          label="استودیو"
          latin="The Studio"
          id="studio-title"
          className="studio__head"
          title={renderRichText(studio.title)}
          note={studio.note}
        />

        <div className="studio__spread">
          <span className="studio__rail" aria-hidden="true">
            <span dir="ltr">CAHEN — STUDIO NOTES</span>
            <span dir="ltr">IV / 05</span>
          </span>

          <div className="studio__manifesto">
            <div className="studio__statement">
              {studio.statementLines.map((line, index) => (
                <Reveal
                  key={`${index}-${line}`}
                  as="span"
                  variant="mask"
                  className="studio__line"
                  delay={index * 100}
                >
                  <span>{renderRichText(line)}</span>
                </Reveal>
              ))}
            </div>

            <Reveal className="studio__copy" delay={120}>
              {studio.copy.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </Reveal>

            <Reveal className="studio__manifesto-foot" delay={180}>
              <a href="#work" className="studio__textlink">
                <span>{studio.linkLabel}</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
              <span className="studio__sign" aria-hidden="true" dir="ltr">
                — CAHEN, TEHRAN
              </span>
            </Reveal>
          </div>

          <Reveal className="studio__sheet-wrap" variant="scale" delay={140}>
            <StudioLedger />
          </Reveal>
        </div>

        <StudioTenets />

        <Reveal className="studio__cta" delay={80}>
          <p>{studio.ctaText}</p>
          <div className="studio__cta-actions">
            <Magnetic strength={8}>
              <a href="#contact" className="studio__link">
                <span>{studio.ctaLabel}</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
            </Magnetic>
            <a className="studio__mail" href={`mailto:${content.contact.email}`} dir="ltr">
              {content.contact.email}
            </a>
          </div>
        </Reveal>
      </div>

      <div className="studio__marquee">
        <Marquee items={studio.marquee} speed={40} />
      </div>
    </section>
  );
}
