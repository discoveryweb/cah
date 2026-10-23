import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowUpLeft, Search, X } from "lucide-react";
import { useContent } from "../content/ContentProvider";
import { socialIcon } from "../content/socialIcons";
import { useActiveSection, useInvertAt } from "../hooks/useActiveSection";
import cahenMark from "../assets/cahen-mark.webp";
import { cn } from "../utils/cn";
import { SITE_MENU_EVENT } from "../utils/bus";
import { haptic } from "../utils/haptics";
import { onScrollFrame } from "../utils/scrollFrame";
import { Brand, Numeral } from "./ui";

const SEARCH_INDEX = [
  { keys: ["کار", "پروژه", "نمونه", "soma", "orbit", "aura", "پرتفولیو"], id: "work" },
  { keys: ["خدمت", "توانمندی", "طراحی", "توسعه", "برند", "هویت", "محصول"], id: "services" },
  { keys: ["استودیو", "درباره", "تیم", "cahen", "کاهن", "ما"], id: "studio" },
  { keys: ["تماس", "همکاری", "پروژه", "مشاوره", "contact", "ایمیل"], id: "contact" },
];

export function Header({ onOrder, ready }: { onOrder: () => void; ready: boolean }) {
  const content = useContent();
  const { contact, nav: NAV_LINKS, socials: SOCIAL_CHANNELS } = content;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const lastScroll = useRef(0);
  const active = useActiveSection();
  const invert = useInvertAt("top");

  useEffect(() => {
    const update = (y: number) => {
      setScrolled(y > 16);
      const delta = y - lastScroll.current;
      if (y > 520 && delta > 6 && !menuOpen && !searchOpen) setHidden(true);
      else if (delta < -4 || y < 320) setHidden(false);
      lastScroll.current = y;
    };
    return onScrollFrame(update);
  }, [menuOpen, searchOpen]);

  // The phone dock opens this menu from outside the header.
  useEffect(() => {
    const open = () => setMenuOpen(true);
    window.addEventListener(SITE_MENU_EVENT, open);
    return () => window.removeEventListener(SITE_MENU_EVENT, open);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      const timer = window.setTimeout(() => searchRef.current?.focus(), 120);
      return () => window.clearTimeout(timer);
    }
    setQuery("");
    setNotFound(false);
  }, [searchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>(".menu__link")?.focus();
    }, 90);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const goTo = (id: string) => {
    setSearchOpen(false);
    setMenuOpen(false);
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim().toLowerCase();
    if (!text) return;
    const match = SEARCH_INDEX.find((entry) => entry.keys.some((key) => text.includes(key)));
    if (!match) {
      setNotFound(true);
      return;
    }
    goTo(match.id);
  };

  return (
    <>
      <header
        className={cn(
          "header",
          scrolled && "header--solid",
          hidden && "header--hidden",
          invert && "header--invert",
          ready && "header--ready"
        )}
      >
        <div className="frame header__inner">
          <a href="#home" className="brand" aria-label="CAHEN — بازگشت به ابتدای صفحه">
            <Brand />
          </a>

          <nav className="nav" aria-label="ناوبری اصلی">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={cn("nav__link", active === link.id && "nav__link--active")}
                aria-current={active === link.id ? "location" : undefined}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="header__side">
            <button
              type="button"
              className="header__search"
              onClick={() => setSearchOpen((value) => !value)}
              aria-label={searchOpen ? "بستن جست‌وجو" : "جست‌وجو در سایت"}
              aria-expanded={searchOpen}
              aria-controls="site-search"
            >
              <Search aria-hidden="true" />
            </button>
            <button type="button" className="header__cta" onClick={onOrder}>
              <span>شروع همکاری</span>
              <ArrowUpLeft aria-hidden="true" />
            </button>
            <button
              type="button"
              className="menu-btn"
              aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => {
                haptic("open");
                setMenuOpen((value) => !value);
              }}
            >
              <span className="menu-btn__lines" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
          </div>
        </div>
      </header>

      <section
        id="site-search"
        className={cn("search", searchOpen && "search--open")}
        aria-hidden={!searchOpen}
      >
        <div className="search__inner">
          <div className="search__body frame">
            <form className="search__form" role="search" onSubmit={submitSearch}>
              <Search aria-hidden="true" />
              <label htmlFor="site-search-input" className="sr-only">
                جست‌وجو در سایت
              </label>
              <input
                id="site-search-input"
                ref={searchRef}
                className="search__input"
                type="search"
                value={query}
                tabIndex={searchOpen ? 0 : -1}
                placeholder="در سایت جست‌وجو کنید…"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setNotFound(false);
                }}
              />
              <kbd className="search__kbd">⌘K</kbd>
              <button
                type="button"
                className="search__close"
                onClick={() => setSearchOpen(false)}
                tabIndex={searchOpen ? 0 : -1}
                aria-label="بستن جست‌وجو"
              >
                <X aria-hidden="true" />
              </button>
            </form>

            <div className="search__results">
              {NAV_LINKS.filter((link) => link.id !== "home").map((link) => (
                <button
                  key={link.id}
                  type="button"
                  className="search__result"
                  tabIndex={searchOpen ? 0 : -1}
                  onClick={() => goTo(link.id)}
                >
                  {link.label}
                </button>
              ))}
            </div>
            {notFound ? (
              <p className="search__hint" role="status">
                بخشی با این عبارت پیدا نشد؛ «کارها» یا «تماس» را امتحان کنید.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div
        id="site-menu"
        ref={menuRef}
        className={cn("menu", menuOpen && "menu--open")}
        role="dialog"
        aria-modal={menuOpen ? true : undefined}
        aria-label="منوی اصلی سایت"
        aria-hidden={!menuOpen}
      >
        <div className="menu__scroll">
          <div
            className="menu__inner frame"
            style={{ "--count": NAV_LINKS.length } as CSSProperties}
          >
            <div className="menu__top">
              <a
                href="#home"
                className="menu__brand"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
              >
                <img src={cahenMark} alt="" width={736} height={600} decoding="async" />
                <span className="menu__brand-type" dir="ltr">
                  CAHEN
                  <small>DIGITAL STUDIO</small>
                </span>
              </a>

              <div className="menu__top-meta">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <i aria-hidden="true" />
                  TEHRAN
                </span>
              </div>

              <button
                type="button"
                className="menu__close"
                onClick={() => {
                  haptic("tap");
                  setMenuOpen(false);
                }}
                tabIndex={menuOpen ? 0 : -1}
                aria-label="بستن منو"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <span className="menu__eyebrow" dir="ltr">
              INDEX — I / V
            </span>

            <nav aria-label="منوی اصلی" className="menu__list">
              {NAV_LINKS.map((link, index) => (
                <div
                  className="menu__item"
                  key={link.id}
                  style={{ "--i": index } as CSSProperties}
                >
                  <a
                    href={`#${link.id}`}
                    className={cn("menu__link", active === link.id && "menu__link--active")}
                    tabIndex={menuOpen ? 0 : -1}
                    aria-current={active === link.id ? "location" : undefined}
                    onClick={() => {
                      haptic("tap");
                      setMenuOpen(false);
                    }}
                  >
                    <Numeral value={index + 1} className="menu__num" />
                    <span className="menu__label">
                      {link.label}
                      <small dir="ltr">{link.latin}</small>
                    </span>
                    <ArrowUpLeft className="menu__arrow" aria-hidden="true" />
                  </a>
                </div>
              ))}
            </nav>

            <div className="menu__foot">
              <div>
                <div className="menu__elsewhere-head">
                  <span className="menu__eyebrow" dir="ltr">
                    ELSEWHERE
                  </span>
                  <span className="menu__handle" dir="ltr">
                    {contact.handle}
                  </span>
                </div>
                <div className="menu__socials">
                  {SOCIAL_CHANNELS.map((channel) => (
                    <a
                      key={channel.platform}
                      href={channel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="menu__social-link"
                      tabIndex={menuOpen ? 0 : -1}
                      aria-label={`${channel.name} — ${channel.platform} (در پنجرهٔ تازه)`}
                    >
                      <span className="menu__social-icon" aria-hidden="true">
                        <img
                          src={socialIcon(channel.icon)}
                          alt=""
                          width={20}
                          height={20}
                          loading="lazy"
                          decoding="async"
                        />
                      </span>
                      <span className="menu__social-copy">
                        <span className="menu__social-name">{channel.name}</span>
                        <em className="menu__social-platform" dir="ltr">
                          {channel.platform}
                        </em>
                      </span>
                      <ArrowUpLeft className="menu__social-arrow" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="menu__direct">
                <a href={`mailto:${contact.email}`} className="menu__mail" tabIndex={menuOpen ? 0 : -1} dir="ltr">
                  {contact.email}
                </a>
                <button
                  type="button"
                  className="menu__cta"
                  tabIndex={menuOpen ? 0 : -1}
                  onClick={() => {
                    setMenuOpen(false);
                    onOrder();
                  }}
                >
                  شروع یک پروژه
                  <ArrowUpLeft aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="menu__legal">
              <span dir="ltr">© 2026 CAHEN STUDIO</span>
              <span>طراحی و کد، درون استودیو</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
