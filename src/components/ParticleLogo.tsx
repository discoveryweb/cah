import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import cahenMark from "../assets/cahen-mark.webp";
import { supportsWebGL } from "../utils/capabilities";
import { violetMarkTexture } from "../utils/markTexture";
import type { ParticleObjectProps } from "./canvasui/ParticleObject";

const CORE_COUNT = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 4 : 4;
const BUDGET_SCALE = CORE_COUNT <= 2 ? 0.55 : CORE_COUNT <= 4 ? 0.8 : 1;

/**
 * A phone paints the same plate on a third of the pixels and has a fraction of
 * the fill rate, so the cloud is rebuilt from fewer, slightly larger points.
 * Above ~2.5k points the mark stops reading as particles and starts reading as
 * a slow surface; below it, the silhouette is lost. This is that window.
 */
const COMPACT = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
const POINT_BUDGET = COMPACT ? 2400 : 9000;

const PARTICLE_OPTIONS: Omit<ParticleObjectProps, "src" | "className" | "style" | "onLoad" | "onError"> = {
  count: Math.round(POINT_BUDGET * BUDGET_SCALE),
  size: COMPACT ? 3.1 : 2.55,
  sizeVariance: 0.3,
  /**
   * Empty keeps the mark's own chrome. The plate lifts its brightness in CSS so
   * the dark indigo facets of the shipped asset still read on a dark ground.
   */
  color: "",
  background: "",
  scale: 3.5,
  cameraDistance: 4.1,
  fov: 62,
  radius: COMPACT ? 58 : 88,
  strength: COMPACT ? 0.52 : 0.66,
  swirl: COMPACT ? 0.34 : 0.46,
  spring: 1.12,
  damping: 0.46,
  drift: 0.26,
  floatIntensity: 0.4,
  rotationIntensity: 0.12,
  floatSpeed: 0.78,
  orbit: false,
  zoom: false,
  autoRotate: false,
};

type ParticleObjectComponent = ComponentType<ParticleObjectProps>;
export type ParticleLogoStatus = "idle" | "live" | "static";

export function ParticleLogo({ onStatusChange }: { onStatusChange?: (status: ParticleLogoStatus) => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ParticleObject, setParticleObject] = useState<ParticleObjectComponent | null>(null);
  const [texture, setTexture] = useState(cahenMark);
  const handleError = useCallback(() => {
    setLoaded(false);
    setFailed(true);
  }, []);
  const handleLoad = useCallback(() => setLoaded(true), []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wrapper = wrapperRef.current;
    let isInView = false;
    const syncMotionAndCapability = () => {
      // Capability (not device tier) decides: low-core devices still get a lighter cloud.
      const unavailable = motionQuery.matches || !supportsWebGL();
      setMotionReady(isInView && !unavailable);
    };

    motionQuery.addEventListener("change", syncMotionAndCapability);

    if (!wrapper || typeof IntersectionObserver === "undefined") {
      setVisible(false);
      return () => motionQuery.removeEventListener("change", syncMotionAndCapability);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInView = Boolean(entry?.isIntersecting);
        setVisible(isInView);
        syncMotionAndCapability();
      },
      { rootMargin: "160px 0px", threshold: 0.01 }
    );
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener("change", syncMotionAndCapability);
    };
  }, []);

  useEffect(() => {
    if (!motionReady || !visible || failed || ParticleObject) return;
    let cancelled = false;
    import("./canvasui/ParticleObject")
      .then((module) => {
        if (!cancelled) setParticleObject(() => module.ParticleObject);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [motionReady, visible, failed, ParticleObject]);

  // Recolour the mark once it is close to the viewport, then hand it to the cloud.
  useEffect(() => {
    if (!visible || texture !== cahenMark) return;
    let cancelled = false;
    violetMarkTexture(cahenMark)
      .then((url) => {
        if (!cancelled) setTexture(url);
      })
      .catch(() => {
        /* keep the original asset — the plate's CSS still lifts it */
      });
    return () => {
      cancelled = true;
    };
  }, [visible, texture]);

  // Report the mode so the plate can label itself honestly.
  useEffect(() => {
    if (loaded) onStatusChange?.("live");
  }, [loaded, onStatusChange]);

  useEffect(() => {
    if (failed) onStatusChange?.("static");
  }, [failed, onStatusChange]);

  const textured = texture !== cahenMark;
  const live = motionReady && visible && !failed && Boolean(ParticleObject) && textured;

  return (
    <div
      ref={wrapperRef}
      className="particle-logo-stage"
      data-live={live}
      data-loaded={loaded}
      data-textured={textured}
    >
      {/* A soft silhouette keeps the mark readable behind and before the cloud. */}
      <img
        className="particle-logo-ghost"
        src={texture}
        alt=""
        aria-hidden="true"
        width={736}
        height={600}
        decoding="async"
        draggable={false}
      />
      <img
        className={`particle-logo-static${loaded ? " is-loaded" : ""}`}
        src={texture}
        alt="نشان CAHEN"
        width={736}
        height={600}
        decoding="async"
        draggable={false}
      />
      {live && ParticleObject ? (
        <ParticleObject
          {...PARTICLE_OPTIONS}
          src={texture}
          className="particle-logo-canvas"
          onLoad={handleLoad}
          onError={handleError}
        />
      ) : null}
    </div>
  );
}
