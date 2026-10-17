import { ArrowUpLeft, MoveUpRight } from "lucide-react";
import { STUDIO_VALUES } from "../data";
import { ParticleLogo } from "./ParticleLogo";
import { Reveal, SectionBadge } from "./ui";

export function Studio() {
  return (
    <section id="about" className="section-anchor section-space section-tint relative">
      <div className="mx-auto grid max-w-[1280px] items-center gap-9 px-5 sm:px-8 lg:grid-cols-[0.96fr_1.04fr] lg:gap-16">
        <Reveal className="studio-art order-2 lg:order-1">
          <div className="studio-art__card">
            <div className="studio-art__grid" aria-hidden="true" />
            <div className="studio-art__orb studio-art__orb--one" aria-hidden="true" />
            <div className="studio-art__orb studio-art__orb--two" aria-hidden="true" />
            <div className="studio-art__outline" aria-hidden="true" />
            <div className="studio-art__topline" dir="ltr">
              <span>CAHEN / PARTICLE IDENTITY</span>
              <span>MOVE · REACT · RETURN</span>
            </div>
            <div className="studio-art__object">
              <ParticleLogo />
            </div>
            <div className="studio-art__bottomline" dir="ltr">
              <span>OUR MARK, IN MOTION</span>
              <span className="studio-art__arrow"><MoveUpRight className="h-4 w-4" aria-hidden="true" /></span>
            </div>
          </div>
          <div className="studio-art__caption" dir="ltr">
            <span>CURIOUS BY NATURE</span>
            <span className="studio-art__caption-line" />
            <span>CAHEN / 1</span>
          </div>
        </Reveal>

        <Reveal delay={100} className="studio-copy order-1 lg:order-2">
          <SectionBadge>دربارهٔ استودیو</SectionBadge>
          <h2 className="section-title mt-4">
            ما CAHEN هستیم؛<br />
            <span className="text-grad">مشتاقِ ساختن.</span>
          </h2>
          <p className="section-intro mt-4 max-w-xl">
            یک تیم خلاق با نگاهی مشترک به طراحی و فناوری. برای ما، تجربهٔ خوب باید هم زیبا به‌نظر برسد، هم ساده و طبیعی کار کند؛ از اولین برخورد تا آخرین تعامل.
          </p>

          <ul className="studio-values mt-8">
            {STUDIO_VALUES.map((value) => (
              <li key={value.number} className="studio-values__item">
                <span className="studio-values__number" dir="ltr">{value.number}</span>
                <div className="studio-values__copy">
                  <h3>{value.title}</h3>
                  <p>{value.text}</p>
                </div>
                <ArrowUpLeft className="studio-values__arrow h-4 w-4" aria-hidden="true" />
              </li>
            ))}
          </ul>

          <a href="#contact" className="studio-link mt-7 inline-flex items-center gap-2">
            <span>آشنایی را شروع کنیم</span>
            <ArrowUpLeft className="h-4 w-4 transition-transform duration-300" aria-hidden="true" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
