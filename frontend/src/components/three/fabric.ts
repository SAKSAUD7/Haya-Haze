/**
 * Fabric in Motion: physics presets and the cloth shader shared by every 3D surface.
 * See CONTEXT.md section 2.4.
 */
import type { Fabric } from "@/lib/types";

export type FabricPreset = {
  /** wave height, world units */
  amp: number;
  /** wave density */
  freq: number;
  /** how quickly the breeze moves through it */
  speed: number;
  /** 0 matte … 1 silk */
  sheen: number;
  sheenColor: [number, number, number];
  opacity: number;
  /** pendulum behaviour when the garment is moved: restoring force, air drag, response to motion */
  stiffness: number;
  damping: number;
  inertia: number;
};

const WARM: [number, number, number] = [1.0, 0.9, 0.72];
const SOFT: [number, number, number] = [1.0, 0.96, 0.9];

export const FABRIC_PRESETS: Record<Fabric, FabricPreset> = {
  // light, fluid, long waves; strong gold-tinted sheen
  silk: { amp: 0.11, freq: 1.05, speed: 0.6, sheen: 0.95, sheenColor: WARM, opacity: 1, stiffness: 9, damping: 1.1, inertia: 1.25 },
  // very light and airy, fast flutter, slightly sheer
  chiffon: { amp: 0.095, freq: 1.9, speed: 1.05, sheen: 0.28, sheenColor: SOFT, opacity: 0.9, stiffness: 8, damping: 1.5, inertia: 1.35 },
  georgette: { amp: 0.085, freq: 2.1, speed: 0.95, sheen: 0.16, sheenColor: SOFT, opacity: 0.94, stiffness: 9, damping: 1.7, inertia: 1.2 },
  // medium weight, soft fall
  modal: { amp: 0.07, freq: 1.4, speed: 0.6, sheen: 0.3, sheenColor: SOFT, opacity: 1, stiffness: 11, damping: 2.0, inertia: 1.0 },
  viscose: { amp: 0.068, freq: 1.45, speed: 0.58, sheen: 0.26, sheenColor: SOFT, opacity: 1, stiffness: 11, damping: 2.1, inertia: 1.0 },
  // heavier, slower, smaller waves, matte
  jersey: { amp: 0.045, freq: 2.2, speed: 0.42, sheen: 0.05, sheenColor: SOFT, opacity: 1, stiffness: 13, damping: 2.8, inertia: 0.85 },
  // heavy: barely ripples, swings slowly and settles with dignity
  crepe: { amp: 0.034, freq: 1.2, speed: 0.34, sheen: 0.08, sheenColor: SOFT, opacity: 1, stiffness: 7.5, damping: 2.2, inertia: 0.8 },
  nida: { amp: 0.04, freq: 1.25, speed: 0.36, sheen: 0.14, sheenColor: SOFT, opacity: 1, stiffness: 7.5, damping: 2.0, inertia: 0.85 },
};

export const presetFor = (fabric: string): FabricPreset => FABRIC_PRESETS[fabric as Fabric] ?? FABRIC_PRESETS.modal;

export const SHAPE_INDEX = { flat: 0, "hanging-garment": 1, "draped-over-bar": 2, folded: 0 } as const;
/** Fraction of a draped cloth that hangs in front of the bar. */
export const DRAPE_FRONT = 0.6;

const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

/**
 * The cloth is positioned entirely from its UVs, so one unit plane serves every shape:
 *   0 flat            a floating panel, lightly held along its top edge
 *   1 hanging-garment pinned at the shoulders (top), hem free
 *   2 draped-over-bar folded over a bar at y = 0, two tails hanging
 * Motion layers: drape (shape + pin weight), breeze (simplex noise), interaction
 * (pendulum swing from JS spring physics, and a ripple spreading from the cursor).
 */
export const FABRIC_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec2 uSize;
uniform float uShape;
uniform float uAmp;
uniform float uFreq;
uniform float uSpeed;
uniform float uSwing;
uniform float uSwingZ;
uniform float uFlutter;
uniform float uHover;
uniform vec3 uRipple;
uniform float uRippleAmp;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
${SIMPLEX}

