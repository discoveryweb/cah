import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpLeft, Search, X } from "lucide-react";
import { CONTACT, NAV_LINKS, SOCIAL_CHANNELS } from "../data";
import { useActiveSection, useInvertAt } from "../hooks/useActiveSection";
import { cn } from "../utils/cn";
import { Brand } from "./ui";
import { TehranClock } from "./SiteChrome";

const SEARCH_INDEX = [
  { keys: ["کار", "پروژه", "نمونه", "soma", "orbit", "aura", "پرتفولیو"], id: "work" },
  { keys: ["خدمت", "توانمندی", "طراحی", "توسعه", "برند", "هویت", "محصول"], id: "services" },
  { keys: ["فرایند", "روش", "مراحل", "process", "پروسه"], id: "process" },
  { keys: ["استودیو", "درباره", "تیم", "cahen", "کاهن", "ما"], id: "studio" },
  { keys: ["تماس", "همکاری", "پروژه", "مشاوره", "contact", "ایمیل"], id: "contact" },
];

export function Header({ onOrder, ready }: { onOrder: () => void; ready: boolean }) {
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
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 16);
      const delta = y - lastScroll.current;
      if (y > 520 && delta > 6 && !menuOpen && !searchOpen) setHidden(true);
      else if (delta < -4 || y < 320) setHidden(false);
      lastScroll.current = y;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
    };
  }, [menuOpen, searchOpen]);

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
            <TehranClock className="header__clock" />
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
              onClick={() => setMenuOpen((value) => !value)}
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
        aria-hidden={!menuOpen}
      >
        <div className="menu__scroll">
          <div className="menu__inner frame">
            <div className="menu__top">
              <span dir="ltr">CAHEN / INDEX — ۲۰۲۶</span>
              <button
                type="button"
                className="menu__close"
                onClick={() => setMenuOpen(false)}
                tabIndex={menuOpen ? 0 : -1}
                aria-label="بستن منو"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="منوی اصلی" className="menu__list">
              {NAV_LINKS.map((link, index) => (
                <div className="menu__item" key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className="menu__link"
                    tabIndex={menuOpen ? 0 : -1}
                    aria-current={active === link.id ? "location" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className="menu__num" dir="ltr">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="menu__label">{link.label}</span>
                    <span className="menu__en" dir="ltr">
                      {link.latin}
                    </span>
                  </a>
                </div>
              ))}
            </nav>

            <div className="menu__foot">
              <div className="menu__foot-group">
                <span className="menu__foot-label" dir="ltr">
                  SOCIAL
                </span>
                <div className="menu__social">
                  {SOCIAL_CHANNELS.map((channel) => (
                    <a
                      key={channel.platform}
                      href={channel.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      tabIndex={menuOpen ? 0 : -1}
                    >
                      <img src={channel.image} alt="" width={16} height={16} loading="lazy" decoding="async" />
                      {channel.name}
                    </a>
                  ))}
                </div>
              </div>

              <div className="menu__foot-group">
                <span className="menu__foot-label" dir="ltr">
                  DIRECT
                </span>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="menu__mail"
                  tabIndex={menuOpen ? 0 : -1}
                  dir="ltr"
                >
                  {CONTACT.email}
                </a>
              </div>

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
        </div>
      </div>
    </>
  );
}
