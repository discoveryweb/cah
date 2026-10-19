import { useEffect, useRef } from "react";
import { ArrowDownLeft, Lock, MoveUpLeft, PencilRuler, Play } from "lucide-react";
import heroImage from "../assets/hero.jpg";
import { CAPABILITIES } from "../data";
import { Button, LogoMark, Marquee, Reveal } from "./ui";

export function Hero({ onOrder }: { onOrder: () => void }) {
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    const stage = inner?.parentElement;
    if (!stage || !inner) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = stage.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        inner.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
        inner.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
      });
    };
    const onLeave = () => {
      inner.style.setProperty("--ry", "0deg");
      inner.style.setProperty("--rx", "0deg");
    };

    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section id="home" className="hero">
      <div className="hero__halo" aria-hidden="true" />

      <div className="hero__grid container">
        <Reveal className="hero__copy">
          <div className="hero__eyebrow-row">
            <span className="hero__eyebrow">
              <span className="hero__pulse" aria-hidden="true" />
              استودیوی طراحی و توسعهٔ دیجیتال
            </span>
            <span className="hero__eyebrow-note" dir="ltr">
              TEHRAN — EST. 2026
            </span>
          </div>

          <h1 className="hero__title">
            <span className="hero__title-line">از ایدهٔ خوب،</span>
            <span className="hero__title-line">
              <span className="hero__title-accent">تجربه‌ای ماندگار</span>
              <span className="hero__title-dot">.</span>
              <span className="hero__title-spark" aria-hidden="true">✦</span>
            </span>
          </h1>

          <p className="hero__lead">
            ما در <strong>CAHEN</strong> طراحی دقیق را با اجرای هوشمند همراه می‌کنیم تا برندها در فضای دیجیتال،
            روشن‌تر، سریع‌تر و به‌یادماندنی‌تر دیده شوند.
          </p>

          <div className="hero__actions">
            <Button onClick={onOrder} className="hero__primary">
              دربارهٔ پروژه‌تان بگویید
            </Button>
            <a href="#projects" className="btn btn--ghost hero__secondary">
              <span className="play" aria-hidden="true">
                <Play />
              </span>
              <span>دیدن پروژه‌ها</span>
            </a>
          </div>

          <div className="hero__notes" role="list" aria-label="تمرکز کاری CAHEN">
            <span role="listitem">تفکر محصول</span>
            <span role="listitem">طراحی تجربه</span>
            <span role="listitem">توسعهٔ وب</span>
            <span className="hero__notes-sep" aria-hidden="true" />
            <span role="listitem" dir="ltr" className="num text-[10px] tracking-[0.2em] text-[#6f6b86]">
              CAHEN / 2026
            </span>
          </div>
        </Reveal>

        <Reveal delay={160} className="hero__visual">
          <div className="hero__visual-inner-wrap">
            <div className="hero__rings" aria-hidden="true">
              <span className="hero__ring hero__ring--1" />
              <span className="hero__ring hero__ring--2" />
              <span className="hero__ring hero__ring--3" />
              <span className="hero__ring-tick" />
            </div>

            <div ref={innerRef} className="hero__visual-inner">
              <div className="browser">
                <div className="browser__bar" aria-hidden="true">
                  <div className="browser__dots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className="browser__url" dir="ltr">
                    <Lock />
                    cahen.studio
                  </span>
                  <LogoMark className="browser__bar-mark" />
                </div>
                <div className="browser__view">
                  <img
                    src={heroImage}
                    alt="چیدمان مفهومی فروشگاه‌های دیجیتال روی لپ‌تاپ و تلفن همراه"
                    width={1536}
                    height={1024}
                    fetchPriority="high"
                    draggable={false}
                  />
                  <div className="browser__view-shade" aria-hidden="true" />
                  <div className="browser__scan" aria-hidden="true" />
                  <div className="browser__caption" dir="ltr" aria-hidden="true">
                    <span className="browser__caption-line" />
                    <span>SELECTED VISUAL / 01</span>
                  </div>
                  <span className="browser__corner browser__corner--tl" aria-hidden="true" />
                  <span className="browser__corner browser__corner--br" aria-hidden="true" />
                </div>
              </div>

              <div className="chip chip--top" aria-hidden="true">
                <span className="chip__icon">
                  <PencilRuler />
                </span>
                <span>
                  <span className="chip__label" dir="ltr">MADE WITH INTENT</span>
                  <span className="chip__value">هر جزئیات، یک دلیل</span>
                </span>
              </div>

              <div className="chip chip--bottom" aria-hidden="true">
                <LogoMark className="h-8 w-10" />
                <span className="chip__stack">
                  <span className="chip__value" dir="ltr">
                    DESIGN <i className="chip__dot" /> DIGITAL
                  </span>
                  <span className="chip__label">از ایده تا اجرا</span>
                </span>
                <MoveUpLeft className="chip__arrow" />
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <a className="hero__cue" href="#projects">
        <span>برای کشف بیشتر اسکرول کنید</span>
        <ArrowDownLeft aria-hidden="true" />
      </a>

      <div className="cap-band">
        <div className="cap-band__inner container">
          <span className="cap-band__label" dir="ltr">
            CAPABILITIES
          </span>
          <Marquee items={CAPABILITIES} duration={52} />
        </div>
      </div>
    </section>
  );
}
