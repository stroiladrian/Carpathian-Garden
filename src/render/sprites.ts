import type { FoodKind } from '../game/food';
import { darken, lighten, rgba } from './color';
import { drawStar } from './heads';

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const S = 96; // food sprite resolution; content radius ~ S*0.36 so glow fits

/** Pre-rendered bitmaps for everything drawn many times per frame. */
export class Sprites {
  readonly food: Record<Exclude<FoodKind, 'spill'>, HTMLCanvasElement>;
  private segCache = new Map<string, HTMLCanvasElement>();
  private glowCache = new Map<string, HTMLCanvasElement>();
  private spillCache = new Map<string, HTMLCanvasElement>();
  readonly shadow: HTMLCanvasElement;

  constructor() {
    this.food = {
      coin: this.make(drawInfluence),
      note: this.make(drawNote),
      gold: this.make(drawGold),
      contract: this.make(drawContract),
      briefcase: this.make(drawBriefcase),
      pledge: this.make(drawPledge),
      envelope: this.make(drawEnvelope),
      tender: this.make(drawTender),
    };
    this.shadow = makeCanvas(64, 64);
    const c = this.shadow.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(10,20,30,0.45)');
    g.addColorStop(1, 'rgba(10,20,30,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }

  private make(fn: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const cv = makeCanvas(S, S);
    const c = cv.getContext('2d')!;
    c.translate(S / 2, S / 2);
    c.scale(S / 100, S / 100); // draw in a 100x100 box centred at 0,0
    fn(c);
    return cv;
  }

  segment(color: string): HTMLCanvasElement {
    let cv = this.segCache.get(color);
    if (cv) return cv;
    cv = makeCanvas(64, 64);
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(24, 22, 3, 32, 32, 31);
    g.addColorStop(0, lighten(color, 0.4));
    g.addColorStop(0.55, color);
    g.addColorStop(1, darken(color, 0.38));
    c.fillStyle = g;
    c.beginPath();
    c.arc(32, 32, 30.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = darken(color, 0.5);
    c.lineWidth = 1.5;
    c.stroke();
    this.segCache.set(color, cv);
    return cv;
  }

  glow(color: string): HTMLCanvasElement {
    let cv = this.glowCache.get(color);
    if (cv) return cv;
    cv = makeCanvas(64, 64);
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(color, 0.7));
    g.addColorStop(0.5, rgba(color, 0.25));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    this.glowCache.set(color, cv);
    return cv;
  }

  spill(color: string): HTMLCanvasElement {
    let cv = this.spillCache.get(color);
    if (cv) return cv;
    cv = this.make((c) => {
      const glow = c.createRadialGradient(0, 0, 10, 0, 0, 50);
      glow.addColorStop(0, rgba(color, 0.55));
      glow.addColorStop(1, rgba(color, 0));
      c.fillStyle = glow;
      c.fillRect(-50, -50, 100, 100);
      const g = c.createRadialGradient(-8, -10, 2, 0, 0, 26);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, lighten(color, 0.35));
      g.addColorStop(1, darken(color, 0.15));
      c.fillStyle = g;
      c.beginPath();
      c.arc(0, 0, 25, 0, Math.PI * 2);
      c.fill();
    });
    this.spillCache.set(color, cv);
    return cv;
  }
}

function glowBg(c: CanvasRenderingContext2D, color: string, a = 0.45): void {
  const g = c.createRadialGradient(0, 0, 10, 0, 0, 50);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.fillRect(-50, -50, 100, 100);
}

function drawInfluence(c: CanvasRenderingContext2D): void {
  glowBg(c, '#b07cff', 0.6);
  const g = c.createRadialGradient(-8, -10, 2, 0, 0, 27);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#d8b8ff');
  g.addColorStop(1, '#6a2fc4');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 26, 0, Math.PI * 2);
  c.fill();
  drawStar(c, 0, 1, 12, 'rgba(255,255,255,0.9)');
}

