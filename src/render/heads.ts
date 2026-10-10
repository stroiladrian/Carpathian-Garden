import type { Archetype } from '../game/characters';
import { darken, lighten } from './color';

export type Expr = 'normal' | 'boost' | 'eat' | 'power' | 'dizzy' | 'dead';

type Ctx = CanvasRenderingContext2D;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

const INK = '#1a1622';

/**
 * Draws an original cartoon caricature head for an archetype.
 * The face always stays upright (with a slight tilt) so it reads clearly,
 * while the pupils look toward the direction of travel.
 */
export function drawHead(
  ctx: Ctx,
  a: Archetype,
  x: number,
  y: number,
  R: number,
  look: number,
  expr: Expr,
  t: number,
  tilt = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(R, R);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const id = a.id;
  const skin = a.skin;
  const skinShade = darken(skin, 0.22);
  const faceRx = id === 'reformer' ? 0.72 : id === 'baron' ? 0.84 : 0.78;
  const faceRy = id === 'reformer' ? 0.92 : 0.88;

  // ── shoulders / jacket
  ctx.fillStyle = a.jacket;
  ellipse(ctx, 0, 1.0, 0.98, 0.42);
  ctx.fill();
  ctx.strokeStyle = darken(a.jacket, 0.35);
  ctx.lineWidth = 0.05;
  ctx.stroke();
  ctx.fillStyle = a.shirt;
  ctx.beginPath();
  ctx.moveTo(-0.3, 0.66);
  ctx.lineTo(0.3, 0.66);
  ctx.lineTo(0, 1.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = a.tie;
  ctx.beginPath();
  ctx.moveTo(-0.08, 0.72);
  ctx.lineTo(0.08, 0.72);
  ctx.lineTo(0.13, 1.08);
  ctx.lineTo(0, 1.24);
  ctx.lineTo(-0.13, 1.08);
  ctx.closePath();
  ctx.fill();
  if (id === 'tycoon') {
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 0.07;
    ctx.setLineDash([0.06, 0.05]);
    ctx.beginPath();
    ctx.arc(0, 0.55, 0.42, 0.35, Math.PI - 0.35);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd84d';
    ellipse(ctx, 0, 0.98, 0.1, 0.1);
    ctx.fill();
  }
  if (id === 'baron') {
    // tricolour rosette on the lapel
    const cols = ['#002b7f', '#fcd116', '#ce1126'];
    cols.forEach((c, i) => {
      ctx.fillStyle = c;
      ellipse(ctx, -0.55, 0.92, 0.15 - i * 0.045, 0.15 - i * 0.045);
      ctx.fill();
    });
  }

  // ── ears
  ctx.fillStyle = skin;
  ctx.strokeStyle = skinShade;
  ctx.lineWidth = 0.05;
  for (const s of [-1, 1]) {
    ellipse(ctx, s * faceRx * 0.98, 0.02, 0.14, 0.19);
    ctx.fill();
    ctx.stroke();
  }

  // ── face
  const g = ctx.createRadialGradient(-0.25, -0.35, 0.1, 0, 0, 1.1);
  g.addColorStop(0, lighten(skin, 0.18));
  g.addColorStop(1, darken(skin, 0.08));
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0, faceRx, faceRy);
  ctx.fill();
  ctx.strokeStyle = skinShade;
  ctx.lineWidth = 0.06;
  ctx.stroke();
  if (id === 'baron') {
    ctx.strokeStyle = skinShade;
    ctx.lineWidth = 0.04;
    ctx.beginPath();
    ctx.arc(0, 0.62, 0.3, 0.4, Math.PI - 0.4);
    ctx.stroke();
  }

  // ── hair
  drawHair(ctx, a, faceRx);

  // ── cheeks
  if (id === 'firebrand' || expr === 'boost' || expr === 'power') {
    ctx.fillStyle = 'rgba(230,60,60,0.35)';
    ellipse(ctx, -0.48, 0.25, 0.16, 0.1);
    ctx.fill();
    ellipse(ctx, 0.48, 0.25, 0.16, 0.1);
    ctx.fill();
  }

  // ── eyes
  const lx = Math.cos(look) * 0.07;
  const ly = Math.sin(look) * 0.06;
  if (id === 'tycoon') {
    drawSunglasses(ctx, expr, t);
  } else {
    drawEyes(ctx, a, expr, lx, ly, t);
  }

  // ── nose
  ctx.fillStyle = darken(skin, 0.12);
  ellipse(ctx, 0, 0.16, id === 'baron' ? 0.13 : 0.1, id === 'firebrand' ? 0.12 : 0.09);
  ctx.fill();
  ctx.fillStyle = lighten(skin, 0.3);
  ellipse(ctx, -0.03, 0.12, 0.03, 0.025);
  ctx.fill();

  if (id === 'baron') {
    ctx.fillStyle = a.hair;
    ctx.strokeStyle = darken(a.hair, 0.3);
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(0, 0.28);
    ctx.bezierCurveTo(-0.2, 0.2, -0.42, 0.28, -0.4, 0.42);
    ctx.bezierCurveTo(-0.25, 0.36, -0.1, 0.38, 0, 0.34);
    ctx.bezierCurveTo(0.1, 0.38, 0.25, 0.36, 0.4, 0.42);
    ctx.bezierCurveTo(0.42, 0.28, 0.2, 0.2, 0, 0.28);
    ctx.fill();
    ctx.stroke();
  }

  drawMouth(ctx, a, expr, t);

  // ── accents
  if (expr === 'boost') {
    ctx.fillStyle = '#9fd8ff';
    ctx.beginPath();
    ctx.moveTo(0.62, -0.62);
    ctx.quadraticCurveTo(0.74, -0.42, 0.66, -0.36);
    ctx.quadraticCurveTo(0.56, -0.38, 0.62, -0.62);
    ctx.fill();
  }
  if (expr === 'dizzy') {
    for (let i = 0; i < 3; i++) {
      const ang = t * 4 + (i * Math.PI * 2) / 3;
      drawStar(ctx, Math.cos(ang) * 0.75, -1.05 + Math.sin(ang) * 0.2, 0.14, '#ffe14d');
    }
  }
  ctx.restore();
}

