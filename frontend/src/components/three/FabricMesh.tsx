"use client";

import { useTexture } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { DRAPE_FRONT, FABRIC_FRAGMENT, FABRIC_VERTEX, presetFor, SHAPE_INDEX } from "./fabric";

/** Values a scene drives each frame. FabricMesh eases its uniforms toward them. */
export type FabricMotion = {
  swing: number;
  swingZ: number;
  flutter: number;
  hover: number;
  /** 0 = full colour, 1 = faded into `dimColor` (haze, or a darkened wardrobe) */
  dim: number;
  opacity: number;
};
export const newMotion = (): FabricMotion => ({ swing: 0, swingZ: 0, flutter: 0, hover: 0, dim: 0, opacity: 1 });

export type FabricShape = keyof typeof SHAPE_INDEX;

type Props = {
  /** Transparent cut-out, or a normal photo when `rounded` is set */
  url: string;
  fabric: string;
  shape?: FabricShape;
  /** Cloth height in world units; width follows the image, capped by maxWidth */
  height: number;
  maxWidth?: number;
  /** [x, y] subdivisions: 64×96 on desktop, 32×48 on mobile */
  segments?: [number, number];
  motion?: RefObject<FabricMotion>;
  seed?: number;
  rounded?: boolean;
  dimColor?: string;
  /** Ripple under the pointer */
  interactive?: boolean;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
};

const UNIT_PLANES = new Map<string, THREE.PlaneGeometry>();
function unitPlane([sx, sy]: [number, number]) {
  const key = `${sx}x${sy}`;
  if (!UNIT_PLANES.has(key)) UNIT_PLANES.set(key, new THREE.PlaneGeometry(1, 1, sx, sy));
  return UNIT_PLANES.get(key)!;
}

/**
 * A product photo rendered as living cloth. The single 3D building block of the site:
 * the hero ring, the wardrobe rail and "Feel the Fabric" all use it.
 */
export function FabricMesh({
  url, fabric, shape = "flat", height, maxWidth, segments = [64, 96], motion, seed = 0, rounded = false,
  dimColor = "#F2D4D0", interactive = true, onPointerOver, onPointerOut, onClick,
}: Props) {
  const texture = useTexture(url);
  const preset = presetFor(fabric);
  const lastRipple = useRef(0);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  const image = texture.image as { width: number; height: number } | undefined;
  const aspect = image && image.height ? image.width / image.height : 0.75;
  const width = Math.min(height * aspect, maxWidth ?? Infinity);

  // The material is built by hand (not through JSX props) so the uniform objects updated
  // every frame below are exactly the ones the GPU program reads.
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FABRIC_VERTEX,
        fragmentShader: FABRIC_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
          uMap: { value: texture },
          uTime: { value: 0 },
          uSeed: { value: seed * 17.13 },
          uSize: { value: new THREE.Vector2(width, height) },
          uShape: { value: SHAPE_INDEX[shape] },
          uAmp: { value: preset.amp },
          uFreq: { value: preset.freq },
          uSpeed: { value: preset.speed },
          uSheen: { value: preset.sheen },
          uSheenColor: { value: new THREE.Color(...preset.sheenColor) },
          uOpacity: { value: preset.opacity },
          uSwing: { value: 0 },
          uSwingZ: { value: 0 },
          uFlutter: { value: 0 },
          uHover: { value: 0 },
          uDim: { value: 0 },
          uDimColor: { value: new THREE.Color(dimColor) },
          uRipple: { value: new THREE.Vector3(0.5, 0.5, -10) },
          uRippleAmp: { value: Math.max(0.05, preset.amp * 1.1) },
          uRound: { value: rounded ? 0.12 : 0 },
        },
      }),
    // Created once per mesh; values are kept current in the effect and frame loop below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const uniforms = material.uniforms;
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.uMap.value = texture;
    uniforms.uSize.value.set(width, height);
    uniforms.uShape.value = SHAPE_INDEX[shape];
    uniforms.uDimColor.value.set(dimColor);
  }, [uniforms, texture, width, height, shape, dimColor]);

  useFrame((state, delta) => {
    const u = uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const m = motion?.current;
    if (!m) return;
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 7);
    u.uSwing.value = m.swing;
    u.uSwingZ.value = m.swingZ;
    u.uFlutter.value += (m.flutter - u.uFlutter.value) * k;
    u.uHover.value += (m.hover - u.uHover.value) * k;
    u.uDim.value += (m.dim - u.uDim.value) * k;
    u.uOpacity.value += (m.opacity * preset.opacity - u.uOpacity.value) * k;
  });

  // The visible cloth is shaped in the vertex shader, so pointer events use a simple
  // stand-in plane that covers the same area.
  const draped = shape === "draped-over-bar";
  const hitHeight = draped ? height * DRAPE_FRONT : height;
  const hitY = shape === "flat" || shape === "folded" ? 0 : -hitHeight / 2;

  const ripple = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive || !event.uv) return;
    const now = uniforms.uTime.value;
    if (now - lastRipple.current < 0.22) return;
    lastRipple.current = now;
    const v = draped ? event.uv.y * DRAPE_FRONT : event.uv.y;
    uniforms.uRipple.value.set(event.uv.x, v, now);
  };

  return (
    <group>
      <mesh geometry={unitPlane(segments)} material={material} frustumCulled={false} renderOrder={2} />
      <mesh
        position={[0, hitY, 0.02]} onPointerMove={ripple} onPointerOver={onPointerOver} onPointerOut={onPointerOut}
        onClick={onClick}
      >
        <planeGeometry args={[width, hitHeight]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
