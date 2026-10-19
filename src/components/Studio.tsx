import { ArrowUpLeft } from "lucide-react";
import { PRINCIPLES, STATS } from "../data";
import { Marquee, Reveal, SectionHead } from "./ui";
import { ParticleLogo } from "./ParticleLogo";

export function Studio() {
  return (
    <section
      id="studio"
      className="chapter theme-ink studio"
      data-invert
      aria-labelledby="studio-title"
    >
      <div className="frame">
        <SectionHead
          index="05"
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

        <div className="studio__grid">
          <Reveal className="studio__copy">
            <p>
              کاهن در سال ۱۳۹۸ با یک ایدهٔ ساده شروع شد: طراحی باید مسئله را حل کند، نه اینکه فقط خوب
              به نظر برسد. امروز همان ایده، شکل یک استودیوی مستقل است که برندها، محصولات و تجربه‌های
              دیجیتال می‌سازد.
            </p>
            <p>
              ما در تهران کار می‌کنیم و با تیم‌هایی در سراسر جهان همکاری می‌کنیم. ابزارمان گفت‌وگوی
              شفاف، پژوهشِ دقیق و وسواسی است که در جزئیاتی دیده می‌شود که شاید کسی نامشان را نبرد.
            </p>

            <div className="studio__values" aria-label="ارزش‌های استودیو">
              {PRINCIPLES.map((principle) => (
                <div className="studio__value" key={principle.number}>
                  <span className="studio__value-mark" dir="ltr">
                    {principle.number}
                  </span>
                  <div>
                    <p className="studio__value-title">{principle.title}</p>
                    <p className="studio__value-text">{principle.text}</p>
                  </div>
                  <ArrowUpLeft aria-hidden="true" />
                </div>
              ))}
            </div>

            <a href="#contact" className="studio__link">
              <span>بیایید دربارهٔ همکاری حرف بزنیم</span>
              <ArrowUpLeft aria-hidden="true" />
            </a>
          </Reveal>

          <div className="studio__stage">
            <span className="studio__stage-grid" aria-hidden="true" />
            <span className="studio__corner studio__corner--tl" aria-hidden="true" />
            <span className="studio__corner studio__corner--br" aria-hidden="true" />
            <span className="studio__mark-tag studio__mark-tag--tl" dir="ltr">
              MARK / 01
            </span>
            <span className="studio__mark-tag studio__mark-tag--tr" dir="ltr">
              PARTICLE SYSTEM
            </span>
            <span className="studio__mark-tag studio__mark-tag--bl">زنده — با ماوس حرکت کنید</span>
            <span className="studio__mark-tag studio__mark-tag--br" dir="ltr">
              35.6892° N
            </span>
            <div className="studio__mark">
              <ParticleLogo />
            </div>
          </div>
        </div>
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
