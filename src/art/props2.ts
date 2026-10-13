import { Rng } from '../core/rng';
import { Color, hex, mix, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

const O = hex('#3b2a2a');

// ------------------------------------------------------------------ vehicles

export const CAR_COLORS = ['#c94f43', '#4f7fb5', '#e3c35a', '#6f9e62', '#e8e1d0', '#8a5aa8'];

/** Soviet sedan (Жигули) seen from the side, facing right. 46x24 */
export function drawCar(variant: number): PixelCanvas {
  const pc = new PixelCanvas(46, 24);
  const body = hex(CAR_COLORS[variant % CAR_COLORS.length]);
  const glass = hex('#8fb3c9');
  const chrome = hex('#d8d8de');
  // lower body
  pc.roundRect(1, 9, 44, 9, 3, body);
  pc.hline(2, 43, 9, shade(body, 1.18));
  pc.rect(1, 15, 44, 3, shade(body, 0.82));
  // cabin
  pc.roundRect(11, 2, 24, 9, 3, body);
  pc.hline(13, 32, 2, shade(body, 1.2));
  pc.rect(13, 4, 9, 6, glass);
  pc.rect(24, 4, 9, 6, glass);
  pc.set(14, 5, hex('#d8eef7'));
  pc.set(15, 5, hex('#d8eef7'));
  pc.set(25, 5, hex('#d8eef7'));
  pc.vline(23, 3, 15, shade(body, 0.7)); // door seam
  pc.rect(19, 11, 2, 1, chrome);
  pc.rect(29, 11, 2, 1, chrome);
  // lights & bumpers
  pc.rect(43, 10, 2, 2, hex('#ffe9a8'));
  pc.rect(1, 10, 2, 2, hex('#e0453f'));
  pc.rect(0, 15, 6, 2, chrome);
  pc.rect(40, 15, 6, 2, chrome);
  // wheels
  for (const x of [10, 36]) {
    pc.ellipse(x, 18, 4.6, 4.6, hex('#2a262c'));
    pc.ellipse(x, 18, 2, 2, chrome);
    pc.set(x - 1, 17, hex('#ffffff'));
  }
  pc.outline(0.45);
  return pc;
}

// ------------------------------------------------------------------ yard furniture

/** Swing set — frame index shifts the seat. 30x30 */
export function drawSwing(frame: number): PixelCanvas {
  const pc = new PixelCanvas(32, 30);
  const metal = hex('#d0574a');
  // A-frame legs
  pc.line(2, 29, 6, 3, metal);
  pc.line(9, 29, 6, 3, metal);
  pc.line(23, 29, 26, 3, metal);
  pc.line(30, 29, 26, 3, metal);
  pc.hline(5, 27, 3, shade(metal, 0.8));
  pc.hline(5, 27, 2, metal);
  const off = [-3, 0, 3, 0][frame % 4];
  const seatY = 22 - Math.abs(off) * 0.5;
  pc.line(12, 4, 12 + off, seatY, hex('#8d8d95'));
  pc.line(20, 4, 20 + off, seatY, hex('#8d8d95'));
  pc.rect(11 + off, seatY, 11, 2, hex('#e8b04a'));
  pc.hline(11 + off, 21 + off, seatY + 2, shade(hex('#e8b04a'), 0.7));
  pc.outline(0.45);
  return pc;
}

export function drawSandbox(): PixelCanvas {
  const pc = new PixelCanvas(32, 20);
  const wood = hex('#b97d45');
  pc.rect(0, 2, 32, 18, shade(wood, 0.8));
  pc.rect(2, 4, 28, 13, hex('#e8cf8f'));
  const rng = new Rng(4);
  for (let i = 0; i < 30; i++) pc.set(rng.int(2, 29), rng.int(4, 16), rng.chance(0.5) ? hex('#d9bd7a') : hex('#f2dda4'));
  pc.rect(0, 2, 32, 2, wood);
  pc.hline(0, 31, 2, shade(wood, 1.2));
  // bucket and spade
  pc.rect(6, 8, 4, 4, hex('#4f9de0'));
  pc.hline(6, 9, 8, hex('#7fc0ff'));
  pc.line(20, 7, 24, 12, hex('#e0453f'));
  pc.rect(23, 11, 3, 2, hex('#e0453f'));
  // little sand castle
  pc.rect(13, 9, 5, 4, hex('#d4b46c'));
  pc.set(13, 8, hex('#d4b46c'));
  pc.set(15, 8, hex('#d4b46c'));
  pc.set(17, 8, hex('#d4b46c'));
  pc.outline(0.45);
  return pc;
}

/** Carpet-beating rack (выбивалка) with a rug hanging on it. 36x26 */
export function drawCarpetRack(): PixelCanvas {
  const pc = new PixelCanvas(36, 28);
  const metal = hex('#5d6670');
  pc.rect(2, 4, 2, 24, metal);
  pc.rect(32, 4, 2, 24, metal);
  pc.rect(2, 4, 32, 2, metal);
  pc.hline(2, 33, 4, shade(metal, 1.3));
  pc.rect(2, 16, 32, 1, metal);
  // rug with a classic pattern
  const red = hex('#b8443b');
  pc.rect(6, 6, 24, 15, red);
  pc.rect(7, 7, 22, 13, hex('#e0c07a'));
  pc.rect(9, 9, 18, 9, red);
  pc.ellipse(18, 13.5, 5, 3, hex('#3f6f8f'));
  pc.ellipse(18, 13.5, 2, 1.2, hex('#e0c07a'));
  for (let x = 6; x < 30; x += 2) pc.set(x, 21, hex('#f1ead8')); // fringe
  pc.outline(0.45);
  return pc;
}

/** Washing line with laundry; two frames flap in the wind. 44x28 */
export function drawLaundry(frame: number): PixelCanvas {
  const pc = new PixelCanvas(44, 28);
  const pole = hex('#8d8d95');
  pc.rect(1, 2, 2, 26, pole);
  pc.rect(41, 2, 2, 26, pole);
  const sag = (x: number) => 4 + Math.sin((x / 44) * Math.PI) * 3;
  for (let x = 3; x < 41; x++) pc.set(x, sag(x), hex('#e8e0c8'));
  const f = frame % 2;
  const items: [number, number, Color, number, number][] = [
    [6, 8, hex('#7fb2e5'), 7, 9], // shirt
    [16, 4, hex('#f6f2ea'), 9, 13], // sheet
    [28, 3, hex('#ff9ec4'), 4, 6], // sock
    [33, 4, hex('#ffe066'), 5, 8], // towel
  ];
  for (const [x, w, c, , h] of items) {
    const top = Math.round(sag(x + w / 2));
    for (let j = 0; j < h; j++) {
      const sway = f && j > h / 2 ? 1 : 0;
      for (let i = 0; i < w; i++) pc.set(x + i + sway, top + j, j === h - 1 ? shade(c, 0.85) : i === 0 ? shade(c, 1.08) : c);
    }
    pc.set(x + 1, top, hex('#c0643a'));
    pc.set(x + w - 2, top, hex('#c0643a'));
  }
  pc.outline(0.45);
  return pc;
}

export function drawPullupBar(): PixelCanvas {
  const pc = new PixelCanvas(22, 28);
  const metal = hex('#4f74a3');
  pc.rect(1, 2, 2, 26, metal);
  pc.rect(19, 2, 2, 26, metal);
  pc.hline(1, 20, 4, hex('#c9c6cf'));
  pc.hline(1, 20, 5, shade(hex('#c9c6cf'), 0.7));
  pc.outline(0.45);
  return pc;
}

/** Garage with its door raised: shelves, tools and a warm bulb inside. 32x40 */
export function drawOpenGarage(): PixelCanvas {
  const pc = new PixelCanvas(32, 40);
  const roof = hex('#4c4852');
  const wall = hex('#b1a899');
  pc.rect(0, 0, 32, 8, roof);
  pc.hline(0, 31, 0, shade(roof, 1.25));
  pc.rect(0, 7, 32, 2, shade(roof, 0.7));
  pc.rect(0, 9, 32, 31, wall);
  pc.rect(0, 9, 3, 31, shade(wall, 1.08));
  pc.rect(29, 9, 3, 31, shade(wall, 0.92));
  // dark interior with warm light gradient
  for (let y = 11; y < 39; y++) {
    const t = (y - 11) / 28;
    pc.hline(3, 28, y, mix(hex('#4a3a33'), hex('#2a2226'), t));
  }
  pc.rect(3, 11, 26, 2, hex('#7a7a82')); // raised door
  pc.ellipse(16, 15, 2, 2, hex('#ffe9a8'));
  pc.ellipse(16, 15, 4, 3, hex('#ffe9a8', 60));
  // shelves with jars
  pc.hline(5, 12, 20, hex('#8a6a4a'));
  pc.hline(20, 27, 24, hex('#8a6a4a'));
  const jars = [hex('#e0453f'), hex('#ffe066'), hex('#7fb2e5'), hex('#9fd38a')];
  jars.forEach((c, i) => pc.rect(5 + i * 2, 18, 1, 2, c));
  pc.rect(21, 22, 2, 2, hex('#c0643a'));
  pc.rect(24, 21, 3, 3, hex('#5d6670'));
  // tyre leaning
  pc.ellipse(8, 33, 4, 5, hex('#2a262c'));
  pc.ellipse(8, 33, 1.5, 2, hex('#4a3a33'));
  pc.hline(0, 31, 39, shade(wall, 0.6));
  return pc;
}

// ------------------------------------------------------------------ people

export interface PersonLook {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  hat?: { kind: 'scarf' | 'cap' | 'none'; color: string };
  small?: boolean;
  glasses?: boolean;
  beard?: boolean;
}

/** Front-facing townsperson. pose: 0/1 idle (blink / small motion), 2 = action (wave, knit…), 3 = sit. 16x24 */
export function drawPerson(look: PersonLook, pose: number): PixelCanvas {
  const pc = new PixelCanvas(16, 24);
  const skin = hex(look.skin);
  const hair = hex(look.hair);
  const top = hex(look.top);
  const bottom = hex(look.bottom);
  const s = look.small ? 3 : 0; // kids are shorter
  const sit = pose === 3;
  const y0 = s + (sit ? 2 : 0);
  // legs / skirt
  if (sit) {
    pc.rect(4, 17 + s, 8, 3, bottom);
    pc.rect(4, 20 + s, 3, 2, shade(bottom, 0.85));
    pc.rect(9, 20 + s, 3, 2, shade(bottom, 0.85));
    pc.rect(4, 22, 3, 2, hex('#3e3a44'));
    pc.rect(9, 22, 3, 2, hex('#3e3a44'));
  } else {
    pc.rect(5, 17 + s * 0.6, 3, 5 - s * 0.6, bottom);
    pc.rect(8, 17 + s * 0.6, 3, 5 - s * 0.6, shade(bottom, 0.88));
    pc.rect(5, 22, 3, 2, hex('#3e3a44'));
    pc.rect(8, 22, 3, 2, hex('#3e3a44'));
  }
  // torso
  pc.rect(4, 10 + y0, 8, 8 - y0 + s * 0.6, top);
  pc.hline(4, 11, 10 + y0, shade(top, 1.15));
  pc.hline(4, 11, 17 + s * 0.6, shade(top, 0.8));
  pc.set(8, 12 + y0, shade(top, 0.75)); // button
  pc.set(8, 14 + y0, shade(top, 0.75));
  // arms
  if (pose === 2) {
    // action: hands together in front (knitting / holding)
    pc.rect(3, 11 + y0, 2, 4, top);
    pc.rect(11, 11 + y0, 2, 4, top);
    pc.rect(5, 15 + y0, 6, 2, skin);
    pc.set(7, 14 + y0, hex('#e0453f'));
    pc.set(8, 14 + y0, hex('#e0453f'));
  } else {
    pc.rect(2, 11 + y0, 2, 5, top);
    pc.rect(12, 11 + y0, 2, 5, top);
    pc.hline(2, 3, 16 + y0, skin);
    pc.hline(12, 13, 16 + y0, skin);
  }
  // head
  const hy = y0;
  pc.ellipse(8, 6 + hy, 4.4, 4.4, skin);
  const hat = look.hat?.kind ?? 'none';
  if (hat === 'scarf') {
    const sc = hex(look.hat!.color);
    pc.ellipse(8, 5 + hy, 5, 4.6, sc);
    pc.ellipse(8, 7 + hy, 3.3, 3.2, skin);
    pc.set(4, 10 + hy, sc);
    pc.set(12, 10 + hy, sc);
    pc.set(6, 3 + hy, shade(sc, 1.3)); // pattern dots
    pc.set(10, 4 + hy, shade(sc, 1.3));
  } else if (hat === 'cap') {
    const cc = hex(look.hat!.color);
    pc.ellipse(8, 3 + hy, 4.8, 2.6, cc);
    pc.hline(4, 11, 5 + hy, shade(cc, 0.75));
    pc.rect(4, 5 + hy, 1, 3, hair);
    pc.rect(11, 5 + hy, 1, 3, hair);
  } else {
    pc.ellipse(8, 3.5 + hy, 4.6, 2.8, hair);
    pc.rect(4, 4 + hy, 1, 4, hair);
    pc.rect(11, 4 + hy, 1, 4, hair);
  }
  const blink = pose === 1;
  if (blink) {
    pc.hline(6, 6, 7 + hy, O);
    pc.hline(10, 10, 7 + hy, O);
  } else {
    pc.vline(6, 6 + hy, 7 + hy, O);
    pc.vline(10, 6 + hy, 7 + hy, O);
  }
  if (look.glasses) {
    pc.hline(5, 7, 5 + hy, hex('#8d8d95'));
    pc.hline(9, 11, 5 + hy, hex('#8d8d95'));
    pc.set(8, 6 + hy, hex('#8d8d95'));
  }
  pc.set(5, 8 + hy, hex('#f39a8f'));
  pc.set(11, 8 + hy, hex('#f39a8f'));
  if (look.beard) {
    pc.ellipse(8, 9.5 + hy, 3, 1.8, hair);
    pc.hline(7, 9, 9 + hy, shade(skin, 0.7));
  } else pc.hline(7, 9, 9 + hy, shade(skin, 0.75));
  pc.outline(0.4);
  return pc;
}

// ------------------------------------------------------------------ small critters (string art)

const PIGEON_ROWS = [
  ['.....gg..', '....ggek.', '....nng..', '..ddpngg.', '.dddgggg.', 'ddddggg..', '.ddggg...', '...l..l..'],
  ['.........', '......gg.', '.....ggek', '..ddpnng.', '.dddgggg.', 'ddddggg..', '.ddggg...', '....ll...'],
  ['.........', '.........', '..dd.....', '.dddggg..', 'ddddgggn.', '.ddggggng', '....l.lgk', '.......e.'],
  ['.d.....d.', '.dd...dd.', '..dd.dd..', '...dgggek', '..ddggg..', '.dd.gg...', '.........', '.........'],
  ['.........', '.........', '....ggek.', '.ddddggg.', 'dddddgg..', '.d...dd..', '......d..', '.........'],
];

export function drawPigeon(frame: number): PixelCanvas {
  const pc = new PixelCanvas(9, 8);
  pc.stamp(PIGEON_ROWS[frame], {
    g: hex('#a3a9b8'),
    d: hex('#737a8c'),
    n: hex('#5fa39a'),
    p: hex('#8a6aa8'),
    k: hex('#e8d8c0'),
    e: hex('#ff7a3d'),
    l: hex('#e0735a'),
  });
  pc.outline(0.45);
  return pc;
}

const CAT_ROWS = [
  ['.o.....o...', '.oo...oo...', '.ccccccc...', '.cEecEec...', '.cccnccc...', '..cmmmc....', '.ccccccc..t', '.ccwwwcc..t', '.ccwwwcc.t.', '.cccccccct.', '..cc.cc....'],
  ['.o.....o...', '.oo...oo...', '.ccccccc...', '.cEecEec...', '.cccnccc...', '..cmmmc....', '.ccccccc...', '.ccwwwcc...', '.ccwwwcc...', '.cccccccctt', '..cc.cc...t'],
  ['.o.....o...', '.oo...oo...', '.ccccccc...', '.ceecee c..', '.cccnccc...', '..cKKKc....', '.ccccccc..t', '.ccwwwcc..t', '.ccwwwcc..t', '.cccccccct.', '..cc.cc....'],
];
export const CAT_COLORS = [
  { c: '#e0904a', w: '#f6e0c0' },
  { c: '#3d3438', w: '#f0ead9' },
  { c: '#9a96a0', w: '#e6e2e8' },
];

export function drawCat(variant: number, frame: number): PixelCanvas {
  const col = CAT_COLORS[variant % CAT_COLORS.length];
  const c = hex(col.c);
  const pc = new PixelCanvas(11, 11);
  pc.stamp(CAT_ROWS[frame], {
    c,
    o: shade(c, 0.8),
    t: shade(c, 0.9),
    w: hex(col.w),
    m: hex(col.w),
    E: hex('#9be36b'),
    e: hex('#1d1622'),
    n: hex('#ef7d8d'),
    K: hex('#1d1622'),
  });
  pc.outline(0.45);
  return pc;
}

export function drawButterfly(frame: number, color: string): PixelCanvas {
  const pc = new PixelCanvas(5, 4);
  const rows = frame ? ['..b..', '.aba.', '..b..'] : ['ab.ba', 'aabaa', '.a.a.'];
  pc.stamp(rows, { a: hex(color), b: hex('#3b2a2a') });
  return pc;
}

export function drawLeaf(variant: number): PixelCanvas {
  const pc = new PixelCanvas(4, 3);
  const c = [hex('#e8a33a'), hex('#d9762f'), hex('#f0c94b')][variant % 3];
  pc.stamp(['.aa.', 'aab.', '.a..'], { a: c, b: shade(c, 0.75) });
  return pc;
}

export function drawDust(): PixelCanvas {
  const pc = new PixelCanvas(5, 4);
  pc.ellipse(2.5, 2, 2.5, 2, hex('#e8dcc4', 200));
  pc.set(1, 1, hex('#fff6e0', 220));
  return pc;
}

export function drawSplash(): PixelCanvas {
  const pc = new PixelCanvas(9, 5);
  const c = hex('#d8eef7');
  pc.set(1, 2, c);
  pc.set(7, 2, c);
  pc.set(2, 1, c);
  pc.set(6, 1, c);
  pc.set(4, 0, c);
  pc.hline(2, 6, 4, hex('#a9cde0'));
  return pc;
}

export function drawBubble(): PixelCanvas {
  const pc = new PixelCanvas(5, 5);
  pc.ellipse(2.5, 2.5, 2.5, 2.5, hex('#e6f6ff', 200));
  pc.ellipse(2.5, 2.5, 1.6, 1.6, hex('#bfe6ff', 120));
  pc.set(1, 1, hex('#ffffff'));
  return pc;
}

// ------------------------------------------------------------------ pickups

export function drawPickup(kind: 'bone' | 'wrench' | 'ball' | 'coin'): PixelCanvas {
  const rows: Record<string, string[]> = {
    bone: ['ww.....ww', 'wwwwwwwww', '.wwwwwww.', 'wwwwwwwww', 'ww.....ww'],
    wrench: ['.mm....', 'm..m...', 'mm.mm..', '..mmmm.', '....mmm', '.....mm'],
    ball: ['..rrr..', '.rrwrr.', 'rrrrrrr', 'bbbbbbb', 'rrrrrrr', '.rrrrr.', '..rrr..'],
    coin: ['.yyy.', 'yYyyy', 'yYyy#', 'yyy##', '.y##.'],
  };
  const r = rows[kind];
  const pc = new PixelCanvas(r[0].length + 2, r.length + 2);
  pc.stamp(r, { w: hex('#f6efe0'), m: hex('#a9a9b1'), r: hex('#e0453f'), b: hex('#4f74a3'), y: hex('#ffd23f'), Y: hex('#fff3b0'), '#': hex('#d99a1f') }, 1, 1);
  pc.outline(0.45);
  return pc;
}

// ------------------------------------------------------------------ shelter

/** Shelter house «Лапа»: one storey, pitched roof, cosy windows, big paw sign. */
export function drawShelterHouse(): PixelCanvas {
  const w = 144;
  const h = 84;
  const pc = new PixelCanvas(w, h);
  const roof = hex('#b35a44');
  const brick = hex('#d9a777');
  // roof (tiled)
  for (let y = 0; y < 26; y++) {
    const inset = Math.max(0, 12 - y);
    pc.hline(inset, w - 1 - inset, y, y % 4 === 0 ? shade(roof, 0.85) : roof);
  }
  for (let x = 0; x < w; x += 6) for (let y = 1; y < 26; y += 4) pc.set(x + ((y >> 2) % 2) * 3, y, shade(roof, 1.15));
  pc.rect(0, 25, w, 3, shade(roof, 0.65));
  // chimney
  pc.rect(110, 0, 10, 10, hex('#a4705a'));
  pc.rect(109, 0, 12, 2, hex('#8a5a48'));
  // brick wall
  pc.rect(0, 28, w, h - 28, brick);
  for (let y = 28; y < h; y += 4) {
    pc.hline(0, w - 1, y, shade(brick, 0.88));
    for (let x = ((y >> 2) % 2) * 4; x < w; x += 8) pc.vline(x, y, y + 3, shade(brick, 0.9));
  }
  pc.rect(0, h - 4, w, 4, shade(brick, 0.7));
  // sign board with a big paw and heart
  const sx = 46;
  pc.roundRect(sx, 30, 52, 16, 3, hex('#f4e4c1'));
  pc.roundRect(sx + 1, 31, 50, 14, 2, hex('#fff6e0'));
  const paw = hex('#7a4f35');
  pc.ellipse(sx + 14, 40, 4, 3, paw);
  pc.set(sx + 9, 36, paw);
  pc.set(sx + 12, 34, paw);
  pc.set(sx + 16, 34, paw);
  pc.set(sx + 19, 36, paw);
  pc.stamp(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], { '#': hex('#ff6b81') }, sx + 30, 35);
  // windows with curtains and flower boxes
  for (const x of [10, 30, 106, 124]) {
    pc.rect(x - 1, 47, 13, 15, hex('#f6f2ea'));
    pc.rect(x, 48, 11, 13, hex('#ffe9a8'));
    pc.vline(x + 5, 48, 60, hex('#f6f2ea'));
    pc.rect(x, 48, 3, 13, hex('#e57a6e'));
    pc.rect(x + 8, 48, 3, 13, hex('#e57a6e'));
    pc.rect(x - 2, 62, 15, 3, hex('#8a5a3c'));
    for (let i = 0; i < 5; i++) pc.set(x + i * 3, 61, [hex('#ff9ec4'), hex('#ffe066'), hex('#e0453f')][i % 3]);
  }
  // door with a small canopy and a bell
  const dx = 64;
  pc.rect(dx - 4, 50, 24, 3, shade(roof, 0.9));
  pc.rect(dx, 53, 16, 27, hex('#6f9e62'));
  pc.rect(dx, 53, 16, 1, shade(hex('#6f9e62'), 1.2));
  pc.vline(dx + 8, 53, 79, shade(hex('#6f9e62'), 0.7));
  pc.rect(dx + 11, 66, 2, 2, hex('#ffd23f'));
  pc.rect(dx + 2, 56, 4, 5, hex('#bfe6ff'));
  pc.rect(dx + 10, 56, 4, 5, hex('#bfe6ff'));
  pc.rect(dx + 18, 54, 3, 3, hex('#ffd23f'));
  return pc;
}

