"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

import type { SceneControls } from "./CanvasGate";
import { presetFor } from "./fabric";
import { FabricMesh, newMotion, type FabricShape } from "./FabricMesh";

/** "Feel the Fabric": one piece of cloth you can drag to watch how the fabric moves. */
function Cloth({ url, fabric, shape, onReady }: { url: string; fabric: string; shape: FabricShape; onReady: () => void }) {
  const { gl } = useThree();
  const motion = useRef(newMotion());
  const physics = useRef({ angle: 0, velocity: 0, push: 0, dragging: false });
  const frames = useRef(0);
  const preset = presetFor(fabric);
  const hanging = shape === "hanging-garment";

  useEffect(() => {
    const el = gl.domElement;
    const p = physics.current;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      p.dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!p.dragging) return;
      p.push += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const up = () => {
      p.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.style.touchAction = "pan-y";
    el.style.cursor = "grab";
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.04);
    const p = physics.current;
    // The drag pushes the cloth; the fabric's own weight decides how it answers.
    p.velocity += (-preset.stiffness * p.angle - preset.damping * p.velocity + p.push * 60 * preset.inertia) * dt;
    p.push *= Math.exp(-dt * 12);
    p.angle = THREE.MathUtils.clamp(p.angle + p.velocity * dt, -0.8, 0.8);
    motion.current.swing = p.angle;
    motion.current.flutter = Math.min(1, Math.abs(p.velocity) * 0.25);
    if (++frames.current === 3) onReady();
  });

  return (
    <group position={[0, hanging ? 1.55 : 1.45, 0]}>
      <FabricMesh
        url={url} fabric={fabric} shape="hanging-garment" height={hanging ? 3.1 : 2.9} motion={motion}
        segments={[64, 96]} dimColor="#F2D4D0"
      />
    </group>
  );
}

export default function FabricViewer({
  url, fabric, shape, controls,
}: { url: string; fabric: string; shape: string; controls: SceneControls }) {
  return (
    <Canvas
      flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 0, 7.2] }} gl={{ antialias: true, alpha: true }}
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", controls.onStruggle)}
    >
      <Suspense fallback={null}>
        <Cloth url={url} fabric={fabric} shape={shape as FabricShape} onReady={controls.onReady} />
      </Suspense>
    </Canvas>
  );
}
