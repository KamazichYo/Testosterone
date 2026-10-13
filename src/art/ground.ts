import { hash2, Rng } from '../core/rng';
import { Color, hex, mix, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const TILE = 16;

/** g = grass, d = dirt, a = asphalt, s = concrete sidewalk plates */
export type GroundType = 'g' | 'd' | 'a' | 's';

export interface Decal {
  kind: 'puddle' | 'oil' | 'manhole' | 'leaves' | 'hopscotch' | 'flowers' | 'dashes' | 'zebra' | 'parking' | 'patch' | 'grate';
  x: number;
  y: number;
  w?: number;
  h?: number;
}

const GRASS = [hex('#62a14a'), hex('#69a84f'), hex('#70ae54')];
const GRASS_LIGHT = hex('#8cc463');
const GRASS_DARK = hex('#4f8a3a');
const DIRT = [hex('#a8835a'), hex('#b08a5e'), hex('#b8936a')];
const ASPHALT = hex('#6d6973');
const ASPHALT_LIGHT = hex('#7d7983');
const ASPHALT_DARK = hex('#5d5963');
const CONCRETE = hex('#bab2a4');
const SEAM = hex('#9d9587');
const CURB_TOP = hex('#d8d1c4');
const CURB_SIDE = hex('#9e968a');
const FLOWER = [hex('#ffffff'), hex('#ffe066'), hex('#ff9ec4'), hex('#b9a4ff')];
const LEAF = [hex('#e8a33a'), hex('#d9762f'), hex('#f0c94b'), hex('#c45a2a')];

export class GroundGrid {
  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly cells: GroundType[] = new Array(cols * rows).fill('g'),
  ) {}

  get(c: number, r: number): GroundType {
    c = Math.max(0, Math.min(this.cols - 1, c));
    r = Math.max(0, Math.min(this.rows - 1, r));
    return this.cells[r * this.cols + c];
  }

  paint(t: GroundType, c: number, r: number, w = 1, h = 1): this {
    for (let j = r; j < r + h; j++)
      for (let i = c; i < c + w; i++)
        if (i >= 0 && j >= 0 && i < this.cols && j < this.rows) this.cells[j * this.cols + i] = t;
    return this;
  }
}

const soft = (t: GroundType) => t === 'g' || t === 'd';

