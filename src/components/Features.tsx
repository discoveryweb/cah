import { Fingerprint, Gauge, Layers, Target } from "lucide-react";
import { FEATURES } from "../data";
import { useSpotlight } from "../utils/spotlight";
import { Reveal } from "./ui";

const ICONS = { target: Target, layers: Layers, fingerprint: Fingerprint, gauge: Gauge };

function Principle({ icon, number, title, text }: { icon: keyof typeof ICONS; number: string; title: string; text: string }) {
  const Icon = ICONS[icon];
  const ref = useSpotlight<HTMLLIElement>();

  return (
    <li ref={ref} className="principle spotlight">
      <div className="principle__head">
        <span className="principle__icon" aria-hidden="true">
          <Icon strokeWidth={1.6} />
        </span>
        <span className="principle__num" dir="ltr" aria-hidden="true">
          {number.padStart(2, "0")}
        </span>
      </div>
      <h3 className="principle__title">{title}</h3>
      <p className="principle__text">{text}</p>
    </li>
  );
}

export function Features() {
  return (
    <section className="principles" aria-label="اصول طراحی CAHEN">
      <div className="container">
        <Reveal className="principles__panel">
          <div className="principles__meta" dir="ltr" aria-hidden="true">
            <span className="principles__meta-group">
              CAHEN <i /> PRINCIPLES
            </span>
            <span className="principles__meta-group">FOUR THINGS WE OPTIMIZE FOR</span>
          </div>
          <ul className="principles__list">
            {FEATURES.map((feature) => (
              <Principle key={feature.number} {...feature} />
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
