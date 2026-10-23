import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { NAV_LINKS } from "../data";
import { toRoman } from "../utils/roman";
import { useActiveSection, useInvertAt } from "../hooks/useActiveSection";
import { onScrollFrame } from "../utils/scrollFrame";

/** Hairline scroll progress fixed to the very top of the viewport. */
export function ScrollProgress() {
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const update = (y: number) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };

    return onScrollFrame(update);
  }, []);

  return <span ref={barRef} className="progress" aria-hidden="true" />;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = (y: number) => {
      // Same rule as the dock: once the film is behind you.
      const hero = document.getElementById("home");
      const threshold = hero
        ? Math.max(560, hero.offsetTop + hero.offsetHeight - window.innerHeight * 0.92)
        : 900;
      setVisible(y > threshold);
    };

    return onScrollFrame(update);
  }, []);

  return (
    <button
      type="button"
      className={`to-top${visible ? " to-top--visible" : ""}`}
      aria-label="بازگشت به بالای صفحه"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <ArrowUp aria-hidden="true" />
    </button>
  );
}

/** A quiet chapter index pinned to the outer edge on large screens. */
export function ChapterRail() {
  const active = useActiveSection();
  const invert = useInvertAt("middle");

  return (
    <nav className={`rail${invert ? " rail--light" : ""}`} aria-label="فهرست فصل‌ها">
      <ol className="rail__list">
        {NAV_LINKS.map((link, index) => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className={`rail__link${active === link.id ? " rail__link--active" : ""}`}
              aria-current={active === link.id ? "location" : undefined}
              title={link.label}
            >
              <span className="rail__num" dir="ltr">
                {toRoman(index + 1)}
              </span>
              <span className="rail__tick" aria-hidden="true" />
              <span className="sr-only">{link.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
