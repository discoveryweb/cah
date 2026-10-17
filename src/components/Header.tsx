import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpLeft, Menu, Search, SquareArrowOutUpRight, X } from "lucide-react";
import { NAV_LINKS } from "../data";
import { cn } from "../utils/cn";
import { LogoMark } from "./ui";

const SEARCH_INDEX = [
  { keys: ["نمونه", "پروژه", "کار", "کانسپت"], id: "projects" },
  { keys: ["خدمات", "توانمندی", "طراحی", "توسعه", "برند", "تجربه"], id: "services" },
  { keys: ["روش", "رویکرد", "مراحل", "فرایند"], id: "approach" },
  { keys: ["درباره", "تیم", "cahen", "کاهن"], id: "about" },
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

  useEffect(() => {
    const updateCurrentSection = () => {
      setScrolled(window.scrollY > 20);
      const threshold = window.scrollY + 150;
      let current = "home";

      for (const link of NAV_LINKS) {
        const section = document.getElementById(link.id);
        if (section && section.getBoundingClientRect().top + window.scrollY <= threshold) current = link.id;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) current = "contact";
      setActive(current);
    };

    updateCurrentSection();
    window.addEventListener("scroll", updateCurrentSection, { passive: true });
    window.addEventListener("resize", updateCurrentSection, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateCurrentSection);
      window.removeEventListener("resize", updateCurrentSection);
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
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

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
    setSearchOpen(false);
    setMenuOpen(false);
    setQuery("");
    document.getElementById(match.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={cn("site-header sticky top-0 z-40 transition-all duration-300", scrolled && "site-header--scrolled", menuOpen && "site-header--menu-open")}>
      <div className="site-header__inner mx-auto flex h-[76px] max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-8 lg:h-[88px]">
        <a href="#home" className="brand-lockup group flex items-center gap-3" aria-label="CAHEN — بازگشت به صفحهٔ اصلی" onClick={closeMenu}>
          <LogoMark className="h-10 w-[50px] transition-transform duration-300 group-hover:rotate-[-4deg] group-hover:scale-105" />
          <span className="flex flex-col gap-0.5">
            <span className="wordmark" dir="ltr">CAHEN</span>
            <span className="brand-caption" dir="ltr">DIGITAL STUDIO</span>
          </span>
        </a>

        <nav aria-label="منوی اصلی" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  aria-current={active === link.id ? "location" : undefined}
                  className={cn("nav-link", active === link.id && "nav-link--active")}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setSearchOpen((value) => !value);
              setNotFound(false);
            }}
            aria-label={searchOpen ? "بستن جست‌وجو" : "جست‌وجو در سایت"}
            aria-expanded={searchOpen}
            aria-controls="site-search-panel"
            className="header-icon-button hidden sm:flex"
          >
            {searchOpen ? <X className="h-[18px] w-[18px]" aria-hidden="true" /> : <Search className="h-[18px] w-[18px]" aria-hidden="true" />}
          </button>

          <button type="button" onClick={onOrder} className="header-cta hidden sm:inline-flex">
            شروع همکاری
            <ArrowUpLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="header-icon-button xl:hidden"
            aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div className={cn("search-panel-wrap", searchOpen && "search-panel-wrap--open")}>
        <form id="site-search-panel" onSubmit={submitSearch} role="search" className="search-panel" aria-hidden={!searchOpen}>
          <label htmlFor="site-search" className="sr-only">جست‌وجو در سایت</label>
          <Search className="h-4 w-4 shrink-0 text-lav" aria-hidden="true" />
          <input
            id="site-search"
            ref={searchRef}
            tabIndex={searchOpen ? 0 : -1}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setNotFound(false);
            }}
            placeholder="پروژه، طراحی، فرایند…"
            className="search-panel__input"
          />
          <kbd className="search-shortcut hidden sm:block">↵</kbd>
          {notFound && <p role="status" className="search-panel__hint">بخشی با این عبارت پیدا نشد؛ عبارت دیگری را امتحان کنید.</p>}
        </form>
      </div>

      <div id="mobile-menu" className="mobile-menu xl:hidden" data-open={menuOpen} aria-hidden={!menuOpen}>
        <div className="mobile-menu__inner">
          <nav aria-label="منوی موبایل">
            <ul className="mobile-menu__list">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    tabIndex={menuOpen ? 0 : -1}
                    aria-current={active === link.id ? "location" : undefined}
                    onClick={closeMenu}
                    className={cn("mobile-menu__link", active === link.id && "mobile-menu__link--active")}
                  >
                    <span>{link.label}</span>
                    <SquareArrowOutUpRight className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                  </a>
                </li>
              ))}
              <li className="mobile-menu__footer sm:hidden">
                <button type="button" tabIndex={menuOpen ? 0 : -1} onClick={() => { closeMenu(); onOrder(); }} className="header-cta w-full">
                  شروع همکاری
                  <ArrowUpLeft className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            </ul>
          </nav>
          <button
            type="button"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => { closeMenu(); setSearchOpen(true); }}
            className="mobile-search-link sm:hidden"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            جست‌وجو در سایت
            <span className="mr-auto text-xs text-muted">⌘ K</span>
          </button>
        </div>
      </div>
    </header>
  );
}