/** Wooden dog house (будка). 24x24 */
export function drawKennel(variant: number): PixelCanvas {
  const pc = new PixelCanvas(26, 24);
  const wood = hex(['#c48a52', '#b07a48', '#d09a62'][variant % 3]);
  const roof = hex(['#4f74a3', '#b35a44', '#6f9e62'][variant % 3]);
  pc.rect(3, 9, 20, 15, wood);
  for (let y = 10; y < 24; y += 3) pc.hline(3, 22, y, shade(wood, 0.85));
  for (let y = 0; y < 10; y++) {
    const half = 3 + y * 1.1;
    pc.hline(Math.round(13 - half), Math.round(12 + half), y, y === 0 ? shade(roof, 1.2) : roof);
  }
  pc.hline(1, 24, 9, shade(roof, 0.7));
  // arched door
  pc.ellipse(13, 17, 4.5, 4.5, hex('#2a2226'));
  pc.rect(9, 17, 9, 7, hex('#2a2226'));
  // name plate
  pc.rect(9, 10, 8, 3, hex('#f4e4c1'));
  pc.outline(0.45);
  return pc;
}

export function drawBathStation(): PixelCanvas {
  const pc = new PixelCanvas(36, 26);
  const tin = hex('#b8c0c8');
  pc.rect(6, 18, 2, 8, hex('#5d6670'));
  pc.rect(28, 18, 2, 8, hex('#5d6670'));
  pc.roundRect(2, 8, 32, 12, 4, tin);
  pc.hline(4, 31, 8, shade(tin, 1.2));
  pc.rect(2, 16, 32, 4, shade(tin, 0.82));
  pc.rect(4, 9, 28, 3, hex('#8fd3ff'));
  pc.hline(4, 31, 9, hex('#d8eef7'));
  for (const [x, y] of [[8, 7], [13, 6], [20, 7], [26, 6], [30, 8]]) pc.ellipse(x, y, 2, 2, hex('#f6fbff'));
  // shampoo bottles
  pc.rect(1, 0, 3, 7, hex('#ff9ec4'));
  pc.rect(5, 2, 3, 5, hex('#9fd38a'));
  // hose
  pc.line(34, 4, 34, 20, hex('#4f9443'));
  pc.line(34, 4, 30, 2, hex('#4f9443'));
  pc.outline(0.45);
  return pc;
}

