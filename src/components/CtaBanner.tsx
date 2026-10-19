import { ArrowUpLeft, ArrowUpRight, MessagesSquare } from "lucide-react";
import ctaImage from "../assets/cta.jpg";
import { SOCIAL_CHANNELS } from "../data";
import { ParticleMorph } from "./ParticleMorph";
import { Reveal } from "./ui";

const SOCIAL_IMAGES = SOCIAL_CHANNELS.map((channel) => channel.image);
const SOCIAL_LABELS = SOCIAL_CHANNELS.map((channel) => channel.platform);
const SOCIAL_COLORS = SOCIAL_CHANNELS.map((channel) => channel.color);

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <section id="contact" className="section contact">
      <div className="container">
        <Reveal>
          <div className="cta">
            <div className="cta__art" aria-hidden="true">
              <img src={ctaImage} alt="" loading="lazy" width={1536} height={1024} />
              <div className="cta__art-wash" />
              <div className="cta__orbit cta__orbit--one" />
              <div className="cta__orbit cta__orbit--two" />
            </div>

            <div className="cta__content">
              <span className="cta__eyebrow">
                <MessagesSquare aria-hidden="true" />
                یک ایدهٔ تازه دارید؟
              </span>
              <h2 className="cta__title">
                بیایید به آن
                <br />
                <span>شکل بدهیم.</span>
              </h2>
              <p className="cta__text">
                از اولین گفت‌وگو تا جزئیات نهایی، کنار هم پیش می‌رویم. کافی است شروع کنیم.
              </p>

              <div className="cta__actions">
                <button type="button" onClick={onOrder} className="btn cta__primary">
                  شروع یک گفت‌وگو
                  <ArrowUpLeft aria-hidden="true" />
                </button>
                <a href="#projects" className="btn cta__secondary">
                  مشاهدهٔ پروژه‌ها
                  <ArrowUpRight aria-hidden="true" />
                </a>
              </div>
            </div>

            <span className="cta__index" dir="ltr" aria-hidden="true">
              LET’S MAKE IT MATTER / 01
            </span>
          </div>
        </Reveal>

        <Reveal delay={110}>
          <div className="social-panel">
            <div className="social-panel__copy">
              <span className="social-panel__eyebrow" dir="ltr">
                CAHEN / SOCIAL CHANNELS
              </span>
              <h3 className="social-panel__title">
                جایی که راحت‌ترید،
                <br />
                <span className="text-grad">پیدایمان کنید.</span>
              </h3>
              <p className="social-panel__text">
                برای دنبال‌کردن خبرها و گفت‌وگو، یکی از مسیرهای زیر را انتخاب کنید.
              </p>

              <ul className="social-list" aria-label="شبکه‌های اجتماعی CAHEN">
                {SOCIAL_CHANNELS.map((channel) => (
                  <li key={channel.platform}>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`بازکردن ${channel.name} در زبانهٔ جدید`}
                      className={`social-link social-link--${channel.platform.toLowerCase()}`}
                    >
                      <span className="social-link__icon">
                        <img src={channel.image} alt="" width={20} height={20} loading="lazy" decoding="async" />
                      </span>
                      <span className="social-link__body">
                        <span className="social-link__name">{channel.name}</span>
                        <span className="social-link__platform" dir="ltr">
                          {channel.platform}
                        </span>
                      </span>
                      <ArrowUpRight className="social-link__arrow" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="social-panel__visual">
              <ParticleMorph
                images={SOCIAL_IMAGES}
                labels={SOCIAL_LABELS}
                layout={{ width: 420, height: 300, maxWidth: 460, logoScale: 0.7 }}
                particleDensity={0.68}
                particleSize={2.15}
                colors={SOCIAL_COLORS}
                transitionDuration={1450}
                interval={3650}
                dispersion={17}
                glow={0.38}
                pointerStrength={0.42}
                className="social-panel__morph"
              />
              <span className="social-panel__caption" dir="ltr">
                ONE TEAM · THREE WAYS TO CONNECT
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
