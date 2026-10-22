import type { CSSProperties } from "react";
import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { CONTACT, SOCIAL_CHANNELS } from "../data";
import { Magnetic, Reveal } from "./ui";
import { ParticleMorph } from "./ParticleMorph";

const SOCIAL_IMAGES = SOCIAL_CHANNELS.map((channel) => channel.image);
const SOCIAL_LABELS = SOCIAL_CHANNELS.map((channel) => channel.platform);
const SOCIAL_COLORS = SOCIAL_CHANNELS.map((channel) => channel.color);

export function Cta({ onOrder }: { onOrder: () => void }) {
  return (
    <section id="contact" className="cta" aria-labelledby="cta-title">
      <div className="frame">
        <Reveal className="cta__top" as="header">
          <span className="cta__avail">
            <i aria-hidden="true" />
            ظرفیت محدود برای همکاری در فصل جدید
          </span>
          <span dir="ltr">06 — CONTACT / START A PROJECT</span>
        </Reveal>

        <div className="cta__hero">
          <Reveal variant="mask">
            <h2 className="cta__headline" id="cta-title">
              بیایید چیزی بسازیم که <span className="accent">دیده شود.</span>
            </h2>
          </Reveal>

          <a
            className="cta__seal-wrap"
            href={`mailto:${CONTACT.email}`}
            aria-label={`ایمیل به ${CONTACT.email}`}
            data-cursor="hover"
          >
            <svg className="cta__seal" viewBox="0 0 140 140" aria-hidden="true">
              <defs>
                <path
                  id="cta-seal-path"
                  d="M70,70 m-52,0 a52,52 0 1,1 104,0 a52,52 0 1,1 -104,0"
                  fill="none"
                />
              </defs>
              <text>
                <textPath href="#cta-seal-path">
                  LET&apos;S TALK — CAHEN STUDIO — LET&apos;S TALK — CAHEN STUDIO —
                </textPath>
              </text>
              <circle cx="70" cy="70" r="3.4" />
              <path
                d="M70 52 L70 88 M52 70 L88 70"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                opacity="0.4"
              />
            </svg>
          </a>
        </div>

        <div className="cta__under">
          <div className="cta__lead">
            <p className="cta__lead-text">
              هر همکاری با یک پیام کوتاه شروع می‌شود. بنویسید چه می‌سازید، در چه مرحله‌ای هستید و چه
              چیزی باید تغییر کند؛ بقیهٔ مسیر را با هم می‌چینیم.
            </p>

            <div className="cta__actions">
              <Magnetic strength={12}>
                <button type="button" className="cta__button" onClick={onOrder} data-cursor="hover">
                  <span>شروع گفت‌وگو</span>
                  <ArrowUpLeft aria-hidden="true" />
                </button>
              </Magnetic>
            </div>
          </div>

          <div className="cta__details">
            <dl className="cta__meta">
              <div>
                <dt>ایمیل</dt>
                <dd>
                  <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                </dd>
              </div>
              <div>
                <dt>تلگرام</dt>
                <dd>
                  <a href={SOCIAL_CHANNELS[0].href} target="_blank" rel="noopener noreferrer" dir="ltr">
                    {CONTACT.handle}
                  </a>
                </dd>
              </div>
              <div>
                <dt>پاسخ‌گویی</dt>
                <dd>کمتر از یک روز کاری</dd>
              </div>
            </dl>
          </div>
        </div>

        <Reveal className="cta__social-panel" delay={140}>
          <div className="cta__social-copy">
            <span className="cta__social-eyebrow" dir="ltr">
              CAHEN / SOCIAL CHANNELS
            </span>
            <h3 className="cta__social-title">
              جایی که راحت‌ترید،
              <br />
              <em>پیدایمان کنید.</em>
            </h3>
            <p className="cta__social-text">
              سه مسیر، یک تیم. هر کدام را که انتخاب کنید، همان آدم‌هایی پاسخ می‌دهند که پروژه را
              می‌سازند.
            </p>

            <ul className="cta__channels" aria-label="شبکه‌های اجتماعی CAHEN">
              {SOCIAL_CHANNELS.map((channel) => (
                <li key={channel.platform}>
                  <a
                    href={channel.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`بازکردن ${channel.name} در زبانهٔ جدید`}
                    className={`cta__channel cta__channel--${channel.platform.toLowerCase()}`}
                    style={{ "--channel": channel.color } as CSSProperties}
                  >
                    <span className="cta__channel-icon">
                      <img
                        src={channel.image}
                        alt=""
                        width={20}
                        height={20}
                        loading="lazy"
                        decoding="async"
                      />
                    </span>
                    <span className="cta__channel-copy">
                      <span className="cta__channel-name">{channel.name}</span>
                      <span className="cta__channel-platform" dir="ltr">
                        {channel.platform}
                      </span>
                    </span>
                    <ArrowUpRight className="cta__channel-arrow" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="cta__social-visual">
            <ParticleMorph
              images={SOCIAL_IMAGES}
              labels={SOCIAL_LABELS}
              layout={{ width: 420, height: 300, maxWidth: 460, logoScale: 0.62 }}
              particleDensity={0.72}
              particleSize={2.2}
              colors={SOCIAL_COLORS}
              transitionDuration={1450}
              interval={3600}
              dispersion={18}
              glow={0.45}
              pointerStrength={0.45}
              className="cta__morph"
            />
            <span className="cta__social-caption" dir="ltr">
              ONE TEAM · THREE WAYS TO CONNECT
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