function drawHair(ctx: Ctx, a: Archetype, rx: number): void {
  const hair = a.hair;
  ctx.fillStyle = hair;
  ctx.strokeStyle = darken(hair, 0.3);
  ctx.lineWidth = 0.04;
  switch (a.id) {
    case 'firebrand': {
      // tall, swept-back mane
      ctx.beginPath();
      ctx.moveTo(-rx - 0.04, 0.0);
      ctx.bezierCurveTo(-rx - 0.15, -0.7, -0.5, -1.25, 0.05, -1.22);
      ctx.bezierCurveTo(0.6, -1.2, rx + 0.18, -0.75, rx + 0.04, 0.0);
      ctx.bezierCurveTo(rx - 0.05, -0.35, 0.55, -0.55, 0.3, -0.6);
      ctx.bezierCurveTo(0.0, -0.66, -0.4, -0.62, -0.62, -0.45);
      ctx.bezierCurveTo(-0.7, -0.35, -0.72, -0.2, -rx - 0.04, 0.0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.3, -1.05);
      ctx.quadraticCurveTo(0.15, -1.15, 0.45, -0.95);
      ctx.stroke();
      break;
    }
    case 'tycoon': {
      ctx.beginPath();
      ctx.moveTo(-rx, -0.1);
      ctx.bezierCurveTo(-rx - 0.05, -0.75, -0.35, -1.02, 0.05, -1.0);
      ctx.bezierCurveTo(0.5, -0.98, rx + 0.05, -0.7, rx, -0.1);
      ctx.bezierCurveTo(rx - 0.1, -0.4, 0.4, -0.55, 0.05, -0.56);
      ctx.bezierCurveTo(-0.35, -0.55, -rx + 0.1, -0.42, -rx, -0.1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.35, -0.86);
      ctx.quadraticCurveTo(0.05, -0.95, 0.4, -0.82);
      ctx.stroke();
      break;
    }
    case 'baron': {
      // bald dome with grey side tufts and a heroic comb-over
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(s * (rx - 0.05), -0.32, 0.18, 0.3, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.strokeStyle = hair;
      ctx.lineWidth = 0.05;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-0.62, -0.5 - i * 0.07);
        ctx.quadraticCurveTo(0, -0.95 - i * 0.02, 0.6, -0.55 - i * 0.06);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ellipse(ctx, -0.2, -0.62, 0.14, 0.07, -0.3);
      ctx.fill();
      break;
    }
    case 'reformer': {
      ctx.beginPath();
      ctx.moveTo(-rx - 0.02, -0.05);
      ctx.bezierCurveTo(-rx - 0.06, -0.8, -0.3, -1.05, 0.05, -1.02);
      ctx.bezierCurveTo(0.5, -1.0, rx + 0.06, -0.7, rx + 0.02, -0.05);
      ctx.bezierCurveTo(rx - 0.04, -0.4, 0.45, -0.62, 0.0, -0.62);
      ctx.lineTo(-0.28, -0.7);
      ctx.bezierCurveTo(-0.5, -0.55, -rx + 0.08, -0.4, -rx - 0.02, -0.05);
      ctx.fill();
      ctx.strokeStyle = darken(hair, 0.4);
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(-0.28, -0.7);
      ctx.quadraticCurveTo(-0.22, -0.9, -0.12, -1.0);
      ctx.stroke();
      break;
    }
  }
}

