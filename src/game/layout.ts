/**
 * Shared world layout: where the mountains, rivers and capital sit.
 * Used by both the simulation (spawn biasing) and the terrain renderer.
 */
export type Pt = [number, number];

export const CARPATHIANS = { cx: -500, cy: -150, r: 1350, a0: -1.85, a1: 2.75 };

/** Top-left + size of the stylised capital. */
export const BUCHAREST = { x: 700, y: 1250, w: 760, h: 520 };

export function coastX(y: number): number {
  return 2200 + 70 * Math.sin(y / 260);
}

export const DANUBE: Pt[] = [
  [-2760, 1250], [-2250, 1650], [-1700, 1900], [-1100, 2000], [-400, 2150], [300, 2200],
  [900, 2150], [1500, 2050], [1850, 1850], [1950, 1400], [2050, 1000], [2200, 900], [2320, 880],
];
export const DANUBE_BRANCHES: Pt[][] = [
  [[2050, 1000], [2150, 1150], [2300, 1190]],
  [[2050, 1000], [2120, 760], [2290, 650]],
];
export const OLT: Pt[] = [[-180, 1220], [-260, 1500], [-180, 1800], [-230, 2160]];
export const MURES: Pt[] = [[-500, -200], [-900, 50], [-1400, 150], [-1850, 230], [-2500, 300], [-3100, 330]];

export interface Village { x: number; y: number; name: string }
export const VILLAGES: Village[] = [
  { x: -700, y: -380, name: 'Sânpromisiune' },
  { x: -150, y: 300, name: 'Gropile Mari' },
  { x: -1050, y: 420, name: 'Asfaltu’ Viitor' },
  { x: -380, y: -820, name: 'Vărzari de Sus' },
  { x: 60, y: -360, name: 'Cumetrești' },
  { x: 1550, y: -1100, name: 'Fondurile Europene' },
  { x: 1700, y: -150, name: 'Pupezele' },
  { x: 1350, y: 550, name: 'Ciorbești' },
  { x: -1350, y: 1620, name: 'Dosarești' },
  { x: -650, y: 1720, name: 'Sinecura' },
  { x: 280, y: 1780, name: 'Plicuri' },
  { x: -1300, y: -1350, name: 'Sighetu’ Mic' },
  { x: -2250, y: -250, name: 'Timișu’ Plin' },
  { x: -2000, y: 820, name: 'Banatu’ Bogat' },
];

export function inMountainZone(x: number, y: number, pad: number): boolean {
  const { cx, cy, r, a0, a1 } = CARPATHIANS;
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - r) > pad) return false;
  const a = Math.atan2(dy, dx);
  return a >= a0 - 0.05 && a <= a1 + 0.05;
}

export function inBucharest(x: number, y: number, pad = 0): boolean {
  const b = BUCHAREST;
  return x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
}
