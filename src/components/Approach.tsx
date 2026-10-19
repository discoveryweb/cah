import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Layers, Route, Search } from "lucide-react";
import { PROCESS_STEPS } from "../data";
import { Reveal, SectionBadge } from "./ui";

const STEP_ICONS = { search: Search, layers: Layers, arrow: ArrowUpRight };

export function Approach() {
  const listRef = useRef<HTMLOListElement>(null);
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setActiveStep(PROCESS_STEPS.length - 1);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const items = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
      if (!items.length) return;

      const viewportAnchor = window.innerHeight * 0.58;
      let progress = 0;
      let active = -1;

      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        if (rect.top <= viewportAnchor) {
          active = index;
          const travelled = Math.min(rect.height, viewportAnchor - rect.top);
          progress = ((index + travelled / rect.height) / items.length) * 100;
        }
      });

      const listRect = list.getBoundingClientRect();
      if (listRect.top > viewportAnchor) progress = 0;
      list.style.setProperty("--timeline-progress", `${Math.min(100, Math.max(0, progress)).toFixed(2)}%`);
      setActiveStep(active);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <section id="approach" className="section approach">
      <div className="container approach__grid">
        <Reveal className="approach__aside">
          <div className="flex items-center gap-4">
            <SectionBadge>رویکرد CAHEN</SectionBadge>
            <span className="section-index" aria-hidden="true" dir="ltr">
              <strong>03</strong> / 05
            </span>
          </div>
          <h2 className="section-title mt-4">
            مسیر روشن،
            <br />
            <span className="text-grad">نتیجهٔ ماندگار.</span>
          </h2>
          <p className="section-intro mt-4">
            کیفیت فقط در خروجی نیست؛ در شیوهٔ رسیدن به آن هم هست. با روندی شفاف، مشارکتی و دقیق، ایده را
            قدم‌به‌قدم به تجربه تبدیل می‌کنیم.
          </p>

          <div className="approach__note">
            <span className="approach__note-mark" aria-hidden="true">
              <Route />
            </span>
            <p>
              بدون شتاب‌زدگی. بدون جزئیات تصادفی.
              <br />
              <strong>با فکر، سلیقه و همراهی.</strong>
            </p>
          </div>

          <span className="approach__signature" dir="ltr">
            THREE STEPS · ONE STANDARD
          </span>
        </Reveal>

        <ol className="timeline" ref={listRef}>
          <span className="timeline__fill" aria-hidden="true" />
          {PROCESS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li
                key={step.number}
                data-step
                className={`timeline__item${index === activeStep ? " timeline__item--active" : ""}`}
              >
                <div className="timeline__rail" aria-hidden="true">
                  <span className="timeline__num" dir="ltr">
                    {step.number.padStart(2, "0")}
                  </span>
                </div>
                <Reveal delay={index * 90} className="timeline__body">
                  <div className="timeline__meta">
                    <span className="timeline__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span className="timeline__label" dir="ltr">
                      {step.label}
                    </span>
                  </div>
                  <h3 className="timeline__title">{step.title}</h3>
                  <p className="timeline__text">{step.text}</p>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
