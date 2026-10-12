/** Colors are packed as 0xAABBGGRR so they can be written straight into an ImageData Uint32 view (little-endian). */
export type Color = number;

export const TRANSPARENT: Color = 0;

export function rgba(r: number, g: number, b: number, a = 255): Color {
  return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

export function hex(h: string, a = 255): Color {
  const v = parseInt(h.replace('#', ''), 16);
  return rgba((v >> 16) & 255, (v >> 8) & 255, v & 255, a);
}

export function channels(c: Color): [number, number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, (c >>> 24) & 255];
}

export function alpha(c: Color): number {
  return (c >>> 24) & 255;
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Multiply brightness; f < 1 darkens, f > 1 lightens. Slight hue shift keeps shadows warm/cool like hand-made pixel art. */
export function shade(c: Color, f: number): Color {
  const [r, g, b, a] = channels(c);
  if (f < 1) {
    // shadows drift toward purple
    return rgba(clamp(r * f), clamp(g * f * 0.96), clamp(b * f + (1 - f) * 28), a);
  }
  // highlights drift toward warm yellow
  const k = f - 1;
  return rgba(clamp(r + (255 - r) * k), clamp(g + (255 - g) * k * 0.95), clamp(b + (255 - b) * k * 0.75), a);
}

export function mix(c1: Color, c2: Color, t: number): Color {
  const a = channels(c1);
  const b = channels(c2);
  return rgba(
    clamp(a[0] + (b[0] - a[0]) * t),
    clamp(a[1] + (b[1] - a[1]) * t),
    clamp(a[2] + (b[2] - a[2]) * t),
    clamp(a[3] + (b[3] - a[3]) * t),
  );
}

export function toCss(c: Color): string {
  const [r, g, b] = channels(c);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function toNumber(c: Color): number {
  const [r, g, b] = channels(c);
  return (r << 16) | (g << 8) | b;
}

export function hsl(h: number, s: number, l: number): Color {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgba((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
