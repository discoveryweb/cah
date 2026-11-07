import type { CSSProperties } from "react";
import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { renderRichText } from "../content/RichText";
import { socialIcon } from "../content/socialIcons";
import { Magnetic, Numeral, Reveal } from "./ui";
import { ParticleMorph } from "./ParticleMorph";

export function Cta({ onOrder }: { onOrder: () => void }) {
  const content = useContent();
  const { contact, socials, contactSection } = content;
  const SOCIAL_IMAGES = socials.map((channel) => socialIcon(channel.icon));
  const SOCIAL_LABELS = socials.map((channel) => channel.platform);
  const SOCIAL_COLORS = socials.map((channel) => channel.color);

  return (
    <section id="contact" className="cta" aria-labelledby="cta-title">
      <div className="frame">
        <Reveal className="cta__top" as="header">
          <span className="cta__avail">
            <i aria-hidden="true" />
            {contactSection.availability}
          </span>
          <span className="cta__index" dir="ltr">
            <Numeral value={5} className="numeral--section" />
            <span aria-hidden="true">—</span> CONTACT / START A PROJECT
          </span>
        </Reveal>

        <div className="cta__hero">
          <Reveal variant="mask">
            <h2 className="cta__headline" id="cta-title">
              {renderRichText(contactSection.headline)}
            </h2>
          </Reveal>

          <a
            className="cta__seal-wrap"
            href={`mailto:${contact.email}`}
            aria-label={`ایمیل به ${contact.email}`}
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
            <p className="cta__lead-text">{contactSection.lead}</p>

            <div className="cta__actions">
              <Magnetic strength={12}>
                <button type="button" className="cta__button" onClick={onOrder} data-cursor="hover">
                  <span>{contactSection.ctaLabel}</span>
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
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </dd>
              </div>
              <div>
                <dt>{contactSection.telegramLabel}</dt>
                <dd>
                  <a
                    href={socials[0]?.href ?? "#contact"}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                  >
                    {contact.handle}
                  </a>
                </dd>
              </div>
              <div>
                <dt>{contactSection.responseLabel}</dt>
                <dd>{contact.responseTime}</dd>
              </div>
            </dl>
          </div>
        </div>

        <Reveal className="cta__social-panel" delay={140}>
          <div className="cta__social-copy">
            <span className="cta__social-eyebrow" dir="ltr">
              {contactSection.socialEyebrow}
            </span>
            <h3 className="cta__social-title">
              {contactSection.socialTitle}
              <br />
              <em>{contactSection.socialTitleAccent}</em>
            </h3>
            <p className="cta__social-text">{contactSection.socialText}</p>

            <ul className="cta__channels" aria-label="شبکه‌های اجتماعی CAHEN">
              {socials.map((channel) => (
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
                        src={socialIcon(channel.icon)}
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