export function drawKitchenStation(): PixelCanvas {
  const pc = new PixelCanvas(36, 24);
  const sack = hex('#d9b77a');
  // sacks of food
  pc.roundRect(1, 4, 11, 17, 3, sack);
  pc.roundRect(10, 7, 10, 14, 3, shade(sack, 0.92));
  pc.rect(3, 10, 6, 5, hex('#e8833a'));
  pc.set(5, 12, hex('#7a4a28'));
  pc.set(6, 12, hex('#7a4a28'));
  pc.hline(2, 10, 4, shade(sack, 0.8));
  // bowls row
  const bowl = hex('#c8d0d8');
  for (const x of [24, 31]) {
    pc.ellipse(x, 20, 4, 2, shade(bowl, 0.8));
    pc.ellipse(x, 19.5, 3.5, 1.5, bowl);
    pc.hline(x - 2, x + 2, 19, hex('#9a5f32'));
  }
  // bone sign
  pc.stamp(['ww...ww', '.wwwww.', 'ww...ww'], { w: hex('#f6efe0') }, 24, 6);
  pc.outline(0.45);
  return pc;
}

export function drawVetStation(): PixelCanvas {
  const pc = new PixelCanvas(36, 34);
  const awn = hex('#7cc576');
  // awning with stripes
  for (let x = 0; x < 36; x++) pc.vline(x, 0, 6, (x >> 2) % 2 ? awn : hex('#f6f2ea'));
  for (let x = 0; x < 36; x += 4) pc.set(x + 2, 7, (x >> 2) % 2 ? awn : hex('#f6f2ea'));
  pc.rect(1, 6, 2, 28, hex('#8d8d95'));
  pc.rect(33, 6, 2, 28, hex('#8d8d95'));
  // cabinet with green cross
  pc.rect(4, 10, 12, 14, hex('#f6f2ea'));
  pc.rect(8, 13, 4, 8, awn);
  pc.rect(6, 15, 8, 4, awn);
  // table
  pc.rect(17, 20, 16, 3, hex('#f6f2ea'));
  pc.rect(18, 23, 2, 10, hex('#8d8d95'));
  pc.rect(30, 23, 2, 10, hex('#8d8d95'));
  pc.rect(22, 18, 6, 2, hex('#7fb2e5')); // towel
  pc.outline(0.45);
  return pc;
}

