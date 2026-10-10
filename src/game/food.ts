import { BUCHAREST, inBucharest } from './layout';
import { randomPointInCircle, TAU } from './math';
import { WORLD_RADIUS } from './config';

export type FoodKind = 'coin' | 'note' | 'gold' | 'contract' | 'briefcase' | 'pledge' | 'envelope' | 'tender' | 'spill';

export interface FoodDef {
  label: string;
  value: number;
  lei: number;
  radius: number;
  weight: number;
}

export const FOOD_DEFS: Record<FoodKind, FoodDef> = {
  coin: { label: 'Influence', value: 1, lei: 50, radius: 8, weight: 56 },
  note: { label: 'Campaign Donation', value: 2, lei: 500, radius: 10, weight: 24 },
  gold: { label: 'Budget Bonus', value: 4, lei: 2000, radius: 10, weight: 10 },
  contract: { label: 'Public Contract', value: 10, lei: 25000, radius: 15, weight: 4 },
  briefcase: { label: 'Briefcase of Cash', value: 16, lei: 100000, radius: 16, weight: 2 },
  pledge: { label: 'Reform Pledge', value: 3, lei: 0, radius: 11, weight: 4 },
  envelope: { label: 'Bribe Envelope', value: 8, lei: 50000, radius: 13, weight: 4 },
  tender: { label: 'Special Contract', value: 60, lei: 5000000, radius: 24, weight: 0 },
  spill: { label: 'Spilled Funds', value: 1, lei: 300, radius: 7, weight: 0 },
};

const NATURAL: FoodKind[] = ['coin', 'note', 'gold', 'contract', 'briefcase', 'pledge', 'envelope'];
const CAPITAL_WEIGHTS: Partial<Record<FoodKind, number>> = { coin: 40, note: 25, gold: 14, contract: 10, briefcase: 5, pledge: 2, envelope: 9 };

export class Food {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  kind: FoodKind;
  value: number;
  r: number;
  color: string;
  phase: number;
  born: number;
  alive = true;
  /** Special contracts: display name, place and expiry time. */
  label = '';
  place = '';
  expires = 0;
  /** Set when a worm is pulling it in, so it can't be "stolen" mid-flight visually. */
  attractedBy = -1;

  constructor(x: number, y: number, kind: FoodKind, value: number, color: string, time: number) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.value = value;
    this.color = color;
    this.r = kind === 'spill' ? Math.min(15, 5 + Math.sqrt(value) * 2.2) : FOOD_DEFS[kind].radius;
    this.phase = Math.random() * TAU;
    this.born = time;
  }
}

function weightedKind(weights: Partial<Record<FoodKind, number>>): FoodKind {
  let total = 0;
  for (const k of NATURAL) total += weights[k] ?? 0;
  let r = Math.random() * total;
  for (const k of NATURAL) {
    r -= weights[k] ?? 0;
    if (r <= 0) return k;
  }
  return 'coin';
}

const DEFAULT_WEIGHTS: Partial<Record<FoodKind, number>> = Object.fromEntries(
  NATURAL.map((k) => [k, FOOD_DEFS[k].weight]),
);

/** Picks a spawn spot + type. The capital is (satirically) richer in contracts. */
export function rollNaturalFood(time: number): Food {
  let x: number;
  let y: number;
  let kind: FoodKind;
  if (Math.random() < 0.05) {
    x = BUCHAREST.x + Math.random() * BUCHAREST.w;
    y = BUCHAREST.y + Math.random() * BUCHAREST.h;
    kind = weightedKind(CAPITAL_WEIGHTS);
  } else {
    const p = randomPointInCircle(WORLD_RADIUS - 70);
    x = p.x;
    y = p.y;
    kind = weightedKind(inBucharest(x, y) ? CAPITAL_WEIGHTS : DEFAULT_WEIGHTS);
  }
  return new Food(x, y, kind, FOOD_DEFS[kind].value, '', time);
}
