import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createRectCache } from "./canvasui/rect-cache";
import { Move3d } from "lucide-react";
import { ParticleLogo, type ParticleLogoStatus } from "./ParticleLogo";

/**
 * The studio mark as a live particle plate: a printed plate for the identity,
 * tilted with the pointer, with the mark rebuilt from ~9k particles in WebGL.
 */
export function MarkStage({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ParticleLogoStatus>("idle");
  const [touched, setTouched] = useState(false);
  const frame = useRef(0);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  /** Asks the tilt spring for a frame; set by the effect, called by the pointer. */
  const wake = useRef<() => void>(() => {});

  const handleStatus = useCallback((next: ParticleLogoStatus) => setStatus(next), []);

  /**
   * The tilt is a spring, and it only runs while it is actually moving and the
   * plate is on screen. It used to start a frame loop on mount and write four
   * custom properties every frame for the whole session — a permanent style
   * recalculation three screens before the reader ever arrives, which is felt
   * as a heavier page everywhere else.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;

    let inView = false;
    const paint = () => {
      stage.style.setProperty("--tilt-x", current.current.x.toFixed(3));
      stage.style.setProperty("--tilt-y", current.current.y.toFixed(3));
      stage.style.setProperty("--shift-x", `${(current.current.x * 12).toFixed(2)}px`);
      stage.style.setProperty("--shift-y", `${(current.current.y * 12).toFixed(2)}px`);
    };

    const render = () => {
      frame.current = 0;
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      current.current.x += dx * 0.12;
      current.current.y += dy * 0.12;
      paint();
      // Settled: no frame is requested until the pointer asks for one.
      if (inView && Math.abs(dx) + Math.abs(dy) > 0.002) {
        frame.current = window.requestAnimationFrame(render);
      }
    };
    const request = () => {
      if (!frame.current && inView) frame.current = window.requestAnimationFrame(render);
    };
    wake.current = request;

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              inView = Boolean(entry?.isIntersecting);
              if (inView) request();
            },
            { rootMargin: "120px 0px" },
          );
    observer?.observe(stage);

    return () => {
      observer?.disconnect();
      wake.current = () => {};
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  const box = useRef<ReturnType<typeof createRectCache> | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    box.current = createRectCache(stage);
    return () => box.current?.destroy();
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = box.current?.current ?? stage.getBoundingClientRect();
    target.current = {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    };
    wake.current();
    if (!touched) setTouched(true);
  };

  const onPointerLeave = () => {
    target.current = { x: 0, y: 0 };
    wake.current();
  };

  const label =
    status === "live"
      ? "ذرات زنده — با ماوس حرکت کنید"
      : status === "static"
        ? "نسخهٔ ثابت نشان"
        : "در حال ساخت ذرات…";

  return (
    <div
      ref={stageRef}
      className={["mark-stage", className].filter(Boolean).join(" ")}
      data-mode={status}
      data-touched={touched}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className="mark-stage__glow mark-stage__glow--one" aria-hidden="true" />
      <span className="mark-stage__glow mark-stage__glow--two" aria-hidden="true" />

      <div className="mark-stage__inner">
        <span className="mark-stage__grid" aria-hidden="true" />
        <span className="mark-stage__axis mark-stage__axis--v" aria-hidden="true" />
        <span className="mark-stage__axis mark-stage__axis--h" aria-hidden="true" />
        <span className="mark-stage__ring mark-stage__ring--outer" aria-hidden="true" />
        <span className="mark-stage__ring mark-stage__ring--inner" aria-hidden="true" />
        <span className="mark-stage__halo" aria-hidden="true" />

        <div className="mark-stage__object">
          <ParticleLogo onStatusChange={handleStatus} />
        </div>

        <span className="mark-stage__corner mark-stage__corner--tl" aria-hidden="true" />
        <span className="mark-stage__corner mark-stage__corner--tr" aria-hidden="true" />
        <span className="mark-stage__corner mark-stage__corner--bl" aria-hidden="true" />
        <span className="mark-stage__corner mark-stage__corner--br" aria-hidden="true" />
      </div>

      <div className="mark-stage__rail">
        <span className="mark-stage__tag" dir="ltr">
          MARK / I
        </span>
        <span className="mark-stage__dash" aria-hidden="true" />
        <span className="mark-stage__tag" dir="ltr">
          PARTICLE SYSTEM
        </span>
      </div>

      <div className="mark-stage__rail mark-stage__rail--bottom">
        <span className="mark-stage__live" data-live={status === "live"}>
          <i aria-hidden="true" />
          {label}
        </span>
        <span className="mark-stage__tag mark-stage__tag--dim" dir="ltr">
          35.6892° N
        </span>
      </div>

      <span className="mark-stage__hint" aria-hidden="true">
        <Move3d />
        حرکت دهید
      </span>
    </div>
  );
}
