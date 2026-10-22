import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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

  const handleStatus = useCallback((next: ParticleLogoStatus) => setStatus(next), []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;

    const render = () => {
      current.current.x += (target.current.x - current.current.x) * 0.12;
      current.current.y += (target.current.y - current.current.y) * 0.12;
      stage.style.setProperty("--tilt-x", current.current.x.toFixed(3));
      stage.style.setProperty("--tilt-y", current.current.y.toFixed(3));
      stage.style.setProperty("--shift-x", `${(current.current.x * 12).toFixed(2)}px`);
      stage.style.setProperty("--shift-y", `${(current.current.y * 12).toFixed(2)}px`);
      frame.current = window.requestAnimationFrame(render);
    };
    frame.current = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame.current);
  }, []);

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    target.current = {
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    };
    if (!touched) setTouched(true);
  };

  const onPointerLeave = () => {
    target.current = { x: 0, y: 0 };
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
