export const TAU = Math.PI * 2;

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Signed shortest difference from angle a to angle b, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export const rand = (min: number, max: number): number => min + Math.random() * (max - min);
export const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));
export const pick = <T>(arr: readonly T[], rng: () => number = Math.random): T => arr[Math.floor(rng() * arr.length)];

/** Small deterministic PRNG so the terrain is identical on every load. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomPointInCircle(r: number, rng: () => number = Math.random): { x: number; y: number } {
  const a = rng() * TAU;
  const d = Math.sqrt(rng()) * r;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d };
}
