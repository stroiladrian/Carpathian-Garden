import type { Archetype, BodyColors } from './characters';
import { radiusForMass, segmentSpacing, SPAWN_SHIELD } from './config';

/** Per-tick steering intent. Produced by the local player, the AI, or (later) a network client. */
export interface ControlInput {
  /** Desired heading in radians, or null to keep the current heading. */
  angle: number | null;
  boost: boolean;
  ability: boolean;
}

export interface Seg {
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  px: number;
  py: number;
}

export class Worm {
  readonly id: number;
  name: string;
  arch: Archetype;
  colors: BodyColors;
  isPlayer: boolean;

  segs: Seg[] = [];
  angle: number;
  mass: number;
  peakMass: number;
  alive = true;

  boosting = false;
  abilityCd = 0;
  abilityT = 0;
  stunT = 0;
  spawnShield = SPAWN_SHIELD;
  eatT = 0;

  kills = 0;
  money = 0;
  bornAt: number;
  boostDropAcc = 0;
  /** Index into world.worms for the current tick (grid bookkeeping). */
  gi = 0;
  killedBy: string | null = null;
  deathCause: 'body' | 'border' | null = null;

  control: ControlInput = { angle: null, boost: false, ability: false };

  constructor(
    id: number,
    name: string,
    arch: Archetype,
    colors: BodyColors,
    x: number,
    y: number,
    angle: number,
    mass: number,
    isPlayer: boolean,
    time: number,
    segCount: number,
  ) {
    this.id = id;
    this.name = name;
    this.arch = arch;
    this.colors = colors;
    this.isPlayer = isPlayer;
    this.angle = angle;
    this.mass = mass;
    this.peakMass = mass;
    this.bornAt = time;
    const sp = segmentSpacing(radiusForMass(mass));
    for (let i = 0; i < segCount; i++) {
      const sx = x - Math.cos(angle) * sp * i;
      const sy = y - Math.sin(angle) * sp * i;
      this.segs.push({ x: sx, y: sy, px: sx, py: sy });
    }
  }

  get head(): Seg {
    return this.segs[0];
  }
  get radius(): number {
    return radiusForMass(this.mass);
  }
  /** True when rival bodies can't kill this worm and its own body isn't solid. */
  get shielded(): boolean {
    return this.spawnShield > 0 || (this.arch.id === 'reformer' && this.abilityT > 0);
  }
  get abilityReady(): boolean {
    return this.abilityCd <= 0;
  }
}
