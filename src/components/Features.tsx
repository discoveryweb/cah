import { Fingerprint, Gauge, Layers, Target } from "lucide-react";
import { FEATURES } from "../data";
import { Reveal } from "./ui";

const ICONS = { target: Target, layers: Layers, fingerprint: Fingerprint, gauge: Gauge };

export function FeatureItem({
  icon,
  number,
  title,
  text,
}: {
  icon: keyof typeof ICONS;
  number: string;
  title: string;
  text: string;
}) {
  const Icon = ICONS[icon];

  return (
    <div className="feature-item flex h-full items-center gap-4 sm:gap-5">
      <div className="feature-item__icon" aria-hidden="true">
        <Icon className="h-[19px] w-[19px]" strokeWidth={1.65} />
      </div>
      <div className="min-w-0">
        <div className="feature-item__eyebrow" dir="ltr">{number} / CAHEN</div>
        <h3 className="mt-1 text-sm font-semibold text-txt sm:text-[15px]">{title}</h3>
        <p className="mt-1 text-xs leading-6 text-muted sm:text-[13px]">{text}</p>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section aria-label="اصول طراحی CAHEN" className="feature-section relative z-10 px-5 pb-14 sm:px-8 lg:pb-24">
      <div className="feature-panel mx-auto max-w-[1280px]">
        <ul className="grid grid-cols-1 divide-y divide-white/[0.07] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x lg:divide-x-reverse lg:divide-white/[0.07]">
          {FEATURES.map((feature, index) => (
            <li key={feature.number} className="feature-cell">
              <Reveal delay={index * 70} className="h-full">
                <FeatureItem {...feature} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
