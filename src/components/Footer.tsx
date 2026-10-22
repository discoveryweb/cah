import { ArrowUp, ArrowUpLeft } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { socialIcon } from "../content/socialIcons";
import { Brand } from "./ui";
import { GravityLetters } from "./GravityLetters";

export function Footer() {
  const year = new Date().getFullYear();
  const content = useContent();
  const { contact, nav, socials, footer, meta } = content;
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="footer chapter theme-ink" data-invert>
      <div className="frame">
        <div className="footer__grid">
          <div className="footer__brand">
            <a href="#home" className="brand" aria-label={`${meta.brand} — بازگشت به ابتدای صفحه`}>
              <Brand sub="DESIGN & CODE" />
            </a>
            <p className="footer__statement">{footer.statement}</p>
          </div>

          <nav aria-label="پیوندهای پابرگ">
            <span className="footer__col-label" dir="ltr">
              {footer.sitemapLabel}
            </span>
            <div className="footer__links">
              {nav.map((link) => (
                <a key={link.id} href={`#${link.id}`} className="footer__link">
                  {link.label}
                  <span className="footer__link-line" aria-hidden="true" />
                </a>
              ))}
            </div>
          </nav>

          <div>
            <span className="footer__col-label" dir="ltr">
              {footer.elsewhereLabel}
            </span>
            <div className="footer__links">
              {socials.map((channel) => (
                <a
                  key={channel.platform}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__link"
                >
                  <img
                    src={socialIcon(channel.icon)}
                    alt=""
                    width={16}
                    height={16}
                    loading="lazy"
                    decoding="async"
                  />
                  {channel.name}
                  <ArrowUpLeft aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <span className="footer__col-label" dir="ltr">
              {footer.directLabel}
            </span>
            <div className="footer__links">
              <a href={`mailto:${contact.email}`} className="footer__link">
                {contact.email}
              </a>
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="footer__link" dir="ltr">
                  {contact.phone}
                </a>
              ) : null}
              <span className="footer__link footer__link--static">{contact.city}</span>
              <span className="footer__link footer__link--static" dir="ltr">
                {contact.latinCity}
              </span>
            </div>
          </div>
        </div>

        <div
          className="footer__wordmark"
          title="بکشید تا حروف بپاشند — کلیک کنید تا فرو بریزند"
        >
          <GravityLetters
            text="CAHEN"
            className="footer__gravity"
            fontSize={340}
            fontWeight={600}
            fontFamily='"JetBrains Mono Variable", ui-monospace, SFMono-Regular, monospace'
            colors={["#f6f4ff", "#b39dff"]}
            grainSize={4}
            grainScale={0.86}
            gravity={1}
            cut
            cutWidth={16}
            throwForce={1.05}
            clickToCollapse
            collapseSpeed={1500}
            holdTime={1.1}
            rebuild="sweep"
            rebuildDuration={0.85}
          />
        </div>

        <div className="footer__bottom">
          <div className="footer__bottom-group">
            <span dir="ltr">© {year} {meta.brand} STUDIO</span>
            <span>{footer.rights}</span>
          </div>
          <div className="footer__bottom-group">
            <span dir="ltr">{footer.credit}</span>
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
