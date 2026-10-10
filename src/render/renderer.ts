import { WORLD_RADIUS, SPILL_LIFETIME } from '../game/config';
import type { Particle } from '../game/effects';
import { clamp } from '../game/math';
import type { Worm } from '../game/worm';
import type { World } from '../game/world';
import { drawHead, drawStar, Expr } from './heads';
import { drawOpenCase, Sprites } from './sprites';
import { Terrain } from './terrain';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly sprites = new Sprites();
  readonly terrain = new Terrain();
  w = 0;
  h = 0;
  dpr = 1;
  maxDpr = 2;
  private leaderId = -1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  /** Zoom that keeps a sensible amount of arena on screen, pulling back as you grow. */
  zoomFor(radius: number): number {
    // phones: guarantee ~780 world px across the short side so threats aren't off-screen
    const base = clamp(Math.min(Math.sqrt(this.w * this.h) / 1050, Math.min(this.w, this.h) / 780), 0.42, 1.25);
    return base / (1 + (radius - 11) * 0.022);
  }

  worldToScreen(cam: Camera, x: number, y: number): { x: number; y: number } {
    return { x: (x - cam.x) * cam.zoom + this.w / 2, y: (y - cam.y) * cam.zoom + this.h / 2 };
  }

  render(world: World, cam: Camera, alpha: number, focus: Worm | null): void {
    const ctx = this.ctx;
    const { w, h, dpr } = this;
    const z = cam.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c1a2e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - cam.x * z), dpr * (h / 2 - cam.y * z));
    ctx.imageSmoothingEnabled = true;

    const vx0 = cam.x - w / 2 / z;
    const vy0 = cam.y - h / 2 / z;
    const vx1 = cam.x + w / 2 / z;
    const vy1 = cam.y + h / 2 / z;
    const t = world.time;

    this.terrain.draw(ctx, vx0, vy0, vx1, vy1, 3);
    this.drawBorder(ctx, vx0, vy0, vx1, vy1, focus, t);
    this.drawFood(world, vx0, vy0, vx1, vy1, t);

    const sorted = [...world.worms].sort((a, b) => (a === focus ? 1 : b === focus ? -1 : a.mass - b.mass));
    let leader: Worm | null = null;
    for (const wm of world.worms) if (!leader || wm.mass > leader.mass) leader = wm;
    this.leaderId = leader ? leader.id : -1;
    for (const wm of sorted) this.drawWorm(wm, alpha, t, z, vx0, vy0, vx1, vy1, wm === focus);

    this.drawParticles(world.particles, z);
    this.drawTexts(world, z);
    if (world.special && focus) this.drawSpecialArrow(world, cam, focus, t);
  }

  private drawBeacon(x: number, y: number, left: number, t: number): void {
    const ctx = this.ctx;
    const pulse = (t * 1.2) % 1;
    ctx.strokeStyle = `rgba(255,216,77,${0.8 * (1 - pulse)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 40 + pulse * 120, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createRadialGradient(x, y, 10, x, y, 90);
    g.addColorStop(0, 'rgba(255,230,120,0.55)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 22px "Baloo 2", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(12,26,46,0.9)';
    const txt = `${Math.max(0, Math.ceil(left))}s`;
    ctx.strokeText(txt, x, y - 58);
    ctx.fillStyle = left < 8 ? '#ff6b6b' : '#ffe14d';
    ctx.fillText(txt, x, y - 58);
  }

  /** Screen-edge arrow toward the active special contract. */
  private drawSpecialArrow(world: World, cam: Camera, focus: Worm, t: number): void {
    const sp = world.special;
    if (!sp) return;
    const s = this.worldToScreen(cam, sp.x, sp.y);
    const m = 46;
    if (s.x > m && s.x < this.w - m && s.y > m && s.y < this.h - m) return;
    const ctx = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const ang = Math.atan2(s.y - cy, s.x - cx);
    const k = Math.min((cx - m) / Math.abs(Math.cos(ang) || 1e-6), (cy - m) / Math.abs(Math.sin(ang) || 1e-6));
    const ax = cx + Math.cos(ang) * k;
    const ay = cy + Math.sin(ang) * k;
    const dist = Math.round(Math.hypot(sp.x - focus.head.x, sp.y - focus.head.y) / 10);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    ctx.translate(ax, ay);
    const bob = Math.sin(t * 6) * 3;
    ctx.save();
    ctx.rotate(ang);
    ctx.translate(bob, 0);
    ctx.fillStyle = '#ffd84d';
    ctx.strokeStyle = '#0c1a2e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-10, -16);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
    ctx.font = '700 13px "Baloo 2", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(12,26,46,0.9)';
    const ty = ay > cy ? -28 : 28;
    const label = `${sp.place} · ${dist} m`;
    ctx.strokeText(label, 0, ty);
    ctx.fillStyle = '#fff6dc';
    ctx.fillText(label, 0, ty);
    ctx.restore();
  }

  private drawBorder(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, focus: Worm | null, t: number): void {
    const R = WORLD_RADIUS;
    if (Math.max(Math.hypot(x0, y0), Math.hypot(x1, y0), Math.hypot(x0, y1), Math.hypot(x1, y1)) < R - 60) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 - 50, y0 - 50, x1 - x0 + 100, y1 - y0 + 100);
    ctx.arc(0, 0, R, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(10,22,40,0.88)';
    ctx.fill('evenodd');
    // danger glow
    const near = focus ? clamp((Math.hypot(focus.head.x, focus.head.y) - (R - 500)) / 500, 0, 1) : 0;
    if (near > 0) {
      ctx.strokeStyle = `rgba(255,60,60,${0.25 * near + 0.1 * near * Math.sin(t * 8)})`;
      ctx.lineWidth = 80;
      ctx.beginPath();
      ctx.arc(0, 0, R - 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    const cols = ['#002b7f', '#fcd116', '#ce1126'];
    cols.forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(0, 0, R + 7 + i * 14, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawFood(world: World, x0: number, y0: number, x1: number, y1: number, t: number): void {
    const ctx = this.ctx;
    const sp = this.sprites;
    for (const f of world.food) {
      if (f.x < x0 - 40 || f.x > x1 + 40 || f.y < y0 - 40 || f.y > y1 + 40) continue;
      const age = t - f.born;
      let scale = age < 0.3 ? age / 0.3 : 1;
      scale *= 1 + 0.08 * Math.sin(t * 4 + f.phase);
      const size = f.r * 2.9 * scale;
      const bob = Math.sin(t * 3 + f.phase) * 1.6;
      let a = 1;
      if (f.kind === 'spill') {
        const left = SPILL_LIFETIME - age;
        if (left < 5) a = Math.max(0, left / 5);
      }
      const img = f.kind === 'spill' ? sp.spill(f.color) : sp.food[f.kind];
      if (f.kind === 'tender') this.drawBeacon(f.x, f.y, f.expires - t, t);
      if (a < 1) ctx.globalAlpha = a;
      ctx.drawImage(img, f.x - size / 2, f.y - size / 2 + bob, size, size);
      if (a < 1) ctx.globalAlpha = 1;
      if ((f.kind === 'gold' || f.kind === 'briefcase' || f.kind === 'contract') && Math.sin(t * 2.3 + f.phase * 3) > 0.93) {
        drawStar(ctx, f.x + f.r * 0.6, f.y - f.r * 0.6 + bob, f.r * 0.55, '#ffffff');
      }
    }
  }

  private drawWorm(w: Worm, alpha: number, t: number, z: number, x0: number, y0: number, x1: number, y1: number, isFocus: boolean): void {
    const ctx = this.ctx;
    const r = w.radius;
    const segs = w.segs;
    const n = segs.length;
    const m = r * 3;
    const ia = 1 - alpha;
    const sp = this.sprites;
    const segA = sp.segment(w.colors.a);
    const segB = sp.segment(w.colors.b);

    let bodyAlpha = 1;
    if (w.spawnShield > 0) bodyAlpha = 0.45 + 0.3 * Math.sin(t * 22);
    else if (w.arch.id === 'reformer' && w.abilityT > 0) bodyAlpha = 0.5;

    const px = (i: number) => segs[i].x * alpha + segs[i].px * ia;
    const py = (i: number) => segs[i].y * alpha + segs[i].py * ia;
    const visible = (x: number, y: number) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

    ctx.globalAlpha = bodyAlpha;
    // shadow
    for (let i = n - 1; i >= 0; i -= 2) {
      const x = px(i);
      const y = py(i);
      if (!visible(x, y)) continue;
      ctx.drawImage(sp.shadow, x - r * 1.2 + r * 0.3, y - r * 1.2 + r * 0.45, r * 2.4, r * 2.4);
    }
    // boost glow
    if (w.boosting) {
      const g = sp.glow(w.colors.glow);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = n - 1; i >= 0; i -= 2) {
        const x = px(i);
        const y = py(i);
        if (!visible(x, y)) continue;
        const s = r * (2.1 + 0.25 * Math.sin(t * 20 + i));
        ctx.drawImage(g, x - s, y - s, s * 2, s * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    // body, tail first
    const wave = w.boosting ? 14 : 9;
    for (let i = n - 1; i >= 1; i--) {
      const x = px(i);
      const y = py(i);
      if (!visible(x, y)) continue;
      const fromTail = n - 1 - i;
      let s = r * (1 + 0.06 * Math.sin(t * wave - i * 0.55));
      if (fromTail < 8) s *= 0.55 + fromTail * 0.056;
      const img = Math.floor(i / 3) % 2 ? segB : segA;
      ctx.drawImage(img, x - s, y - s, s * 2, s * 2);
    }

    // head
    const hx = px(0);
    const hy = py(0);
    if (visible(hx, hy)) {
      // neck blob in main colour
      ctx.drawImage(segA, hx - r * 1.1, hy - r * 1.1, r * 2.2, r * 2.2);
      let expr: Expr = 'normal';
      if (w.stunT > 0) expr = 'dizzy';
      else if (w.abilityT > 0) expr = 'power';
      else if (w.boosting) expr = 'boost';
      else if (w.eatT > 0) expr = 'eat';
      const tilt = clamp(Math.cos(w.angle) * 0.22, -0.22, 0.22);
      const bounce = Math.sin(t * 10) * r * 0.04;
      ctx.globalAlpha = Math.max(bodyAlpha, 0.75);
      drawHead(ctx, w.arch, hx + Math.cos(w.angle) * r * 0.25, hy + Math.sin(w.angle) * r * 0.25 - r * 0.3 + bounce, r * 1.6, w.angle, expr, t + w.id, tilt);
      ctx.globalAlpha = 1;
      this.drawAbilityFx(w, hx, hy, r, t);
      // name tag
      const fs = 13 / z;
      ctx.font = `700 ${fs}px "Baloo 2", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3 / z;
      ctx.strokeStyle = 'rgba(12,26,46,0.85)';
      ctx.lineJoin = 'round';
      const ty = hy - r * 2.9 - 6 / z;
      ctx.strokeText(w.name, hx, ty);
      ctx.fillStyle = isFocus ? '#ffe14d' : '#fffaf0';
      ctx.fillText(w.name, hx, ty);
      if (w.id === this.leaderId) drawCrown(ctx, hx, ty - fs * 1.35, fs * 1.1, t);
    }
    ctx.globalAlpha = 1;
  }

  private drawAbilityFx(w: Worm, x: number, y: number, r: number, t: number): void {
    const ctx = this.ctx;
    if (w.spawnShield > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t * 15)})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (w.abilityT <= 0) return;
    switch (w.arch.id) {
      case 'firebrand': {
        ctx.strokeStyle = 'rgba(255,90,70,0.85)';
        ctx.lineWidth = 5;
        for (let k = 0; k < 3; k++) {
          const rr = r * 2 + ((t * 300 + k * 40) % 120);
          ctx.beginPath();
          ctx.arc(x, y, rr, w.angle - 0.6, w.angle + 0.6);
          ctx.stroke();
        }
        break;
      }
      case 'tycoon': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.8);
        ctx.strokeStyle = 'rgba(255,216,77,0.55)';
        ctx.lineWidth = 6;
        ctx.setLineDash([24, 18]);
        ctx.beginPath();
        ctx.arc(0, 0, 250, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,216,77,0.08)';
        ctx.fill();
        ctx.fillStyle = '#ffd84d';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          ctx.fillText('$', Math.cos(a) * 250, Math.sin(a) * 250);
        }
        ctx.restore();
        break;
      }
      case 'baron': {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 3;
        for (let k = -2; k <= 2; k++) {
          const ox = -Math.cos(w.angle) * r * 2 + Math.cos(w.angle + Math.PI / 2) * k * r * 0.5;
          const oy = -Math.sin(w.angle) * r * 2 + Math.sin(w.angle + Math.PI / 2) * k * r * 0.5;
          const len = r * (2 + ((t * 13 + k) % 1.5));
          ctx.beginPath();
          ctx.moveTo(x + ox, y + oy);
          ctx.lineTo(x + ox - Math.cos(w.angle) * len, y + oy - Math.sin(w.angle) * len);
          ctx.stroke();
        }
        break;
      }
      case 'reformer': {
        const rr = r * 2.4 + Math.sin(t * 6) * 3;
        const g = ctx.createRadialGradient(x, y, rr * 0.6, x, y, rr);
        g.addColorStop(0, 'rgba(124,196,255,0.05)');
        g.addColorStop(1, 'rgba(124,196,255,0.4)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200,235,255,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      }
    }
  }

  private drawParticles(ps: Particle[], z: number): void {
    const ctx = this.ctx;
    for (const p of ps) {
      const life = p.life / p.max;
      const prog = 1 - life;
      switch (p.kind) {
        case 'spark':
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.5 + life * 0.5), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'ring': {
          const e = 1 - Math.pow(1 - prog, 3);
          ctx.globalAlpha = life * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 + 10 * life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1, p.size * e), 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'confetti':
        case 'note':
        case 'paper': {
          ctx.globalAlpha = Math.min(1, life * 2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          const s = p.size;
          if (p.kind === 'confetti') ctx.fillRect(-s / 2, -s / 4, s, s / 2);
          else {
            ctx.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9);
            ctx.strokeStyle = p.kind === 'note' ? '#d6ffe9' : '#9aa3b5';
            ctx.lineWidth = 1;
            ctx.strokeRect(-s * 0.55, -s * 0.3, s * 1.1, s * 0.6);
          }
          ctx.restore();
          break;
        }
        case 'coin':
          ctx.globalAlpha = life;
          ctx.fillStyle = '#c48b0c';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.arc(p.x - 1, p.y - 1, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'star':
          ctx.globalAlpha = life;
          drawStar(ctx, p.x, p.y, p.size * (1 + prog * 0.5), p.color);
          break;
        case 'case':
          ctx.globalAlpha = Math.min(1, life * 2);
          drawOpenCase(ctx, p.x, p.y, p.size * (1 + prog * 0.3), Math.min(1, prog * 2.5));
          break;
      }
    }
    ctx.globalAlpha = 1;
    void z;
  }

  private drawTexts(world: World, z: number): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const tx of world.texts) {
      const life = tx.life / tx.max;
      const pop = life > 0.85 ? 1 + (life - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, life * 2.5);
      const fs = (tx.size / z) * pop;
      ctx.font = `700 ${fs}px "Baloo 2", "Trebuchet MS", sans-serif`;
      ctx.lineWidth = fs * 0.2;
      ctx.strokeStyle = 'rgba(12,26,46,0.9)';
      ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** Minimap: pre-rendered country + live worm dots. */
export class Minimap {
  private bg: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  private size: number;

  constructor(canvas: HTMLCanvasElement, terrain: Terrain) {
    this.canvas = canvas;
    this.size = 150;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = this.size * dpr;
    canvas.height = this.size * dpr;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.scale(dpr, dpr);
    this.bg = terrain.renderMinimap(this.size * dpr);
  }

  draw(world: World, focus: Worm | null, t: number): void {
    const c = this.ctx;
    const s = this.size;
    c.clearRect(0, 0, s, s);
    c.globalAlpha = 0.92;
    c.drawImage(this.bg, 0, 0, s, s);
    c.globalAlpha = 1;
    const k = s / (WORLD_RADIUS * 2);
    const top = world.worms.reduce<Worm | null>((b, w) => (!b || w.mass > b.mass ? w : b), null);
    for (const w of world.worms) {
      if (w === focus) continue;
      const x = s / 2 + w.head.x * k;
      const y = s / 2 + w.head.y * k;
      c.fillStyle = w.colors.a;
      c.globalAlpha = 0.85;
      c.beginPath();
      c.arc(x, y, Math.min(4.5, 1.6 + w.radius * 0.06), 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      if (w === top) drawStar(c, x, y - 7, 5, '#ffd84d');
    }
    if (world.special) {
      const x = s / 2 + world.special.x * k;
      const y = s / 2 + world.special.y * k;
      c.strokeStyle = '#ffd84d';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, 4 + ((t * 8) % 7), 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#ffd84d';
      c.fillRect(x - 3, y - 3, 6, 6);
    }
    if (focus && focus.alive) {
      const x = s / 2 + focus.head.x * k;
      const y = s / 2 + focus.head.y * k;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, y, 5 + Math.sin(t * 6) * 1.2, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#ffe14d';
      c.beginPath();
      c.arc(x, y, 3, 0, Math.PI * 2);
      c.fill();
    }
    const cols = ['#002b7f', '#fcd116', '#ce1126'];
    cols.forEach((col, i) => {
      c.strokeStyle = col;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 1 - i * 2, 0, Math.PI * 2);
      c.stroke();
    });
  }
}

function drawCrown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const bob = Math.sin(t * 3) * s * 0.08;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#8a5a00';
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, s * 0.35);
  ctx.lineTo(-s * 0.7, -s * 0.3);
  ctx.lineTo(-s * 0.3, s * 0.02);
  ctx.lineTo(0, -s * 0.45);
  ctx.lineTo(s * 0.3, s * 0.02);
  ctx.lineTo(s * 0.7, -s * 0.3);
  ctx.lineTo(s * 0.6, s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ce1126';
  ctx.beginPath();
  ctx.arc(0, s * 0.15, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