/** Low-frequency value noise for wavy grass/dirt borders. */
function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function bakeGround(grid: GroundGrid, decals: Decal[], seed: number): PixelCanvas {
  const W = grid.cols * TILE;
  const H = grid.rows * TILE;
  const pc = new PixelCanvas(W, H);

  const typeAt = (x: number, y: number): GroundType => grid.get(Math.floor(x / TILE), Math.floor(y / TILE));

  // crack mask for asphalt: a few random-walk lines
  const cracks = new Set<number>();
  const rng = new Rng(seed);
  for (let i = 0; i < (grid.cols * grid.rows) / 14; i++) {
    let x = rng.int(0, W - 1);
    let y = rng.int(0, H - 1);
    if (typeAt(x, y) !== 'a') continue;
    let dir = rng.next() * Math.PI * 2;
    const len = rng.int(6, 18);
    for (let k = 0; k < len; k++) {
      cracks.add(Math.round(y) * W + Math.round(x));
      dir += rng.range(-0.7, 0.7);
      x += Math.cos(dir);
      y += Math.sin(dir);
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t = typeAt(x, y);
      // wavy edge between grass and dirt
      if (soft(t)) {
        const n = smoothNoise(x, y, seed, 5) - 0.5;
        const jt = typeAt(x + n * 7, y + n * 7);
        if (soft(jt)) t = jt;
      }
      const h = hash2(x, y, seed);
      const block = hash2(x >> 1, y >> 1, seed + 1);
      let c: Color;
      switch (t) {
        case 'g': {
          c = GRASS[Math.floor(block * 3)];
          const n = smoothNoise(x, y, seed + 7, 18);
          if (n > 0.68) c = shade(c, 1.05);
          else if (n < 0.3) c = shade(c, 0.94);
          break;
        }
        case 'd':
          c = DIRT[Math.floor(block * 3)];
          if (h > 0.975) c = hex('#8f6e4a');
          else if (h > 0.955) c = hex('#c9a87c');
          break;
        case 'a': {
          c = ASPHALT;
          if (h > 0.9) c = ASPHALT_LIGHT;
          else if (h < 0.08) c = ASPHALT_DARK;
          const n = smoothNoise(x, y, seed + 3, 24);
          if (n < 0.3) c = shade(c, 0.95);
          if (cracks.has(y * W + x)) c = shade(ASPHALT_DARK, 0.85);
          break;
        }
        case 's': {
          c = CONCRETE;
          const plate = hash2(Math.floor(x / TILE), Math.floor(y / TILE), seed + 5);
          if (plate < 0.25) c = shade(c, 0.95);
          else if (plate > 0.85) c = mix(c, hex('#c9b99a'), 0.4);
          const lx = x % TILE;
          const ly = y % TILE;
          if (lx === 0 || ly === 0) c = SEAM;
          else if (lx === 1 || ly === 1) c = shade(c, 1.06);
          if (h > 0.985) c = SEAM;
          break;
        }
      }
      pc.set(x, y, c);
    }
  }

  // curbs where asphalt meets anything else, and grass tufts overhanging
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = typeAt(x, y);
      if (t !== 'a') continue;
      const near = (d: number) =>
        typeAt(x, y - d) !== 'a' || typeAt(x, y + d) !== 'a' || typeAt(x - d, y) !== 'a' || typeAt(x + d, y) !== 'a';
      if (near(1)) pc.set(x, y, CURB_TOP);
      else if (near(2)) pc.set(x, y, CURB_SIDE);
    }
  }

  // grass details: blades, flowers, shade near hard surfaces
  for (let y = 1; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      if (typeAt(x, y) !== 'g') continue;
      const h = hash2(x, y, seed + 11);
      if (typeAt(x, y + 1) !== 'g' && typeAt(x, y + 1) !== 'd') pc.set(x, y, h < 0.5 ? GRASS_DARK : GRASS_LIGHT);
      else if (h > 0.94) {
        pc.set(x, y, GRASS_LIGHT);
        pc.set(x, y + 1, GRASS_DARK);
      } else if (h > 0.9965) {
        const f = FLOWER[Math.floor(hash2(x, y, seed + 12) * FLOWER.length)];
        pc.set(x, y, f);
        pc.set(x - 1, y, shade(f, 0.85));
        pc.set(x + 1, y, shade(f, 0.85));
        pc.set(x, y - 1, shade(f, 0.92));
        pc.set(x, y + 1, GRASS_DARK);
      }
    }
  }

  for (const d of decals) drawDecal(pc, d, seed);
  return pc;
}

