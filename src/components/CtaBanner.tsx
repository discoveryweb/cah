import { ArrowUpLeft, ArrowUpRight, MessagesSquare } from "lucide-react";
import ctaImage from "../assets/cta.jpg";
import instagramImage from "../assets/social/instagram.svg";
import telegramImage from "../assets/social/telegram.svg";
import whatsappImage from "../assets/social/whatsapp.svg";
import { ParticleMorph } from "./ParticleMorph";
import { Reveal } from "./ui";

const SOCIAL_CHANNELS = [
  { name: "تلگرام", platform: "Telegram", href: "https://t.me/", image: telegramImage, color: "#26A5E4" },
  { name: "اینستاگرام", platform: "Instagram", href: "https://www.instagram.com/", image: instagramImage, color: "#E4405F" },
  { name: "واتساپ", platform: "WhatsApp", href: "https://www.whatsapp.com/", image: whatsappImage, color: "#25D366" },
] as const;

const SOCIAL_IMAGES = SOCIAL_CHANNELS.map((channel) => channel.image);
const SOCIAL_LABELS = SOCIAL_CHANNELS.map((channel) => channel.platform);
const SOCIAL_COLORS = SOCIAL_CHANNELS.map((channel) => channel.color);

export function CtaBanner({ onOrder }: { onOrder: () => void }) {
  return (
    <section id="contact" className="section-anchor section-space section-space--cta relative">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <Reveal>
          <div className="contact-card">
            <div className="contact-card__art" aria-hidden="true">
              <img src={ctaImage} alt="" loading="lazy" width={1536} height={1024} />
              <div className="contact-card__art-wash" />
              <div className="contact-card__orbit contact-card__orbit--one" />
              <div className="contact-card__orbit contact-card__orbit--two" />
            </div>

            <div className="contact-card__content">
              <div className="contact-card__eyebrow">
                <MessagesSquare className="h-4 w-4" aria-hidden="true" />
                <span>یک ایدهٔ تازه دارید؟</span>
              </div>
              <h2 className="contact-card__title">بیایید به آن<br className="hidden sm:block" /> شکل بدهیم.</h2>
              <p className="contact-card__text">از اولین گفت‌وگو تا جزئیات نهایی، کنار هم پیش می‌رویم.</p>
            </div>

            <button type="button" onClick={onOrder} className="contact-card__button">
              شروع یک گفت‌وگو
              <ArrowUpLeft className="h-4 w-4 transition-transform duration-300" aria-hidden="true" />
            </button>
            <span className="contact-card__index" dir="ltr" aria-hidden="true">LET’S MAKE IT MATTER / 1</span>
          </div>
        </Reveal>

        <Reveal delay={110}>
          <div className="contact-social-panel mt-5">
            <div className="contact-social-panel__copy">
              <span className="contact-social-panel__eyebrow" dir="ltr">CAHEN / SOCIAL CHANNELS</span>
              <h3>جایی که راحت‌ترید،<br /><span className="text-grad">پیدایمان کنید.</span></h3>
              <p>برای دنبال‌کردن خبرها و گفت‌وگو، یکی از مسیرهای زیر را انتخاب کنید.</p>

              <ul className="contact-social-links" aria-label="شبکه‌های اجتماعی CAHEN">
                {SOCIAL_CHANNELS.map((channel) => (
                  <li key={channel.platform}>
                    <a
                      href={channel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`بازکردن ${channel.name} در زبانهٔ جدید`}
                      className={`contact-social-link contact-social-link--${channel.platform.toLowerCase()}`}
                    >
                      <img src={channel.image} alt="" width={22} height={22} loading="lazy" decoding="async" />
                      <span>{channel.name}</span>
                      <ArrowUpRight className="contact-social-link__arrow h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="contact-social-panel__visual">
              <ParticleMorph
                images={SOCIAL_IMAGES}
                labels={SOCIAL_LABELS}
                layout={{ width: 380, height: 264, maxWidth: 410, logoScale: 0.68 }}
                particleDensity={0.68}
                particleSize={2.15}
                colors={SOCIAL_COLORS}
                transitionDuration={1450}
                interval={3650}
                dispersion={17}
                glow={0.38}
                pointerStrength={0.42}
                className="contact-social-morph"
              />
              <span className="contact-social-panel__caption" dir="ltr">ONE TEAM · THREE WAYS TO CONNECT</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
