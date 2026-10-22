import { ParticleLogo } from "./ParticleLogo";

/**
 * The studio mark as a live particle plate. It lives in the about section so
 * the identity is introduced before the work, framed like a printed plate.
 */
export function MarkStage({ className }: { className?: string }) {
  return (
    <div className={["mark-stage", className].filter(Boolean).join(" ")}>
      <span className="mark-stage__grid" aria-hidden="true" />
      <span className="mark-stage__ring mark-stage__ring--outer" aria-hidden="true" />
      <span className="mark-stage__ring mark-stage__ring--inner" aria-hidden="true" />
      <span className="mark-stage__corner mark-stage__corner--tl" aria-hidden="true" />
      <span className="mark-stage__corner mark-stage__corner--br" aria-hidden="true" />

      <div className="mark-stage__object">
        <ParticleLogo />
      </div>

      <span className="mark-stage__tag mark-stage__tag--tl" dir="ltr">
        MARK / I
      </span>
      <span className="mark-stage__tag mark-stage__tag--tr" dir="ltr">
        PARTICLE SYSTEM
      </span>
      <span className="mark-stage__tag mark-stage__tag--bl">
        <i aria-hidden="true" />
        زنده — با ماوس حرکت کنید
      </span>
      <span className="mark-stage__tag mark-stage__tag--br" dir="ltr">
        35.6892° N
      </span>
    </div>
  );
}
