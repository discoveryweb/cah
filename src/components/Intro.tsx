import { useRef } from "react";
import { ArrowUpLeft } from "lucide-react";
import cahenMark from "../assets/cahen-mark.png";
import studioImage from "../assets/studio.jpg";
import { PRINCIPLES } from "../data";
import { useParallax } from "../hooks/useParallax";
import { MarkStage } from "./MarkStage";
import { Numeral, Reveal, SectionHead } from "./ui";

export function Intro() {
  const portraitRef = useRef<HTMLDivElement>(null);
  useParallax(portraitRef, 0.04);

  return (
    <section id="about" className="chapter theme-paper intro section" aria-labelledby="intro-title">
      <div className="frame">
        <SectionHead
          index="I"
          label="درباره"
          latin="The Practice"
          id="intro-title"
          title={
            <>
              طراحی از دلِ مسئله، نه از دلِ <span className="accent">قالب</span>.
            </>
          }
          note="کاهن یک استودیوی مستقل طراحی و توسعه است؛ کوچک به‌اندازه‌ای که هر پروژه را خودمان بسازیم، بزرگ به‌اندازه‌ای که از پسِ مسائل واقعی بربیاییم."
        />

        <div className="intro__identity">
          <Reveal className="intro__identity-stage" variant="scale" delay={60}>
            <MarkStage />
            <figcaption className="intro__identity-caption">
              <span>نشان کاهن — پرتره‌ای از ذرات</span>
              <span dir="ltr">FIG. II</span>
            </figcaption>
          </Reveal>
        </div>

        <div className="intro__grid">
          <div className="intro__main">
            <div className="intro__statement">
              <Reveal className="intro__line" variant="mask" as="span">
                <span>ما به برندها کمک می‌کنیم</span>
              </Reveal>
              <Reveal className="intro__line" variant="mask" as="span" delay={110}>
                <span>
                  از دایرهٔ شلوغِ <span className="accent">«شبیه بقیه»</span>
                </span>
              </Reveal>
              <Reveal className="intro__line" variant="mask" as="span" delay={220}>
                <span>بیرون بیایند — و دیده شوند.</span>
              </Reveal>
            </div>

            <div className="intro__body">
              <p>
                هر پروژه با یک گفت‌وگوی صادقانه شروع می‌شود: شما از هدف می‌گویید، ما از پرسش‌هایی که
                مسیر را روشن می‌کنند. از آن نقطه، استراتژی، فرم و کد را در یک خط پیش می‌بریم تا چیزی
                ساخته شود که هم درست کار کند و هم به‌یاد بماند.
              </p>
              <p>
                ما به قالب‌های آماده اعتقادی نداریم. هر برند، زبانِ خودش را دارد؛ کارِ ما پیدا کردنِ آن
                زبان و ساختنِ سیستمی است که در هر اندازه و هر نقطهٔ تماس، همان صدا را داشته باشد.
              </p>
              <a href="#studio" className="link-arrow">
                <span>بیشتر دربارهٔ استودیو</span>
                <ArrowUpLeft aria-hidden="true" />
              </a>
            </div>

            <ul className="intro__principles" aria-label="اصول کاری کاهن">
              {PRINCIPLES.map((principle) => (
                <li className="intro__principle" key={principle.number}>
                  <Numeral value={principle.number} className="intro__principle-num" />
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
                src={studioImage}
                alt="میز کار استودیو با برگه‌های چاپ‌شده، ابزار و یک شیء سرامیکی نارنجی در نور طبیعی"
                width={1122}
                height={1402}
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
              <span>دفتر ما — تهران</span>
              <span dir="ltr">PLATE II</span>
            </figcaption>
          </Reveal>
        </div>

      </div>
    </section>
  );
}
