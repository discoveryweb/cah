import { ArrowUpLeft, Timer } from "lucide-react";
import { PROCESS_STEPS } from "../data";
import { Reveal, SectionHead } from "./ui";

export function Process() {
  return (
    <section
      id="process"
      className="chapter theme-paper process section"
      aria-labelledby="process-title"
    >
      <div className="frame">
        <SectionHead
          index="04"
          label="فرایند"
          latin="Method"
          id="process-title"
          title={
            <>
              مسیرِ روشن، از پرسش تا <span className="accent">انتشار</span>.
            </>
          }
          note="فرایند ما یک مراسم نیست؛ یک قرارداد است. در هر مرحله می‌دانید کجاییم، چه چیزی تحویل می‌گیرید و قدم بعدی چیست."
        />

        <div className="process__grid">
          <Reveal className="process__aside" variant="scale">
            <p className="lede">
              پروژه‌های کوچک را در چند هفته و پروژه‌های بزرگ‌تر را در چند ماه جلو می‌بریم. همیشه با یک
              تیمِ ثابت، یک نقطهٔ تماس و جلسه‌های کوتاهِ هفتگی.
            </p>
            <div className="process__note">
              <Timer aria-hidden="true" />
              <p>
                میانگین زمان از شروع تا انتشار، برای یک وب‌سایت کامل: <strong>۶ تا ۱۰ هفته</strong>. این
                بازه در اولین جلسه، بر اساس دامنهٔ واقعی پروژه دقیق می‌شود.
              </p>
            </div>
            <a href="#contact" className="link-arrow">
              <span>زمان‌بندی پروژهٔ خود را بگیرید</span>
              <ArrowUpLeft aria-hidden="true" />
            </a>
          </Reveal>

          <ol className="process__list" aria-label="مراحل فرایند">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.number}>
                <Reveal className="process__item" delay={index * 80}>
                  <span className="process__num" dir="ltr">
                    {step.number}
                  </span>
                  <div className="process__body">
                    <span className="process__label" dir="ltr">
                      {step.latin}
                    </span>
                    <h3 className="process__title">{step.title}</h3>
                    <p className="process__text">{step.text}</p>
                  </div>
                  <ArrowUpLeft className="process__arrow" aria-hidden="true" />
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
