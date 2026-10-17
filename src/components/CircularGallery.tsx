import { ChevronLeft, ChevronRight, Mouse } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
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

/**
 * Scroll-led circular portfolio gallery inspired by Ravi Katiyar's 21st.dev component.
 * This project-adapted implementation keeps the interaction native to the page,
 * while adding keyboard, button, reduced-motion, and small-screen support.
 */
export function CircularGallery({ items }: { items: readonly GalleryItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const frameRef = useRef(0);
  const activeIndexRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const count = Math.max(items.length, 1);
  const activeProject = items[activeIndex] ?? items[0];

  const getScrollProgress = useCallback(() => {
    const scrollArea = scrollRef.current;
    const stickyStage = stickyRef.current;
    if (!scrollArea || !stickyStage) return 0;

    const stickyTop = Number.parseFloat(window.getComputedStyle(stickyStage).top) || 0;
    const travelDistance = Math.max(1, scrollArea.offsetHeight - stickyStage.offsetHeight);
    const distanceFromStart = stickyTop - scrollArea.getBoundingClientRect().top;
    return clamp(distanceFromStart / travelDistance, 0, 1);
  }, []);

  const paintGallery = useCallback((scrollProgress: number) => {
    const viewport = viewportRef.current;
    if (!viewport || !items.length) return;

    const motionReduced = reducedMotionRef.current;
    // Map the full scroll range from the first card to the last. Multiplying by
    // `count` made the last card wrap back to the first at the bottom of the stage.
    const rotation = motionReduced
      ? activeIndexRef.current
      : clamp(scrollProgress, 0, 1) * Math.max(0, count - 1);
    const nextActiveIndex = clamp(Math.round(rotation), 0, count - 1);
    if (nextActiveIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextActiveIndex;
      setActiveIndex(nextActiveIndex);
    }

    const width = viewport.clientWidth || 720;
    const radiusX = width * 0.42;
    const radiusZ = Math.min(140, width * 0.16);

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const angle = ((index - rotation) * Math.PI * 2) / count;
      const sine = Math.sin(angle);
      const cosine = Math.cos(angle);
      const focus = (cosine + 1) * 0.5;
      const x = sine * radiusX;
      const y = Math.sin(angle * 2) * 5;
      const z = cosine * radiusZ;
      const tilt = -sine * 24;
      const scale = 0.79 + focus * 0.21;

      const xOffset = `calc(50% ${x < 0 ? "-" : "+"} ${Math.abs(x).toFixed(2)}px)`;
      const yOffset = `calc(50% ${y < 0 ? "-" : "+"} ${Math.abs(y).toFixed(2)}px)`;
      card.style.left = xOffset;
      card.style.top = yOffset;
      card.style.transform = `translate3d(-50%, -50%, 0) translateZ(${z.toFixed(2)}px) rotateY(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      card.style.opacity = `${0.18 + focus * 0.82}`;
      card.style.zIndex = `${10 + Math.round(focus * 100)}`;
      card.style.filter = `brightness(${0.72 + focus * 0.28}) saturate(${0.78 + focus * 0.22})`;
      card.dataset.front = String(index === nextActiveIndex);
    });
  }, [count, items.length]);

  const schedulePaint = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      paintGallery(getScrollProgress());
    });
  }, [getScrollProgress, paintGallery]);

  const goToProject = useCallback((requestedIndex: number) => {
    if (!items.length) return;
    const nextIndex = wrapIndex(requestedIndex, count);
    if (reducedMotionRef.current) {
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
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
  }, [count, items.length, schedulePaint]);

  useEffect(() => {
    if (!items.length) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isInView = true;
    const syncMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
      schedulePaint();
    };
    const onScroll = () => {
      if (isInView) schedulePaint();
    };
    const visibilityObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          isInView = Boolean(entry?.isIntersecting);
          if (isInView) schedulePaint();
        }, { rootMargin: "120px 0px" });
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(schedulePaint);

    reducedMotionRef.current = motionQuery.matches;
    setReducedMotion(motionQuery.matches);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedulePaint, { passive: true });
    motionQuery.addEventListener("change", syncMotionPreference);
    if (scrollRef.current) {
      visibilityObserver?.observe(scrollRef.current);
      resizeObserver?.observe(scrollRef.current);
    }
    if (stickyRef.current) resizeObserver?.observe(stickyRef.current);
    schedulePaint();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedulePaint);
      motionQuery.removeEventListener("change", syncMotionPreference);
      visibilityObserver?.disconnect();
      resizeObserver?.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [items.length, schedulePaint]);

  if (!items.length || !activeProject) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToProject(activeIndex + 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToProject(activeIndex - 1);
    }
  };

  return (
    <div
      ref={scrollRef}
      className="circular-gallery-scroll"
      data-reduced-motion={reducedMotion}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="گالری چرخشی"
      aria-label="نمونه‌کارهای منتخب CAHEN"
    >
      <div ref={stickyRef} className="circular-gallery-sticky">
        <div className="circular-gallery-surface">
          <div className="circular-gallery-visual">
            <div ref={viewportRef} className="circular-gallery-viewport" role="group" aria-label="کارت‌های گالری نمونه‌کار">
              <div className="circular-gallery-orbit" aria-hidden="true" />
              <div className="circular-gallery-orbit circular-gallery-orbit--inner" aria-hidden="true" />
              {items.map((project, index) => (
                <button
                  key={project.id}
                  ref={(element) => { cardRefs.current[index] = element; }}
                  type="button"
                  className={cn("circular-gallery-card", activeIndex === index && "circular-gallery-card--active")}
                  aria-label={`نمایش پروژهٔ ${project.title}، ${index + 1} از ${items.length}`}
                  aria-pressed={activeIndex === index}
                  onClick={() => goToProject(index)}
                >
                  <span className="circular-gallery-card__image-wrap">
                    <img
                      src={project.image}
                      alt={project.alt}
                      width={1536}
                      height={1024}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                    />
                    <span className="circular-gallery-card__wash" aria-hidden="true" />
                    <span className="circular-gallery-card__topline" dir="ltr">
                      <span>CAHEN / SELECTED</span>
                      <span>{project.id} / {String(items.length)}</span>
                    </span>
                    <span className="circular-gallery-card__wordmark" dir="ltr">{project.label}</span>
                    <span className="circular-gallery-card__bottomline">
                      <span>{project.title}</span>
                      <span className="circular-gallery-card__open" aria-hidden="true"><ChevronLeft /></span>
                    </span>
                  </span>
                </button>
              ))}
              <div className="circular-gallery-visual__hint" aria-hidden="true">
                <Mouse />
                <span>اسکرول کنید تا بچرخد</span>
              </div>
              <span className="circular-gallery-visual__counter" dir="ltr" aria-hidden="true">
                {activeProject.id} <i /> {String(items.length)}
              </span>
            </div>
          </div>

          <aside className="circular-gallery-details">
            <div className="circular-gallery-details__topline" dir="ltr">
              <span>CAHEN / SELECTED WORKS</span>
              <span>{activeProject.id} — {String(items.length)}</span>
            </div>

            <div key={activeProject.id} className="circular-gallery-details__content" aria-live="polite" aria-atomic="true">
              <p className="circular-gallery-details__label" dir="ltr">{activeProject.label}</p>
              <h3>{activeProject.title}</h3>
              <p className="circular-gallery-details__category" dir="ltr">{activeProject.category}</p>
              <p className="circular-gallery-details__description">{activeProject.description}</p>
              <ul className="circular-gallery-tags" aria-label="محورهای پروژه">
                {activeProject.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>
            </div>

            <div className="circular-gallery-controls">
              <div className="circular-gallery-dots" role="group" aria-label="انتخاب نمونه‌کار">
                {items.map((project, index) => (
                  <button
                    key={project.id}
                    type="button"
                    className={cn("circular-gallery-dot", activeIndex === index && "circular-gallery-dot--active")}
                    aria-label={`رفتن به پروژهٔ ${project.title}`}
                    aria-current={activeIndex === index ? "true" : undefined}
                    onClick={() => goToProject(index)}
                  >
                    {project.id}
                  </button>
                ))}
              </div>
              <div className="circular-gallery-arrows" role="group" aria-label="پیمایش پروژه‌ها">
                <button type="button" aria-label="پروژهٔ قبلی" onClick={() => goToProject(activeIndex - 1)}>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" aria-label="پروژهٔ بعدی" onClick={() => goToProject(activeIndex + 1)}>
                  <ChevronLeft aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="circular-gallery-details__hint">برای گردش در کارها، صفحه را پایین ببرید.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
