"use client";

import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import type { Product } from "@/lib/types";
import { media } from "@/lib/utils";
import { useUI } from "@/stores/ui";

import type { SceneControls } from "./CanvasGate";
import { FabricMesh, newMotion, type FabricShape } from "./FabricMesh";

export type RingApi = { step: (direction: 1 | -1) => void };

type RingState = {
  angle: number;
  velocity: number;
  target: number | null;
  dragging: boolean;
  dragged: number;
  hovered: number;
  born: number;
};

const TWO_PI = Math.PI * 2;

function softDot(inner: string, outer: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Light motes drifting up through the haze. */
function Particles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const texture = useMemo(() => softDot("rgba(255,240,205,1)", "rgba(255,240,205,0)"), []);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 9 - 1;
      speeds[i] = 0.08 + Math.random() * 0.2;
    }
    return { positions, speeds };
  }, [count]);

  useFrame((state, delta) => {
    const attribute = points.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (!attribute) return;
    const array = attribute.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] += speeds[i] * delta;
      array[i * 3] += Math.sin(t * 0.3 + i) * 0.0015;
      if (array[i * 3 + 1] > 4.2) array[i * 3 + 1] = -4.2;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial map={texture} size={0.14} transparent opacity={0.85} depthWrite={false} color="#E9C77A" sizeAttenuation />
    </points>
  );
}

/** Soft pools of warm light behind the ring: the "bloom" of the scene, without a post pass. */
function Glows({ x }: { x: number }) {
  const gold = useMemo(() => softDot("rgba(255,226,170,0.85)", "rgba(255,226,170,0)"), []);
  const blush = useMemo(() => softDot("rgba(255,255,255,0.9)", "rgba(255,255,255,0)"), []);
  const a = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (a.current) a.current.scale.setScalar(9 + Math.sin(state.clock.elapsedTime * 0.4) * 0.6);
  });
  return (
    <group position={[x, 0, -3.2]}>
      <mesh ref={a} position={[0.6, 0.8, 0]}>
        <planeGeometry />
        <meshBasicMaterial map={gold} transparent depthWrite={false} opacity={0.75} />
      </mesh>
      <mesh position={[-2.6, -1.2, 0.4]} scale={8}>
        <planeGeometry />
        <meshBasicMaterial map={blush} transparent depthWrite={false} opacity={0.8} />
      </mesh>
    </group>
  );
}

function Item({
  product, index, count, radius, height, segments, ring, onSelect,
}: {
  product: Product; index: number; count: number; radius: number; height: number; segments: [number, number];
  ring: RefObject<RingState>; onSelect: (product: Product) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef(newMotion());
  const lift = useRef(0);
  const angle = (index / count) * TWO_PI;
  const garment = product.shape_preset === "hanging-garment";
  const shape: FabricShape = garment ? "hanging-garment" : "flat";
  const texture = product.fabric_texture;
  const url = media(texture ?? product.media.find((m) => m.image)?.image);

  useFrame((state, delta) => {
    const g = group.current;
    const r = ring.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);
    // Intro: pieces drift up out of the haze one after another, fluttering as they settle.
    const age = state.clock.elapsedTime - r.born - index * 0.14;
    const intro = THREE.MathUtils.smootherstep(age, 0, 1.8);
    // 1 when this piece faces the camera, -1 at the back of the ring
    const facing = Math.cos(angle + r.angle);
    const hovered = r.hovered === index;
    lift.current += ((hovered ? 1 : 0) - lift.current) * (1 - Math.exp(-dt * 6));

    const out = radius + lift.current * 0.55;
    g.position.set(Math.sin(angle) * out, (1 - intro) * -1.6 + Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.07, Math.cos(angle) * out);
    g.scale.setScalar((0.72 + 0.28 * intro) * (1 + lift.current * 0.07));

    const m = motion.current;
    m.flutter = Math.min(1, Math.abs(r.velocity) * 0.55) + (1 - intro) * 0.9;
    m.hover = lift.current;
    // Pieces at the back sink into the haze.
    m.dim = THREE.MathUtils.clamp((0.35 - facing) * 0.62, 0, 0.72);
    m.opacity = intro;
    // Cloth trails behind the ring's rotation.
    m.swing = THREE.MathUtils.clamp(-r.velocity * 0.16, -0.5, 0.5);
  });

  return (
    <group ref={group} rotation={[0, angle, 0]}>
      <group position={[0, garment ? height / 2 : 0, 0]}>
        <FabricMesh
          url={url} fabric={product.fabric} shape={shape} height={height} segments={segments} motion={motion}
          seed={index} rounded={!texture}
          onPointerOver={(e) => {
            e.stopPropagation();
            ring.current.hovered = index;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            if (ring.current.hovered === index) ring.current.hovered = -1;
            document.body.style.cursor = "";
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (ring.current.dragged < 8) onSelect(product);
          }}
        />
      </group>
    </group>
  );
}

