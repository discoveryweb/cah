import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpLeft, Search, X } from "lucide-react";
import { NAV_LINKS, SOCIAL_CHANNELS } from "../data";
import { cn } from "../utils/cn";
import { LogoMark } from "./ui";

const SEARCH_INDEX = [
  { keys: ["نمونه", "پروژه", "کار", "کانسپت"], id: "projects" },
  { keys: ["خدمات", "توانمندی", "طراحی", "توسعه", "برند", "تجربه"], id: "services" },
  { keys: ["روش", "رویکرد", "مراحل", "فرایند"], id: "approach" },
  { keys: ["درباره", "تیم", "cahen", "کاهن", "استودیو"], id: "about" },
  { keys: ["تماس", "همکاری", "مشاوره"], id: "contact" },
];

export function Header({ onOrder }: { onOrder: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const update = () => {
      frameRef.current = 0;
      setScrolled(window.scrollY > 12);
      const threshold = window.scrollY + 170;
      let current = "home";
      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (section && section.getBoundingClientRect().top + window.scrollY <= threshold) current = link.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) current = "contact";
      setActive(current);
    };

    const schedule = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) window.setTimeout(() => searchRef.current?.focus(), 60);
    else {
      setQuery("");
      setNotFound(false);
    }
  }, [searchOpen]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const goTo = (id: string) => {
    setMenuOpen(false);
    setSearchOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim().toLocaleLowerCase("fa");
    if (!value) return;

    const match = SEARCH_INDEX.find((section) => section.keys.some((key) => value.includes(key) || key.includes(value)));
    if (!match) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    goTo(match.id);
  };

  return (
    <>
      <header
        className={cn("site-header", scrolled && "site-header--scrolled", menuOpen && "site-header--open")}
      >
        <div className="header-inner container">
          <a href="#home" className="brand" aria-label="CAHEN — بازگشت به صفحهٔ اصلی" onClick={() => setMenuOpen(false)}>
            <span className="brand__mark">
              <LogoMark />
            </span>
            <span className="brand__type">
              <span className="brand__word" dir="ltr">CAHEN</span>
              <span className="brand__sub" dir="ltr">DIGITAL STUDIO</span>
            </span>
          </a>

          <nav aria-label="منوی اصلی" className="nav">
            <ul className="nav__list">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    aria-current={active === link.id ? "location" : undefined}
                    className={cn("nav__link", active === link.id && "nav__link--active")}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              onClick={() => setSearchOpen((value) => !value)}
              aria-label={searchOpen ? "بستن جست‌وجو" : "جست‌وجو در سایت"}
              aria-expanded={searchOpen}
              aria-controls="site-search-panel"
              className="icon-btn"
            >
              {searchOpen ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}
            </button>

            <button type="button" onClick={onOrder} className="btn btn--primary header-cta">
              شروع همکاری
              <ArrowUpLeft aria-hidden="true" />
            </button>

            <button
              type="button"
              className="icon-btn icon-btn--menu menu-btn"
              aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? (
                <X aria-hidden="true" />
              ) : (
                <span className="menu-btn__lines" aria-hidden="true">
                  <i />
                  <i />
                </span>
              )}
            </button>
          </div>
        </div>

        <div className={cn("search-wrap", searchOpen && "search-wrap--open")} aria-hidden={!searchOpen}>
          <div className="search-wrap__inner">
            <div className="container">
              <form id="site-search-panel" onSubmit={submitSearch} role="search" className="search-panel">
                <Search aria-hidden="true" />
                <label htmlFor="site-search" className="sr-only">جست‌وجو در سایت</label>
                <input
                  id="site-search"
                  ref={searchRef}
                  tabIndex={searchOpen ? 0 : -1}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setNotFound(false);
                  }}
                  placeholder="چه چیزی را جست‌وجو می‌کنید؟"
                  className="search-panel__input"
                />
                <kbd className="search-panel__kbd">⌘K</kbd>
                {notFound && <p role="status" className="search-hint">بخشی با این عبارت پیدا نشد؛ عبارت دیگری را امتحان کنید.</p>}
              </form>
              <div className="search-suggestions">
                {NAV_LINKS.slice(1).map((link) => (
                  <button key={link.id} type="button" tabIndex={searchOpen ? 0 : -1} onClick={() => goTo(link.id)}>
                    {link.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={cn("menu-sheet", menuOpen && "menu-sheet--open")}
        aria-hidden={!menuOpen}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMenuOpen(false);
        }}
      >
        <div className="menu-sheet__scroll">
          <div className="menu-sheet__panel">
            <div className="menu-sheet__label">
              <span>CAHEN / NAVIGATION</span>
              <span>MENU</span>
            </div>

            <nav aria-label="منوی موبایل" className="menu-sheet__list">
              <ul>
                {NAV_LINKS.map((link, index) => (
                  <li key={link.id} className="menu-sheet__item">
                    <a
                      href={link.href}
                      tabIndex={menuOpen ? 0 : -1}
                      aria-current={active === link.id ? "location" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={cn("menu-sheet__link", active === link.id && "menu-sheet__link--active")}
                    >
                      <span className="menu-sheet__index" dir="ltr">{String(index + 1).padStart(2, "0")}</span>
                      <span>{link.label}</span>
                      <ArrowUpLeft aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="menu-sheet__foot">
              <button
                type="button"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => {
                  setMenuOpen(false);
                  onOrder();
                }}
                className="btn btn--primary"
              >
                شروع همکاری
                <ArrowUpLeft aria-hidden="true" />
              </button>

              <div className="menu-sheet__social" aria-label="شبکه‌های اجتماعی CAHEN">
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

              <p className="menu-sheet__label" dir="ltr">
                <span>TEHRAN / IRAN</span>
                <span>CAHEN © {new Date().getFullYear()}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
