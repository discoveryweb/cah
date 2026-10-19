import { useEffect, useRef, useState } from "react";

type CursorMode = "default" | "hover" | "view";

/**
 * A two-part pointer: a precise vermilion dot and a trailing ring that names the
 * action underneath it. Native cursors are hidden only on precise pointers;
 * form fields keep their own I-beam and hide the custom pair.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CursorMode>("default");
  const [label, setLabel] = useState("");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;
    let frame = 0;

    const render = () => {
      ringX += (pointerX - ringX) * 0.15;
      ringY += (pointerY - ringY) * 0.15;
      ring.style.transform = `translate3d(${ringX.toFixed(2)}px, ${ringY.toFixed(2)}px, 0)`;
      frame = window.requestAnimationFrame(render);
    };

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      setHidden(false);
    };

    const onOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;

      if (target.closest("input, textarea, select, [contenteditable='true']")) {
        setMode("default");
        setHidden(true);
        return;
      }

      const trigger = target.closest<HTMLElement>("[data-cursor]");
      if (!trigger) {
        setMode("default");
        setLabel("");
        return;
      }

      const kind = trigger.dataset.cursor;
      if (kind === "view") {
        setMode("view");
        setLabel(trigger.dataset.cursorLabel ?? "مشاهده");
        return;
      }
      setMode("hover");
      setLabel("");
    };

    const onLeave = () => setHidden(true);
    const onEnter = () => setHidden(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      root.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className={`cursor${hidden ? " cursor--hidden" : ""}`} aria-hidden="true" />
      <div
        ref={ringRef}
        className={[
          "cursor-ring",
          mode === "hover" ? "cursor-ring--hover" : "",
          mode === "view" ? "cursor-ring--view" : "",
          hidden ? "cursor-ring--hidden" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        <span className="cursor-ring__label">{label}</span>
      </div>
    </>
  );
}