function drawGold(c: CanvasRenderingContext2D): void {
  glowBg(c, '#ffd23f', 0.6);
  c.fillStyle = '#b8860b';
  c.beginPath();
  c.arc(2, 3, 30, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(-10, -12, 3, 0, 0, 32);
  g.addColorStop(0, '#fff6c2');
  g.addColorStop(0.45, '#ffd23f');
  g.addColorStop(1, '#c48b0c');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 30, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#9a6a06';
  c.lineWidth = 3;
  c.beginPath();
  c.arc(0, 0, 22, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = '#9a6a06';
  c.font = 'bold 30px Georgia, serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('L', 0, 2);
}

function drawNote(c: CanvasRenderingContext2D): void {
  glowBg(c, '#7fe0b0', 0.45);
  c.rotate(-0.18);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(-36, -18, 76, 42);
  const g = c.createLinearGradient(-38, 0, 38, 0);
  g.addColorStop(0, '#5fb8d6');
  g.addColorStop(1, '#4fae7e');
  c.fillStyle = g;
  c.fillRect(-38, -21, 76, 42);
  c.strokeStyle = '#e8fff2';
  c.lineWidth = 2.5;
  c.strokeRect(-33, -16, 66, 32);
  c.fillStyle = '#e8fff2';
  c.beginPath();
  c.arc(-14, 0, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1d4d3a';
  c.font = 'bold 15px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('100', 14, -4);
  c.font = 'bold 9px sans-serif';
  c.fillText('LEI', 14, 9);
}

function drawContract(c: CanvasRenderingContext2D): void {
  glowBg(c, '#fff3c4', 0.5);
  c.rotate(0.12);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(-25, -31, 54, 68);
  c.fillStyle = '#fffaf0';
  c.beginPath();
  c.moveTo(-28, -35);
  c.lineTo(16, -35);
  c.lineTo(28, -23);
  c.lineTo(28, 35);
  c.lineTo(-28, 35);
  c.closePath();
  c.fill();
  c.strokeStyle = '#c9b78f';
  c.lineWidth = 2;
  c.stroke();
  c.fillStyle = '#e8dcc0';
  c.beginPath();
  c.moveTo(16, -35);
  c.lineTo(16, -23);
  c.lineTo(28, -23);
  c.closePath();
  c.fill();
  c.fillStyle = '#1f2f5c';
  c.font = 'bold 9px sans-serif';
  c.textAlign = 'center';
  c.fillText('CONTRACT', -2, -20);
  c.strokeStyle = '#9aa3b5';
  c.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-20, -8 + i * 8);
    c.lineTo(i === 3 ? 0 : 20, -8 + i * 8);
    c.stroke();
  }
  c.fillStyle = '#c0392b';
  c.beginPath();
  c.arc(14, 24, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#e74c3c';
  c.beginPath();
  c.arc(12, 22, 4, 0, Math.PI * 2);
  c.fill();
}

function drawBriefcase(c: CanvasRenderingContext2D): void {
  glowBg(c, '#ffd84d', 0.55);
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(-34, -14, 72, 46);
  c.strokeStyle = '#2b1a10';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(-12, -28, 24, 18, 6);
  c.stroke();
  const g = c.createLinearGradient(0, -18, 0, 30);
  g.addColorStop(0, '#7a4a2a');
  g.addColorStop(1, '#4a2c18');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(-36, -18, 72, 48, 7);
  c.fill();
  c.strokeStyle = '#2b1a10';
  c.lineWidth = 2.5;
  c.stroke();
  c.beginPath();
  c.moveTo(-36, -2);
  c.lineTo(36, -2);
  c.stroke();
  c.fillStyle = '#ffd23f';
  c.fillRect(-24, -6, 10, 9);
  c.fillRect(14, -6, 10, 9);
  // a cheeky banknote poking out
  c.fillStyle = '#4fae7e';
  c.fillRect(20, -24, 18, 10);
}

function drawPledge(c: CanvasRenderingContext2D): void {
  glowBg(c, '#7cc4ff', 0.6);
  c.fillStyle = '#173a6b';
  c.beginPath();
  c.moveTo(-12, 12);
  c.lineTo(-20, 40);
  c.lineTo(-8, 34);
  c.lineTo(-2, 44);
  c.lineTo(2, 14);
  c.fill();
  c.beginPath();
  c.moveTo(12, 12);
  c.lineTo(20, 40);
  c.lineTo(8, 34);
  c.lineTo(2, 44);
  c.lineTo(-2, 14);
  c.fill();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    c.fillStyle = i % 2 ? '#2a6fdb' : '#5aa9ff';
    c.beginPath();
    c.arc(Math.cos(a) * 22, Math.sin(a) * 22, 9, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#eaf4ff';
  c.beginPath();
  c.arc(0, 0, 20, 0, Math.PI * 2);
  c.fill();
  drawStar(c, 0, 1, 15, '#2a6fdb');
}

/** Briefcase opening animation frame (used by the 'case' particle). */
export function drawOpenCase(c: CanvasRenderingContext2D, x: number, y: number, s: number, open: number): void {
  c.save();
  c.translate(x, y);
  c.scale(s / 40, s / 40);
  c.fillStyle = '#4a2c18';
  c.fillRect(-30, -4, 60, 26);
  c.fillStyle = '#4fae7e';
  c.fillRect(-26, -8, 52, 10);
  c.save();
  c.translate(0, -4);
  c.rotate(-open * 1.2);
  c.fillStyle = '#7a4a2a';
  c.fillRect(-30, -22 * (1 - open * 0.4), 60, 22 * (1 - open * 0.4));
  c.restore();
  c.restore();
}

function drawEnvelope(c: CanvasRenderingContext2D): void {
  glowBg(c, '#ff9a6b', 0.5);
  c.rotate(-0.12);
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(-31, -18, 66, 44);
  // banknotes poking out
  c.fillStyle = '#4fae7e';
  c.fillRect(-20, -30, 34, 18);
  c.fillStyle = '#5fb8d6';
  c.fillRect(-8, -34, 30, 18);
  c.fillStyle = '#f7f1e3';
  c.fillRect(-34, -20, 68, 42);
  c.strokeStyle = '#c9b78f';
  c.lineWidth = 2;
  c.strokeRect(-34, -20, 68, 42);
  c.beginPath();
  c.moveTo(-34, -20);
  c.lineTo(0, 6);
  c.lineTo(34, -20);
  c.stroke();
  c.fillStyle = '#c0392b';
  c.beginPath();
  c.arc(0, 4, 9, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff3e0';
  c.font = 'bold 11px sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('Ș', 0, 5);
}

function drawTender(c: CanvasRenderingContext2D): void {
  glowBg(c, '#ffd84d', 0.85);
  // golden scroll with tricolour ribbon
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fillRect(-26, -30, 58, 66);
  const g = c.createLinearGradient(-28, 0, 28, 0);
  g.addColorStop(0, '#f6d365');
  g.addColorStop(0.5, '#fff3c4');
  g.addColorStop(1, '#e0a92a');
  c.fillStyle = g;
  c.fillRect(-28, -32, 56, 64);
  c.fillStyle = '#d4a017';
  c.beginPath();
  c.ellipse(0, -32, 30, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(0, 32, 30, 6, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#8a5a00';
  c.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    c.moveTo(-18, -14 + i * 9);
    c.lineTo(18, -14 + i * 9);
    c.stroke();
  }
  ['#002b7f', '#fcd116', '#ce1126'].forEach((col, i) => {
    c.fillStyle = col;
    c.fillRect(-30 + i * 20, 18, 20, 7);
  });
  c.fillStyle = '#8a5a00';
  c.font = 'bold 10px sans-serif';
  c.textAlign = 'center';
  c.fillText('CONTRACT', 0, -20);
  c.fillText('SPECIAL', 0, 13);
}
