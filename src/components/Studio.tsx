import { useCallback, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpLeft, MoveUpRight } from "lucide-react";
import { CONTACT, PRINCIPLES } from "../data";
import { Magnetic, Marquee, Numeral, Reveal, SectionHead } from "./ui";

const STUDIO_FACTS = [
  { label: "تأسیس", value: "۱۳۹۸", latin: "FOUNDED" },
  { label: "تیم ثابت", value: "۴ نفر", latin: "CORE TEAM" },
  { label: "موقعیت", value: "تهران", latin: "TEHRAN" },
  { label: "زبان کار", value: "فارسی / انگلیسی", latin: "LANGUAGES" },
] as const;

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
  return (
    <aside className="studio__sheet" aria-label="شناسنامهٔ استودیو">
      <header className="studio__sheet-head">
        <span className="studio__sheet-label" dir="ltr">
          STUDIO PROFILE
        </span>
        <span className="studio__sheet-index">
          <Numeral value={5} />
        </span>
      </header>

      <div className="studio__sheet-body">
        <StudioSeal />

        <dl className="studio__ledger">
          {STUDIO_FACTS.map((fact) => (
            <div className="studio__ledger-row" key={fact.latin}>
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
          {String(active + 1).padStart(2, "0")} / {String(PRINCIPLES.length).padStart(2, "0")}
        </span>
      </Reveal>

      <div className="studio__tenets-body">
        <span className="studio__tenets-ghost" aria-hidden="true">
          <Numeral key={active} value={PRINCIPLES[active]?.number ?? "1"} />
        </span>

        <ul className="studio__tenet-list">
          {PRINCIPLES.map((principle, index) => (
            <Reveal
              as="li"
              key={principle.number}
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
                  <Numeral value={principle.number} />
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
          index="V"
          label="استودیو"
          latin="The Studio"
          id="studio-title"
          className="studio__head"
          title={
            <>
              استودیوی کوچک، وسواسِ <span className="accent">بزرگ</span>.
            </>
          }
          note="ما یک تیمِ کوچکِ ثابت هستیم؛ بدون واسطه، بدون لایه‌های اضافه. کسی که با شما حرف می‌زند، همان کسی است که طراحی می‌کند و کد را می‌نویسد."
        />

        <div className="studio__spread">
          <span className="studio__rail" aria-hidden="true">
            <span dir="ltr">CAHEN — STUDIO NOTES</span>
            <span dir="ltr">V / 06</span>
          </span>

          <div className="studio__manifesto">
            <div className="studio__statement">
              <Reveal as="span" variant="mask" className="studio__line">
                <span>ما با ایده‌های بزرگ</span>
              </Reveal>
              <Reveal as="span" variant="mask" className="studio__line" delay={100}>
                <span>شروع نمی‌کنیم؛ با</span>
              </Reveal>
              <Reveal as="span" variant="mask" className="studio__line" delay={200}>
                <span>
                  <span className="studio__statement-accent">پرسش‌های درست</span> شروع می‌کنیم.
                </span>
              </Reveal>
            </div>

            <Reveal className="studio__copy" delay={120}>
              <p>
                کاهن در سال ۱۳۹۸ با یک ایدهٔ ساده شروع شد: طراحی باید مسئله را حل کند، نه اینکه فقط
                خوب به نظر برسد. امروز همان ایده، شکل یک استودیوی مستقل است که برندها، محصولات و
                تجربه‌های دیجیتال می‌سازد.
              </p>
              <p>
                ما در تهران کار می‌کنیم و با تیم‌هایی در سراسر جهان همکاری می‌کنیم. ابزارمان گفت‌وگوی
                شفاف، پژوهشِ دقیق و وسواسی است که در جزئیاتی دیده می‌شود که شاید کسی نامشان را نبرد.
              </p>
            </Reveal>

            <Reveal className="studio__manifesto-foot" delay={180}>
              <a href="#work" className="studio__textlink">
                <span>کارهایی که این اصول را نشان می‌دهند</span>
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
          <p>
            اگر مسئله‌ای دارید که فکر می‌کنید وقتِ حل‌شدنش رسیده،
            <span> یک پیام کوتاه کافی است.</span>
          </p>
          <div className="studio__cta-actions">
            <Magnetic strength={8}>
              <a href="#contact" className="studio__link">
                <span>بیایید دربارهٔ همکاری حرف بزنیم</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
            </Magnetic>
            <a className="studio__mail" href={`mailto:${CONTACT.email}`} dir="ltr">
              {CONTACT.email}
            </a>
          </div>
        </Reveal>
      </div>

      <div className="studio__marquee">
        <Marquee
          items={["CAHEN", "DIGITAL STUDIO", "TEHRAN", "DESIGN & CODE", "SINCE 2019"]}
          speed={40}
        />
      </div>
    </section>
  );
}
