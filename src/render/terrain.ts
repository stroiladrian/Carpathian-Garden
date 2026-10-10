import { WORLD_HALF, WORLD_RADIUS } from '../game/config';
import {
  BUCHAREST,
  CARPATHIANS,
  coastX,
  DANUBE,
  DANUBE_BRANCHES,
  inBucharest,
  inMountainZone,
  MURES,
  OLT,
  Pt,
  VILLAGES,
} from '../game/layout';
import { mulberry32 } from '../game/math';
import { darken, lighten } from './color';
import { makeCanvas } from './sprites';

type Feature =
  | { k: 'blob'; x: number; y: number; r: number; c: string }
  | { k: 'sea' }
  | { k: 'field'; x: number; y: number; w: number; h: number; rot: number; c: string }
  | { k: 'lake'; x: number; y: number; rx: number; ry: number; name?: string }
  | { k: 'river'; pts: Pt[]; w: number }
  | { k: 'road'; pts: Pt[]; w: number }
  | { k: 'highway'; pts: Pt[] }
  | { k: 'cones'; x: number; y: number }
  | { k: 'serpentine'; x: number; y: number; h: number }
  | { k: 'mountain'; x: number; y: number; s: number; v: number }
  | { k: 'pine'; x: number; y: number; s: number }
  | { k: 'tree'; x: number; y: number; s: number; c: string }
  | { k: 'house'; x: number; y: number; w: number; h: number; roof: string }
  | { k: 'cityBase' }
  | { k: 'building'; x: number; y: number; w: number; h: number; c: string }
  | { k: 'park'; x: number; y: number; w: number; h: number }
  | { k: 'palace'; x: number; y: number }
  | { k: 'arch'; x: number; y: number }
  | { k: 'castle'; x: number; y: number }
  | { k: 'church'; x: number; y: number }
  | { k: 'bunting'; a: Pt; b: Pt }
  | { k: 'billboard'; x: number; y: number; text: string; c: string }
  | { k: 'umbrella'; x: number; y: number; c: string }
  | { k: 'label'; x: number; y: number; text: string; size: number; alpha: number; color: string };

interface Item {
  f: Feature;
  layer: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LAYER: Record<Feature['k'], number> = {
  blob: 0, sea: 1, field: 2, lake: 3, river: 4, cityBase: 5, park: 6, road: 7, highway: 8, serpentine: 8,
  cones: 9, mountain: 10, pine: 11, tree: 11, house: 12, building: 12, palace: 13, arch: 13, castle: 13,
  church: 13, umbrella: 13, billboard: 14, bunting: 15, label: 16,
};

const GRASS = '#6aab48';
const FIELD_COLORS = ['#d9b44a', '#c9a23c', '#8fbf4d', '#a7c957', '#e6c84f', '#9b7b4f', '#b8d36b', '#7fae3f'];

export const CHUNK = 640;
const RES = 0.62;
const N = Math.ceil((WORLD_HALF * 2) / CHUNK);

/**
 * Procedurally laid-out, hand-styled map of a cartoon Romania.
 * Features are generated once (deterministically), bucketed per chunk and
 * rasterised lazily into cached chunk canvases.
 */
export class Terrain {
  private items: Item[] = [];
  private buckets: Item[][] = [];
  private cache = new Map<number, HTMLCanvasElement>();
  private maxCache = 72;

  constructor() {
    this.generate();
    this.items.sort((a, b) => a.layer - b.layer || a.y1 - b.y1);
    for (let i = 0; i < N * N; i++) this.buckets.push([]);
    for (const it of this.items) {
      const i0 = Math.max(0, Math.floor((it.x0 + WORLD_HALF) / CHUNK));
      const i1 = Math.min(N - 1, Math.floor((it.x1 + WORLD_HALF) / CHUNK));
      const j0 = Math.max(0, Math.floor((it.y0 + WORLD_HALF) / CHUNK));
      const j1 = Math.min(N - 1, Math.floor((it.y1 + WORLD_HALF) / CHUNK));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.buckets[j * N + i].push(it);
    }
  }

  // ───────────────────────────── generation ─────────────────────────────

  private add(f: Feature, x0: number, y0: number, x1: number, y1: number): void {
    this.items.push({ f, layer: LAYER[f.k], x0, y0, x1, y1 });
  }
  private addPts(f: Feature & { pts: Pt[] }, pad: number): void {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of f.pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    this.add(f, x0 - pad, y0 - pad, x1 + pad, y1 + pad);
  }

