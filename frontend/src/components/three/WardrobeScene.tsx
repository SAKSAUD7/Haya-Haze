"use client";

import { AdaptiveDpr, ContactShadows, Environment, Html, Lightformer, MeshReflectorMaterial, PerformanceMonitor, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import type { Product } from "@/lib/types";
import { formatINR, media } from "@/lib/utils";
import { useUI } from "@/stores/ui";

import type { SceneControls } from "./CanvasGate";
import { presetFor } from "./fabric";
import { FabricMesh, newMotion, type FabricShape } from "./FabricMesh";

// --- Dimensions (world units ≈ metres × 1.4) ---------------------------------------
const W = 6.6;            // interior width
const H = 3.55;           // height to where the arch springs
const RISE = 1.0;         // arch height
const D = 1.3;            // depth
const T = 0.22;           // frame thickness
const RAIL_Y = 3.2;
const SHELF_X = 1.72;     // divider between rail and shelves
const RAIL_LEFT = -W / 2 + 0.12;
const RAIL_RIGHT = SHELF_X - 0.1;
const SPACING = 1.06;
const DOOR_OPEN = 1.98;   // radians

const WOOD = { walnut: "#5B3A29", espresso: "#3D2B1F", ivory: "#E9DFD2" } as const;
const GOLD = "#C9A84C";

export type WardrobeShared = {
  scroll: number;
  velocity: number;
  accel: number;
  dragging: boolean;
  dragged: number;
  hovered: number;
  open: number;      // 0 closed … 1 open (eased)
  flutter: number;   // pulse of air when the doors open
};

function archShape(width: number, height: number, rise: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(-width / 2, height);
  shape.absellipse(0, height, width / 2, rise, Math.PI, 0, true);
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return shape;
}

/** One door leaf in hinge-local coordinates (hinge on x = 0, opening toward +x). */
function doorShape(): THREE.Shape {
  const half = W / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.02);
  shape.lineTo(0, H);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * (half - 0.012);
    const k = (x - half) / half;
    shape.lineTo(x, H + RISE * Math.sqrt(Math.max(0, 1 - k * k)));
  }
  shape.lineTo(half - 0.012, 0.02);
  shape.closePath();
  return shape;
}

function plaqueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 96);
  gradient.addColorStop(0, "#E6CB7C");
  gradient.addColorStop(0.5, "#C9A84C");
  gradient.addColorStop(1, "#A8863A");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = "rgba(61,43,31,.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, 496, 80);
  ctx.fillStyle = "#3D2B1F";
  ctx.font = "500 40px 'Cormorant Garamond', Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("H A Y A  &  H A Z E", 256, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Structure({ wood, warm, shared, mobile }: { wood: string; warm: THREE.Color; shared: RefObject<WardrobeShared>; mobile: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const glow = useRef<THREE.PointLight>(null);
  const strips = useRef<THREE.MeshBasicMaterial>(null);
  const interior = useRef<THREE.MeshStandardMaterial>(null);

  const geo = useMemo(() => {
    const outer = archShape(W + T * 2, H, RISE + T);
    outer.holes.push(new THREE.Path(archShape(W, H, RISE).getPoints(48)));
    const frame = new THREE.ExtrudeGeometry(outer, { depth: D, bevelEnabled: false, curveSegments: 48 });
    const back = new THREE.ShapeGeometry(archShape(W, H, RISE), 48);
    const door = new THREE.ExtrudeGeometry(doorShape(), { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
    // Inset panel line on each door and the gold trim around the opening
    const inset = archShape(W, H, RISE).getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const trim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(inset, false, "catmullrom", 0.05), 160, 0.02, 6);
    const half = W / 2;
    const panel: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const x = 0.32 + (i / 20) * (half - 0.64);
      const k = (x - half) / half;
      panel.push(new THREE.Vector3(x, H - 0.25 + (RISE - 0.1) * Math.sqrt(Math.max(0, 1 - k * k)), 0));
    }
    const line = [new THREE.Vector3(0.32, 0.4, 0), ...panel, new THREE.Vector3(half - 0.32, 0.4, 0), new THREE.Vector3(0.32, 0.4, 0)];
    const doorLine = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(line, false, "catmullrom", 0.02), 120, 0.009, 5);
    return { frame, back, door, trim, doorLine };
  }, []);
  const plaque = useMemo(() => plaqueTexture(), []);
  const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: wood, roughness: 0.62, metalness: 0.06 }), [wood]);
  const goldMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.28, metalness: 1 }), []);

  useFrame(() => {
    const open = shared.current.open;
    const angle = open * DOOR_OPEN;
    if (left.current) left.current.rotation.y = -angle;
    if (right.current) right.current.rotation.y = -angle;
    // Warm light blooms out as the doors part.
    if (glow.current) glow.current.intensity = open * (mobile ? 16 : 24);
    if (strips.current) strips.current.color.copy(warm).multiplyScalar(0.25 + open * 0.75);
    if (interior.current) interior.current.emissiveIntensity = 0.05 + open * 0.3;
  });

  const door = (
    <>
      <mesh geometry={geo.door} material={woodMaterial} />
      <mesh geometry={geo.doorLine} material={goldMaterial} position={[0, 0, 0.085]} />
      <mesh position={[W / 2 - 0.22, 1.85, 0.11]} rotation={[0, 0, 0]} material={goldMaterial}>
        <capsuleGeometry args={[0.022, 0.42, 4, 10]} />
      </mesh>
    </>
  );

  return (
    <group>
      <mesh geometry={geo.frame} material={woodMaterial} position={[0, 0, -D]} />
      <mesh geometry={geo.back} position={[0, 0, -D + 0.02]}>
        <meshStandardMaterial ref={interior} color="#F5EDE4" roughness={0.85} emissive={warm} emissiveIntensity={0.05} />
      </mesh>
      {/* plinth */}
      <mesh position={[0, -0.07, -D / 2 + 0.05]} material={woodMaterial}>
        <boxGeometry args={[W + T * 2 + 0.28, 0.14, D + 0.3]} />
      </mesh>
      <mesh geometry={geo.trim} material={goldMaterial} position={[0, 0, 0.012]} />

      {/* plaque on the crown of the arch */}
      <mesh position={[0, H + RISE + T * 0.5, 0.03]}>
        <boxGeometry args={[1.05, 0.2, 0.03]} />
        <meshStandardMaterial map={plaque} roughness={0.35} metalness={0.7} />
      </mesh>

      {/* brass rail with end brackets */}
      <mesh position={[(RAIL_LEFT + RAIL_RIGHT) / 2, RAIL_Y, -D / 2]} rotation={[0, 0, Math.PI / 2]} material={goldMaterial}>
        <cylinderGeometry args={[0.032, 0.032, RAIL_RIGHT - RAIL_LEFT + 0.2, 16]} />
      </mesh>
      {[RAIL_LEFT - 0.06, RAIL_RIGHT + 0.06].map((x) => (
        <mesh key={x} position={[x, RAIL_Y, -D / 2]} material={goldMaterial}>
          <sphereGeometry args={[0.07, 14, 12]} />
        </mesh>
      ))}

      {/* shelf column on the right */}
      <mesh position={[SHELF_X, H / 2 + 0.2, -D / 2 - 0.05]} material={woodMaterial}>
        <boxGeometry args={[0.06, H + 0.5, D - 0.2]} />
      </mesh>
      {SHELF_YS.map((y) => (
        <group key={y} position={[(SHELF_X + W / 2) / 2, y, -D / 2 - 0.05]}>
          <mesh material={woodMaterial}>
            <boxGeometry args={[W / 2 - SHELF_X, 0.055, D - 0.2]} />
          </mesh>
          {/* LED strip under the shelf above */}
          <mesh position={[0, 0.78, 0.42]}>
            <boxGeometry args={[W / 2 - SHELF_X - 0.2, 0.018, 0.03]} />
            <meshBasicMaterial ref={y === SHELF_YS[0] ? strips : undefined} color={warm} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* cove light under the arch */}
      <mesh position={[-0.8, H + 0.1, -0.2]}>
        <boxGeometry args={[4.2, 0.02, 0.04]} />
        <meshBasicMaterial color={warm} toneMapped={false} />
      </mesh>
      <pointLight ref={glow} position={[-0.6, H + 0.2, -0.25]} color={warm} intensity={0} distance={9} decay={1.6} />

      {/* doors: the left leaf carries a full-length mirror on its inner face */}
      <group position={[-W / 2, 0, 0]}>
        <group ref={left}>
          {door}
          <mesh position={[W / 4, H / 2 + 0.1, -0.006]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[W / 2 - 0.9, H - 0.7]} />
            <meshStandardMaterial color="#E9ECEE" roughness={0.04} metalness={1} envMapIntensity={1.5} />
          </mesh>
        </group>
      </group>
      <group position={[W / 2, 0, 0]} scale={[-1, 1, 1]}>
        <group ref={right}>{door}</group>
      </group>
    </group>
  );
}

const SHELF_YS = [0.95, 1.8, 2.65];

function hangerGeometry(): THREE.BufferGeometry {
  const hook = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.05, -0.01, 0), new THREE.Vector3(-0.035, 0.05, 0), new THREE.Vector3(0.02, 0.058, 0),
    new THREE.Vector3(0.05, 0.015, 0), new THREE.Vector3(0.022, -0.06, 0), new THREE.Vector3(0, -0.13, 0),
  ]);
  const body = new THREE.CatmullRomCurve3(
    [new THREE.Vector3(0, -0.13, 0), new THREE.Vector3(0.43, -0.275, 0), new THREE.Vector3(-0.43, -0.275, 0)],
    true, "catmullrom", 0.02,
  );
  const a = new THREE.TubeGeometry(hook, 24, 0.012, 6);
  const b = new THREE.TubeGeometry(body, 60, 0.014, 6, true);
  // Merge the two tubes into one geometry shared by every hanger.
  const merged = new THREE.BufferGeometry();
  const pos = new Float32Array(a.attributes.position.count * 3 + b.attributes.position.count * 3);
  const nor = new Float32Array(pos.length);
  pos.set(a.attributes.position.array as Float32Array, 0);
  pos.set(b.attributes.position.array as Float32Array, a.attributes.position.count * 3);
  nor.set(a.attributes.normal.array as Float32Array, 0);
  nor.set(b.attributes.normal.array as Float32Array, a.attributes.normal.count * 3);
  const index: number[] = Array.from(a.index!.array);
  const offset = a.attributes.position.count;
  for (const i of Array.from(b.index!.array)) index.push(i + offset);
  merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  merged.setIndex(index);
  return merged;
}