function drawDecal(pc: PixelCanvas, d: Decal, seed: number): void {
  const w = d.w ?? 12;
  const h = d.h ?? 6;
  switch (d.kind) {
    case 'puddle': {
      const water = hex('#5f7f98');
      pc.ellipse(d.x, d.y, w / 2 + 1, h / 2 + 1, shade(hex('#6d6973'), 0.8));
      pc.ellipse(d.x, d.y, w / 2, h / 2, (_nx, ny) => (ny < -0.4 ? shade(water, 0.85) : water));
      // sky reflection
      pc.hline(Math.round(d.x - w / 4), Math.round(d.x), Math.round(d.y - 1), hex('#a9cde0'));
      pc.set(Math.round(d.x + w / 5), Math.round(d.y + 1), hex('#d8eef7'));
      break;
    }
    case 'oil':
      pc.ellipse(d.x, d.y, w / 2, h / 2, hex('#57535d'));
      pc.set(Math.round(d.x - 1), Math.round(d.y), hex('#7a6f8c'));
      break;
    case 'manhole': {
      pc.ellipse(d.x, d.y, 6, 4, hex('#4a464f'));
      pc.ellipse(d.x, d.y, 5, 3.2, (nx, ny) => ((Math.round((nx + ny) * 4) & 1) === 0 ? hex('#5e5a64') : hex('#545059')));
      break;
    }
    case 'leaves': {
      for (let i = 0; i < (w * h) / 6; i++) {
        const lx = d.x + (hash2(i, 1, seed + d.x) - 0.5) * w;
        const ly = d.y + (hash2(i, 2, seed + d.y) - 0.5) * h;
        const c = LEAF[Math.floor(hash2(i, 3, seed) * LEAF.length)];
        pc.set(lx, ly, c);
        pc.set(lx + 1, ly, shade(c, 0.8));
      }
      break;
    }
    case 'flowers': {
      for (let i = 0; i < (w * h) / 5; i++) {
        const lx = d.x + (hash2(i, 4, seed + d.x) - 0.5) * w;
        const ly = d.y + (hash2(i, 5, seed + d.y) - 0.5) * h;
        const c = FLOWER[Math.floor(hash2(i, 6, seed) * FLOWER.length)];
        pc.set(lx, ly + 1, GRASS_DARK);
        pc.set(lx, ly, c);
      }
      break;
    }
    case 'dashes': {
      const paint = hex('#e9e4d6');
      for (let x = d.x + 4; x < d.x + w - 8; x += 16) {
        pc.rect(x, d.y, 9, 2, paint);
        pc.set(x + 3 + (Math.floor(x) % 5), d.y, hex('#c9c4b6'));
      }
      break;
    }
    case 'zebra': {
      const paint = hex('#ece7da');
      for (let x = d.x + 2; x < d.x + w - 2; x += 8) {
        for (let y = d.y + 3; y < d.y + h - 3; y++) {
          for (let i = 0; i < 5; i++) if (hash2(x + i, y, seed) > 0.08) pc.set(x + i, y, paint);
        }
      }
      break;
    }
    case 'parking': {
      const paint = hex('#e3dfd2');
      for (let x = d.x + 8; x <= d.x + w - 8; x += 26) pc.vline(x, d.y + 4, d.y + 22, paint);
      for (let x = d.x + 8; x <= d.x + w - 8; x += 26) pc.vline(x, d.y + h - 22, d.y + h - 4, paint);
      break;
    }
    case 'patch': {
      const c = hex('#5a5660');
      pc.rect(Math.round(d.x - w / 2), Math.round(d.y - h / 2), w, h, c);
      pc.hline(Math.round(d.x - w / 2), Math.round(d.x + w / 2) - 1, Math.round(d.y - h / 2), shade(c, 1.15));
      for (let i = 0; i < w; i += 3) pc.set(Math.round(d.x - w / 2) + i, Math.round(d.y), shade(c, 1.12));
      break;
    }
    case 'grate': {
      pc.rect(Math.round(d.x - 6), Math.round(d.y - 3), 12, 6, hex('#3f3b44'));
      for (let x = -5; x < 6; x += 2) pc.vline(Math.round(d.x + x), Math.round(d.y - 2), Math.round(d.y + 1), hex('#6a666f'));
      break;
    }
    case 'hopscotch': {
      // chalk "классики" on the sidewalk
      const chalk = hex('#f4f1ea', 200);
      const pink = hex('#ff9ec4', 220);
      const cells = [
        [0, 0],
        [0, 1],
        [-0.5, 2],
        [0.5, 2],
        [0, 3],
        [-0.5, 4],
        [0.5, 4],
      ];
      for (const [cx, cy] of cells) {
        const x0 = Math.round(d.x + cx * 8 - 4);
        const y0 = Math.round(d.y - cy * 7);
        pc.hline(x0, x0 + 8, y0, chalk);
        pc.hline(x0, x0 + 8, y0 + 7, chalk);
        pc.vline(x0, y0, y0 + 7, chalk);
        pc.vline(x0 + 8, y0, y0 + 7, chalk);
      }
      pc.ellipse(d.x, d.y - 36, 5, 3, pink);
      pc.ellipse(d.x, d.y - 36, 3.5, 1.8, hex('#bab2a4'));
      break;
    }
  }
}