  private generate(): void {
    const rng = mulberry32(20261010);
    const R = WORLD_RADIUS;
    const inside = (x: number, y: number, pad = 0) => Math.hypot(x, y) < R - pad;
    const isSea = (x: number, y: number) => x > coastX(y) - 20;

    // grass mottling
    for (let i = 0; i < 900; i++) {
      const x = (rng() * 2 - 1) * R;
      const y = (rng() * 2 - 1) * R;
      const r = 40 + rng() * 140;
      const c = rng() < 0.5 ? '#62a242' : '#76b652';
      this.add({ k: 'blob', x, y, r, c }, x - r, y - r, x + r, y + r);
    }

    // Black Sea
    this.add({ k: 'sea' }, 2050, -WORLD_HALF, WORLD_HALF, WORLD_HALF);

    // patchwork fields
    const fieldRegion = (x0: number, y0: number, x1: number, y1: number, size: number, prob: number, palette: string[]) => {
      for (let y = y0; y < y1; y += size) {
        for (let x = x0; x < x1; x += size) {
          if (rng() > prob) continue;
          const w = size * (0.75 + rng() * 0.3);
          const h = size * (0.7 + rng() * 0.3);
          const cx = x + size / 2;
          const cy = y + size / 2;
          if (!inside(cx, cy, 120) || isSea(cx + size, cy) || inBucharest(cx, cy, 120) || inMountainZone(cx, cy, 300)) continue;
          if (cy > danubeY(cx) - 70 && cx < 1900) continue;
          const c = palette[Math.floor(rng() * palette.length)];
          const rot = (rng() - 0.5) * 0.25;
          this.add({ k: 'field', x: cx, y: cy, w, h, rot, c }, cx - size, cy - size, cx + size, cy + size);
        }
      }
    };
    fieldRegion(-2300, 1250, 1900, 2150, 190, 0.85, FIELD_COLORS); // Wallachia plain
    fieldRegion(950, -2000, 2250, 1000, 200, 0.8, FIELD_COLORS); // Moldova
    fieldRegion(-1500, -1000, 400, 700, 200, 0.45, FIELD_COLORS); // Transylvania
    fieldRegion(-2900, -1200, -1700, 1300, 200, 0.6, FIELD_COLORS); // west
    fieldRegion(2000, 400, 2300, 2000, 120, 0.9, ['#d9b44a', '#e0c56a', '#c9a23c']); // Dobrogea

    // lakes
    this.add({ k: 'lake', x: -560, y: -60, rx: 170, ry: 95, name: 'Lacul Fondurilor' }, -760, -180, -360, 60);
    this.add({ k: 'lake', x: 1900, y: -1500, rx: 90, ry: 60 }, 1800, -1580, 2000, -1420);

    // rivers
    this.addPts({ k: 'river', pts: DANUBE, w: 46 }, 60);
    for (const b of DANUBE_BRANCHES) this.addPts({ k: 'river', pts: b, w: 26 }, 40);
    this.addPts({ k: 'river', pts: OLT, w: 22 }, 30);
    this.addPts({ k: 'river', pts: MURES, w: 20 }, 30);
    this.addPts({ k: 'river', pts: [[1400, -2100], [1300, -1300], [1500, -600], [1650, 300], [1800, 1100], [1900, 1400]], w: 20 }, 30);

    // capital
    const B = BUCHAREST;
    this.add({ k: 'cityBase' }, B.x - 40, B.y - 40, B.x + B.w + 40, B.y + B.h + 40);
    const cols = 8;
    const rows = 6;
    const bw = B.w / cols;
    const bh = B.h / rows;
    const palaceCell = { i: 2, j: 3 };
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = B.x + i * bw + 12;
        const y = B.y + j * bh + 12;
        const w = bw - 24;
        const h = bh - 24;
        if ((i === palaceCell.i || i === palaceCell.i + 1) && (j === palaceCell.j || j === palaceCell.j + 1)) continue;
        if (i === 6 && j === 1) {
          this.add({ k: 'park', x, y, w, h }, x, y, x + w, y + h);
          this.add({ k: 'lake', x: x + w / 2, y: y + h / 2, rx: w * 0.3, ry: h * 0.25 }, x, y, x + w, y + h);
          continue;
        }
        if (rng() < 0.12) {
          this.add({ k: 'park', x, y, w, h }, x, y, x + w, y + h);
          for (let t = 0; t < 5; t++) {
            const tx = x + 10 + rng() * (w - 20);
            const ty = y + 10 + rng() * (h - 20);
            this.add({ k: 'tree', x: tx, y: ty, s: 9 + rng() * 5, c: '#3f8a3a' }, tx - 16, ty - 16, tx + 16, ty + 16);
          }
          continue;
        }
        // subdivide into buildings
        const nb = 2 + Math.floor(rng() * 3);
        for (let b = 0; b < nb; b++) {
          const bx = x + rng() * w * 0.5;
          const by = y + rng() * h * 0.5;
          const bww = w * (0.3 + rng() * 0.5);
          const bhh = h * (0.3 + rng() * 0.5);
          const c = ['#e9e2d0', '#d7cbb5', '#c8c3bb', '#f1e7cf', '#b9b2a6', '#e3c9a8'][Math.floor(rng() * 6)];
          this.add({ k: 'building', x: bx, y: by, w: Math.min(bww, x + w - bx), h: Math.min(bhh, y + h - by), c }, bx, by, bx + bww, by + bhh);
        }
      }
    }
    const px = B.x + (palaceCell.i + 1) * bw;
    const py = B.y + (palaceCell.j + 1) * bh;
    this.add({ k: 'palace', x: px, y: py }, px - 120, py - 140, px + 120, py + 120);
    this.add({ k: 'arch', x: B.x + B.w * 0.62, y: B.y - 70 }, B.x + B.w * 0.62 - 40, B.y - 110, B.x + B.w * 0.62 + 40, B.y - 30);
    this.add({ k: 'label', x: B.x + B.w / 2, y: B.y - 150, text: 'BUCUREȘTI', size: 64, alpha: 0.9, color: '#fff6dc' }, B.x - 100, B.y - 210, B.x + B.w + 100, B.y - 100);
    this.add({ k: 'label', x: px, y: py + 135, text: 'Palatul Contractelor', size: 20, alpha: 0.95, color: '#fff6dc' }, px - 160, py + 110, px + 160, py + 160);
    for (let i = 0; i < 4; i++) {
      const y = B.y + 18 + i * bh * 1.6;
      this.add({ k: 'bunting', a: [B.x + 10, y], b: [B.x + B.w - 10, y + 10] }, B.x, y - 10, B.x + B.w, y + 50);
    }

