import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpLeft, X } from "lucide-react";
import { WORK } from "../data";
import { Button, Reveal } from "./ui";

type Project = (typeof WORK)[number];

export function Work({ onOrder }: { onOrder: () => void }) {
  const [active, setActive] = useState<number | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  const lastRow = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (active === null) return;
    const preview = previewRef.current;
    if (!preview) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const render = () => {
      current.current.x += (target.current.x - current.current.x) * 0.16;
      current.current.y += (target.current.y - current.current.y) * 0.16;
      const dx = target.current.x - current.current.x;
      preview.style.transform = `translate3d(${(current.current.x - 150).toFixed(2)}px, ${(
        current.current.y - 200
      ).toFixed(2)}px, 0) rotate(${Math.max(-4, Math.min(4, dx * 0.02)).toFixed(2)}deg)`;
      frame.current = window.requestAnimationFrame(render);
    };
    frame.current = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame.current);
  }, [active]);

  const track = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    target.current = { x: event.clientX, y: event.clientY };
  }, []);

  const open = (index: number, row?: HTMLButtonElement | null) => {
    lastRow.current = row ?? null;
    setOpenIndex(index);
  };

  return (
    <section id="work" className="chapter theme-ink work" data-invert aria-labelledby="work-title">
      <div className="frame">
        <Reveal className="work__head" as="header">
          <div className="section-head__aside">
            <span className="work__index" dir="ltr">
              02 — WORK
            </span>
            <span className="label label--plain" dir="ltr">
              SELECTED WORK
            </span>
          </div>
          <div>
            <h2 className="work__title" id="work-title">
              کارهایی که <span className="accent">دیده</span> شدند
              <span className="hero__dot" aria-hidden="true" />
            </h2>
            <p className="work__note">
              سه پروژه از مجموعه؛ هر کدام با یک مسئلهٔ مشخص شروع شده و با یک سیستمِ قابلِ استفاده تمام
              شده است. روی هر ردیف مکث کنید تا تصویرش را ببینید.
            </p>
          </div>
        </Reveal>

        <div onPointerMove={track} onPointerLeave={() => setActive(null)}>
          <ul className="work__list" aria-label="فهرست پروژه‌ها">
            {WORK.map((project, index) => (
              <li key={project.id}>
                <Reveal delay={index * 70}>
                  <button
                    type="button"
                    className="work__row"
                    data-cursor="hidden"
                    onPointerEnter={(event) => {
                      setActive(index);
                      target.current = { x: event.clientX, y: event.clientY };
                      current.current = { x: event.clientX, y: event.clientY };
                    }}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                    onClick={(event) => open(index, event.currentTarget)}
                    aria-label={`مشاهدهٔ پروژهٔ ${project.name} — ${project.title}`}
                  >
                    <span className="work__row-index" dir="ltr">
                      {project.index}
                    </span>
                    <span className="work__row-main">
                      <span className="work__row-name" dir="ltr">
                        {project.name}
                      </span>
                      <span className="work__row-desc">{project.title}</span>
                    </span>
                    <span className="work__row-side">
                      <span className="work__row-meta" dir="ltr">
                        {project.category} · {project.year}
                      </span>
                      <span className="work__row-thumb">
                        <img src={project.image} alt="" loading="lazy" decoding="async" />
                      </span>
                      <ArrowUpLeft className="work__row-arrow" aria-hidden="true" />
                    </span>
                  </button>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>

        <Reveal className="work__foot" delay={120}>
          <span className="work__foot-note">۳ پروژه در این مجموعه — آرشیو کامل با درخواست</span>
          <button type="button" className="work__all" onClick={onOrder} data-cursor="hover">
            <span>درخواست آرشیو کامل</span>
            <ArrowUpLeft aria-hidden="true" />
          </button>
        </Reveal>
      </div>

      <div
        ref={previewRef}
        className={`work__preview${active !== null ? " work__preview--on" : ""}`}
        aria-hidden="true"
      >
        {WORK.map((project, index) => (
          <img
            key={project.id}
            src={project.image}
            alt=""
            data-active={active === index}
            loading="lazy"
            decoding="async"
          />
        ))}
        <span className="work__preview-label" dir="ltr">
          VIEW PROJECT ↗
        </span>
      </div>

      {openIndex !== null ? (
        <ProjectOverlay
          projects={WORK}
          index={openIndex}
          onClose={() => {
            setOpenIndex(null);
            lastRow.current?.focus();
          }}
          onNavigate={setOpenIndex}
          onOrder={onOrder}
        />
      ) : null}
    </section>
  );
}

function ProjectOverlay({
  projects,
  index,
  onClose,
  onNavigate,
  onOrder,
}: {
  projects: readonly Project[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onOrder: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const project = projects[index];
  const next = projects[(index + 1) % projects.length];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 80);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="project"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-title"
      ref={dialogRef}
    >
      <div className="project__bar">
        <span className="project__bar-label" dir="ltr">
          CASE STUDY — {project.index} / {String(projects.length).padStart(2, "0")}
        </span>
        <button type="button" className="project__close" onClick={onClose} ref={closeRef}>
          <span>بستن</span>
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="project__scroll">
        <div className="project__inner">
          <div className="project__top">
            <div>
              <h3 className="project__name" id="project-title" dir="ltr">
                {project.name}
              </h3>
              <p className="project__tagline">{project.title}</p>
            </div>
            <dl className="project__facts">
              <div className="project__fact">
                <dt>سال</dt>
                <dd>{project.year}</dd>
              </div>
              <div className="project__fact">
                <dt>حوزه</dt>
                <dd>{project.sector}</dd>
              </div>
              <div className="project__fact">
                <dt>نقش</dt>
                <dd>{project.role}</dd>
              </div>
              <div className="project__fact">
                <dt>دسته</dt>
                <dd dir="ltr">{project.category}</dd>
              </div>
            </dl>
          </div>

          <div className="project__media">
            <img src={project.image} alt={project.alt} />
          </div>

          <div className="project__body">
            <div>
              <h3>روایت پروژه</h3>
              <div className="project__metrics">
                {project.metrics.map((metric) => (
                  <div key={metric.label}>
                    <strong>{metric.value}</strong>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p>{project.intro}</p>
              <p className="project__lede">{project.challenge}</p>
              <p>{project.result}</p>
              <div className="project__tags">
                {project.deliverables.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="project__next">
            <span>پروژهٔ بعدی</span>
            <button type="button" onClick={() => onNavigate((index + 1) % projects.length)}>
              <span dir="ltr">{next.name}</span>
              <ArrowUpLeft aria-hidden="true" />
            </button>
            <Button onClick={onOrder} variant="light">
              گفت‌وگو دربارهٔ پروژهٔ شما
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
