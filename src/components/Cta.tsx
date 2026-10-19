import { ArrowUpLeft } from "lucide-react";
import { CONTACT, SOCIAL_CHANNELS } from "../data";
import { Magnetic, Reveal } from "./ui";

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

            <div className="cta__social">
              {SOCIAL_CHANNELS.map((channel) => (
                <a
                  key={channel.platform}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={channel.name}
                >
                  <img src={channel.image} alt="" width={16} height={16} loading="lazy" decoding="async" />
                  <span>{channel.platform}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