    // villages
    for (const v of VILLAGES) {
      const n = 7 + Math.floor(rng() * 7);
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2;
        const d = 30 + rng() * 110;
        const x = v.x + Math.cos(a) * d;
        const y = v.y + Math.sin(a) * d;
        const w = 22 + rng() * 14;
        const h = 18 + rng() * 10;
        const roof = ['#b8432f', '#a63a2a', '#c75b3a', '#7d4b3a', '#8c3b2e'][Math.floor(rng() * 5)];
        this.add({ k: 'house', x, y, w, h, roof }, x - w, y - h, x + w, y + h);
      }
      for (let i = 0; i < 4; i++) {
        const tx = v.x + (rng() - 0.5) * 300;
        const ty = v.y + (rng() - 0.5) * 300;
        this.add({ k: 'tree', x: tx, y: ty, s: 12 + rng() * 6, c: '#4d8f3a' }, tx - 20, ty - 20, tx + 20, ty + 20);
      }
      this.add({ k: 'bunting', a: [v.x - 70, v.y - 20], b: [v.x + 70, v.y - 30] }, v.x - 80, v.y - 40, v.x + 80, v.y + 20);
      this.add({ k: 'label', x: v.x, y: v.y + 165, text: v.name, size: 22, alpha: 0.95, color: '#fffaf0' }, v.x - 260, v.y + 135, v.x + 260, v.y + 195);
    }

    // roads (villages ↔ capital, plus a loop)
    const hub: Pt = [B.x + B.w / 2, B.y + B.h / 2];
    const roadTo = (a: Pt, b: Pt, w = 14) => {
      const mx = (a[0] + b[0]) / 2 + (rng() - 0.5) * 200;
      const my = (a[1] + b[1]) / 2 + (rng() - 0.5) * 200;
      const pts: Pt[] = [];
      for (let t = 0; t <= 1.0001; t += 0.1) {
        const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mx + t * t * b[0];
        const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * my + t * t * b[1];
        pts.push([x, y]);
      }
      this.addPts({ k: 'road', pts, w }, w + 10);
    };
    const order = [8, 9, 10, 13, 12, 11, 3, 0, 4, 1, 2, 7, 6, 5];
    for (let i = 0; i < order.length - 1; i++) {
      const a = VILLAGES[order[i]];
      const b = VILLAGES[order[i + 1]];
      roadTo([a.x, a.y], [b.x, b.y]);
    }
    roadTo(hub, [VILLAGES[10].x, VILLAGES[10].y], 18);
    roadTo(hub, [VILLAGES[7].x, VILLAGES[7].y], 18);
    roadTo(hub, [VILLAGES[9].x, VILLAGES[9].y], 18);

    // the eternal motorway: starts in the capital, ends in a field
    const hw: Pt[] = [[B.x - 10, B.y + B.h * 0.55], [B.x - 300, B.y + B.h * 0.5], [B.x - 560, B.y + B.h * 0.62]];
    this.addPts({ k: 'highway', pts: hw }, 40);
    this.add({ k: 'cones', x: hw[2][0] - 30, y: hw[2][1] }, hw[2][0] - 90, hw[2][1] - 60, hw[2][0] + 10, hw[2][1] + 60);
    this.add({ k: 'billboard', x: hw[2][0] - 40, y: hw[2][1] - 90, text: 'AUTOSTRADĂ — GATA ÎN 2006*', c: '#1f2f5c' }, hw[2][0] - 260, hw[2][1] - 150, hw[2][0] + 180, hw[2][1] - 30);
    const hw2: Pt[] = [[-1550, 1420], [-1250, 1400], [-1050, 1440]];
    this.addPts({ k: 'highway', pts: hw2 }, 40);
    this.add({ k: 'cones', x: -1580, y: 1420 }, -1640, 1360, -1520, 1480);
    this.add({ k: 'cones', x: -1020, y: 1440 }, -1080, 1380, -960, 1500);
    this.add({ k: 'billboard', x: -1300, y: 1330, text: 'TRONSON FINALIZAT (4 km)', c: '#ce1126' }, -1540, 1270, -1060, 1390);

    // Transfăgărășan-style serpentine across the southern ridge
    this.add({ k: 'serpentine', x: -150, y: 900, h: 420 }, -260, 690, -40, 1110);

    // Carpathian arc
    const { cx, cy, r, a0, a1 } = CARPATHIANS;
    const castle = { x: -650, y: 1030 };
    for (let row = 0; row < 3; row++) {
      const off = (row - 1) * 130;
      for (let a = a0; a <= a1; a += 0.085 + rng() * 0.04) {
        const rr = r + off + (rng() - 0.5) * 90;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (Math.hypot(x - castle.x, y - castle.y) < 160 || Math.hypot(x + 150, y - 900) < 90) continue;
        if (!inside(x, y, 120)) continue;
        const s = (row === 1 ? 150 : 105) + rng() * 70;
        this.add({ k: 'mountain', x, y, s, v: rng() }, x - s, y - s * 1.1, x + s, y + s * 0.4);
      }
    }
    // conifer forests around the arc
    for (let i = 0; i < 1600; i++) {
      const a = a0 + rng() * (a1 - a0);
      const rr = r + (rng() < 0.5 ? -1 : 1) * (200 + rng() * 260);
      const x = cx + Math.cos(a) * rr + (rng() - 0.5) * 60;
      const y = cy + Math.sin(a) * rr + (rng() - 0.5) * 60;
      if (!inside(x, y, 80) || isSea(x, y) || inBucharest(x, y, 60)) continue;
      if (VILLAGES.some((v) => Math.hypot(v.x - x, v.y - y) < 150)) continue;
      const s = 10 + rng() * 9;
      this.add({ k: 'pine', x, y, s }, x - s, y - s * 2, x + s, y + s);
    }
    // deciduous groves in the plains
    const groves: Pt[] = [[-1900, 1450], [-900, 1450], [400, 1450], [1250, -600], [1900, 600], [-2400, 500], [-2100, -900], [600, -1700], [-300, -1500]];
    for (const [gx, gy] of groves) {
      for (let i = 0; i < 70; i++) {
        const x = gx + (rng() - 0.5) * 360;
        const y = gy + (rng() - 0.5) * 260;
        if (!inside(x, y, 80) || inBucharest(x, y, 40)) continue;
        const s = 11 + rng() * 9;
        this.add({ k: 'tree', x, y, s, c: rng() < 0.5 ? '#4d8f3a' : '#3f7f34' }, x - s * 1.6, y - s * 1.6, x + s * 1.6, y + s * 1.6);
      }
    }

    // landmarks
    this.add({ k: 'castle', x: castle.x, y: castle.y }, castle.x - 90, castle.y - 110, castle.x + 90, castle.y + 80);
    this.add({ k: 'label', x: castle.x, y: castle.y + 105, text: 'Castelul Consilierilor', size: 20, alpha: 0.95, color: '#fffaf0' }, castle.x - 160, castle.y + 80, castle.x + 160, castle.y + 130);
    this.add({ k: 'church', x: -1150, y: -1530 }, -1220, -1650, -1080, -1460);
    this.add({ k: 'label', x: -1150, y: -1420, text: 'Biserica de Lemn', size: 20, alpha: 0.95, color: '#fffaf0' }, -1300, -1450, -1000, -1390);

    // Black Sea resort umbrellas
    for (let i = 0; i < 26; i++) {
      const y = 1200 + i * 22 + (rng() - 0.5) * 10;
      const x = coastX(y) - 34 + (rng() - 0.5) * 18;
      const c = ['#ce1126', '#fcd116', '#002b7f', '#ffffff'][i % 4];
      this.add({ k: 'umbrella', x, y, c }, x - 12, y - 12, x + 12, y + 12);
    }

    // satirical billboards
    const boards: [number, number, string, string][] = [
      [-300, 1300, 'VOTAȚI CU NOI! (am promis deja)', '#ce1126'],
      [1500, 1200, 'PENSII DUBLE* *condiții', '#1f2f5c'],
      [-1600, -600, 'UN CONTRACT PENTRU FIECARE', '#d4a017'],
      [1500, -1300, 'FONDURI EUROPENE: ÎN CURÂND', '#002b7f'],
      [-2350, 900, 'TRANSPARENȚĂ (parțială)', '#2a6fdb'],
      [500, -900, 'ASFALT ELECTORAL — 3 ZILE', '#3b3b3b'],
      [2050, -400, 'BINE AȚI VENIT LA MARE!', '#14a3a3'],
      [-900, 1000, 'AICI SE CONSTRUIEȘTE ORICÂND', '#ce1126'],
    ];
    for (const [x, y, text, c] of boards) {
      const hw = text.length * 7 + 60;
      this.add({ k: 'billboard', x, y, text, c }, x - hw, y - 60, x + hw, y + 50);
    }

    // region labels
    const regions: [number, number, string, number][] = [
      [-450, -560, 'TRANSILVANIA', 74],
      [1650, -700, 'MOLDOVA', 74],
      [-900, 1960, 'ȚARA ROMÂNEASCĂ', 64],
      [2620, 200, 'MAREA NEAGRĂ', 54],
      [450, -1200, 'CARPAȚII', 60],
      [-2350, 250, 'BANAT', 60],
    ];
    for (const [x, y, text, size] of regions) {
      this.add({ k: 'label', x, y, text, size, alpha: 0.32, color: '#0e2440' }, x - size * text.length * 0.6, y - size, x + size * text.length * 0.6, y + size);
    }
  }

  // ───────────────────────────── chunk rendering ─────────────────────────────

  private renderChunk(i: number, j: number): HTMLCanvasElement {
    const px = Math.ceil(CHUNK * RES);
    const cv = makeCanvas(px, px);
    const c = cv.getContext('2d')!;
    const x0 = -WORLD_HALF + i * CHUNK;
    const y0 = -WORLD_HALF + j * CHUNK;
    c.setTransform(RES, 0, 0, RES, -x0 * RES, -y0 * RES);
    c.fillStyle = GRASS;
    c.fillRect(x0, y0, CHUNK, CHUNK);
    for (const it of this.buckets[j * N + i]) drawFeature(c, it.f, 1);
    // subtle survey grid
    c.strokeStyle = 'rgba(14,36,64,0.07)';
    c.lineWidth = 2;
    c.beginPath();
    for (let g = Math.ceil(x0 / 100) * 100; g <= x0 + CHUNK; g += 100) {
      c.moveTo(g, y0);
      c.lineTo(g, y0 + CHUNK);
    }
    for (let g = Math.ceil(y0 / 100) * 100; g <= y0 + CHUNK; g += 100) {
      c.moveTo(x0, g);
      c.lineTo(x0 + CHUNK, g);
    }
    c.stroke();
    return cv;
  }

  /** Draws visible chunks; generates at most `budget` new ones per call to avoid frame spikes. */
  draw(ctx: CanvasRenderingContext2D, vx0: number, vy0: number, vx1: number, vy1: number, budget: number): void {
    const i0 = Math.max(0, Math.floor((vx0 + WORLD_HALF) / CHUNK));
    const i1 = Math.min(N - 1, Math.floor((vx1 + WORLD_HALF) / CHUNK));
    const j0 = Math.max(0, Math.floor((vy0 + WORLD_HALF) / CHUNK));
    const j1 = Math.min(N - 1, Math.floor((vy1 + WORLD_HALF) / CHUNK));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const key = j * N + i;
        let cv = this.cache.get(key);
        const x = -WORLD_HALF + i * CHUNK;
        const y = -WORLD_HALF + j * CHUNK;
        if (!cv && budget > 0) {
          budget--;
          cv = this.renderChunk(i, j);
          this.cache.set(key, cv);
          if (this.cache.size > this.maxCache) {
            const first = this.cache.keys().next().value;
            if (first !== undefined) this.cache.delete(first);
          }
        } else if (cv) {
          // refresh LRU position
          this.cache.delete(key);
          this.cache.set(key, cv);
        }
        if (cv) ctx.drawImage(cv, x, y, CHUNK + 0.6, CHUNK + 0.6);
        else {
          ctx.fillStyle = GRASS;
          ctx.fillRect(x, y, CHUNK, CHUNK);
        }
      }
    }
  }

  warm(cx: number, cy: number, radius: number): void {
    const dummy = makeCanvas(1, 1).getContext('2d')!;
    this.draw(dummy, cx - radius, cy - radius, cx + radius, cy + radius, 99);
  }

  /** Small overview map for the minimap. */
  renderMinimap(size: number): HTMLCanvasElement {
    const cv = makeCanvas(size, size);
    const c = cv.getContext('2d')!;
    const s = size / (WORLD_RADIUS * 2);
    c.save();
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    c.clip();
    c.setTransform(s, 0, 0, s, size / 2, size / 2);
    c.fillStyle = GRASS;
    c.fillRect(-WORLD_RADIUS, -WORLD_RADIUS, WORLD_RADIUS * 2, WORLD_RADIUS * 2);
    for (const it of this.items) {
      const k = it.f.k;
      if (k === 'sea' || k === 'field' || k === 'river' || k === 'lake' || k === 'cityBase' || k === 'mountain') drawFeature(c, it.f, s);
    }
    c.restore();
    return cv;
  }
}

