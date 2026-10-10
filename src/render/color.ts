function parse(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Mix colour a toward b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export const lighten = (c: string, t: number): string => mix(c, '#ffffff', t);
export const darken = (c: string, t: number): string => mix(c, '#000000', t);

export function rgba(c: string, a: number): string {
  const [r, g, b] = parse(c);
  return `rgba(${r},${g},${b},${a})`;
}
