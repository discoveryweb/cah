import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpLeft, ChevronLeft, ChevronRight, MousePointer2, Scan } from "lucide-react";
import { cn } from "../utils/cn";

type GalleryItem = {
  id: string;
  label: string;
  title: string;
  category: string;
  description: string;
  tags: readonly string[];
  image: string;
  alt: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrapIndex = (index: number, count: number) => ((index % count) + count) % count;
const pad = (index: number) => String(index + 1).padStart(2, "0");

/**
 * Scroll-led circular portfolio gallery.
 * Desktop: a sticky stage whose rotation is driven by page scroll.
 * Mobile: a native snap reel that stays perfectly legible on small screens.
 */
export function CircularGallery({ items, onOrder }: { items: readonly GalleryItem[]; onOrder?: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const activeIndexRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const count = Math.max(items.length, 1);
  const activeProject = items[activeIndex] ?? items[0];

  const syncActive = useCallback((index: number) => {
    if (index === activeIndexRef.current) return;
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const paintGallery = useCallback(
    (scrollProgress: number) => {
      const viewport = viewportRef.current;
      if (!viewport || !items.length) return;

      const motionReduced = reducedMotionRef.current;
      const rotation = motionReduced
        ? activeIndexRef.current
        : clamp(scrollProgress, 0, 1) * Math.max(0, count - 1);
      const nextActive = clamp(Math.round(rotation), 0, count - 1);
      syncActive(nextActive);

      if (!motionReduced) setProgress(scrollProgress);

      const width = viewport.clientWidth || 680;
      const radiusX = width * 0.355;
      const radiusZ = Math.min(160, width * 0.21);

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const angle = ((index - rotation) * Math.PI * 2) / count;
        const sine = Math.sin(angle);
        const cosine = Math.cos(angle);
        const focus = (cosine + 1) * 0.5;
        const x = sine * radiusX;
        const y = Math.sin(angle * 2) * 6;
        const z = cosine * radiusZ;
        const tilt = -sine * 16;
        const scale = 0.82 + focus * 0.18;

        card.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), ${z.toFixed(2)}px) rotateY(${tilt.toFixed(2)}deg) rotateX(${(-sine * 2).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        card.style.opacity = `${(0.22 + focus * 0.78).toFixed(3)}`;
        card.style.zIndex = `${10 + Math.round(focus * 100)}`;
        card.style.filter = `brightness(${(0.7 + focus * 0.3).toFixed(3)}) saturate(${(0.78 + focus * 0.22).toFixed(3)})`;
        card.dataset.front = String(index === nextActive);
      });
    },
    [count, items.length, syncActive]
  );

  const getScrollProgress = useCallback(() => {
    const scrollArea = scrollRef.current;
    const stickyStage = stickyRef.current;
    if (!scrollArea || !stickyStage) return 0;

    const stickyTop = Number.parseFloat(window.getComputedStyle(stickyStage).top) || 0;
    const travelDistance = Math.max(1, scrollArea.offsetHeight - stickyStage.offsetHeight);
    const distanceFromStart = stickyTop - scrollArea.getBoundingClientRect().top;
    return clamp(distanceFromStart / travelDistance, 0, 1);
  }, []);

  const schedulePaint = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      paintGallery(getScrollProgress());
    });
  }, [getScrollProgress, paintGallery]);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      reducedMotionRef.current = motionQuery.matches;
      schedulePaint();
    };
    syncMotion();
    motionQuery.addEventListener("change", syncMotion);

    window.addEventListener("scroll", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint, { passive: true });
    schedulePaint();

    return () => {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      motionQuery.removeEventListener("change", syncMotion);
      window.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
    };
  }, [schedulePaint]);

  /* Mobile reel: keep the active slide in sync with native scrolling. */
  useEffect(() => {
    const reel = reelRef.current;
    if (!reel) return;

    const onScroll = () => {
      const slides = Array.from(reel.querySelectorAll<HTMLElement>("[data-slide]"));
      const center = reel.scrollLeft + reel.clientWidth / 2;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
        const distance = Math.abs(slideCenter - center);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      syncActive(nearest);
    };

    reel.addEventListener("scroll", onScroll, { passive: true });
    return () => reel.removeEventListener("scroll", onScroll);
  }, [syncActive]);

  const goToProject = useCallback(
    (requestedIndex: number) => {
      if (!items.length) return;
      const nextIndex = wrapIndex(requestedIndex, count);

      const reel = reelRef.current;
      if (reel && window.matchMedia("(max-width: 1023px)").matches) {
        const slide = reel.querySelectorAll<HTMLElement>("[data-slide]")[nextIndex];
        if (slide) {
          reel.scrollTo({ left: slide.offsetLeft - (reel.clientWidth - slide.offsetWidth) / 2, behavior: "smooth" });
          syncActive(nextIndex);
        }
        return;
      }

      if (reducedMotionRef.current) {
        syncActive(nextIndex);
        schedulePaint();
        return;
      }

      const scrollArea = scrollRef.current;
      const stickyStage = stickyRef.current;
      if (!scrollArea || !stickyStage) return;
      const stickyTop = Number.parseFloat(window.getComputedStyle(stickyStage).top) || 0;
      const travelDistance = Math.max(0, scrollArea.offsetHeight - stickyStage.offsetHeight);
      const startPosition = window.scrollY + scrollArea.getBoundingClientRect().top - stickyTop;
      const targetPosition = startPosition + (nextIndex / Math.max(1, count - 1)) * travelDistance;
      window.scrollTo({ top: Math.max(0, targetPosition), behavior: "smooth" });
    },
    [count, items.length, schedulePaint, syncActive]
  );

  const selectCard = (index: number) => {
    if (index === activeIndexRef.current) {
      onOrder?.();
      return;
    }
    goToProject(index);
  };

  const activeProjectIndex = items[activeIndex] ? activeIndex : 0;

  return (
    <div ref={scrollRef} className="gallery__scroll">
      <div ref={stickyRef} className="gallery__sticky">
        <div className="gallery__stage container">
          {/* Details */}
          <div className="gallery__info">
            <div className="gallery__topline" dir="ltr">
              <span>
                CAHEN <i /> SELECTED WORKS
              </span>
              <span>
                {pad(activeProjectIndex)} <i /> {pad(count - 1)}
              </span>
            </div>

            <div className="gallery__copy" key={activeProject.id}>
              <span className="gallery__eyebrow" dir="ltr">
                {activeProject.label}
              </span>
              <h3 className="gallery__title">{activeProject.title}</h3>
              <p className="gallery__category" dir="ltr">
                {activeProject.category}
              </p>
              <p className="gallery__description">{activeProject.description}</p>

              <ul className="gallery__tags">
                {activeProject.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>

              <button
                type="button"
                className="gallery__link group"
                onClick={() => onOrder?.()}
              >
                <span>گفت‌وگو دربارهٔ پروژه‌ای مشابه</span>
                <ArrowUpLeft aria-hidden="true" />
              </button>
            </div>

            <div className="gallery__footer">
              <div className="gallery__progress" aria-hidden="true">
                <span
                  className="gallery__progress-fill"
                  style={{ width: `${Math.round((activeIndex / Math.max(1, count - 1)) * 100)}%` }}
                />
              </div>

              <div className="gallery__controls">
                <div className="gallery__dots" role="tablist" aria-label="پروژه‌ها">
                  {items.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={index === activeIndex}
                      aria-label={`${item.label} — ${item.title}`}
                      onClick={() => goToProject(index)}
                      className={cn("gallery__dot", index === activeIndex && "gallery__dot--active")}
                    >
                      {pad(index)}
                    </button>
                  ))}
                </div>

                <div className="gallery__arrows">
                  <button
                    type="button"
                    className="gallery__arrow"
                    aria-label="پروژهٔ بعدی"
                    onClick={() => goToProject(activeIndex + 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="gallery__arrow"
                    aria-label="پروژهٔ قبلی"
                    onClick={() => goToProject(activeIndex - 1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </button>
                </div>
              </div>

              <span className="gallery__hint">
                <MousePointer2 aria-hidden="true" />
                برای چرخش میان پروژه‌ها اسکرول کنید
              </span>
            </div>
          </div>

          {/* 3D carousel */}
          <div className="gallery__visual">
            <div ref={viewportRef} className="gallery__viewport">
              <span className="gallery__orbit" aria-hidden="true" />
              <span className="gallery__orbit gallery__orbit--inner" aria-hidden="true" />

              {items.map((item, index) => (
                <button
                  key={item.id}
                  ref={(node) => {
                    cardRefs.current[index] = node;
                  }}
                  type="button"
                  className="gallery__card"
                  data-front={index === activeIndex}
                  aria-label={`${item.label} — ${item.title}`}
                  onClick={() => selectCard(index)}
                >
                  <span className="gallery__card-media">
                    <img src={item.image} alt={item.alt} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
                  </span>
                  <span className="gallery__card-wash" aria-hidden="true" />
                  <span className="gallery__card-top" dir="ltr">
                    <span className="gallery__card-badge">
                      <i />
                      CONCEPT
                    </span>
                    <span>{pad(index)} / {pad(count - 1)}</span>
                  </span>
                  <span className="gallery__card-word" dir="ltr">
                    {item.label}
                  </span>
                  <span className="gallery__card-foot">
                    <span>{item.title}</span>
                    <span className="gallery__card-open">
                      <ArrowUpLeft aria-hidden="true" />
                    </span>
                  </span>
                </button>
              ))}

              <span className="gallery__visual-meta" style={{ position: "absolute", right: 18, bottom: 14, left: 18 }} dir="ltr">
                <span>SELECTED / {pad(activeProjectIndex + 1)}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Scan style={{ width: 12, height: 12 }} aria-hidden="true" />
                  DRAG · SCROLL
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile snap reel */}
      <div className="gallery__mobile">
        <div ref={reelRef} className="gallery__reel" role="group" aria-label="پروژه‌های منتخب">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-slide
              data-active={index === activeIndex}
              aria-label={`${item.label} — ${item.title}`}
              onClick={() => goToProject(index)}
              className="gallery__slide"
            >
              <span className="gallery__card-media">
                <img src={item.image} alt={item.alt} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
              </span>
              <span className="gallery__card-wash" aria-hidden="true" />
              <span className="gallery__card-top" dir="ltr">
                <span className="gallery__card-badge">
                  <i />
                  CONCEPT
                </span>
                <span>{pad(index)} / {pad(count - 1)}</span>
              </span>
              <span className="gallery__card-word" dir="ltr">{item.label}</span>
              <span className="gallery__card-foot">
                <span>{item.title}</span>
                <span className="gallery__card-open">
                  <ArrowUpLeft aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="container">
          <div className="gallery__mobile-details" key={`m-${activeProject.id}`}>
            <div className="gallery__mobile-top" dir="ltr">
              <span>{activeProject.label}</span>
              <span>{pad(activeProjectIndex)} — {pad(count - 1)}</span>
            </div>
            <h3 className="gallery__mobile-title">{activeProject.title}</h3>
            <p className="gallery__mobile-category" dir="ltr">{activeProject.category}</p>
            <p className="gallery__mobile-description">{activeProject.description}</p>
            <ul className="gallery__tags">
              {activeProject.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>

            <div className="gallery__mobile-controls">
              <div className="gallery__dots">
                {items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`${item.label} — ${item.title}`}
                    aria-current={index === activeIndex}
                    onClick={() => goToProject(index)}
                    className={cn("gallery__dot", index === activeIndex && "gallery__dot--active")}
                  >
                    {pad(index)}
                  </button>
                ))}
              </div>
              <button type="button" className="gallery__link" onClick={() => onOrder?.()} style={{ marginTop: 0 }}>
                <span>گفت‌وگو</span>
                <ArrowUpLeft aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress readout for assistive tech */}
      <span className="sr-only" aria-live="polite">
        {`پروژهٔ ${pad(activeProjectIndex + 1)} از ${pad(count)}: ${activeProject.label} — ${activeProject.title}`}
      </span>
      <span className="sr-only">{`پیشرفت چرخش: ${Math.round(progress * 100)} درصد`}</span>
    </div>
  );
}
