import { ArrowUpLeft, Code2, Compass, PanelsTopLeft, Palette } from "lucide-react";
import { SERVICES } from "../data";
import { Reveal, SectionBadge } from "./ui";

const ICONS = { compass: Compass, panels: PanelsTopLeft, code: Code2, palette: Palette };

export function ServiceCard({
  icon,
  number,
  title,
  text,
  onSelect,
}: {
  icon: keyof typeof ICONS;
  number: string;
  title: string;
  text: string;
  onSelect: () => void;
}) {
  const Icon = ICONS[icon];

  return (
    <article className="service-card group relative flex h-full flex-col overflow-hidden rounded-[24px] p-6 sm:p-7">
      <div className="service-card__top flex items-start justify-between">
        <span className="service-card__index" dir="ltr">{number} / {SERVICES.length}</span>
        <span className="service-card__icon" aria-hidden="true">
          <Icon className="h-[21px] w-[21px]" strokeWidth={1.55} />
        </span>
      </div>
      <h3 className="service-card__title mt-7">{title}</h3>
      <p className="service-card__description mt-2">{text}</p>
      <button
        type="button"
        onClick={onSelect}
        aria-label={`دربارهٔ ${title} گفت‌وگو کنیم`}
        className="service-card__action mt-7 inline-flex items-center gap-2 self-start"
      >
        <span>گفت‌وگو دربارهٔ این خدمت</span>
        <ArrowUpLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
      </button>
      <span className="service-card__glow" aria-hidden="true" />
    </article>
  );
}

export function Services({ onOrder }: { onOrder: (service?: string) => void }) {
  return (
    <section id="services" className="section-anchor section-space section-tint relative">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal className="section-heading flex flex-col gap-5 sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionBadge>آنچه کنار هم می‌سازیم</SectionBadge>
            <h2 className="section-title mt-4">
              از تصویر بزرگ، <span className="text-grad">تا پیکسل آخر.</span>
            </h2>
          </div>
          <p className="section-intro max-w-md lg:pb-1">
            مجموعه‌ای از تخصص‌ها که در کنار هم، حضوری دیجیتال با شخصیت و عملکرد می‌سازند.
          </p>
        </Reveal>

        <ul className="service-grid mt-8 grid grid-cols-1 gap-3 min-[540px]:grid-cols-2 lg:mt-11 lg:grid-cols-4 lg:gap-4">
          {SERVICES.map((service, index) => (
            <li key={service.number}>
              <Reveal delay={index * 65} className="h-full">
                <ServiceCard {...service} onSelect={() => onOrder(service.option)} />
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