function Label({ product }: { product: Product }) {
  return (
    <Html center position={[0, -1.25, 0.5]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="w-max max-w-[220px] rounded-2xl border border-gold/40 bg-ivory/90 px-4 py-2.5 text-center shadow-soft backdrop-blur-md">
        <p className="font-serif text-lg leading-tight text-deep">{product.name}</p>
        <p className="mt-0.5 text-sm font-bold text-deep">{formatINR(product.price)}</p>
        <p className="mt-1 flex justify-center gap-1">
          {product.swatches.slice(0, 5).map((s) => (
            <span key={s.name} className="h-2.5 w-2.5 rounded-full border border-deep/20" style={{ background: s.hex }} />
          ))}
        </p>
      </div>
    </Html>
  );
}

function Garment({
  product, index, shared, hanger, gold, segments, focused, onSelect,
}: {
  product: Product; index: number; shared: RefObject<WardrobeShared>; hanger: THREE.BufferGeometry;
  gold: THREE.Material; segments: [number, number]; focused: boolean; onSelect: (product: Product) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const motion = useRef(newMotion());
  const physics = useRef({ angle: 0, velocity: 0, lift: 0, pick: 0 });
  const [labelled, setLabelled] = useState(false);
  const preset = presetFor(product.fabric);
  const garment = product.shape_preset === "hanging-garment";
  const tall = garment && product.category === "modest-wear";
  const shape: FabricShape = garment ? "hanging-garment" : "draped-over-bar";
  const texture = product.fabric_texture;
  const url = media(texture ?? product.media.find((m) => m.image)?.image);
  const height = garment ? (tall ? 2.55 : 1.55) : 2.7;

  useFrame((state, delta) => {
    const g = group.current;
    const s = shared.current;
    if (!g || !pivot.current) return;
    const dt = Math.min(delta, 0.04);
    const p = physics.current;
    const selectedId = useUI.getState().quickView?.product.id;
    const selected = selectedId === product.id;

    // Damped pendulum, driven by how the rail is being moved. Light fabrics float on,
    // heavy ones swing slowly and settle.
    p.velocity += (-preset.stiffness * p.angle - preset.damping * p.velocity - s.accel * 0.085 * preset.inertia) * dt;
    p.angle = THREE.MathUtils.clamp(p.angle + p.velocity * dt, -0.7, 0.7);

    const hovered = (s.hovered === index || focused) && !selectedId;
    p.lift += ((hovered ? 1 : 0) - p.lift) * (1 - Math.exp(-dt * 7));
    const wasPicked = p.pick > 0.5;
    p.pick += ((selected ? 1 : 0) - p.pick) * (1 - Math.exp(-dt * 3.2));
    if (wasPicked && !selected && p.pick > 0.45) p.velocity += 1.6; // hung back on the rail: let it swing

    // Place on the rail; fade out as it slides past the ends.
    const x = RAIL_LEFT + 0.62 + index * SPACING + s.scroll;
    const edge = Math.min(x - (RAIL_LEFT + 0.2), RAIL_RIGHT - 0.2 - x);
    const inside = THREE.MathUtils.smoothstep(edge, -0.1, 0.35);
    // When chosen it lifts off, floats toward the viewer and turns to face them.
    const k = THREE.MathUtils.smootherstep(p.pick, 0, 1);
    g.position.set(
      THREE.MathUtils.lerp(x, -0.9, k),
      THREE.MathUtils.lerp(RAIL_Y, RAIL_Y + 0.28, k) + Math.sin(k * Math.PI) * 0.25,
      THREE.MathUtils.lerp(-D / 2 + p.lift * 0.26, 2.9, k),
    );
    g.rotation.y = THREE.MathUtils.lerp(0, Math.sin(state.clock.elapsedTime * 0.5) * 0.12, k);
    g.scale.setScalar(1 + k * 0.12);
    g.visible = inside > 0.01 || k > 0.01;
    pivot.current.rotation.z = p.angle * 0.45;

    const m = motion.current;
    m.swing = p.angle * 0.9;
    m.swingZ = k * Math.sin(state.clock.elapsedTime * 1.3) * 0.05;
    m.flutter = s.flutter + Math.min(0.5, Math.abs(p.velocity) * 0.12) + k * 0.25;
    m.hover = p.lift;
    // Dark behind closed doors; dimmed while another piece is being looked at.
    m.dim = Math.max((1 - s.open) * 0.6, selectedId && !selected ? 0.5 : 0);
    m.opacity = Math.max(inside, k);

    if (hovered !== labelled) setLabelled(hovered);
  });

  return (
    <group ref={group}>
      <group ref={pivot}>
        <mesh geometry={hanger} material={gold} />
        <group position={[0, garment ? -0.15 : -0.27, garment ? 0.015 : 0]}>
          <FabricMesh
            url={url} fabric={product.fabric} shape={shape} height={height} maxWidth={garment ? undefined : 0.86}
            segments={segments} motion={motion} seed={index + 3} rounded={!texture} dimColor="#2B1D16"
            onPointerOver={(e) => {
              e.stopPropagation();
              shared.current.hovered = index;
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              if (shared.current.hovered === index) shared.current.hovered = -1;
              document.body.style.cursor = "";
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (shared.current.dragged < 8) onSelect(product);
            }}
          />
        </group>
        {labelled && <Label product={product} />}
      </group>
    </group>
  );
}

/** A product folded on a shelf: one layer per colour it comes in. */
function FoldedStack({ product, position, shared, onSelect }: { product: Product; position: [number, number, number]; shared: RefObject<WardrobeShared>; onSelect: (p: Product) => void }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const layers = (product.swatches.length ? product.swatches : [{ name: "", hex: "#C8A882" }]).slice(0, 4);
  useFrame((_, delta) => {
    if (!group.current) return;
    const target = position[1] + (hovered ? 0.07 : 0);
    group.current.position.y += (target - group.current.position.y) * (1 - Math.exp(-delta * 8));
    group.current.visible = shared.current.open > 0.02;
  });
  return (
    <group
      ref={group} position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (shared.current.dragged < 8) onSelect(product);
      }}
    >
      {layers.map((layer, i) => (
        <RoundedBox key={layer.name + i} args={[0.66 - i * 0.015, 0.085, 0.52]} radius={0.035} smoothness={3} position={[(i % 2) * 0.012, 0.045 + i * 0.088, 0]}>
          <meshStandardMaterial color={layer.hex} roughness={0.92} />
        </RoundedBox>
      ))}
      {hovered && (
        <Html center position={[0, 0.62, 0.2]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="w-max max-w-[200px] rounded-2xl border border-gold/40 bg-ivory/90 px-3.5 py-2 text-center shadow-soft backdrop-blur-md">
            <p className="font-serif text-base leading-tight text-deep">{product.name}</p>
            <p className="text-sm font-bold text-deep">{formatINR(product.price)}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Quiet styling on the shelves: a perfume bottle and a keepsake box. */
function ShelfProps({ gold }: { gold: THREE.Material }) {
  const x = (SHELF_X + W / 2) / 2;
  return (
    <group>
      <group position={[x + 0.3, SHELF_YS[2] + 0.03, -D / 2]}>
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.085, 0.095, 0.28, 20]} />
          <meshStandardMaterial color="#F2D4D0" roughness={0.08} metalness={0.2} transparent opacity={0.82} />
        </mesh>
        <mesh position={[0, 0.33, 0]} material={gold}>
          <sphereGeometry args={[0.055, 16, 12]} />
        </mesh>
      </group>
      <RoundedBox args={[0.42, 0.16, 0.3]} radius={0.02} position={[x - 0.3, SHELF_YS[2] + 0.11, -D / 2]}>
        <meshStandardMaterial color="#2C4A3E" roughness={0.6} />
      </RoundedBox>
      <mesh position={[x - 0.3, SHELF_YS[2] + 0.195, -D / 2]} material={gold}>
        <boxGeometry args={[0.43, 0.012, 0.05]} />
      </mesh>
    </group>
  );
}

function Scene({
  products, mobile, woodTone, warmth, open, focus, onSelect, controls,
}: Props & { mobile: boolean }) {
  const { gl, camera, size } = useThree();
  const shared = useRef<WardrobeShared>({ scroll: 0, velocity: 0, accel: 0, dragging: false, dragged: 0, hovered: -1, open: 0, flutter: 0 });
  const lastVelocity = useRef(0);
  const wasOpen = useRef(false);
  const frames = useRef(0);
  const hanger = useMemo(() => hangerGeometry(), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#D9B95C", roughness: 0.22, metalness: 1 }), []);
  const warm = useMemo(() => new THREE.Color("#FFF1DC").lerp(new THREE.Color("#FFC27A"), THREE.MathUtils.clamp(warmth / 100, 0, 1)), [warmth]);
  const segments: [number, number] = mobile ? [24, 40] : [48, 80];

  const rail = products.filter((p) => p.wardrobe_placement !== "shelf");
  const shelf = products.filter((p) => p.wardrobe_placement === "shelf");
  const span = RAIL_RIGHT - RAIL_LEFT - 1.24;
  const minScroll = Math.min(0, span - (rail.length - 1) * SPACING);

  // Reset the rail when its contents change (category tabs).
  const key = products.map((p) => p.id).join(",");
  useEffect(() => {
    shared.current.scroll = 0;
    shared.current.velocity = 0;
  }, [key]);

  // Keyboard focus: bring the focused hanger into view.
  useEffect(() => {
    if (focus < 0 || focus >= rail.length) return;
    const s = shared.current;
    const x = 0.62 + focus * SPACING + s.scroll;
    if (x < 0.5) s.scroll += 0.62 - x;
    else if (x > span + 0.6) s.scroll -= x - span - 0.6;
    s.scroll = THREE.MathUtils.clamp(s.scroll, minScroll, 0);
  }, [focus, rail.length, span, minScroll]);

  // Drag or swipe to slide hangers along the rail.
  useEffect(() => {
    const el = gl.domElement;
    const s = shared.current;
    let lastX = 0;
    let lastT = 0;
    const down = (e: PointerEvent) => {
      s.dragging = true;
      s.dragged = 0;
      lastX = e.clientX;
      lastT = performance.now();
    };
    const move = (e: PointerEvent) => {
      if (!s.dragging || useUI.getState().quickView) return;
      const now = performance.now();
      const dt = Math.max(now - lastT, 8) / 1000;
      const dx = (e.clientX - lastX) * (9.5 / el.clientWidth);
      s.dragged += Math.abs(e.clientX - lastX);
      s.scroll = THREE.MathUtils.clamp(s.scroll + dx, minScroll - 0.5, 0.5);
      s.velocity = THREE.MathUtils.clamp(dx / dt, -9, 9);
      lastX = e.clientX;
      lastT = now;
    };
    const up = () => {
      s.dragging = false;
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
  }, [gl, minScroll]);

  useFrame((state, delta) => {
    const s = shared.current;
    const dt = Math.min(delta, 0.04);
    // Doors ease open and closed; opening sends one soft gust through the garments.
    s.open += ((open ? 1 : 0) - s.open) * (1 - Math.exp(-dt * (open ? 2.1 : 4.2)));
    if (open && !wasOpen.current) s.flutter = 1;
    wasOpen.current = open;
    s.flutter *= Math.exp(-dt * 1.5);

    if (!s.dragging) {
      s.scroll += s.velocity * dt;
      s.velocity *= Math.exp(-dt * 2.6);
      // Spring back inside the ends of the rail.
      if (s.scroll > 0) s.scroll += (0 - s.scroll) * (1 - Math.exp(-dt * 9));
      if (s.scroll < minScroll) s.scroll += (minScroll - s.scroll) * (1 - Math.exp(-dt * 9));
    }
    s.accel = THREE.MathUtils.clamp((s.velocity - lastVelocity.current) / dt, -140, 140);
    lastVelocity.current = s.velocity;

    // Frame the wardrobe with its doors open, whatever the canvas proportions.
    const aspect = size.width / size.height;
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    const fit = (W / 2 + 1.75) / (Math.tan(fov / 2) * aspect);
    const distance = Math.max(10.8, fit);
    const picked = useUI.getState().quickView ? 1 : 0;
    camera.position.x += (state.pointer.x * 0.35 + picked * 0.5 - camera.position.x) * (1 - Math.exp(-dt * 2.5));
    camera.position.y += (2.3 + state.pointer.y * 0.12 - camera.position.y) * (1 - Math.exp(-dt * 2.5));
    camera.position.z += (distance - camera.position.z) * (1 - Math.exp(-dt * 3));
    camera.lookAt(0, 2.25, 0);

    if (++frames.current === 3) controls.onReady();
  });

  const shelfX = (SHELF_X + W / 2) / 2;
  return (
    <>
      <color attach="background" args={["#EFD9D1"]} />
      <fog attach="fog" args={["#EFD9D1", 14, 30]} />
      <ambientLight intensity={0.85} color="#FFF3E6" />
      <spotLight position={[3.5, 8, 8]} angle={0.5} penumbra={0.9} intensity={160} color={warm} castShadow={false} />
      <directionalLight position={[-6, 4, 3]} intensity={0.9} color="#F8D9B0" />
      <Environment resolution={64}>
        <Lightformer form="rect" intensity={3} color="#FFE3B8" position={[0, 5, 6]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#F2D4D0" position={[-7, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[8, 5, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#FFF8F6" position={[7, 2, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 5, 1]} />
        <Lightformer form="circle" intensity={2} color="#C9A84C" position={[0, 1, -6]} scale={6} />
      </Environment>

      <Structure wood={WOOD[woodTone] ?? WOOD.espresso} warm={warm} shared={shared} mobile={mobile} />
      <ShelfProps gold={gold} />

      {rail.map((product, i) => (
        <Suspense key={product.id} fallback={null}>
          <Garment
            product={product} index={i} shared={shared} hanger={hanger} gold={gold} segments={segments}
            focused={focus === i} onSelect={onSelect}
          />
        </Suspense>
      ))}
      {shelf.slice(0, 2).map((product, i) => (
        <FoldedStack
          key={product.id} product={product} shared={shared} onSelect={onSelect}
          position={[shelfX, SHELF_YS[1 - i] + 0.03, -D / 2]}
        />
      ))}

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 2]}>
        <planeGeometry args={[60, 40]} />
        {mobile ? (
          <meshStandardMaterial color="#E7CFC6" roughness={0.9} />
        ) : (
          <MeshReflectorMaterial
            resolution={512} blur={[320, 90]} mixBlur={1} mixStrength={0.55} roughness={0.85} depthScale={0.6}
            minDepthThreshold={0.4} maxDepthThreshold={1.2} color="#E7CFC6" metalness={0}
          />
        )}
      </mesh>
      <ContactShadows position={[0, -0.13, 0.4]} scale={16} blur={2.6} far={3} opacity={0.42} frames={mobile ? 1 : 40} color="#3D2B1F" />
    </>
  );
}

type Props = {
  products: Product[];
  woodTone: keyof typeof WOOD;
  warmth: number;
  open: boolean;
  /** Index on the rail highlighted by keyboard navigation (-1 for none) */
  focus: number;
  onSelect: (product: Product) => void;
  controls: SceneControls;
};

export default function WardrobeScene(props: Props & { mobile: boolean }) {
  const [dpr, setDpr] = useState<[number, number]>([1, props.mobile ? 1.5 : 1.75]);
  return (
    <Canvas
      flat dpr={dpr} camera={{ fov: 30, position: [0, 2.3, 12], near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.domElement.addEventListener("webglcontextlost", props.controls.onStruggle)}
    >
      <PerformanceMonitor onDecline={() => setDpr([1, 1])} flipflops={3} onFallback={props.controls.onStruggle} />
      <AdaptiveDpr />
      <Scene {...props} />
    </Canvas>
  );
}
