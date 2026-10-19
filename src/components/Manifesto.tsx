import { Reveal } from "./ui";

export function Manifesto() {
  return (
    <section className="manifesto" aria-label="باور CAHEN">
      <div className="container manifesto__inner">
        <Reveal>
          <span className="kicker">
            <span className="kicker__dot" aria-hidden="true" />
            باور ما
          </span>
        </Reveal>

        <Reveal delay={90}>
          <p className="manifesto__text">
            طراحی خوب دیده نمی‌شود؛ <em>حس می‌شود.</em>
            <br />
            ما فرم را در خدمت معنا می‌آوریم و هر جزئیات را با دلیلش می‌سازیم؛
            <br />
            تا تجربه‌ای بماند که ساده به‌نظر می‌رسد، اما پشتش فکر ایستاده.
          </p>
        </Reveal>

        <Reveal delay={160}>
          <div className="manifesto__meta" dir="ltr">
            <span>STRATEGY / DESIGN / BUILD</span>
            <span>CAHEN DIGITAL STUDIO</span>
            <span>TEHRAN — IRAN</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
