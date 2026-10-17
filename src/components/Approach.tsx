import { ArrowUpRight, Layers, Route, Search } from "lucide-react";
import { PROCESS_STEPS } from "../data";
import { Reveal, SectionBadge } from "./ui";

const STEP_ICONS = { search: Search, layers: Layers, arrow: ArrowUpRight };

export function Approach() {
  return (
    <section id="approach" className="section-anchor section-space relative">
      <div className="mx-auto grid max-w-[1280px] items-start gap-10 px-5 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-20">
        <Reveal className="approach-intro lg:sticky lg:top-32">
          <SectionBadge>رویکرد CAHEN</SectionBadge>
          <h2 className="section-title mt-4">
            مسیر روشن،<br />
            <span className="text-grad">نتیجهٔ ماندگار.</span>
          </h2>
          <p className="section-intro mt-4 max-w-md">
            کیفیت فقط در خروجی نیست؛ در شیوهٔ رسیدن به آن هم هست. با روندی شفاف، مشارکتی و دقیق، ایده را قدم‌به‌قدم به تجربه تبدیل می‌کنیم.
          </p>

          <div className="approach-note mt-8">
            <span className="approach-note__mark"><Route className="h-4 w-4" aria-hidden="true" /></span>
            <p>بدون شتاب‌زدگی. بدون جزئیات تصادفی.<br /><strong>با فکر، سلیقه و همراهی.</strong></p>
          </div>
        </Reveal>

        <ol className="process-list">
          {PROCESS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li key={step.number} className="process-list__item">
                <Reveal delay={index * 95}>
                  <article className="process-card">
                    <div className="process-card__rail" aria-hidden="true">
                      <span className="process-card__number" dir="ltr">{step.number}</span>
                      {index < PROCESS_STEPS.length - 1 && <span className="process-card__connector" />}
                    </div>
                    <div className="process-card__content">
                      <div className="process-card__meta">
                        <span className="process-card__icon"><Icon className="h-[19px] w-[19px]" strokeWidth={1.6} aria-hidden="true" /></span>
                        <span className="process-card__label" dir="ltr">{step.label}</span>
                      </div>
                      <h3 className="process-card__title">{step.title}</h3>
                      <p className="process-card__text">{step.text}</p>
                    </div>
                    <span className="process-card__shine" aria-hidden="true" />
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
