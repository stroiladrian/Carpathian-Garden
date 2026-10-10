import {
  BASE_SPEED,
  BOOST_COST,
  BOOST_SPEED,
  FOOD_HARD_CAP,
  FOOD_TARGET,
  MAGNET_RANGE,
  MIN_BOOST_MASS,
  segmentSpacing,
  segmentsForMass,
  SPILL_LIFETIME,
  turnRateForRadius,
  WORLD_HALF,
  WORLD_RADIUS,
} from './config';
import type { Archetype, BodyColors } from './characters';
import type { FloatText, GameEvent, Particle, ParticleKind } from './effects';
import { Food, FOOD_DEFS, FoodKind, rollNaturalFood } from './food';
import { Grid } from './grid';
import { angleDiff, clamp, rand, randomPointInCircle, TAU } from './math';
import { Worm } from './worm';

const MAX_PARTICLES = 900;
const MAX_SEG_RADIUS = 42;

/**
 * Pure simulation of the arena. It knows nothing about input devices or
 * rendering: every worm is driven by its `control` field, which makes the
 * same class usable as a server-authoritative simulation later on.
 */
export class World {
  worms: Worm[] = [];
  food: Food[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  events: GameEvent[] = [];
  time = 0;
  /** Worm whose pickups get floating text (the local player). */
  focusId = -1;
  effectsScale = 1;

  private nextId = 1;
  private naturalCount = 0;

  readonly segGrid = new Grid(64, WORLD_HALF);
  readonly foodGrid = new Grid(64, WORLD_HALF);
  segX = new Float32Array(4096);
  segY = new Float32Array(4096);
  segR = new Float32Array(4096);
  segW = new Int32Array(4096);
  segI = new Int32Array(4096);
  segCount = 0;
  /** Snapshots of the arrays the grids were built from (indices stay valid after compaction). */
  private gridWorms: Worm[] = [];
  private gridFood: Food[] = [];
  private foodX = new Float32Array(4096);
  private foodY = new Float32Array(4096);

  constructor() {
    for (let i = 0; i < FOOD_TARGET; i++) this.food.push(rollNaturalFood(0));
    this.naturalCount = FOOD_TARGET;
    this.rebuildSegGrid();
    this.rebuildFoodGrid();
  }

  // ───────────────────────────── spawning ─────────────────────────────

  addWorm(name: string, arch: Archetype, colors: BodyColors, mass: number, isPlayer: boolean, pos?: { x: number; y: number }): Worm {
    const p = pos ?? this.findSpawnPoint(mass > 200 ? 520 : 380);
    const angle = Math.atan2(-p.y, -p.x) + rand(-0.9, 0.9);
    const w = new Worm(this.nextId++, name, arch, colors, p.x, p.y, angle, mass, isPlayer, this.time, segmentsForMass(mass));
    w.abilityCd = isPlayer ? 0 : rand(2, arch.cooldown);
    this.worms.push(w);
    return w;
  }

  findSpawnPoint(clear: number): { x: number; y: number } {
    let best = { x: 0, y: 0 };
    let bestD = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = randomPointInCircle(WORLD_RADIUS - 650);
      let minD = Infinity;
      for (const w of this.worms) {
        if (!w.alive) continue;
        for (let i = 0; i < w.segs.length; i += 3) {
          const s = w.segs[i];
          const d = Math.hypot(s.x - p.x, s.y - p.y);
          if (d < minD) minD = d;
        }
      }
      if (minD > clear) return p;
      if (minD > bestD) {
        bestD = minD;
        best = p;
      }
    }
    return best;
  }

  // ───────────────────────────── main step ─────────────────────────────

  step(dt: number): void {
    this.time += dt;
    const ws = this.worms;
    for (let i = 0; i < ws.length; i++) ws[i].gi = i;

    for (const w of ws) if (w.alive) this.updateWorm(w, dt);

    this.rebuildSegGrid();
    for (const w of ws) if (w.alive) this.checkCollisions(w);

    this.updateFood(dt);
    for (const w of ws) if (w.alive) this.collectFood(w, dt);

    this.spawnNaturalFood();
    this.updateEffects(dt);

    // compact
    this.food = this.food.filter((f) => f.alive);
    this.naturalCount = 0;
    for (const f of this.food) if (f.kind !== 'spill') this.naturalCount++;
    this.worms = ws.filter((w) => w.alive);
  }

