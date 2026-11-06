import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight, Mouse, ArrowUpLeft } from "lucide-react";
import { cn } from "../utils/cn";
import { toRoman } from "../utils/roman";
import { onScrollFrame } from "../utils/scrollFrame";
import { createDocumentBox } from "../utils/layoutBoxes";

export type GalleryItem = {
  id: string;
  name: string;
  index: string;
  title: string;
  category: string;
  description: string;
  deliverables: readonly string[];
  year: string;
  image: string;
  alt: string;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const wrapIndex = (index: number, count: number) => ((index % count) + count) % count;

/**
 * Scroll-led circular gallery: the page scroll rotates a ring of project
 * plates, and the front plate drives the case-study panel next to it.
 * Adapted from Ravi Katiyar's 21st.dev component, rebuilt on the CAHEN grid.
 */
export function CircularGallery({
  items,
  onOpen,
  hint = "اسکرول کنید تا بچرخد",
}: {
  items: readonly GalleryItem[];
  onOpen: (index: number) => void;
  hint?: string;
}) {
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

  /* The scroll track and the sticky stage are measured when the layout changes
     — never inside the scroll frame. This used to read `getComputedStyle`, two
     `offsetHeight`s and a `getBoundingClientRect` on every scanned frame, which
     forces a synchronous relayout while the reader is scrolling. */
  const geometry = useRef<{ stickyTop: number; travel: number; start: number; stageWidth: number } | null>(null);

  const measureGeometry = useCallback(() => {
    const scrollArea = scrollRef.current;
    const stickyStage = stickyRef.current;
    if (!scrollArea || !stickyStage) {
      geometry.current = null;
      return;
    }
    const track = createDocumentBox(scrollArea).read();
    const stage = createDocumentBox(stickyStage).read();
    geometry.current = {
      stickyTop: Number.parseFloat(window.getComputedStyle(stickyStage).top) || 0,
      travel: Math.max(1, track.height - stage.height),
      start: track.top,
      stageWidth: viewportRef.current?.clientWidth || 720,
    };
  }, []);

  const getScrollProgress = useCallback(
    (scrollY: number) => {
      if (!geometry.current) measureGeometry();
      const box = geometry.current;
      if (!box) return 0;
      const distanceFromStart = box.stickyTop - (box.start - scrollY);
      return clamp(distanceFromStart / box.travel, 0, 1);
    },
    [measureGeometry]
  );

  const paintGallery = useCallback(
    (scrollProgress: number) => {
      const viewport = viewportRef.current;
      if (!viewport || !items.length) return;

      const motionReduced = reducedMotionRef.current;
      const rotation = motionReduced
        ? activeIndexRef.current
        : clamp(scrollProgress, 0, 1) * Math.max(0, count - 1);
      const nextActiveIndex = clamp(Math.round(rotation), 0, count - 1);
      if (nextActiveIndex !== activeIndexRef.current) {
        activeIndexRef.current = nextActiveIndex;
        setActiveIndex(nextActiveIndex);
      }

      const width = geometry.current?.stageWidth || viewport.clientWidth || 720;
      const radiusX = width * 0.42;
      const radiusZ = Math.min(150, width * 0.16);

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const angle = ((index - rotation) * Math.PI * 2) / count;
        const sine = Math.sin(angle);
        const cosine = Math.cos(angle);
        const focus = (cosine + 1) * 0.5;
        const x = sine * radiusX;
        const y = Math.sin(angle * 2) * 6;
        const z = cosine * radiusZ;
        const tilt = -sine * 22;
        const scale = 0.78 + focus * 0.22;

        /* Offsets live inside the transform. Writing `left`/`top` — which is
           what this used to do — lays the card out again on every frame, while
           a transform is composited. The per-card `filter` is gone for the same
           reason: a filter re-rasterises the card (image, radius, shadow) sixty
           times a second. The depth is carried by scale, opacity and z-index,
           which are free. */
        card.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(
          2
        )}px), 0) translateZ(${z.toFixed(2)}px) rotateY(${tilt.toFixed(2)}deg) scale(${scale.toFixed(
          3
        )})`;
        card.style.opacity = `${(0.16 + focus * 0.84).toFixed(3)}`;
        card.style.zIndex = `${10 + Math.round(focus * 100)}`;
        const front = String(index === nextActiveIndex);
        if (card.dataset.front !== front) card.dataset.front = front;
      });
    },
    [count, items.length]
  );

  const schedulePaint = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      paintGallery(getScrollProgress(window.scrollY || window.pageYOffset || 0));
    });
  }, [getScrollProgress, paintGallery]);

  const goToProject = useCallback(
    (requestedIndex: number) => {
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
    },
    [count, items.length, schedulePaint]
  );

  useEffect(() => {
    if (!items.length) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isInView = true;
    const syncMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
      setReducedMotion(motionQuery.matches);
      schedulePaint();
    };
    const stopWatchingScroll = onScrollFrame(() => {
      if (isInView) schedulePaint();
    });
    const visibilityObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              isInView = Boolean(entry?.isIntersecting);
              if (isInView) schedulePaint();
            },
            { rootMargin: "160px 0px" }
          );
    const remeasure = () => {
      measureGeometry();
      schedulePaint();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(remeasure);

    reducedMotionRef.current = motionQuery.matches;
    setReducedMotion(motionQuery.matches);
    window.addEventListener("resize", remeasure, { passive: true });
    motionQuery.addEventListener("change", syncMotionPreference);
    if (scrollRef.current) {
      visibilityObserver?.observe(scrollRef.current);
      resizeObserver?.observe(scrollRef.current);
    }
    if (stickyRef.current) resizeObserver?.observe(stickyRef.current);
    schedulePaint();

    return () => {
      stopWatchingScroll();
      window.removeEventListener("resize", remeasure);
      motionQuery.removeEventListener("change", syncMotionPreference);
      visibilityObserver?.disconnect();
      resizeObserver?.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [items.length, schedulePaint, measureGeometry]);

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
      className="gallery__scroll"
      data-reduced-motion={reducedMotion}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="گالری چرخشی"
      aria-label="نمونه‌کارهای منتخب CAHEN"
    >
      <div ref={stickyRef} className="gallery__sticky">
        <div className="gallery__stage">
          <div className="gallery__visual">
            <div ref={viewportRef} className="gallery__viewport" role="group" aria-label="کارت‌های گالری نمونه‌کار">
              <span className="gallery__orbit" aria-hidden="true" />
              <span className="gallery__orbit gallery__orbit--inner" aria-hidden="true" />

              {items.map((project, index) => (
                <button
                  key={project.id}
                  ref={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  type="button"
                  className={cn(
                    "gallery__card",
                    activeIndex === index && "gallery__card--active"
                  )}
                  aria-label={`نمایش پروژهٔ ${project.name}، ${index + 1} از ${items.length}`}
                  aria-pressed={activeIndex === index}
                  onClick={() => {
                    if (activeIndex === index) onOpen(index);
                    else goToProject(index);
                  }}
                >
                  <span className="gallery__card-media">
                    <img
                      src={project.image}
                      alt={project.alt}
                      width={1536}
                      height={1024}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      draggable={false}
                    />
                    <span className="gallery__card-wash" aria-hidden="true" />
                    <span className="gallery__card-top" dir="ltr">
                      <span>CAHEN / SELECTED</span>
                      <span>
                        {toRoman(project.index)} / {toRoman(items.length)}
                      </span>
                    </span>
                    <span className="gallery__card-mark" dir="ltr">
                      {project.name}
                    </span>
                    <span className="gallery__card-bottom">
                      <span>{project.title}</span>
                      <span className="gallery__card-open" aria-hidden="true">
                        <ChevronLeft />
                      </span>
                    </span>
                  </span>
                </button>
              ))}

              <span className="gallery__hint" aria-hidden="true">
                <Mouse />
                <span>{hint}</span>
              </span>

              <span className="gallery__counter" dir="ltr" aria-hidden="true">
                {toRoman(activeProject.index)} <i /> {toRoman(items.length)}
              </span>
            </div>
          </div>

          <aside className="gallery__details">
            <div className="gallery__details-top" dir="ltr">
              <span>CAHEN / SELECTED WORKS</span>
              <span>
                {toRoman(activeProject.index)} — {toRoman(items.length)}
              </span>
            </div>

            <div
              key={activeProject.id}
              className="gallery__details-body"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="gallery__details-label" dir="ltr">
                {activeProject.name} · {activeProject.year}
              </p>
              <h3>{activeProject.title}</h3>
              <p className="gallery__details-category" dir="ltr">
                {activeProject.category}
              </p>
              <p className="gallery__details-text">{activeProject.description}</p>
              <ul className="gallery__tags" aria-label="محورهای پروژه">
                {activeProject.deliverables.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </div>

            <div className="gallery__actions">
              <button
                type="button"
                className="gallery__open"
                onClick={() => onOpen(activeIndex)}
              >
                <span>خواندن پروژه</span>
                <ArrowUpLeft aria-hidden="true" />
              </button>

              <div className="gallery__arrows" role="group" aria-label="پیمایش پروژه‌ها">
                <button type="button" aria-label="پروژهٔ قبلی" onClick={() => goToProject(activeIndex - 1)}>
                  <ChevronRight aria-hidden="true" />
                </button>
                <button type="button" aria-label="پروژهٔ بعدی" onClick={() => goToProject(activeIndex + 1)}>
                  <ChevronLeft aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="gallery__dots" role="group" aria-label="انتخاب نمونه‌کار">
              {items.map((project, index) => (
                <button
                  key={project.id}
                  type="button"
                  className={cn("gallery__dot", activeIndex === index && "gallery__dot--active")}
                  aria-label={`رفتن به پروژهٔ ${project.name}`}
                  aria-current={activeIndex === index ? "true" : undefined}
                  onClick={() => goToProject(index)}
                >
                  <span>{toRoman(project.index)}</span>
                  <em>{project.name}</em>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
