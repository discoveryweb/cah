import { ArrowDownLeft, ArrowUpLeft, MoveUpLeft, PencilRuler } from "lucide-react";
import heroImage from "../assets/hero.jpg";
import { Button, LogoMark, Reveal } from "./ui";

export function Hero({ onOrder }: { onOrder: () => void }) {
  return (
    <section id="home" className="hero-section section-anchor relative isolate">
      <div className="hero-grid mx-auto grid max-w-[1280px] items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-20 lg:min-h-[690px] lg:grid-cols-[0.95fr_1.05fr] lg:gap-8 lg:pb-24 lg:pt-9 xl:min-h-[760px]">
        <Reveal className="hero-copy order-1 relative z-10 flex flex-col items-start lg:pe-4">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow__pulse" aria-hidden="true" />
            استودیوی طراحی و توسعهٔ دیجیتال
          </div>

          <p className="hero-overline" dir="ltr">
            DESIGN WITH INTENT <span>·</span> BUILD WITH CARE
          </p>

          <h1 className="hero-title">
            از ایدهٔ خوب،<br />
            <span className="hero-title__accent">تجربه‌ای ماندگار</span>
            <span className="hero-title__period">.</span>
          </h1>

          <p className="hero-description">
            ما در <span dir="ltr">CAHEN</span> طراحی دقیق را با اجرای هوشمند همراه می‌کنیم تا برندها در فضای دیجیتال، روشن‌تر، سریع‌تر و به‌یادماندنی‌تر دیده شوند.
          </p>

          <div className="hero-actions flex flex-wrap items-center gap-3">
            <Button onClick={onOrder} className="hero-primary-action">
              دربارهٔ پروژه‌تان بگویید
            </Button>
            <a href="#projects" className="hero-secondary-action">
              <span>دیدن پروژه‌ها</span>
              <ArrowDownLeft className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-[-3px] group-hover:translate-y-[3px]" aria-hidden="true" />
            </a>
          </div>

          <div className="hero-signature mt-8 flex items-center gap-3" aria-label="خدمات تیم کاهن">
            <span className="hero-signature__line" aria-hidden="true" />
            <span>تفکر · طراحی · توسعه</span>
            <span className="hero-signature__divider" aria-hidden="true" />
            <span dir="ltr">CAHEN / 2026</span>
          </div>
        </Reveal>

        <Reveal delay={140} className="hero-visual order-2 relative mx-auto w-full max-w-[700px] lg:order-2">
          <div className="hero-orbit hero-orbit--outer" aria-hidden="true" />
          <div className="hero-orbit hero-orbit--inner" aria-hidden="true" />
          <div className="hero-visual__halo" aria-hidden="true" />

          <div className="hero-visual__frame">
            <div className="hero-visual__topbar" aria-hidden="true">
              <div className="browser-dots"><i /><i /><i /></div>
              <span className="browser-address" dir="ltr">cahen.studio / digital experiences</span>
              <MoveUpLeft className="h-3.5 w-3.5 text-lav/80" />
            </div>
            <div className="hero-visual__image-wrap">
              <img
                src={heroImage}
                alt="چیدمان مفهومی فروشگاه‌های دیجیتال روی لپ‌تاپ و تلفن همراه"
                width={1536}
                height={1024}
                fetchPriority="high"
                className="hero-visual__image"
                draggable={false}
              />
              <div className="hero-visual__image-shade" aria-hidden="true" />
              <div className="hero-visual__image-note" dir="ltr" aria-hidden="true">
                <span>SELECTED VISUAL</span>
                <span className="hero-visual__image-note-line" />
                <span>1 — 3</span>
              </div>
            </div>
          </div>

          <div className="hero-float-card hero-float-card--top" aria-hidden="true">
            <div className="hero-float-card__icon"><PencilRuler className="h-[17px] w-[17px]" /></div>
            <div>
              <span className="hero-float-card__label">MADE WITH INTENT</span>
              <span className="hero-float-card__value">هر جزئیات، یک دلیل</span>
            </div>
          </div>

          <div className="hero-float-card hero-float-card--bottom" aria-hidden="true">
            <LogoMark className="h-9 w-11" />
            <div className="hero-float-card__stack">
              <span className="hero-float-card__value" dir="ltr">DESIGN <i /> DIGITAL</span>
              <span className="hero-float-card__label">از ایده تا اجرا</span>
            </div>
            <ArrowUpLeft className="mr-auto h-4 w-4 text-lav" />
          </div>

          <span className="hero-visual__index" dir="ltr" aria-hidden="true">C / 1</span>
        </Reveal>
      </div>

      <a className="hero-scroll-cue hidden lg:flex" href="#projects">
        <span>برای کشف بیشتر اسکرول کنید</span>
        <ArrowDownLeft className="h-4 w-4" aria-hidden="true" />
      </a>
    </section>
  );
}
