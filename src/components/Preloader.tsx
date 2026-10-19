import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LogoMark } from "./ui";

export function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("is-loading");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };

    if (reduced) {
      setCount(100);
      setLeaving(true);
      finish();
      const quickExit = window.setTimeout(() => setGone(true), 320);
      root.classList.remove("is-loading");
      return () => window.clearTimeout(quickExit);
    }

    const duration = 1350;
    const start = performance.now();
    let frame = 0;
    let exitTimer = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * 100));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      setLeaving(true);
      exitTimer = window.setTimeout(() => {
        finish();
        root.classList.remove("is-loading");
      }, 700);
      exitTimer = window.setTimeout(() => setGone(true), 1500);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      root.classList.remove("is-loading");
    };
  }, [onDone]);

  if (gone) return null;

  return (
    <div className={`preloader${leaving ? " preloader--leaving" : ""}`} aria-hidden="true">
      <div className="preloader__inner">
        <div className="preloader__top">
          <span className="preloader__mark">
            <LogoMark />
            <span dir="ltr">CAHEN / DIGITAL STUDIO</span>
          </span>
          <span dir="ltr">TEHRAN — IRAN</span>
        </div>

        <div className="preloader__center">
          <span className="preloader__word" dir="ltr">
            CAHEN
          </span>
          <span className="preloader__count" dir="ltr">
            {String(count).padStart(3, "0")}
          </span>
        </div>

        <div className="preloader__bottom">
          <span>در حال چیدن صحنه</span>
          <span className="preloader__bar">
            <span style={{ width: `${count}%` } as CSSProperties} />
          </span>
          <span dir="ltr">CAHEN © 2026</span>
        </div>
      </div>
    </div>
  );
}
