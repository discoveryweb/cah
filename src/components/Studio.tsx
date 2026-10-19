import { ArrowUpLeft, MoveUpRight } from "lucide-react";
import { STUDIO_VALUES } from "../data";
import { ParticleLogo } from "./ParticleLogo";
import { Reveal, SectionBadge } from "./ui";

export function Studio() {
  return (
    <section id="about" className="section section--tint studio">
      <div className="container studio__grid">
        <Reveal className="studio__copy">
          <div className="flex items-center gap-4">
            <SectionBadge>دربارهٔ استودیو</SectionBadge>
            <span className="section-index" aria-hidden="true" dir="ltr">
              <strong>04</strong> / 05
            </span>
          </div>
          <h2 className="section-title mt-4">
            ما CAHEN هستیم؛
            <br />
            <span className="text-grad">مشتاقِ ساختن.</span>
          </h2>
          <p className="section-intro mt-4">
            یک تیم خلاق با نگاهی مشترک به طراحی و فناوری. برای ما، تجربهٔ خوب باید هم زیبا به‌نظر برسد، هم ساده و
            طبیعی کار کند؛ از اولین برخورد تا آخرین تعامل.
          </p>

          <ul className="studio__values">
            {STUDIO_VALUES.map((value) => (
              <li key={value.number} className="studio__value">
                <span className="studio__value-mark" dir="ltr" aria-hidden="true">
                  {value.number}
                </span>
                <div className="studio__value-body">
                  <h3 className="studio__value-title">{value.title}</h3>
                  <p className="studio__value-text">{value.text}</p>
                </div>
                <ArrowUpLeft className="studio__value-arrow" aria-hidden="true" />
              </li>
            ))}
          </ul>

          <a href="#contact" className="studio__link">
            <span>آشنایی را شروع کنیم</span>
            <ArrowUpLeft aria-hidden="true" />
          </a>
        </Reveal>

        <Reveal delay={130} className="studio__art">
          <div className="studio__card">
            <span className="studio__orb studio__orb--one" aria-hidden="true" />
            <span className="studio__orb studio__orb--two" aria-hidden="true" />

            <div className="studio__card-label studio__card-label--top" dir="ltr" aria-hidden="true">
              <span>CAHEN / PARTICLE IDENTITY</span>
              <span>MOVE · REACT · RETURN</span>
            </div>

            <div className="studio__object">
              <ParticleLogo />
            </div>

            <div className="studio__card-label studio__card-label--bottom" dir="ltr" aria-hidden="true">
              <span>OUR MARK, IN MOTION</span>
              <span className="studio__card-arrow">
                <MoveUpRight />
              </span>
            </div>

            <span className="studio__corner studio__corner--tl" aria-hidden="true" />
            <span className="studio__corner studio__corner--br" aria-hidden="true" />
          </div>

          <div className="studio__caption" dir="ltr" aria-hidden="true">
            <span>CURIOUS BY NATURE</span>
            <span className="studio__caption-line" />
            <span>CAHEN / 01</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