function drawEyes(ctx: Ctx, a: Archetype, expr: Expr, lx: number, ly: number, t: number): void {
  const ey = -0.12;
  const ex = 0.3;
  const blink = expr === 'normal' && t % 4 > 3.86;
  for (const s of [-1, 1]) {
    const x = s * ex;
    if (expr === 'dead') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(x - 0.11, ey - 0.11);
      ctx.lineTo(x + 0.11, ey + 0.11);
      ctx.moveTo(x + 0.11, ey - 0.11);
      ctx.lineTo(x - 0.11, ey + 0.11);
      ctx.stroke();
      continue;
    }
    if (expr === 'dizzy') {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.04;
      ctx.beginPath();
      for (let k = 0; k < 18; k++) {
        const ang = k * 0.7 + t * 6 * s;
        const rr = 0.01 + k * 0.008;
        const px = x + Math.cos(ang) * rr;
        const py = ey + Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      continue;
    }
    const wink = expr === 'power' && a.id === 'baron' && s === 1;
    if (blink || wink) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(x, ey - 0.02, 0.12, 0.2, Math.PI - 0.2);
      ctx.stroke();
      continue;
    }
    const ry = expr === 'boost' ? 0.12 : 0.17;
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, x, ey, 0.16, ry);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.03;
    ctx.stroke();
    ctx.fillStyle = a.id === 'reformer' ? '#3d6fb0' : a.id === 'baron' ? '#5b4636' : INK;
    ellipse(ctx, x + lx, ey + ly * (expr === 'boost' ? 0.4 : 1), 0.085, 0.09);
    ctx.fill();
    ctx.fillStyle = INK;
    ellipse(ctx, x + lx, ey + ly * (expr === 'boost' ? 0.4 : 1), 0.045, 0.05);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, x + lx - 0.03, ey + ly - 0.04, 0.025, 0.025);
    ctx.fill();
  }

  // brows
  ctx.strokeStyle = a.id === 'baron' ? '#d6d6dc' : darken(a.hair, 0.1);
  ctx.lineWidth = a.id === 'firebrand' ? 0.11 : a.id === 'baron' ? 0.1 : 0.06;
  const angry = a.id === 'firebrand' || expr === 'boost' || (expr === 'power' && a.id !== 'baron');
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (angry) {
      ctx.moveTo(s * 0.48, -0.42);
      ctx.lineTo(s * 0.13, -0.3 + (expr === 'power' ? 0.04 : 0));
    } else if (a.id === 'reformer') {
      ctx.moveTo(s * 0.45, -0.36);
      ctx.quadraticCurveTo(s * 0.3, -0.48, s * 0.15, -0.4);
    } else {
      ctx.moveTo(s * 0.46, -0.35);
      ctx.quadraticCurveTo(s * 0.3, -0.42, s * 0.14, -0.36);
    }
    ctx.stroke();
  }

  if (a.id === 'reformer' && expr !== 'dead') {
    ctx.strokeStyle = '#2a2a33';
    ctx.lineWidth = 0.045;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(s * 0.3 - 0.21, ey - 0.16, 0.42, 0.3, 0.07);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-0.09, ey - 0.04);
    ctx.lineTo(0.09, ey - 0.04);
    ctx.stroke();
    if (expr === 'power') {
      drawStar(ctx, 0.48, ey - 0.12, 0.08, '#ffffff');
    }
  }
}

