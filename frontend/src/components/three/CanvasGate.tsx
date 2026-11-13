"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";

import { useMounted, useReducedMotion } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useCanvasArbiter } from "@/stores/ui";

let webglSupport: boolean | null = null;
/** Probe once for a usable WebGL context. */
export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    webglSupport = Boolean(gl);
    (gl as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

class SceneBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type SceneControls = {
  /** The scene calls this once its first frame is on screen */
  onReady: () => void;
  /** The scene calls this if the device cannot keep up; the 2D version takes over */
  onStruggle: () => void;
};

/**
 * Gatekeeper for a 3D section.
 *  - `poster` is the complete 2D version of the section. It is what is server-rendered,
 *    what shows while the 3D bundle loads, and what stays if 3D is unavailable (no WebGL,
 *    reduced motion, a crash, or a device that cannot hold the frame rate).
 *  - `scene` mounts only while this is the most visible 3D section, so there is never
 *    more than one WebGL context alive.
 */
export function CanvasGate({
  id, poster, scene, className, force2D = false,
}: {
  id: string;
  poster: ReactNode;
  scene: (controls: SceneControls) => ReactNode;
  className?: string;
  force2D?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const reduce = useReducedMotion();
  const report = useCanvasArbiter((s) => s.report);
  const active = useCanvasArbiter((s) => s.active === id);
  const [broken, setBroken] = useState(false);
  const [ready, setReady] = useState(false);

  const allowed = mounted && !reduce && !broken && !force2D && hasWebGL();

  useEffect(() => {
    const el = box.current;
    if (!el || !allowed) return;
    const observer = new IntersectionObserver(
      ([entry]) => report(id, entry.isIntersecting ? Math.max(entry.intersectionRatio, 0.03) : 0),
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: "120px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      report(id, 0);
    };
  }, [allowed, id, report]);

  const show3D = allowed && active;
  useEffect(() => {
    if (!show3D) setReady(false);
  }, [show3D]);

  return (
    <div ref={box} className={cn("relative", className)} data-three={show3D && ready ? "on" : "off"} data-gate={broken ? "broken" : !allowed ? "2d" : active ? "active" : "waiting"}>
      <div
        className={cn("absolute inset-0 transition-opacity duration-700", show3D && ready && "pointer-events-none opacity-0")}
        // Hidden from assistive tech while the 3D version (with its own controls) is showing.
        aria-hidden={show3D && ready ? true : undefined}
        inert={show3D && ready ? true : undefined}
      >
        {poster}
      </div>
      {show3D && (
        <div className={cn("absolute inset-0 transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}>
          <SceneBoundary onError={() => setBroken(true)}>
            {scene({ onReady: () => setReady(true), onStruggle: () => setBroken(true) })}
          </SceneBoundary>
        </div>
      )}
    </div>
  );
}
