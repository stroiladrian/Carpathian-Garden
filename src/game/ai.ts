import { WORLD_RADIUS } from './config';
import { angleDiff, rand } from './math';
import type { ControlInput, Worm } from './worm';
import type { World } from './world';
import type { Difficulty } from './difficulty';

/**
 * Simple but lively rival politician. Re-plans ~8 times per second:
 * picks a goal (food, a victim to cut off, or home if near the border),
 * then probes a fan of headings and steers along the clearest one.
 */
export class AIBrain {
  readonly worm: Worm;
  private nextThink = 0;
  private wander: number;
  private aggression: number;
  private greed: number;
  private huntId = -1;
  private huntUntil = 0;
  private out: ControlInput = { angle: null, boost: false, ability: false };

  private diff: Difficulty;

  constructor(worm: Worm, diff: Difficulty) {
    this.worm = worm;
    this.diff = diff;
    this.wander = worm.angle;
    this.aggression = rand(0.15, 0.75) * diff.aggression;
    this.greed = rand(0.3, 1);
  }

  think(world: World): ControlInput {
    const w = this.worm;
    if (world.time < this.nextThink) {
      this.out.ability = false;
      return this.out;
    }
    this.nextThink = world.time + rand(this.diff.thinkMin, this.diff.thinkMax);

    const h = w.head;
    const r = w.radius;
    let goal = this.wander;
    let boost = false;
    let ability = false;
    let mode: 'wander' | 'home' | 'food' | 'hunt' = 'wander';
    let nearbyFood = 0;
    let bestFood = 0;

    this.wander += rand(-0.35, 0.35);

    if (Math.hypot(h.x, h.y) > WORLD_RADIUS - 520) {
      goal = Math.atan2(-h.y, -h.x) + rand(-0.4, 0.4);
      this.wander = goal;
      mode = 'home';
    } else {
      // food seeking
      let bx = 0;
      let by = 0;
      world.forEachFoodNear(h.x, h.y, 430, (f) => {
        const d = Math.hypot(f.x - h.x, f.y - h.y);
        nearbyFood++;
        const s = f.value / (d + 90);
        if (s > bestFood) {
          bestFood = s;
          bx = f.x;
          by = f.y;
        }
      });
      if (bestFood > 0) {
        goal = Math.atan2(by - h.y, bx - h.x);
        mode = 'food';
        if (bestFood > 0.05 && w.mass > 90 && Math.random() < this.greed * 0.25) boost = true;
      }

      // hunting: try to cut in front of a rival's head
      let target: Worm | null = null;
      if (this.huntId >= 0 && world.time < this.huntUntil) {
        target = world.worms.find((o) => o.id === this.huntId && o.alive) ?? null;
      }
      if (!target && w.mass > 45 && Math.random() < this.aggression * 0.12) {
        let bestD = 520;
        for (const o of world.worms) {
          if (o === w || !o.alive || o.mass > w.mass * 1.6) continue;
          const d = Math.hypot(o.head.x - h.x, o.head.y - h.y) * (o.isPlayer ? this.diff.targetPlayerBias : 1);
          if (d < bestD) {
            bestD = d;
            target = o;
          }
        }
        if (target) {
          this.huntId = target.id;
          this.huntUntil = world.time + rand(3, 7);
        }
      }
      if (target) {
        const th = target.head;
        const d = Math.hypot(th.x - h.x, th.y - h.y);
        if (d > 750) {
          this.huntId = -1;
        } else {
          const lead = target.radius * 5 + 80 + d * 0.35;
          const ax = th.x + Math.cos(target.angle) * lead;
          const ay = th.y + Math.sin(target.angle) * lead;
          goal = Math.atan2(ay - h.y, ax - h.x);
          mode = 'hunt';
          if (d < 340 && w.mass > 60 && Math.random() < this.aggression) boost = true;
        }
      }
    }

    // obstacle avoidance
    const step = Math.max(r * 1.8, 26);
    const probe = (ang: number): number => {
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      for (let k = 1; k <= 6; k++) {
        if (world.blocked(h.x + c * step * k, h.y + s * step * k, r * 0.95, w)) return k;
      }
      return 7;
    };
    const curClear = probe(w.angle);
    const goalClear = probe(goal);
    let final = goal;
    if (!(goalClear >= 6 && curClear >= 3)) {
      let bestScore = -Infinity;
      for (let k = -7; k <= 7; k++) {
        const ang = w.angle + k * 0.32;
        const c = probe(ang);
        const score = c * 10 - Math.abs(angleDiff(goal, ang)) * (c >= 6 ? 5 : 2);
        if (score > bestScore) {
          bestScore = score;
          final = ang;
        }
      }
    }
    if (curClear < 4) boost = false;

    // abilities
    switch (w.arch.id) {
      case 'firebrand':
        for (const o of world.worms) {
          if (o !== w && o.alive && Math.hypot(o.head.x - h.x, o.head.y - h.y) < 300) {
            ability = Math.random() < 0.5;
            break;
          }
        }
        break;
      case 'tycoon':
        ability = nearbyFood > 16;
        break;
      case 'baron':
        ability = mode === 'hunt' || (mode === 'food' && bestFood > 0.06);
        break;
      case 'reformer':
        ability = curClear <= 2;
        break;
    }

    this.out = { angle: final, boost, ability };
    return this.out;
  }
}