function drawSunglasses(ctx: Ctx, expr: Expr, t: number): void {
  const askew = expr === 'dead' ? 0.25 : expr === 'dizzy' ? Math.sin(t * 8) * 0.15 : 0;
  ctx.save();
  ctx.rotate(askew);
  ctx.fillStyle = '#121214';
  ctx.strokeStyle = '#d4a017';
  ctx.lineWidth = 0.04;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(s * 0.33 - 0.27, -0.3, 0.54, 0.34, 0.12);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-0.07, -0.2);
  ctx.quadraticCurveTo(0, -0.26, 0.07, -0.2);
  ctx.stroke();
  // glint
  const glint = expr === 'power' ? 0.9 : 0.45;
  ctx.strokeStyle = `rgba(255,255,255,${glint})`;
  ctx.lineWidth = 0.05;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.33 - 0.16, -0.2);
    ctx.lineTo(s * 0.33 - 0.04, -0.27);
    ctx.stroke();
  }
  if (expr === 'dead') {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.05;
    for (const s of [-1, 1]) {
      const x = s * 0.33;
      ctx.beginPath();
      ctx.moveTo(x - 0.08, -0.21);
      ctx.lineTo(x + 0.08, -0.05);
      ctx.moveTo(x + 0.08, -0.21);
      ctx.lineTo(x - 0.08, -0.05);
      ctx.stroke();
    }
  }
  if (expr === 'power') {
    ctx.fillStyle = '#ffd84d';
    ctx.font = 'bold 0.24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', -0.33, -0.13);
    ctx.fillText('$', 0.33, -0.13);
  }
  ctx.restore();
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 0.06;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -0.43);
    ctx.lineTo(s * 0.18, -0.4);
    ctx.stroke();
  }
}

function drawMouth(ctx: Ctx, a: Archetype, expr: Expr, t: number): void {
  const id = a.id;
  const my = 0.45;
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = INK;

  const openMouth = (w: number, h: number, tongue = true) => {
    ctx.fillStyle = '#5a1620';
    ellipse(ctx, 0, my, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, my - h * 0.6, w * 0.75, h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    if (tongue) {
      ctx.fillStyle = '#e05a6a';
      ellipse(ctx, 0, my + h * 0.45, w * 0.55, h * 0.35);
      ctx.fill();
    }
  };

  if (expr === 'dead') {
    openMouth(0.12, 0.1);
    ctx.fillStyle = '#e05a6a';
    ellipse(ctx, 0.05, my + 0.14, 0.07, 0.1);
    ctx.fill();
    return;
  }
  if (expr === 'eat') {
    openMouth(0.2, 0.17);
    return;
  }
  if (expr === 'dizzy') {
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = -0.25 + i * 0.05;
      const y = my + Math.sin(i * 1.5 + t * 6) * 0.04;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }
  if (expr === 'boost') {
    // gritted teeth
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(-0.27, my - 0.08, 0.54, 0.16, 0.06);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.moveTo(-0.27, my);
    ctx.lineTo(0.27, my);
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 0.09, my - 0.08);
      ctx.lineTo(i * 0.09, my + 0.08);
    }
    ctx.stroke();
    return;
  }

  switch (id) {
    case 'firebrand':
      if (expr === 'power') {
        openMouth(0.3, 0.24);
      } else {
        // permanent rant: half-open shouting mouth
        openMouth(0.22, 0.11 + Math.abs(Math.sin(t * 5)) * 0.04, false);
      }
      break;
    case 'tycoon': {
      const w = expr === 'power' ? 0.36 : 0.3;
      ctx.fillStyle = '#5a1620';
      ctx.beginPath();
      ctx.moveTo(-w, my - 0.06);
      ctx.quadraticCurveTo(0, my + 0.32, w, my - 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-w + 0.04, my - 0.04);
      ctx.lineTo(w - 0.04, my - 0.04);
      ctx.lineTo(w - 0.1, my + 0.05);
      ctx.lineTo(-w + 0.1, my + 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f2c230';
      ctx.fillRect(0.04, my - 0.04, 0.08, 0.09);
      break;
    }
    case 'baron':
      ctx.beginPath();
      ctx.moveTo(-0.2, my + 0.03);
      ctx.quadraticCurveTo(0.05, my + 0.12, 0.26, my - 0.06);
      ctx.stroke();
      break;
    case 'reformer':
      if (expr === 'power') {
        ctx.beginPath();
        ctx.moveTo(-0.18, my);
        ctx.lineTo(0.18, my);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, my - 0.1, 0.18, 0.5, Math.PI - 0.5);
        ctx.stroke();
      }
      break;
  }
}

export function drawStar(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(ang) * rr;
    const py = y + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** Renders a standalone portrait (menu cards, game-over screen). */
export function renderPortrait(canvas: HTMLCanvasElement, a: Archetype, expr: Expr, t: number, bg = true): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (bg) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, lighten(a.colors.a, 0.35));
    g.addColorStop(1, darken(a.colors.a, 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  drawHead(ctx, a, w / 2, h * 0.47, w * 0.33, Math.PI / 2, expr, t, Math.sin(t * 1.5) * 0.05);
}
