import { ArrowUp, ArrowUpLeft } from "lucide-react";
import { CONTACT, NAV_LINKS, SOCIAL_CHANNELS } from "../data";
import { Brand } from "./ui";
import { TehranClock } from "./SiteChrome";

export function Footer() {
  const year = new Date().getFullYear();
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="footer chapter theme-ink" data-invert>
      <div className="frame">
        <div className="footer__grid">
          <div className="footer__brand">
            <a href="#home" className="brand" aria-label="CAHEN — بازگشت به ابتدای صفحه">
              <Brand sub="DESIGN & CODE" />
            </a>
            <p className="footer__statement">
              استودیوی مستقل طراحی و توسعهٔ دیجیتال. برندها و محصولاتی می‌سازیم که در اولین نگاه،
              خودشان را نشان می‌دهند.
            </p>
            <div>
              <TehranClock className="footer__clock" short />
              <p className="footer__clock-note">
                TEHRAN — LOCAL TIME / OPEN FOR WORK
              </p>
            </div>
          </div>

          <nav aria-label="پیوندهای پابرگ">
            <span className="footer__col-label" dir="ltr">
              SITEMAP
            </span>
            <div className="footer__links">
              {NAV_LINKS.map((link) => (
                <a key={link.id} href={`#${link.id}`} className="footer__link">
                  {link.label}
                  <span className="footer__link-line" aria-hidden="true" />
                </a>
              ))}
            </div>
          </nav>

          <div>
            <span className="footer__col-label" dir="ltr">
              ELSEWHERE
            </span>
            <div className="footer__links">
              {SOCIAL_CHANNELS.map((channel) => (
                <a
                  key={channel.platform}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__link"
                >
                  <img src={channel.image} alt="" width={16} height={16} loading="lazy" decoding="async" />
                  {channel.name}
                  <ArrowUpLeft aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <span className="footer__col-label" dir="ltr">
              DIRECT
            </span>
            <div className="footer__links">
              <a href={`mailto:${CONTACT.email}`} className="footer__link">
                {CONTACT.email}
              </a>
              <span className="footer__link footer__link--static">{CONTACT.city}</span>
              <span className="footer__link footer__link--static">
                {CONTACT.latinCity}
              </span>
            </div>
          </div>
        </div>

        <div className="footer__wordmark" aria-hidden="true">
          <span dir="ltr">CAHEN</span>
        </div>

        <div className="footer__bottom">
          <div className="footer__bottom-group">
            <span dir="ltr">© {year} CAHEN STUDIO</span>
            <span>همهٔ حقوق محفوظ است.</span>
          </div>
          <div className="footer__bottom-group">
            <span dir="ltr">DESIGNED &amp; BUILT IN-HOUSE</span>
            <button type="button" onClick={scrollTop}>
              <span>بازگشت به بالا</span>
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