function Ring({
  products, mobile, api, onActive, onSelect,
}: {
  products: Product[]; mobile: boolean; api: RefObject<RingApi | null>; onActive: (index: number) => void;
  onSelect: (product: Product) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const { gl, camera, clock } = useThree();
  const count = products.length;
  const step = TWO_PI / count;
  const ring = useRef<RingState>({ angle: 0, velocity: 0, target: null, dragging: false, dragged: 0, hovered: -1, born: clock.elapsedTime });
  const active = useRef(0);
  const radius = mobile ? 2.2 : 2.8;
  const height = mobile ? 2.0 : 2.2;
  const segments: [number, number] = mobile ? [32, 48] : [64, 96];
  const x = mobile ? 0 : 3.0;

  useEffect(() => {
    api.current = {
      step: (direction) => {
        const r = ring.current;
        const current = Math.round(r.angle / step);
        r.target = (current - direction) * step;
        r.velocity = 0;
      },
    };
    return () => {
      api.current = null;
    };
  }, [api, step]);

  // Drag or swipe to spin the ring. Vertical swipes are left to the page scroll.
  useEffect(() => {
    const el = gl.domElement;
    const r = ring.current;
    let lastX = 0;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      r.dragging = true;
      r.dragged = 0;
      r.target = null;
      lastX = e.clientX;
      lastT = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!r.dragging) return;
      const dx = e.clientX - lastX;
      const now = performance.now();
      const dt = Math.max(now - lastT, 8) / 1000;
      r.dragged += Math.abs(dx);
      const dAngle = dx * (mobile ? 0.011 : 0.0055);
      r.angle += dAngle;
      r.velocity = THREE.MathUtils.clamp(dAngle / dt, -5, 5);
      lastX = e.clientX;
      lastT = now;
    };
    const up = () => {
      r.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.style.touchAction = "pan-y";
    el.style.cursor = "grab";
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.cursor = "";
    };
  }, [gl, mobile]);

  useFrame((state, delta) => {
    const r = ring.current;
    const dt = Math.min(delta, 0.05);
    if (!r.dragging) {
      if (r.target !== null) {
        const diff = r.target - r.angle;
        const move = diff * (1 - Math.exp(-dt * 4.5));
        r.angle += move;
        r.velocity = move / dt;
        if (Math.abs(diff) < 0.002) {
          r.angle = r.target;
          r.target = null;
          r.velocity = 0;
        }
      } else {
        r.angle += r.velocity * dt;
        r.velocity *= Math.exp(-dt * 2.0);
        // Idle: a slow, steady turn that pauses while a piece is being looked at.
        if (r.hovered < 0 && !useUI.getState().quickView) r.angle -= dt * 0.085;
      }
    }
    if (group.current) group.current.rotation.y = r.angle;

    const front = ((Math.round(-r.angle / step) % count) + count) % count;
    if (front !== active.current) {
      active.current = front;
      onActive(front);
    }

    // Camera: sinks gently as the page scrolls, and leans in while a product is open.
    const scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    const open = useUI.getState().quickView ? 1 : 0;
    const targetZ = (mobile ? 9.6 : 9.2) - open * 0.9;
    camera.position.z += (targetZ - camera.position.z) * (1 - Math.exp(-dt * 2.5));
    camera.position.y += (0.35 + scroll * 1.3 - camera.position.y) * (1 - Math.exp(-dt * 4));
    camera.position.x = state.pointer.x * 0.25;
    camera.lookAt(x * 0.5, 0.2 + scroll * 0.4, 0);
  });

  return (
    <>
      <Glows x={x} />
      <group position={[x, mobile ? 0.1 : 0.42, 0]} rotation={[0.09, 0, 0]}>
        <group ref={group}>
          {products.map((product, i) => (
            <Suspense key={product.id} fallback={null}>
              <Item
                product={product} index={i} count={count} radius={radius} height={height} segments={segments}
                ring={ring} onSelect={onSelect}
              />
            </Suspense>
          ))}
        </group>
      </group>
      <Particles count={mobile ? 45 : 110} />
    </>
  );
}

function Ready({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  useFrame(() => {
    if (++frames.current === 3) onReady();
  });
  return null;
}

export default function HeroScene({
  products, mobile, api, onActive, onSelect, controls,
}: {
  products: Product[]; mobile: boolean; api: RefObject<RingApi | null>; onActive: (index: number) => void;
  onSelect: (product: Product) => void; controls: SceneControls;
}) {
  const [dpr, setDpr] = useState<[number, number]>([1, mobile ? 1.5 : 2]);
  return (
    <Canvas
      flat dpr={dpr} camera={{ fov: 32, position: [0, 0.35, 9.2], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(0x000000, 0);
        if (process.env.NODE_ENV !== "production") (window as unknown as { __hhScene?: unknown }).__hhScene = scene;
        gl.domElement.addEventListener("webglcontextlost", controls.onStruggle);
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr([1, 1])}
        // Still struggling at the lowest quality: hand over to the 2D carousel.
        flipflops={3} onFallback={controls.onStruggle}
      />
      <AdaptiveDpr />
      <Ring products={products} mobile={mobile} api={api} onActive={onActive} onSelect={onSelect} />
      <Ready onReady={controls.onReady} />
    </Canvas>
  );
}