function danubeY(x: number): number {
  for (let i = 0; i < DANUBE.length - 1; i++) {
    const [ax, ay] = DANUBE[i];
    const [bx, by] = DANUBE[i + 1];
    if (x >= ax && x <= bx) return ay + ((x - ax) / (bx - ax || 1)) * (by - ay);
  }
  return 99999;
}

function smoothPath(c: CanvasRenderingContext2D, pts: Pt[]): void {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    c.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  c.lineTo(l[0], l[1]);
}

function drawFeature(c: CanvasRenderingContext2D, f: Feature, scale: number): void {
  switch (f.k) {
    case 'blob':
      c.fillStyle = f.c;
      c.globalAlpha = 0.3;
      c.beginPath();
      c.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
      break;
    case 'sea': {
      c.beginPath();
      c.moveTo(coastX(-WORLD_HALF), -WORLD_HALF);
      for (let y = -WORLD_HALF; y <= WORLD_HALF; y += 40) c.lineTo(coastX(y), y);
      c.lineTo(WORLD_HALF + 10, WORLD_HALF);
      c.lineTo(WORLD_HALF + 10, -WORLD_HALF);
      c.closePath();
      c.strokeStyle = '#ead9a4';
      c.lineWidth = 90;
      c.stroke();
      c.fillStyle = '#2f6fa8';
      c.fill();
      if (scale < 0.5) break;
      c.strokeStyle = 'rgba(255,255,255,0.25)';
      c.lineWidth = 3;
      for (let y = -WORLD_HALF + 40; y < WORLD_HALF; y += 90) {
        for (let x = 2150; x < WORLD_HALF; x += 120) {
          const ox = x + ((y / 90) % 2) * 60;
          if (ox < coastX(y) + 60) continue;
          c.beginPath();
          c.arc(ox, y, 14, Math.PI * 1.1, Math.PI * 1.9);
          c.stroke();
        }
      }
      break;
    }
    case 'field': {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.rot);
      c.fillStyle = f.c;
      c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h);
      if (scale > 0.5) {
        c.strokeStyle = darken(f.c, 0.12);
        c.lineWidth = 3;
        c.beginPath();
        for (let x = -f.w / 2 + 10; x < f.w / 2; x += 16) {
          c.moveTo(x, -f.h / 2 + 4);
          c.lineTo(x, f.h / 2 - 4);
        }
        c.stroke();
        c.strokeStyle = 'rgba(70,50,20,0.25)';
        c.lineWidth = 2;
        c.strokeRect(-f.w / 2, -f.h / 2, f.w, f.h);
      }
      c.restore();
      break;
    }
    case 'lake':
      c.fillStyle = '#3f86c9';
      c.strokeStyle = '#e2d39c';
      c.lineWidth = 10;
      c.beginPath();
      c.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.fill();
      if (scale > 0.5) {
        c.fillStyle = 'rgba(255,255,255,0.2)';
        c.beginPath();
        c.ellipse(f.x - f.rx * 0.3, f.y - f.ry * 0.3, f.rx * 0.4, f.ry * 0.25, 0, 0, Math.PI * 2);
        c.fill();
        if (f.name) labelText(c, f.name, f.x, f.y + f.ry + 34, 20, '#fffaf0', 0.95);
      }
      break;
    case 'river':
      c.lineCap = 'round';
      c.lineJoin = 'round';
      smoothPath(c, f.pts);
      c.strokeStyle = '#d8c98f';
      c.lineWidth = f.w + 14;
      c.stroke();
      c.strokeStyle = '#3f86c9';
      c.lineWidth = f.w;
      c.stroke();
      if (scale > 0.5) {
        c.strokeStyle = 'rgba(255,255,255,0.28)';
        c.lineWidth = f.w * 0.18;
        c.setLineDash([30, 40]);
        c.stroke();
        c.setLineDash([]);
      }
      break;
    case 'road':
      c.lineCap = 'round';
      c.lineJoin = 'round';
      smoothPath(c, f.pts);
      c.strokeStyle = '#b29d6d';
      c.lineWidth = f.w + 5;
      c.stroke();
      c.strokeStyle = '#e1d2a6';
      c.lineWidth = f.w;
      c.stroke();
      break;
    case 'highway':
      c.lineCap = 'butt';
      smoothPath(c, f.pts);
      c.strokeStyle = '#3e4148';
      c.lineWidth = 40;
      c.stroke();
      c.strokeStyle = '#5d6168';
      c.lineWidth = 34;
      c.stroke();
      c.strokeStyle = '#f5f0e1';
      c.lineWidth = 3;
      c.setLineDash([22, 18]);
      c.stroke();
      c.setLineDash([]);
      c.lineCap = 'round';
      break;
    case 'cones':
      for (let i = -2; i <= 2; i++) {
        const x = f.x + (i % 2) * 8;
        const y = f.y + i * 12;
        c.fillStyle = '#ff7a1a';
        c.beginPath();
        c.moveTo(x, y - 9);
        c.lineTo(x + 7, y + 6);
        c.lineTo(x - 7, y + 6);
        c.closePath();
        c.fill();
        c.fillStyle = '#fff';
        c.fillRect(x - 4, y - 1, 8, 3);
      }
      break;
    case 'serpentine': {
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      const turns = 9;
      for (let t = 0; t <= turns * 20; t++) {
        const p = t / (turns * 20);
        const x = f.x + Math.sin(p * Math.PI * turns) * 70;
        const y = f.y - f.h / 2 + p * f.h;
        if (t === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = '#8c8577';
      c.lineWidth = 16;
      c.stroke();
      c.strokeStyle = '#d7cdb4';
      c.lineWidth = 11;
      c.stroke();
      break;
    }
    case 'mountain': {
      const { x, y, s, v } = f;
      if (scale < 0.5) {
        c.fillStyle = '#8b7d6b';
        c.beginPath();
        c.moveTo(x, y - s);
        c.lineTo(x + s * 0.8, y + s * 0.3);
        c.lineTo(x - s * 0.8, y + s * 0.3);
        c.closePath();
        c.fill();
        break;
      }
      c.fillStyle = 'rgba(20,40,20,0.25)';
      c.beginPath();
      c.ellipse(x + s * 0.15, y + s * 0.3, s * 0.85, s * 0.18, 0, 0, Math.PI * 2);
      c.fill();
      const base = v < 0.5 ? '#8d8371' : '#7f7a6c';
      const px = x + (v - 0.5) * s * 0.2;
      const top = y - s * 0.95;
      c.fillStyle = lighten(base, 0.12);
      c.beginPath();
      c.moveTo(px, top);
      c.lineTo(x - s * 0.8, y + s * 0.3);
      c.lineTo(x + s * 0.05, y + s * 0.3);
      c.closePath();
      c.fill();
      c.fillStyle = darken(base, 0.18);
      c.beginPath();
      c.moveTo(px, top);
      c.lineTo(x + s * 0.05, y + s * 0.3);
      c.lineTo(x + s * 0.82, y + s * 0.3);
      c.closePath();
      c.fill();
      // forested foot
      c.fillStyle = '#4b7d3c';
      c.beginPath();
      c.moveTo(x - s * 0.8, y + s * 0.3);
      c.lineTo(x - s * 0.5, y);
      c.lineTo(x - s * 0.2, y + s * 0.12);
      c.lineTo(x + s * 0.2, y - s * 0.02);
      c.lineTo(x + s * 0.55, y + s * 0.1);
      c.lineTo(x + s * 0.82, y + s * 0.3);
      c.closePath();
      c.fill();
      // snow cap
      c.fillStyle = '#f7f7f2';
      c.beginPath();
      c.moveTo(px, top);
      c.lineTo(px - s * 0.24, top + s * 0.36);
      c.lineTo(px - s * 0.08, top + s * 0.3);
      c.lineTo(px + s * 0.02, top + s * 0.4);
      c.lineTo(px + s * 0.12, top + s * 0.3);
      c.lineTo(px + s * 0.25, top + s * 0.36);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(40,30,20,0.35)';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(x - s * 0.8, y + s * 0.3);
      c.lineTo(px, top);
      c.lineTo(x + s * 0.82, y + s * 0.3);
      c.stroke();
      break;
    }
    case 'pine': {
      const { x, y, s } = f;
      c.fillStyle = 'rgba(20,40,20,0.25)';
      c.beginPath();
      c.ellipse(x + 3, y + s * 0.3, s * 0.8, s * 0.3, 0, 0, Math.PI * 2);
      c.fill();
      for (let k = 0; k < 3; k++) {
        const yy = y - k * s * 0.55;
        const ww = s * (1 - k * 0.25);
        c.fillStyle = k % 2 ? '#2f6e3a' : '#285f33';
        c.beginPath();
        c.moveTo(x, yy - s * 0.9);
        c.lineTo(x + ww, yy + s * 0.2);
        c.lineTo(x - ww, yy + s * 0.2);
        c.closePath();
        c.fill();
      }
      break;
    }
    case 'tree': {
      const { x, y, s } = f;
      c.fillStyle = 'rgba(20,40,20,0.25)';
      c.beginPath();
      c.arc(x + 4, y + 5, s, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = f.c;
      c.beginPath();
      c.arc(x, y, s, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = lighten(f.c, 0.2);
      c.beginPath();
      c.arc(x - s * 0.3, y - s * 0.3, s * 0.45, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'house': {
      const { x, y, w, h, roof } = f;
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x - w / 2 + 4, y - h / 2 + 5, w, h);
      c.fillStyle = roof;
      c.fillRect(x - w / 2, y - h / 2, w, h / 2);
      c.fillStyle = darken(roof, 0.2);
      c.fillRect(x - w / 2, y, w, h / 2);
      c.strokeStyle = darken(roof, 0.45);
      c.lineWidth = 1.5;
      c.strokeRect(x - w / 2, y - h / 2, w, h);
      break;
    }
    case 'cityBase': {
      const B = BUCHAREST;
      c.fillStyle = '#9b978d';
      c.beginPath();
      c.roundRect(B.x - 30, B.y - 30, B.w + 60, B.h + 60, 40);
      c.fill();
      c.strokeStyle = '#7a776f';
      c.lineWidth = 6;
      c.stroke();
      // ring road
      c.strokeStyle = '#e1d2a6';
      c.lineWidth = 14;
      c.beginPath();
      c.roundRect(B.x - 60, B.y - 60, B.w + 120, B.h + 120, 70);
      c.stroke();
      break;
    }
    case 'building':
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(f.x + 4, f.y + 5, f.w, f.h);
      c.fillStyle = f.c;
      c.fillRect(f.x, f.y, f.w, f.h);
      c.fillStyle = darken(f.c, 0.12);
      c.fillRect(f.x + f.w * 0.15, f.y + f.h * 0.15, f.w * 0.3, f.h * 0.25);
      c.strokeStyle = darken(f.c, 0.35);
      c.lineWidth = 1.5;
      c.strokeRect(f.x, f.y, f.w, f.h);
      break;
    case 'park':
      c.fillStyle = '#5fa04a';
      c.fillRect(f.x, f.y, f.w, f.h);
      break;
    case 'palace': {
      const { x, y } = f;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 108, y - 92, 226, 196);
      const tiers = ['#efe8d6', '#f5efe0', '#fbf7ec', '#ffffff'];
      tiers.forEach((col, i) => {
        const w = 220 - i * 48;
        const h = 190 - i * 42;
        c.fillStyle = col;
        c.fillRect(x - w / 2, y - h / 2, w, h);
        c.strokeStyle = '#b9ae94';
        c.lineWidth = 2;
        c.strokeRect(x - w / 2, y - h / 2, w, h);
        c.fillStyle = '#c9bea3';
        for (let k = 0; k < 8; k++) c.fillRect(x - w / 2 + 6 + k * ((w - 12) / 8), y + h / 2 - 8, 3, 6);
      });
      c.strokeStyle = '#5b5b5b';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - 50);
      c.stroke();
      flag(c, x, y - 50);
      break;
    }
    case 'arch': {
      const { x, y } = f;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 26, y - 22, 58, 50);
      c.fillStyle = '#efe8d6';
      c.fillRect(x - 30, y - 26, 60, 50);
      c.fillStyle = '#9b978d';
      c.fillRect(x - 10, y - 26, 20, 50);
      c.strokeStyle = '#b9ae94';
      c.strokeRect(x - 30, y - 26, 60, 50);
      break;
    }
    case 'castle': {
      const { x, y } = f;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 56, y - 36, 120, 90);
      c.fillStyle = '#e9e1cf';
      c.fillRect(x - 60, y - 40, 120, 86);
      c.strokeStyle = '#a99d84';
      c.lineWidth = 3;
      c.strokeRect(x - 60, y - 40, 120, 86);
      c.fillStyle = '#d6cdb7';
      c.fillRect(x - 30, y - 15, 60, 40);
      const towers: Pt[] = [[x - 60, y - 40], [x + 60, y - 40], [x - 60, y + 46], [x + 20, y - 60]];
      for (const [tx, ty] of towers) {
        c.fillStyle = '#efe8d6';
        c.beginPath();
        c.arc(tx, ty, 20, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#b8432f';
        c.beginPath();
        c.arc(tx, ty, 16, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#8c2f22';
        c.beginPath();
        c.moveTo(tx, ty);
        c.arc(tx, ty, 16, 0, Math.PI);
        c.fill();
      }
      flag(c, x + 20, y - 75);
      break;
    }
    case 'church': {
      const { x, y } = f;
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - 36, y - 46, 80, 100);
      c.fillStyle = '#5a3a22';
      c.fillRect(x - 40, y - 50, 80, 100);
      c.fillStyle = '#7a4f2e';
      c.fillRect(x - 40, y - 50, 40, 100);
      c.fillStyle = '#3e2716';
      c.beginPath();
      c.moveTo(x, y - 90);
      c.lineTo(x + 18, y - 40);
      c.lineTo(x - 18, y - 40);
      c.closePath();
      c.fill();
      c.strokeStyle = '#fcd116';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x, y - 100);
      c.lineTo(x, y - 86);
      c.moveTo(x - 5, y - 95);
      c.lineTo(x + 5, y - 95);
      c.stroke();
      break;
    }
    case 'umbrella':
      c.fillStyle = f.c;
      c.beginPath();
      c.arc(f.x, f.y, 10, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1;
      c.stroke();
      break;
    case 'billboard': {
      const { x, y, text, c: col } = f;
      c.font = 'bold 18px "Baloo 2", "Trebuchet MS", sans-serif';
      const w = Math.max(160, c.measureText(text).width + 30);
      c.fillStyle = '#5b4636';
      c.fillRect(x - w * 0.3, y + 10, 6, 30);
      c.fillRect(x + w * 0.3, y + 10, 6, 30);
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(x - w / 2 + 5, y - 36, w, 52);
      c.fillStyle = '#fffaf0';
      c.fillRect(x - w / 2, y - 40, w, 52);
      c.fillStyle = col;
      c.fillRect(x - w / 2, y - 40, w, 8);
      c.fillStyle = '#002b7f';
      c.fillRect(x - w / 2, y + 6, w / 3, 6);
      c.fillStyle = '#fcd116';
      c.fillRect(x - w / 6, y + 6, w / 3, 6);
      c.fillStyle = '#ce1126';
      c.fillRect(x + w / 6, y + 6, w / 3, 6);
      c.fillStyle = col;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, x, y - 12);
      break;
    }
    case 'bunting': {
      const [ax, ay] = f.a;
      const [bx, by] = f.b;
      const sag = 26;
      c.strokeStyle = '#3b3b3b';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(ax, ay);
      c.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + sag * 2, bx, by);
      c.stroke();
      const n = Math.floor(Math.hypot(bx - ax, by - ay) / 18);
      const cols = ['#002b7f', '#fcd116', '#ce1126'];
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * ((ax + bx) / 2) + t * t * bx;
        const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * ((ay + by) / 2 + sag * 2) + t * t * by;
        c.fillStyle = cols[i % 3];
        c.beginPath();
        c.moveTo(x - 6, y);
        c.lineTo(x + 6, y);
        c.lineTo(x, y + 12);
        c.closePath();
        c.fill();
      }
      break;
    }
    case 'label':
      labelText(c, f.text, f.x, f.y, f.size, f.color, f.alpha);
      break;
  }
}

function labelText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, alpha: number): void {
  c.save();
  c.globalAlpha = alpha;
  c.font = `700 ${size}px "Baloo 2", "Trebuchet MS", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (color !== '#0e2440') {
    c.lineWidth = Math.max(3, size * 0.16);
    c.strokeStyle = 'rgba(14,36,64,0.85)';
    c.lineJoin = 'round';
    c.strokeText(text, x, y);
  }
  c.fillStyle = color;
  c.fillText(text, x, y);
  c.restore();
}

function flag(c: CanvasRenderingContext2D, x: number, y: number): void {
  const cols = ['#002b7f', '#fcd116', '#ce1126'];
  cols.forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(x + i * 8, y - 14, 8, 14);
  });
}
