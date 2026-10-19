import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { NAV_LINKS, SOCIAL_CHANNELS } from "../data";
import { LogoMark } from "./ui";

export function Footer() {
  const year = new Date().getFullYear();

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-brand">
            <a href="#home" className="brand" aria-label="CAHEN — بازگشت به بالای صفحه">
              <span className="brand__mark">
                <LogoMark />
              </span>
              <span className="brand__type">
                <span className="brand__word" dir="ltr">CAHEN</span>
                <span className="brand__sub" dir="ltr">DIGITAL STUDIO</span>
              </span>
            </a>
            <p className="footer-tagline">
              طراحی با فکر. ساختن با معنا.
              <br />
              تجربه‌های دیجیتال با امضای CAHEN.
            </p>
            <span className="footer-note" dir="ltr">
              TEHRAN — IRAN
            </span>
          </div>

          <nav aria-label="پیوندهای پابرگ">
            <span className="footer-nav__label" dir="ltr">NAVIGATION</span>
            <ul className="footer-nav__list">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a href={link.href} className="footer-nav__link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <span className="footer-social__label" dir="ltr">SOCIAL</span>
            <div className="footer-social__links">
              {SOCIAL_CHANNELS.map((channel) => (
                <a
                  key={channel.platform}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social__link"
                >
                  <img src={channel.image} alt="" width={16} height={16} loading="lazy" decoding="async" />
                  {channel.name}
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-wordmark" aria-hidden="true">
          CAHEN
        </div>

        <div className="footer-bottom">
          <div className="footer-bottom__group">
            <span className="num" dir="ltr">© {year} CAHEN STUDIO</span>
            <span className="footer-bottom__dot" aria-hidden="true" />
            <span>همهٔ حقوق محفوظ است.</span>
          </div>

          <div className="footer-bottom__group">
            <span className="num" dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              DESIGNED &amp; BUILT IN-HOUSE
              <ArrowUpLeft style={{ width: 12, height: 12, color: "#a98be7" }} aria-hidden="true" />
            </span>
          </div>

          <button type="button" onClick={scrollTop} className="footer-top-link">
            بازگشت به بالا
            <ArrowUpRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
