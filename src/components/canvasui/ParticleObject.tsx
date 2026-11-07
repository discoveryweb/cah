import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  createParticleObject,
  type ParticleObjectInstance,
  type ParticleObjectOptions,
} from "./ParticleObjectVanilla";

/**
 * CanvasUI Particle Object React adapter.
 * Upstream: https://github.com/DavidHDev/canvas-ui/tree/main/src/lib/ParticleObject
 * Copyright (c) 2026 David Haz — license terms are in licenses/CANVAS-UI-LICENSE.md.
 */
export interface ParticleObjectProps extends ParticleObjectOptions {
  className?: string;
  style?: CSSProperties;
}

export function ParticleObject({ className, style, ...options }: ParticleObjectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<ParticleObjectInstance | null>(null);
  const [initialOptions] = useState(options);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      instanceRef.current = createParticleObject({ canvas }, initialOptions);
    } catch (error) {
      initialOptions.onError?.(error);
    }

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [initialOptions]);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  });

  return (
    <div className={className} style={{ position: "relative", ...style }} aria-hidden="true">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "pan-y",
        }}
      />
    </div>
  );
}

export type { ParticleObjectInstance, ParticleObjectOptions };
export default ParticleObject;