  private updateWorm(w: Worm, dt: number): void {
    w.abilityCd = Math.max(0, w.abilityCd - dt);
    w.abilityT = Math.max(0, w.abilityT - dt);
    w.stunT = Math.max(0, w.stunT - dt);
    w.spawnShield = Math.max(0, w.spawnShield - dt);
    w.eatT = Math.max(0, w.eatT - dt);

    if (w.control.ability && w.abilityCd <= 0) this.activateAbility(w);

    const r = w.radius;
    // steering
    let target = w.control.angle;
    if (w.stunT > 0) target = w.angle + Math.sin(this.time * 7 + w.id * 1.7) * 1.4;
    let turn = turnRateForRadius(r);
    if (w.arch.id === 'firebrand') turn *= 1.15;
    if (w.stunT > 0) turn *= 0.55;
    if (target !== null) {
      const d = angleDiff(w.angle, target);
      w.angle += clamp(d, -turn * dt, turn * dt);
      if (w.angle > Math.PI) w.angle -= TAU;
      else if (w.angle < -Math.PI) w.angle += TAU;
    }

    // speed / boost
    const fastTrack = w.arch.id === 'baron' && w.abilityT > 0;
    w.boosting = fastTrack || (w.control.boost && w.mass > MIN_BOOST_MASS);
    let speed = fastTrack ? BASE_SPEED * 1.85 : w.boosting ? BOOST_SPEED : BASE_SPEED;
    if (w.stunT > 0) speed *= 0.55;

    if (w.boosting && !fastTrack) {
      const cost = BOOST_COST * (w.arch.id === 'reformer' ? 0.6 : 1) * dt * (1 + w.mass / 2500);
      w.mass -= cost;
      w.boostDropAcc += cost * 0.75;
      if (w.boostDropAcc >= 1.5) {
        const v = Math.floor(w.boostDropAcc);
        w.boostDropAcc -= v;
        const tail = w.segs[w.segs.length - 1];
        if (this.food.length < FOOD_HARD_CAP) {
          const f = new Food(tail.x + rand(-6, 6), tail.y + rand(-6, 6), 'spill', v, w.colors.a, this.time);
          this.food.push(f);
        }
      }
      if (Math.random() < 0.5 * this.effectsScale) {
        const tail = w.segs[Math.min(w.segs.length - 1, 3)];
        this.emit('spark', tail.x, tail.y, rand(-30, 30), rand(-30, 30), 0.4, r * 0.5, w.colors.glow);
      }
    }
    if (fastTrack && Math.random() < 0.6 * this.effectsScale) {
      const s = w.segs[Math.min(w.segs.length - 1, 4)];
      this.emit('paper', s.x, s.y, rand(-60, 60), rand(-60, 60), 0.9, 9, '#fffaf0');
    }

    // move
    const segs = w.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      s.px = s.x;
      s.py = s.y;
    }
    const h = segs[0];
    h.x += Math.cos(w.angle) * speed * dt;
    h.y += Math.sin(w.angle) * speed * dt;
    const sp = segmentSpacing(r);
    for (let i = 1; i < segs.length; i++) {
      const a = segs[i - 1];
      const s = segs[i];
      const dx = a.x - s.x;
      const dy = a.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > sp) {
        const k = (d - sp) / d;
        s.x += dx * k;
        s.y += dy * k;
      }
    }

    // length follows mass
    const want = segmentsForMass(w.mass);
    while (segs.length < want) {
      const t = segs[segs.length - 1];
      segs.push({ x: t.x, y: t.y, px: t.px, py: t.py });
    }
    while (segs.length > want && segs.length > 4) segs.pop();
    if (w.mass > w.peakMass) w.peakMass = w.mass;
  }

  private activateAbility(w: Worm): void {
    const a = w.arch;
    w.abilityCd = a.cooldown;
    w.abilityT = a.duration;
    const h = w.head;
    this.events.push({ t: 'ability', w: w.id, ab: a.id, x: h.x, y: h.y });
    switch (a.id) {
      case 'firebrand': {
        const range = 360;
        for (const o of this.worms) {
          if (o === w || !o.alive || o.shielded) continue;
          if (Math.hypot(o.head.x - h.x, o.head.y - h.y) < range + o.radius) {
            o.stunT = 2;
            this.events.push({ t: 'stunned', w: o.id, by: w.id });
            this.emit('star', o.head.x, o.head.y - o.radius, 0, -30, 1.2, 14, '#ffe14d');
          }
        }
        this.emit('ring', h.x, h.y, 0, 0, 0.7, range, '#ff4a3d');
        this.emit('ring', h.x, h.y, 0, 0, 0.5, range * 0.7, '#ffd23f');
        break;
      }
      case 'tycoon':
        this.emit('ring', h.x, h.y, 0, 0, 0.6, 320, '#ffd84d');
        for (let i = 0; i < 18; i++) this.emit('coin', h.x, h.y, rand(-220, 220), rand(-220, 220), 0.9, 9, '#ffcf33');
        break;
      case 'baron':
        for (let i = 0; i < 14; i++) this.emit('paper', h.x, h.y, rand(-200, 200), rand(-200, 200), 1, 10, '#fffaf0');
        break;
      case 'reformer':
        this.emit('ring', h.x, h.y, 0, 0, 0.6, 200, '#7cc4ff');
        break;
    }
  }

  private rebuildSegGrid(): void {
    let n = 0;
    for (const w of this.worms) n += w.segs.length;
    if (this.segX.length < n) {
      const cap = n * 2;
      this.segX = new Float32Array(cap);
      this.segY = new Float32Array(cap);
      this.segR = new Float32Array(cap);
      this.segW = new Int32Array(cap);
      this.segI = new Int32Array(cap);
    }
    let k = 0;
    for (let wi = 0; wi < this.worms.length; wi++) {
      const w = this.worms[wi];
      w.gi = wi;
      const r = w.radius;
      for (let i = 0; i < w.segs.length; i++) {
        this.segX[k] = w.segs[i].x;
        this.segY[k] = w.segs[i].y;
        this.segR[k] = r;
        this.segW[k] = wi;
        this.segI[k] = i;
        k++;
      }
    }
    this.segCount = k;
    this.gridWorms = this.worms.slice();
    this.segGrid.build(k, this.segX, this.segY);
  }

  private rebuildFoodGrid(): void {
    const n = this.food.length;
    if (this.foodX.length < n) {
      this.foodX = new Float32Array(n * 2);
      this.foodY = new Float32Array(n * 2);
    }
    for (let i = 0; i < n; i++) {
      this.foodX[i] = this.food[i].x;
      this.foodY[i] = this.food[i].y;
    }
    this.gridFood = this.food.slice();
    this.foodGrid.build(n, this.foodX, this.foodY);
  }

  private checkCollisions(w: Worm): void {
    const h = w.head;
    const r = w.radius;
    if (Math.hypot(h.x, h.y) > WORLD_RADIUS - r * 0.6) {
      this.kill(w, null, 'border');
      return;
    }
    if (w.shielded) return;
    const ws = this.gridWorms;
    let killer: Worm | null = null;
    this.segGrid.query(h.x, h.y, r + MAX_SEG_RADIUS, (k) => {
      const ow = this.segW[k];
      if (ow === w.gi) return;
      const other = ws[ow];
      if (!other.alive || other.shielded) return;
      const dx = this.segX[k] - h.x;
      const dy = this.segY[k] - h.y;
      const rr = r * 0.8 + this.segR[k] * 0.85;
      if (dx * dx + dy * dy >= rr * rr) return;
      if (this.segI[k] === 0) {
        // head-on: the smaller politician loses
        if (other.mass > w.mass || (other.mass === w.mass && other.id < w.id)) {
          killer = other;
          return true;
        }
        return;
      }
      killer = other;
      return true;
    });
    if (killer) this.kill(w, killer, 'body');
  }

  kill(w: Worm, killer: Worm | null, cause: 'body' | 'border'): void {
    if (!w.alive) return;
    w.alive = false;
    w.killedBy = killer ? killer.name : null;
    w.deathCause = cause;
    if (killer) killer.kills++;
    const h = w.head;

    // spill the war chest
    const segs = w.segs;
    let total = w.mass * 0.8;
    const room = Math.max(0, FOOD_HARD_CAP + 400 - this.food.length);
    const cases = Math.min(6, Math.floor(w.mass / 160));
    for (let c = 0; c < cases && room > 0; c++) {
      const s = segs[Math.floor(Math.random() * segs.length)];
      const f = new Food(s.x, s.y, 'briefcase', FOOD_DEFS.briefcase.value, '', this.time);
      f.vx = rand(-120, 120);
      f.vy = rand(-120, 120);
      this.food.push(f);
      total -= FOOD_DEFS.briefcase.value;
    }
    const count = Math.max(4, Math.min(room, 110, Math.ceil(total / 2.5)));
    const each = Math.max(1, total / count);
    const r = w.radius;
    for (let i = 0; i < count; i++) {
      const s = segs[Math.floor((i / count) * segs.length)];
      const color = Math.floor(i / 3) % 2 ? w.colors.b : w.colors.a;
      const f = new Food(s.x + rand(-r, r) * 0.7, s.y + rand(-r, r) * 0.7, 'spill', Math.round(each * 10) / 10, color, this.time);
      const a = Math.random() * TAU;
      const sp = rand(30, 170);
      f.vx = Math.cos(a) * sp;
      f.vy = Math.sin(a) * sp;
      this.food.push(f);
    }

    // burst
    const n = Math.round(36 * this.effectsScale);
    for (let i = 0; i < n; i++) {
      const s = segs[Math.floor(Math.random() * Math.min(segs.length, 30))];
      const a = Math.random() * TAU;
      const sp = rand(80, 340);
      const kind: ParticleKind = i % 3 === 0 ? 'note' : 'confetti';
      const col = kind === 'note' ? '#4fae7e' : [w.colors.a, w.colors.b, '#002b7f', '#fcd116', '#ce1126'][i % 5];
      this.emit(kind, s.x, s.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.8, 1.5), rand(6, 11), col);
    }
    this.emit('ring', h.x, h.y, 0, 0, 0.6, r * 6, w.colors.glow);

    const focus = this.focusId;
    if (killer && killer.id === focus) this.text(h.x, h.y - r * 2, `ELIMINATED ${w.name}!`, '#ffe14d', 2.2, 26);
    else if (w.id === focus) this.text(h.x, h.y - r * 2, cause === 'border' ? 'EXILED!' : 'SCANDAL!', '#ff5a4f', 2.4, 30);

    this.events.push({
      t: 'death',
      victim: w.id,
      victimName: w.name,
      killer: killer ? killer.id : null,
      killerName: killer ? killer.name : null,
      cause,
      x: h.x,
      y: h.y,
      mass: w.mass,
    });
  }

  private updateFood(dt: number): void {
    const decay = Math.pow(0.9, dt * 60);
    const t = this.time;
    for (const f of this.food) {
      f.attractedBy = -1;
      if (f.vx !== 0 || f.vy !== 0) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= decay;
        f.vy *= decay;
        if (Math.abs(f.vx) < 2 && Math.abs(f.vy) < 2) f.vx = f.vy = 0;
        const d = Math.hypot(f.x, f.y);
        if (d > WORLD_RADIUS - 40) {
          f.x *= (WORLD_RADIUS - 40) / d;
          f.y *= (WORLD_RADIUS - 40) / d;
        }
      }
      if (f.kind === 'spill' && t - f.born > SPILL_LIFETIME) f.alive = false;
    }
    this.rebuildFoodGrid();
  }

  private collectFood(w: Worm, dt: number): void {
    const h = w.head;
    const r = w.radius;
    const magnet = w.arch.id === 'tycoon' && w.abilityT > 0 ? 330 : MAGNET_RANGE + r * 0.6;
    const range = r + magnet + 16;
    this.foodGrid.query(h.x, h.y, range, (i) => {
      const f = this.gridFood[i];
      if (!f.alive) return;
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r + f.r * 0.6) {
        this.eat(w, f);
      } else if (d < r + f.r + magnet && f.attractedBy < 0) {
        f.attractedBy = w.gi;
        const pull = Math.min(d, (240 + 520 * (1 - d / (r + f.r + magnet))) * dt);
        f.x += (dx / d) * pull;
        f.y += (dy / d) * pull;
      }
    });
  }

  private eat(w: Worm, f: Food): void {
    f.alive = false;
    const def = FOOD_DEFS[f.kind];
    let mult = 1;
    const id = w.arch.id;
    if (id === 'tycoon' && (f.kind === 'coin' || f.kind === 'note' || f.kind === 'gold')) mult = 1.3;
    if (id === 'baron' && (f.kind === 'contract' || f.kind === 'briefcase')) mult = 1.5;
    if (id === 'reformer' && f.kind === 'pledge') mult = 3;
    const gain = f.value * mult;
    w.mass += gain;
    w.money += (f.kind === 'spill' ? f.value * 300 : def.lei) * mult;
    if (f.kind !== 'coin' && f.kind !== 'spill') w.eatT = 0.28;
    this.events.push({ t: 'eat', w: w.id, kind: f.kind, value: gain });

    const sparks = f.kind === 'coin' || f.kind === 'spill' ? 2 : 6;
    for (let i = 0; i < sparks * this.effectsScale; i++) {
      this.emit('spark', f.x, f.y, rand(-90, 90), rand(-90, 90), 0.35, rand(2, 4), f.kind === 'spill' ? f.color : '#ffe680');
    }
    if (f.kind === 'briefcase') {
      this.emit('case', f.x, f.y, 0, -40, 0.9, 30, '#5a3a22');
      for (let i = 0; i < 10; i++) this.emit('note', f.x, f.y, rand(-160, 160), rand(-200, 40), rand(0.7, 1.2), 9, '#4fae7e');
    } else if (f.kind === 'contract') {
      for (let i = 0; i < 5; i++) this.emit('paper', f.x, f.y, rand(-120, 120), rand(-120, 120), 0.8, 8, '#fffaf0');
    } else if (f.kind === 'gold') {
      this.emit('star', f.x, f.y, 0, -20, 0.5, 10, '#fff2a8');
    }
    if (w.id === this.focusId && (f.kind === 'contract' || f.kind === 'briefcase' || f.kind === 'gold' || f.kind === 'pledge')) {
      const label = def.label;
      const v = Math.round(gain * 10) / 10;
      this.text(f.x, f.y - 20, `+${v} ${label}`, f.kind === 'pledge' ? '#9fd0ff' : '#ffe14d', 1.2, f.kind === 'briefcase' ? 22 : 18);
    }
  }

  private spawnNaturalFood(): void {
    let budget = 25;
    while (this.naturalCount < FOOD_TARGET && budget-- > 0) {
      this.food.push(rollNaturalFood(this.time));
      this.naturalCount++;
    }
  }

  private updateEffects(dt: number): void {
    const ps = this.particles;
    let j = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const drag = p.kind === 'note' || p.kind === 'paper' || p.kind === 'confetti' ? 0.93 : 0.9;
      p.vx *= Math.pow(drag, dt * 60);
      p.vy *= Math.pow(drag, dt * 60);
      p.rot += p.vr * dt;
      ps[j++] = p;
    }
    ps.length = j;
    const ts = this.texts;
    j = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      t.life -= dt;
      t.y -= 28 * dt;
      if (t.life > 0) ts[j++] = t;
    }
    ts.length = j;
  }

  emit(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ kind, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * TAU, vr: rand(-6, 6) });
  }

  text(x: number, y: number, text: string, color: string, life: number, size: number): void {
    if (this.texts.length > 30) this.texts.shift();
    this.texts.push({ x, y, text, color, life, max: life, size });
  }

  // ───────────────────────────── queries (used by AI) ─────────────────────────────

  /** Is a circle at (x,y) blocked by a rival body or the border? */
  blocked(x: number, y: number, rad: number, self: Worm): boolean {
    if (Math.hypot(x, y) > WORLD_RADIUS - rad - 30) return true;
    const ws = this.gridWorms;
    return this.segGrid.query(x, y, rad + MAX_SEG_RADIUS, (k) => {
      const ow = this.segW[k];
      const other = ws[ow];
      if (!other || other === self || !other.alive || other.shielded) return;
      const dx = this.segX[k] - x;
      const dy = this.segY[k] - y;
      const rr = rad + this.segR[k];
      if (dx * dx + dy * dy < rr * rr) return true;
    });
  }

  forEachFoodNear(x: number, y: number, r: number, fn: (f: Food) => void): void {
    this.foodGrid.query(x, y, r, (i) => {
      const f = this.gridFood[i];
      if (f && f.alive) fn(f);
    });
  }

  leaderboard(): Worm[] {
    return [...this.worms].sort((a, b) => b.mass - a.mass);
  }

  isKind(f: Food, k: FoodKind): boolean {
    return f.kind === k;
  }
}
