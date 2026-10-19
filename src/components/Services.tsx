import { ArrowUpLeft, Code2, Compass, PanelsTopLeft, Palette } from "lucide-react";
import { SERVICES } from "../data";
import { useSpotlight } from "../utils/spotlight";
import { Reveal, SectionBadge, SectionHead } from "./ui";

const ICONS = { compass: Compass, panels: PanelsTopLeft, code: Code2, palette: Palette };

function ServiceCard({
  icon,
  number,
  latin,
  title,
  text,
  onSelect,
}: {
  icon: keyof typeof ICONS;
  number: string;
  latin: string;
  title: string;
  text: string;
  onSelect: () => void;
}) {
  const Icon = ICONS[icon];
  const ref = useSpotlight<HTMLElement>();

  return (
    <article ref={ref} className="service spotlight">
      <div className="service__top">
        <span className="service__icon" aria-hidden="true">
          <Icon strokeWidth={1.6} />
        </span>
        <span className="service__index" dir="ltr" aria-hidden="true">
          {number.padStart(2, "0")} / 04
        </span>
      </div>

      <span className="service__latin" dir="ltr">
        {latin}
      </span>
      <h3 className="service__title">{title}</h3>
      <p className="service__text">{text}</p>

      <button type="button" onClick={onSelect} className="service__action">
        <span>گفت‌وگو دربارهٔ این خدمت</span>
        <ArrowUpLeft aria-hidden="true" />
      </button>

      <span className="service__glow" aria-hidden="true" />
    </article>
  );
}

export function Services({ onOrder }: { onOrder: (service?: string) => void }) {
  return (
    <section id="services" className="section section--tint services">
      <div className="container">
        <Reveal>
          <SectionHead
            badge="آنچه کنار هم می‌سازیم"
            index="02"
            title={
              <>
                از تصویر بزرگ، <span className="text-grad">تا پیکسل آخر.</span>
              </>
            }
            intro="مجموعه‌ای از تخصص‌ها که در کنار هم، حضوری دیجیتال با شخصیت و عملکرد می‌سازند."
          />
        </Reveal>

        <ul className="service-grid">
          {SERVICES.map((service, index) => (
            <li key={service.number}>
              <Reveal delay={index * 70} className="h-full">
                <ServiceCard {...service} onSelect={() => onOrder(service.option)} />
              </Reveal>
            </li>
          ))}
        </ul>

        <Reveal delay={120} className="services__foot">
          <p className="services__foot-note">هر پروژه، ترکیبی متفاوت از این توانمندی‌هاست.</p>
          <SectionBadge className="!border-white/[0.08] !bg-white/[0.02] !text-[#a9a4bd]">
            یک تیم، یک مسیر، یک نتیجه
          </SectionBadge>
        </Reveal>
      </div>
    </section>
  );
}
