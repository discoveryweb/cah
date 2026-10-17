import { ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { NAV_LINKS } from "../data";
import { LogoMark } from "./ui";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        <div className="site-footer__top">
          <a href="#home" className="footer-brand" aria-label="CAHEN — بازگشت به بالای صفحه">
            <LogoMark className="h-9 w-11" />
            <span className="flex flex-col gap-0.5">
              <span className="wordmark" dir="ltr">CAHEN</span>
              <span className="brand-caption" dir="ltr">DIGITAL STUDIO</span>
            </span>
          </a>

          <p className="site-footer__statement">طراحی با فکر. ساختن با معنا.</p>

          <a href="#home" className="back-to-top">
            بازگشت به بالا
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="site-footer__bottom">
          <p dir="ltr">© {new Date().getFullYear()} CAHEN STUDIO</p>
          <nav aria-label="پیوندهای پابرگ">
            <ul className="site-footer__links">
              {NAV_LINKS.filter((link) => ["projects", "services", "about", "contact"].includes(link.id)).map((link) => (
                <li key={link.id}><a href={link.href}>{link.label}</a></li>
              ))}
            </ul>
          </nav>
          <p className="site-footer__signature" dir="ltr">BUILT WITH INTENTION <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden="true" /></p>
        </div>
      </div>
    </footer>
  );
}
