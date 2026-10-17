import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import cahenMark from "../assets/cahen-mark.png";
import { isLowEndDevice, supportsWebGL } from "../utils/capabilities";
import type { ParticleObjectProps } from "./canvasui/ParticleObject";

const PARTICLE_OPTIONS: Omit<ParticleObjectProps, "src" | "className" | "style" | "onLoad" | "onError"> = {
  count: 7600,
  size: 2.3,
  sizeVariance: 0.28,
  color: "",
  background: "",
  scale: 3.55,
  cameraDistance: 4.1,
  fov: 62,
  radius: 82,
  strength: 0.62,
  swirl: 0.42,
  spring: 1.15,
  damping: 0.48,
  drift: 0.24,
  floatIntensity: 0.32,
  rotationIntensity: 0.1,
  floatSpeed: 0.75,
  orbit: false,
  zoom: false,
  autoRotate: false,
};

type ParticleObjectComponent = ComponentType<ParticleObjectProps>;

export function ParticleLogo() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ParticleObject, setParticleObject] = useState<ParticleObjectComponent | null>(null);
  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setLoaded(false);
    setFailed(true);
  }, []);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wrapper = wrapperRef.current;
    let isInView = false;
    const syncMotionAndCapability = () => {
      setMotionReady(isInView && !motionQuery.matches && !isLowEndDevice() && supportsWebGL());
    };

    motionQuery.addEventListener("change", syncMotionAndCapability);

    if (!wrapper || typeof IntersectionObserver === "undefined") {
      setVisible(false);
      return () => motionQuery.removeEventListener("change", syncMotionAndCapability);
    }

    const observer = new IntersectionObserver(([entry]) => {
      isInView = Boolean(entry?.isIntersecting);
      setVisible(isInView);
      syncMotionAndCapability();
    }, { rootMargin: "120px 0px", threshold: 0.01 });
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
    return () => { cancelled = true; };
  }, [motionReady, visible, failed, ParticleObject]);

  useEffect(() => {
    setLoaded(false);
  }, [motionReady, visible]);

  return (
    <div ref={wrapperRef} className={`particle-logo-stage ${loaded ? "particle-logo-stage--loaded" : ""}`}>
      <img className="particle-logo-static" src={cahenMark} alt="نشان CAHEN" width={736} height={600} />
      {motionReady && visible && !failed && ParticleObject && (
        <ParticleObject
          {...PARTICLE_OPTIONS}
          src={cahenMark}
          className="particle-logo-canvas"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
}
