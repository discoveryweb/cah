import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { NAV_LINKS } from "../data";
import { toRoman } from "../utils/roman";
import { useActiveSection, useInvertAt } from "../hooks/useActiveSection";

/** Hairline scroll progress fixed to the very top of the viewport. */
export function ScrollProgress() {
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return <span ref={barRef} className="progress" aria-hidden="true" />;
}

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setVisible(window.scrollY > 900);
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

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Tehran local time, refreshed on the minute. */
export function TehranClock({ className, short = false }: { className?: string; short?: boolean }) {
  const [time, setTime] = useState(() => TIME_FORMAT.format(new Date()));

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      const now = new Date();
      setTime(TIME_FORMAT.format(now));
      timer = window.setTimeout(schedule, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <span className={className}>
      {!short && <i aria-hidden="true" />}
      <span dir="ltr">{time}</span>
      <span className="sr-only">به وقت تهران</span>
    </span>
  );
}