export function drawTagStation(): PixelCanvas {
  const pc = new PixelCanvas(30, 26);
  const wood = hex('#a8784a');
  pc.rect(1, 10, 28, 4, wood);
  pc.hline(1, 28, 10, shade(wood, 1.2));
  pc.rect(3, 14, 2, 12, shade(wood, 0.7));
  pc.rect(25, 14, 2, 12, shade(wood, 0.7));
  // box of yellow tags
  pc.rect(4, 5, 9, 5, hex('#5d6670'));
  for (let i = 0; i < 4; i++) pc.rect(5 + i * 2, 4, 1, 2, hex('#ffd23f'));
  // ledger + pen
  pc.rect(16, 7, 9, 3, hex('#f6f2ea'));
  pc.hline(17, 23, 8, hex('#7fb2e5'));
  pc.line(22, 3, 25, 7, hex('#e0453f'));
  pc.outline(0.45);
  return pc;
}

export function drawBoard(): PixelCanvas {
  const pc = new PixelCanvas(26, 30);
  const cork = hex('#c49a62');
  pc.rect(2, 16, 2, 14, hex('#7a5a3c'));
  pc.rect(22, 16, 2, 14, hex('#7a5a3c'));
  pc.rect(0, 0, 26, 19, hex('#7a5a3c'));
  pc.rect(1, 1, 24, 17, cork);
  const notes = [hex('#fff3b0'), hex('#ff9ec4'), hex('#bfe6ff'), hex('#9fd38a')];
  notes.forEach((c, i) => {
    const x = 3 + (i % 2) * 11;
    const y = 2 + Math.floor(i / 2) * 8;
    pc.rect(x, y, 9, 6, c);
    pc.hline(x + 1, x + 6, y + 2, shade(c, 0.75));
    pc.set(x + 4, y, hex('#e0453f'));
  });
  pc.outline(0.45);
  return pc;
}

