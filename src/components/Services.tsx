import { useState } from "react";
import { ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { renderRichText } from "../content/RichText";
import { cn } from "../utils/cn";
import { Numeral, Reveal, SectionHead } from "./ui";
import { toRoman } from "../utils/roman";

export function Services({ onOrder }: { onOrder: (service?: string) => void }) {
  const [open, setOpen] = useState<number | null>(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const content = useContent();
  const services = content.services;

  return (
    <section
      id="services"
      className="chapter theme-paper services section"
      aria-labelledby="services-title"
    >
      <div className="frame">
        <SectionHead
          index="III"
          label="توانمندی‌ها"
          latin="Capabilities"
          id="services-title"
          title={renderRichText(services.title)}
          note={services.note}
        />

        <Reveal className="services__list" delay={80}>
          {services.items.map((service, index) => {
            const isOpen = open === index;
            const number = String(index + 1).padStart(2, "0");
            return (
              <div
                key={`${index}-${service.title}`}
                className={cn("service", isOpen && "service--open")}
                onPointerEnter={() => setHovered(index)}
                onPointerLeave={() => setHovered(null)}
              >
                <h3>
                  <button
                    type="button"
                    className="service__trigger"
                    aria-expanded={isOpen}
                    aria-controls={`service-panel-${index}`}
                    id={`service-trigger-${index}`}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    <Numeral value={number} className="service__num" />
                    <span className="service__name">
                      <strong>{service.title}</strong>
                      <span dir="ltr">{service.latin}</span>
                    </span>
                    <span
                      className={cn(
                        "service__toggle",
                        hovered === index && !isOpen && "service__toggle--hot"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                <div
                  className="service__panel"
                  id={`service-panel-${index}`}
                  role="region"
                  aria-labelledby={`service-trigger-${index}`}
                  aria-hidden={!isOpen}
                >
                  <div className="service__panel-inner">
                    <div className="service__content">
                      <span className="service__watermark" aria-hidden="true" dir="ltr">
                        {toRoman(number)}
                      </span>
                      <div className="service__lede">
                        <p className="service__desc">{service.text}</p>
                        <button
                          type="button"
                          className="service__cta"
                          tabIndex={isOpen ? 0 : -1}
                          onClick={() => onOrder(service.option)}
                          data-cursor="hover"
                        >
                          <span>{services.ctaLabel}</span>
                          <ArrowUpLeft aria-hidden="true" />
                        </button>
                      </div>
                      <div className="service__meta">
                        <span className="service__meta-label">
                          <span dir="ltr">DELIVERABLES</span>
                        </span>
                        <ul className="service__deliverables">
                          {service.deliverables.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>

                        <dl className="service__facts">
                          <div>
                            <dt>زمان تقریبی</dt>
                            <dd>{service.duration}</dd>
                          </div>
                          <div>
                            <dt>مناسب برای</dt>
                            <dd>{service.suited}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>

        <Reveal className="services__foot" delay={120}>
          <p>{services.foot}</p>
          <button
            type="button"
            className="link-arrow"
            onClick={() => onOrder()}
            data-cursor="hover"
          >
            <span>با ما دربارهٔ پروژه‌تان حرف بزنید</span>
            <ArrowUpLeft aria-hidden="true" />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
