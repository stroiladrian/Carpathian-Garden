/** Tunable gameplay constants. All distances are world pixels, all times seconds. */
export const WORLD_RADIUS = 3000;
/** Half-size of the square that bounds the arena (used for spatial grids & terrain). */
export const WORLD_HALF = 3200;
/** Fixed simulation step — the sim is frame-rate independent. */
export const TICK = 1 / 60;

export const AI_COUNT = 15;
export const FOOD_TARGET = 2000;
export const FOOD_HARD_CAP = 3200;
export const SPILL_LIFETIME = 75;

export const START_MASS = 30;
export const BASE_SPEED = 185;
export const BOOST_SPEED = 370;
export const MIN_BOOST_MASS = 24;
export const BOOST_COST = 9; // mass per second while boosting
export const MAGNET_RANGE = 34;
export const SPAWN_SHIELD = 2.2;
export const MAX_SEGMENTS = 320;

export function radiusForMass(m: number): number {
  return 11 + Math.min(30, Math.sqrt(Math.max(0, m)) * 0.85);
}
export function segmentsForMass(m: number): number {
  return Math.min(MAX_SEGMENTS, Math.round(8 + Math.sqrt(Math.max(0, m)) * 5));
}
export function turnRateForRadius(r: number): number {
  return 5.4 / (1 + (r - 11) * 0.032);
}
export function segmentSpacing(r: number): number {
  return r * 0.5;
}
