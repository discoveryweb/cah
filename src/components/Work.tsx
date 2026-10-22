import { useEffect, useRef, useState } from "react";
import { ArrowUpLeft, X } from "lucide-react";
import { WORK } from "../data";
import { Button, Reveal } from "./ui";
import { CircularGallery } from "./CircularGallery";

type Project = (typeof WORK)[number];

export function Work({ onOrder }: { onOrder: () => void }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const open = (index: number) => {
    lastTrigger.current = document.activeElement as HTMLElement | null;
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
              شده است. اسکرول کنید تا حلقهٔ کارها بچرخد، یا روی کارتِ جلو بزنید تا پروژه باز شود.
            </p>
          </div>
        </Reveal>
      </div>

      <CircularGallery items={WORK} onOpen={open} />

      <div className="frame">
        <Reveal className="work__foot" delay={120}>
          <span className="work__foot-note">۳ پروژه در این مجموعه — آرشیو کامل با درخواست</span>
          <button type="button" className="work__all" onClick={onOrder} data-cursor="hover">
            <span>درخواست آرشیو کامل</span>
            <ArrowUpLeft aria-hidden="true" />
          </button>
        </Reveal>
      </div>

      {openIndex !== null ? (
        <ProjectOverlay
          projects={WORK}
          index={openIndex}
          onClose={() => {
            setOpenIndex(null);
            lastTrigger.current?.focus();
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
