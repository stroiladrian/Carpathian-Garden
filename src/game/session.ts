import { AIBrain } from './ai';
import { AI_NAMES, ARCHETYPE_LIST, Archetype, BodyColors, PARTY_COLORS } from './characters';
import { START_MASS, TICK } from './config';
import type { GameEvent } from './effects';
import { pick, rand } from './math';
import type { ControlInput, Worm } from './worm';
import { World } from './world';

export interface SessionOptions {
  player?: { name: string; arch: Archetype };
  aiCount: number;
  demo?: boolean;
}

const INITIAL_MASSES = [700, 460, 320, 240, 180, 140, 110, 90, 75, 60, 50, 42, 36, 32, 30, 30, 30, 30];

/**
 * One run of the game: a World plus the controllers that drive its worms.
 * The local player is just another controller; a networked version would
 * feed remote ControlInputs here instead.
 */
export class Session {
  readonly world = new World();
  readonly brains = new Map<number, AIBrain>();
  player: Worm | null = null;
  readonly aiCount: number;
  private respawnAt: number[] = [];
  private pending: GameEvent[] = [];

  constructor(opts: SessionOptions) {
    this.aiCount = opts.aiCount;
    if (opts.demo) this.world.effectsScale = 0.5;
    for (let i = 0; i < opts.aiCount; i++) this.spawnAI(INITIAL_MASSES[i] ?? 30);
    if (opts.player) {
      const w = this.world.addWorm(opts.player.name, opts.player.arch, opts.player.arch.colors, START_MASS, true);
      this.player = w;
      this.world.focusId = w.id;
    }
  }

  private spawnAI(mass: number): void {
    const used = new Set(this.world.worms.map((w) => w.name));
    const free = AI_NAMES.filter((n) => !used.has(n));
    const name = free.length ? pick(free) : `${pick(AI_NAMES)} II`;
    const arch = pick(ARCHETYPE_LIST);
    const colors: BodyColors = Math.random() < 0.45 ? arch.colors : pick(PARTY_COLORS);
    const w = this.world.addWorm(name, arch, colors, mass, false);
    this.brains.set(w.id, new AIBrain(w));
  }

  /** Advance exactly one fixed simulation step. */
  tick(control: ControlInput | null): void {
    const world = this.world;
    for (const b of this.brains.values()) b.worm.control = b.think(world);
    if (this.player && this.player.alive && control) this.player.control = control;
    world.step(TICK);

    for (const e of world.events) {
      if (e.t === 'death' && this.brains.has(e.victim)) {
        this.brains.delete(e.victim);
        this.respawnAt.push(world.time + rand(1.5, 4.5));
      }
      this.pending.push(e);
    }
    world.events.length = 0;

    for (let i = this.respawnAt.length - 1; i >= 0; i--) {
      if (world.time >= this.respawnAt[i]) {
        this.respawnAt.splice(i, 1);
        if (this.brains.size < this.aiCount) this.spawnAI(Math.random() < 0.15 ? rand(150, 320) : rand(30, 110));
      }
    }
    if (this.pending.length > 400) this.pending.splice(0, this.pending.length - 400);
  }

  drainEvents(): GameEvent[] {
    const e = this.pending;
    this.pending = [];
    return e;
  }

  rankOf(w: Worm): number {
    let rank = 1;
    for (const o of this.world.worms) if (o !== w && o.alive && o.mass > w.mass) rank++;
    return rank;
  }
}
