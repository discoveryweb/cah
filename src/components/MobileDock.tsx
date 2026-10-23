import { useEffect, useRef, useState } from "react";
import { ArrowUpLeft } from "lucide-react";
import { NAV_LINKS } from "../data";
import { useActiveSection } from "../hooks/useActiveSection";
import { openSiteMenu } from "../utils/bus";
import { haptic } from "../utils/haptics";
import { toRoman } from "../utils/roman";
import { cn } from "../utils/cn";

/**
 * The phone dock.
 *
 * Desktop has hover, a chapter rail and a header CTA in view at all times.
 * A phone has none of that once the header slides away, so the site gets one
 * steady, quiet surface at the bottom: where you are, how far you have come,
 * and the one action the studio actually wants. It stays out of the hero —
 * the film is the first impression, and nothing sits on top of it.
 */
export function MobileDock({ onOrder }: { onOrder: () => void }) {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
  );
  const [shown, setShown] = useState(false);
  const meterRef = useRef<HTMLElement>(null);
  const active = useActiveSection(phone);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setPhone(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!phone) {
      setShown(false);
      return;
    }

    let frame = 0;
    let last = false;

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const meter = meterRef.current;
      if (meter) meter.style.transform = `scaleX(${ratio.toFixed(4)})`;

      // Out of the way of the film, and out of the way of the closing CTA.
      const hero = document.getElementById("home");
      const pastFilm = hero
        ? hero.getBoundingClientRect().bottom <= window.innerHeight * 0.92
        : window.scrollY > window.innerHeight;
      const nearEnd = max > 0 && max - window.scrollY < window.innerHeight * 0.62;
      const next = pastFilm && !nearEnd;
      if (next !== last) {
        last = next;
        setShown(next);
      }
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
  }, [phone]);

  if (!phone) return null;

  const index = Math.max(0, NAV_LINKS.findIndex((link) => link.id === active));
  const chapter = NAV_LINKS[index] ?? NAV_LINKS[0];

  return (
    <nav className={cn("dock", shown && "dock--in")} aria-label="دسترسی سریع">
      <i className="dock__meter" ref={meterRef} aria-hidden="true" />

      <button
        type="button"
        className="dock__chapter"
        onClick={() => {
          haptic("tap");
          openSiteMenu();
        }}
        tabIndex={shown ? 0 : -1}
        aria-label={`فهرست بخش‌ها — اکنون در «${chapter.label}»`}
      >
        <span className="dock__num" dir="ltr" aria-hidden="true">
          {toRoman(index + 1)}
        </span>
        <span className="dock__name">{chapter.label}</span>
        <span className="dock__bars" aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      <span className="dock__rule" aria-hidden="true" />

      <button
        type="button"
        className="dock__cta"
        onClick={() => {
          haptic("commit");
          onOrder();
        }}
        tabIndex={shown ? 0 : -1}
      >
        <span>شروع یک پروژه</span>
        <ArrowUpLeft aria-hidden="true" />
      </button>
    </nav>
  );
}
