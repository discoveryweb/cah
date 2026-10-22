import { ArrowUpLeft } from "lucide-react";
import { PRINCIPLES, STATS } from "../data";
import { Marquee, Numeral, Reveal, SectionHead } from "./ui";

const STUDIO_FACTS = [
  { label: "تأسیس", value: "۱۳۹۸", latin: "FOUNDED" },
  { label: "تیم ثابت", value: "۴ نفر", latin: "CORE TEAM" },
  { label: "موقعیت", value: "تهران", latin: "TEHRAN" },
  { label: "زبان کار", value: "فارسی / انگلیسی", latin: "LANGUAGES" },
] as const;

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

        <div className="studio__manifesto">
          <Reveal className="studio__lead">
            <p className="studio__statement">
              ما با ایده‌های بزرگ شروع نمی‌کنیم؛
              <br />
              با <em>پرسش‌های درست</em> شروع می‌کنیم.
            </p>
            <div className="studio__copy">
              <p>
                کاهن در سال ۱۳۹۸ با یک ایدهٔ ساده شروع شد: طراحی باید مسئله را حل کند، نه اینکه فقط
                خوب به نظر برسد. امروز همان ایده، شکل یک استودیوی مستقل است که برندها، محصولات و
                تجربه‌های دیجیتال می‌سازد.
              </p>
              <p>
                ما در تهران کار می‌کنیم و با تیم‌هایی در سراسر جهان همکاری می‌کنیم. ابزارمان گفت‌وگوی
                شفاف، پژوهشِ دقیق و وسواسی است که در جزئیاتی دیده می‌شود که شاید کسی نامشان را نبرد.
              </p>
            </div>
          </Reveal>

          <Reveal className="studio__card" delay={120}>
            <div className="studio__card-top">
              <span className="studio__card-label" dir="ltr">
                STUDIO PROFILE
              </span>
              <span className="studio__card-index" dir="ltr">
                / V
              </span>
            </div>

            <dl className="studio__facts">
              {STUDIO_FACTS.map((fact) => (
                <div className="studio__fact" key={fact.latin}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                  <span className="studio__fact-latin" dir="ltr">
                    {fact.latin}
                  </span>
                </div>
              ))}
            </dl>

            <span className="studio__avail">
              <i aria-hidden="true" />
              ظرفیت همکاری — زمستان ۱۴۰۴
            </span>
          </Reveal>
        </div>

        <ul className="studio__values" aria-label="ارزش‌های استودیو">
          {PRINCIPLES.map((principle, index) => (
            <Reveal as="li" className="studio__value" key={principle.number} delay={index * 90}>
              <Numeral value={principle.number} className="studio__value-num" />
              <h3 className="studio__value-title">{principle.title}</h3>
              <p className="studio__value-text">{principle.text}</p>
              <ArrowUpLeft className="studio__value-arrow" aria-hidden="true" />
            </Reveal>
          ))}
        </ul>

        <Reveal className="studio__stats" delay={80}>
          {STATS.map((stat) => (
            <div className="studio__stat" key={stat.latin}>
              <strong>{stat.value}</strong>
              <span className="studio__stat-label">{stat.label}</span>
              <span className="studio__stat-latin" dir="ltr">
                {stat.latin}
              </span>
            </div>
          ))}
        </Reveal>

        <Reveal className="studio__cta" delay={120}>
          <p>
            اگر مسئله‌ای دارید که فکر می‌کنید وقتِ حل‌شدنش رسیده،
            <span> یک پیام کوتاه کافی است.</span>
          </p>
          <a href="#contact" className="studio__link">
            <span>بیایید دربارهٔ همکاری حرف بزنیم</span>
            <ArrowUpLeft aria-hidden="true" />
          </a>
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
