import { alpha, Color, shade, TRANSPARENT } from './color';

/**
 * A tiny software canvas for drawing pixel art in code.
 * Everything in the game is drawn through this, then uploaded as Phaser textures.
 */
export class PixelCanvas {
  readonly data: Uint32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): Color {
    x = Math.floor(x);
    y = Math.floor(y);
    return this.inBounds(x, y) ? this.data[y * this.w + x] : TRANSPARENT;
  }

  set(x: number, y: number, c: Color): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return;
    if (alpha(c) === 255 || alpha(c) === 0) {
      this.data[y * this.w + x] = c;
      return;
    }
    // simple alpha blend over existing pixel
    const dst = this.data[y * this.w + x];
    if (alpha(dst) === 0) {
      this.data[y * this.w + x] = c;
      return;
    }
    const a = alpha(c) / 255;
    const blend = (shift: number) =>
      Math.round(((c >>> shift) & 255) * a + ((dst >>> shift) & 255) * (1 - a)) & 255;
    this.data[y * this.w + x] = (255 << 24) | (blend(16) << 16) | (blend(8) << 8) | blend(0);
  }

  /** Only paint where something is already drawn (useful for patterns/shading clipped to a shape). */
  setOver(x: number, y: number, c: Color): void {
    if (alpha(this.get(x, y)) > 0) this.set(x, y, c);
  }

  isSolid(x: number, y: number): boolean {
    return alpha(this.get(x, y)) > 0;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  rectOver(x: number, y: number, w: number, h: number, c: Color): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setOver(x + i, y + j, c);
  }

  hline(x0: number, x1: number, y: number, c: Color): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: Color): void {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Filled ellipse; centre may be fractional so even-sized shapes look symmetric. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color | ((nx: number, ny: number) => Color)): void {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'function' ? c(nx, ny) : c);
      }
    }
  }

  /**
   * Ellipse with built-in three-tone shading: light from the top-left, shadow bottom-right.
   * This is the workhorse for round, soft cartoon shapes (canopies, bodies, heads).
   */
  shadedEllipse(cx: number, cy: number, rx: number, ry: number, base: Color, lightAmt = 1.18, darkAmt = 0.78): void {
    const light = shade(base, lightAmt);
    const dark = shade(base, darkAmt);
    this.ellipse(cx, cy, rx, ry, (nx, ny) => {
      const d = nx * 0.55 + ny * 0.85;
      if (d > 0.45) return dark;
      if (d < -0.55 && nx * nx + ny * ny > 0.12) return light;
      return base;
    });
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, c: Color): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const cx = i < r ? r - i - 0.5 : i >= w - r ? i - (w - r) + 0.5 : 0;
        const cy = j < r ? r - j - 0.5 : j >= h - r ? j - (h - r) + 0.5 : 0;
        if (cx * cx + cy * cy <= r * r) this.set(x + i, y + j, c);
      }
    }
  }

  /** Paste another canvas, optionally mirrored. Transparent pixels are skipped. */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false): void {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (alpha(c) > 0) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Draw from a string grid + palette (for small hand-made sprites and icons). */
  stamp(rows: readonly string[], palette: Record<string, Color>, dx = 0, dy = 0): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = palette[row[x]];
        if (c !== undefined) this.set(dx + x, dy + y, c);
      }
    });
  }

  /**
   * Selective outline ("sel-out"): every empty pixel touching the sprite becomes a darkened
   * version of its neighbour. Gives the soft cartoon outline instead of flat black.
   */
  outline(darkness = 0.45, fixed?: Color): void {
    const out = this.data.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (alpha(this.data[y * this.w + x]) > 0) continue;
        let n: Color = TRANSPARENT;
        for (const [ox, oy] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ] as const) {
          const c = this.get(x + ox, y + oy);
          if (alpha(c) === 255) {
            n = c;
            break;
          }
        }
        if (n !== TRANSPARENT) out[y * this.w + x] = fixed ?? shade(n, darkness);
      }
    }
    this.data.set(out);
  }

  /** Darken pixels that sit on the inner edge of the shape (inner outline / ambient occlusion). */
  innerEdge(darkness = 0.8, side: 'bottom' | 'all' = 'bottom'): void {
    const out = this.data.slice();
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        if (alpha(c) === 0) continue;
        const edge =
          !this.isSolid(x, y + 1) ||
          (side === 'all' && (!this.isSolid(x, y - 1) || !this.isSolid(x - 1, y) || !this.isSolid(x + 1, y)));
        if (edge) out[y * this.w + x] = shade(c, darkness);
      }
    }
    this.data.set(out);
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }
}