/** Low picket fence: horizontal segment 16 wide. */
export function drawPicketH(): PixelCanvas {
  const pc = new PixelCanvas(16, 14);
  const wood = hex('#f1ead8');
  for (let x = 1; x < 16; x += 4) {
    pc.rect(x, 2, 2, 12, wood);
    pc.set(x, 1, wood);
    pc.vline(x + 1, 3, 13, shade(wood, 0.85));
  }
  pc.hline(0, 15, 5, shade(wood, 0.8));
  pc.hline(0, 15, 10, shade(wood, 0.8));
  pc.outline(0.5);
  return pc;
}

/** Picket fence running north–south (seen edge-on). 16 tall. */
export function drawPicketV(): PixelCanvas {
  const pc = new PixelCanvas(4, 18);
  const wood = hex('#f1ead8');
  pc.rect(1, 0, 2, 18, shade(wood, 0.9));
  pc.vline(1, 0, 17, wood);
  for (let y = 2; y < 18; y += 4) pc.set(2, y, shade(wood, 0.7));
  pc.outline(0.5);
  return pc;
}

export function drawToy(kind: 'ball' | 'bone' | 'ring'): PixelCanvas {
  if (kind === 'ball') return drawPickup('ball');
  if (kind === 'bone') return drawPickup('bone');
  const pc = new PixelCanvas(9, 7);
  pc.ellipse(4.5, 3.5, 4.5, 3.5, hex('#4f9de0'));
  pc.ellipse(4.5, 3.5, 2, 1.4, 0);
  pc.outline(0.45);
  return pc;
}

/** Small sign post with an icon plate (used to label shelter stations). */
export function drawSignPost(): PixelCanvas {
  const pc = new PixelCanvas(14, 22);
  pc.rect(6, 10, 2, 12, hex('#7a5a3c'));
  pc.roundRect(0, 0, 14, 11, 2, hex('#f4e4c1'));
  pc.outline(0.45);
  return pc;
}