vec3 cloth(vec2 uv) {
  float w = uSize.x;
  float h = uSize.y;
  vec3 p;
  float free;   // 0 where the cloth is held, 1 where it moves freely
  float len;    // distance from the pin: how far a swing carries this point
  if (uShape < 0.5) {
    p = vec3((uv.x - 0.5) * w, (uv.y - 0.5) * h, 0.0);
    free = 0.3 + 0.7 * (1.0 - uv.y);
    len = (1.0 - uv.y) * h;
  } else if (uShape < 1.5) {
    p = vec3((uv.x - 0.5) * w, (uv.y - 1.0) * h, 0.0);
    free = pow(1.0 - uv.y, 1.25);
    len = (1.0 - uv.y) * h;
  } else {
    float d = (uv.y - ${DRAPE_FRONT.toFixed(2)}) * h;  // < 0 front tail, > 0 back tail
    float r = 0.05;
    float back = step(0.0, d);
    float side = d / sqrt(d * d + r * r);
    p = vec3((uv.x - 0.5) * w * (1.0 - 0.07 * back) + back * 0.06 * w, r - sqrt(d * d + r * r), -r * side);
    len = abs(d);
    free = clamp(len / (${DRAPE_FRONT.toFixed(2)} * h), 0.0, 1.0);
  }

  // Breeze
  float t = uTime * uSpeed + uSeed;
  vec2 q = vec2(p.x * uFreq, p.y * uFreq * 0.55);
  float n = snoise(vec3(q.x, q.y - t * 0.35, t * 0.6)) + 0.5 * snoise(vec3(q * 2.1 + 7.0, t * 0.9));
  float amp = uAmp * (1.0 + uFlutter * 2.4 + uHover * 0.6);
  p.z += n * amp * free;
  p.x += snoise(vec3(q.y * 0.7, t * 0.5, 3.0 + uSeed)) * amp * 0.35 * free;

  // Pendulum swing: the hem lags and travels furthest
  float a = uSwing * free;
  p.x += sin(a) * len;
  p.y += (1.0 - cos(a)) * len * 0.6;
  p.z += sin(uSwingZ * free) * len;

  // Ripple from the cursor / touch point
  float age = uTime - uRipple.z;
  if (age > 0.0 && age < 4.0) {
    float dist = distance(uv, uRipple.xy);
    p.z += sin(dist * 26.0 - age * 9.0) * exp(-dist * 5.5) * exp(-age * 1.6) * uRippleAmp * (0.25 + 0.75 * free);
  }
  return p;
}

void main() {
  vUv = uv;
  vec3 p = cloth(uv);
  // Recompute the normal from neighbouring points so folds catch the light.
  float e = 1.0 / 72.0;
  vec3 px = cloth(uv + vec2(e, 0.0));
  vec3 py = cloth(uv + vec2(0.0, e));
  vec3 n = normalize(cross(px - p, py - p));
  vNormal = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vViewPosition = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

export const FABRIC_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uSheen;
uniform vec3 uSheenColor;
uniform float uOpacity;
uniform float uDim;
uniform vec3 uDimColor;
uniform float uRound;
uniform vec2 uSize;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  float alpha = tex.a;
  if (uRound > 0.0) {
    // Opaque photos (no cut-out yet) are shown as a soft rounded panel.
    vec2 half_ = uSize * 0.5;
    vec2 d = abs((vUv - 0.5) * uSize) - half_ + uRound;
    float sd = length(max(d, 0.0)) - uRound;
    alpha *= 1.0 - smoothstep(-0.01, 0.01, sd);
  }
  if (alpha < 0.03) discard;

  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(vViewPosition);
  vec3 L = normalize(vec3(0.35, 0.75, 0.9));
  vec3 L2 = normalize(vec3(-0.7, 0.2, 0.5));

  float wrap = dot(N, L) * 0.5 + 0.5;
  vec3 color = tex.rgb * (0.56 + 0.56 * wrap);
  // Sheen: a specular band along each fold plus a soft glow at grazing angles.
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), mix(10.0, 46.0, uSheen));
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float back = pow(max(dot(N, L2), 0.0), 3.0);
  color += uSheenColor * (spec * uSheen * 0.75 + rim * (0.07 + uSheen * 0.3) + back * uSheen * 0.16);
  if (!gl_FrontFacing) color *= 0.84;

  color = mix(color, uDimColor, uDim);
  gl_FragColor = vec4(color, alpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
