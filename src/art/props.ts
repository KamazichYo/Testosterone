import { hash2, Rng } from '../core/rng';
import { Color, hex, mix, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

/** 3x5 digits for garage numbers etc. */
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
};

function drawNumber(pc: PixelCanvas, n: number, x: number, y: number, c: Color): void {
  const s = String(n);
  for (let i = 0; i < s.length; i++) pc.stamp(DIGITS[s[i]], { '#': c }, x + i * 4, y);
}

export const GARAGE_DOORS = ['#5f8a5b', '#4f74a3', '#8a5a3c', '#a3524a', '#7d8590', '#c79a3e', '#3f7f80'];

/** Soviet-style garage box seen from the front (top-down 3/4). 32x40. */
export function drawGarage(variant: number, number: number): PixelCanvas {
  const pc = new PixelCanvas(32, 40);
  const rng = new Rng(variant * 977 + number);
  const door = hex(GARAGE_DOORS[variant % GARAGE_DOORS.length]);
  const wall = hex('#b1a899');
  const roof = hex('#4c4852');

  // roof (tar sheet) with a little overhang
  pc.rect(0, 0, 32, 8, roof);
  pc.hline(0, 31, 0, shade(roof, 1.25));
  for (let i = 0; i < 18; i++) pc.set(rng.int(1, 30), rng.int(1, 6), rng.chance(0.5) ? shade(roof, 1.15) : shade(roof, 0.85));
  // moss / fallen leaves on the roof
  for (let i = 0; i < 4; i++) {
    const x = rng.int(2, 28);
    const c = rng.pick([hex('#6b9a45'), hex('#e8a33a'), hex('#d9762f')]);
    pc.set(x, rng.int(2, 6), c);
    pc.set(x + 1, rng.int(2, 6), shade(c, 0.85));
  }
  pc.rect(0, 7, 32, 2, shade(roof, 0.7));

  // walls / pillars
  pc.rect(0, 9, 32, 31, wall);
  pc.rect(0, 9, 3, 31, shade(wall, 1.08));
  pc.rect(29, 9, 3, 31, shade(wall, 0.92));
  pc.rect(0, 9, 32, 2, shade(wall, 0.85)); // shadow under roof lip
  for (let i = 0; i < 10; i++) pc.set(rng.int(0, 31), rng.int(11, 38), shade(wall, rng.chance(0.5) ? 0.9 : 1.08));

  // door
  const dx = 3;
  const dy = 12;
  const dw = 26;
  const dh = 27;
  pc.rect(dx - 1, dy - 1, dw + 2, dh + 1, shade(door, 0.55)); // frame
  for (let y = dy; y < dy + dh; y++) {
    for (let x = dx; x < dx + dw; x++) {
      const rib = (x - dx) % 4;
      let c = rib === 0 ? shade(door, 1.15) : rib === 3 ? shade(door, 0.88) : door;
      if (y === dy) c = shade(door, 1.2);
      pc.set(x, y, c);
    }
  }
  // split between the two leaves
  pc.vline(dx + dw / 2, dy, dy + dh - 1, shade(door, 0.5));
  // wicket door in the left leaf
  const wx = dx + 3;
  const wy = dy + 6;
  pc.rect(wx, wy, 8, 1, shade(door, 0.6));
  pc.rect(wx, wy, 1, dh - 6, shade(door, 0.6));
  pc.rect(wx + 8, wy, 1, dh - 6, shade(door, 0.6));
  pc.set(wx + 6, wy + 10, hex('#e8e0c8'));
  // padlock
  const lx = dx + dw / 2 - 1;
  const ly = dy + 13;
  pc.rect(lx, ly, 3, 3, hex('#e2b23c'));
  pc.set(lx + 1, ly - 1, hex('#8d8d95'));
  pc.set(lx, ly - 1, hex('#8d8d95'));
  pc.set(lx + 2, ly - 1, hex('#8d8d95'));
  pc.set(lx + 1, ly + 1, hex('#8a6a1c'));
  // painted number
  drawNumber(pc, number, dx + dw - 4 - String(number).length * 4, dy + 3, hex('#f1ead8'));
  // rust streaks dripping down
  const rust = hex('#9a5a3a');
  for (let i = 0; i < 5; i++) {
    const x = rng.int(dx + 1, dx + dw - 2);
    const len = rng.int(2, 9);
    const y0 = rng.chance(0.5) ? dy + 1 : dy + dh - len;
    for (let k = 0; k < len; k++) pc.set(x, y0 + k, mix(pc.get(x, y0 + k), rust, 0.55 - k * 0.04));
  }
  // cozy extras: a painted heart or a tiny paw doodle
  if (rng.chance(0.35)) {
    const hx = rng.int(dx + 14, dx + 20);
    const hy = dy + 18;
    const pink = hex('#ff9ec4');
    pc.stamp(['#.#', '###', '.#.'], { '#': pink }, hx, hy);
  }
  // ground contact shadow
  pc.hline(0, 31, 39, shade(wall, 0.6));
  return pc;
}

const LEAF_GREEN = hex('#4f8f3e');

/** Round deciduous tree (тополь/клён), 40x50. autumn=0..1 mixes in yellow leaves. */
export function drawTree(seed: number, autumn = 0): PixelCanvas {
  const pc = new PixelCanvas(40, 50);
  const rng = new Rng(seed);
  const trunk = hex('#6b4a33');
  // trunk + roots
  pc.rect(17, 30, 6, 17, trunk);
  pc.rect(17, 30, 2, 17, shade(trunk, 1.2));
  pc.rect(21, 30, 2, 17, shade(trunk, 0.75));
  pc.rect(15, 45, 10, 2, shade(trunk, 0.85));
  pc.set(14, 46, shade(trunk, 0.8));
  pc.set(25, 46, shade(trunk, 0.8));
  pc.line(21, 33, 26, 27, trunk); // branch

  const base = mix(LEAF_GREEN, hex('#c9a53a'), autumn);
  const blobs = [
    [20, 18, 13, 11],
    [12, 22, 8, 7],
    [28, 22, 8, 7],
    [15, 12, 8, 7],
    [26, 11, 8, 7],
    [20, 26, 10, 6],
  ];
  for (const [x, y, rx, ry] of blobs) pc.shadedEllipse(x + rng.range(-1, 1), y + rng.range(-1, 1), rx, ry, base, 1.22, 0.74);
  // leaf texture: little clumps catching light
  for (let i = 0; i < 70; i++) {
    const x = rng.int(6, 34);
    const y = rng.int(4, 32);
    if (!pc.isSolid(x, y) || y > 30) continue;
    const top = y < 18 && x < 24;
    pc.setOver(x, y, top ? shade(base, 1.35) : shade(base, rng.chance(0.5) ? 1.12 : 0.82));
    pc.setOver(x + 1, y, shade(base, top ? 1.15 : 0.8));
  }
  if (autumn > 0) {
    for (let i = 0; i < 20 * autumn; i++) {
      const x = rng.int(6, 34);
      const y = rng.int(4, 30);
      pc.setOver(x, y, rng.pick([hex('#e8a33a'), hex('#f0c94b'), hex('#d9762f')]));
    }
  }
  pc.outline(0.5);
  return pc;
}

/** Birch (берёза), 28x54. */
export function drawBirch(seed: number): PixelCanvas {
  const pc = new PixelCanvas(28, 54);
  const rng = new Rng(seed);
  const bark = hex('#eee8dc');
  pc.rect(12, 20, 4, 32, bark);
  pc.rect(15, 20, 1, 32, shade(bark, 0.82));
  for (let i = 0; i < 9; i++) {
    const y = rng.int(21, 50);
    const x = rng.int(12, 14);
    pc.hline(x, x + rng.int(0, 2), y, hex('#2f2a2e'));
  }
  pc.rect(11, 51, 6, 1, shade(bark, 0.7));
  const leaf = hex('#7fb24f');
  const blobs = [
    [14, 13, 10, 10],
    [8, 20, 6, 6],
    [20, 19, 6, 6],
    [14, 6, 7, 6],
  ];
  for (const [x, y, rx, ry] of blobs) pc.shadedEllipse(x, y, rx, ry, leaf, 1.22, 0.76);
  for (let i = 0; i < 45; i++) {
    const x = rng.int(3, 25);
    const y = rng.int(1, 27);
    pc.setOver(x, y, rng.chance(0.4) ? shade(leaf, 1.3) : shade(leaf, 0.8));
  }
  // a few gaps so the crown looks airy
  for (let i = 0; i < 6; i++) {
    const x = rng.int(6, 22);
    const y = rng.int(8, 24);
    pc.set(x, y, 0);
  }
  pc.vline(13, 20, 26, bark); // trunk visible through crown
  pc.outline(0.5);
  return pc;
}

export function drawBush(seed: number, berries = false): PixelCanvas {
  const pc = new PixelCanvas(26, 18);
  const rng = new Rng(seed);
  const leaf = hex('#4f9443');
  pc.shadedEllipse(13, 11, 11, 6.5, leaf, 1.2, 0.72);
  pc.shadedEllipse(8, 9, 6, 5, leaf, 1.25, 0.8);
  pc.shadedEllipse(17, 8, 6, 5, leaf, 1.25, 0.8);
  for (let i = 0; i < 30; i++) pc.setOver(rng.int(2, 24), rng.int(3, 16), rng.chance(0.5) ? shade(leaf, 1.3) : shade(leaf, 0.8));
  if (berries)
    for (let i = 0; i < 6; i++) {
      const x = rng.int(4, 22);
      const y = rng.int(5, 14);
      if (pc.isSolid(x, y)) pc.set(x, y, hex('#e0453f'));
    }
  pc.outline(0.5);
  return pc;
}

/** Stack of old tyres. 18x18 */
export function drawTires(painted = false): PixelCanvas {
  const pc = new PixelCanvas(20, 20);
  const rubber = painted ? hex('#f1ead8') : hex('#3a3538');
  for (let i = 0; i < (painted ? 1 : 3); i++) {
    const y = 15 - i * 4;
    pc.ellipse(10, y, 9, 4, shade(rubber, 0.8));
    pc.ellipse(10, y - 1, 9, 3.5, rubber);
    pc.ellipse(10, y - 1, 5, 1.8, shade(rubber, painted ? 0.75 : 0.6));
    pc.hline(4, 8, y - 4, shade(rubber, 1.4));
  }
  if (painted) {
    // classic yard flowerbed made from a painted tyre
    pc.ellipse(10, 14, 5, 1.8, hex('#7a5a3c'));
    const flowers = [hex('#ff9ec4'), hex('#ffe066'), hex('#e0453f'), hex('#b9a4ff')];
    for (let i = 0; i < 5; i++) {
      const x = 6 + i * 2;
      const y = 8 + (i % 2) * 2;
      pc.vline(x, y + 1, 13, hex('#4f8a3a'));
      pc.set(x, y, flowers[i % flowers.length]);
      pc.set(x - 1, y, shade(flowers[i % flowers.length], 0.85));
      pc.set(x, y - 1, shade(flowers[i % flowers.length], 1.1));
    }
    for (let x = 1; x < 19; x += 3) pc.setOver(x, 15, hex('#4f74a3'));
  }
  pc.outline(0.45);
  return pc;
}

/** Green municipal trash container. 24x24 */
export function drawContainer(seed: number): PixelCanvas {
  const pc = new PixelCanvas(24, 24);
  const rng = new Rng(seed);
  const metal = hex('#4c7a4a');
  pc.rect(2, 7, 20, 14, metal);
  for (let x = 2; x < 22; x += 3) pc.vline(x, 8, 20, shade(metal, 0.85));
  pc.rect(2, 7, 20, 1, shade(metal, 1.25));
  pc.rect(2, 20, 20, 1, shade(metal, 0.7));
  // lid slightly open with bags peeking out
  pc.rect(1, 3, 22, 4, shade(metal, 0.75));
  pc.rect(1, 3, 22, 1, shade(metal, 1.1));
  pc.ellipse(7, 6, 4, 2.5, hex('#2f2c35'));
  pc.ellipse(15, 5, 4, 2.5, hex('#3f5c8a'));
  pc.set(14, 4, hex('#6f8cba'));
  pc.set(6, 5, hex('#55525e'));
  // wheels
  pc.rect(4, 21, 3, 2, hex('#2a262c'));
  pc.rect(17, 21, 3, 2, hex('#2a262c'));
  // rust & a sticker
  for (let i = 0; i < 4; i++) pc.set(rng.int(3, 20), rng.int(9, 19), hex('#8a5a3a'));
  pc.rect(9, 12, 5, 4, hex('#f1ead8'));
  pc.rect(10, 13, 3, 1, hex('#4c7a4a'));
  pc.outline(0.45);
  return pc;
}

export function drawBench(): PixelCanvas {
  const pc = new PixelCanvas(30, 18);
  const wood = hex('#b97d45');
  const iron = hex('#3e3a44');
  pc.rect(4, 8, 2, 9, iron);
  pc.rect(24, 8, 2, 9, iron);
  for (let i = 0; i < 3; i++) {
    pc.rect(1, 1 + i * 3, 28, 2, i === 0 ? shade(wood, 1.1) : wood);
    pc.hline(1, 28, 2 + i * 3, shade(wood, 0.8));
  }
  pc.rect(0, 10, 30, 2, shade(wood, 1.05));
  pc.rect(0, 12, 30, 1, shade(wood, 0.75));
  pc.outline(0.45);
  return pc;
}

export function drawLamp(): PixelCanvas {
  const pc = new PixelCanvas(14, 46);
  const pole = hex('#5d6670');
  pc.rect(6, 6, 2, 39, pole);
  pc.vline(6, 6, 44, shade(pole, 1.25));
  pc.rect(4, 43, 6, 3, shade(pole, 0.8));
  pc.rect(2, 2, 10, 4, hex('#4a525b'));
  pc.rect(3, 6, 8, 1, hex('#ffe9a8'));
  pc.hline(3, 10, 2, shade(pole, 1.3));
  pc.outline(0.45);
  return pc;
}

/** Vertical heating main (теплотрасса): two insulated pipes on concrete supports. */
export function drawPipeV(length: number): PixelCanvas {
  const pc = new PixelCanvas(18, length);
  const ins = hex('#c9c6cf');
  for (let y = 0; y < length; y++) {
    for (const px of [2, 9]) {
      for (let i = 0; i < 6; i++) {
        let c = i === 0 ? shade(ins, 1.12) : i >= 4 ? shade(ins, 0.8) : ins;
        if (y % 8 === 0) c = shade(c, 0.85);
        pc.set(px + i, y, c);
      }
    }
    if (y % 40 === 20) {
      pc.rect(0, y, 18, 5, hex('#a39b8e'));
      pc.rect(0, y, 18, 1, hex('#c9c2b4'));
      pc.rect(0, y + 4, 18, 1, hex('#7e776c'));
    }
  }
  // torn insulation flap: dogs love these warm spots
  for (let i = 0; i < length / 30; i++) {
    const y = 10 + i * 30 + (hash2(i, 0, length) * 10) | 0;
    pc.rect(3, y, 3, 2, hex('#e0c875'));
  }
  pc.outline(0.5);
  return pc;
}

export function drawPipeH(length: number): PixelCanvas {
  const pc = new PixelCanvas(length, 20);
  const ins = hex('#c9c6cf');
  for (let x = 0; x < length; x++) {
    for (const py of [3, 10]) {
      for (let i = 0; i < 6; i++) {
        let c = i === 0 ? shade(ins, 1.15) : i >= 4 ? shade(ins, 0.78) : ins;
        if (x % 8 === 0) c = shade(c, 0.88);
        pc.set(x, py + i, c);
      }
    }
    if (x % 40 === 20) {
      pc.rect(x, 2, 5, 17, hex('#a39b8e'));
      pc.rect(x, 2, 5, 1, hex('#c9c2b4'));
      pc.rect(x + 4, 2, 1, 17, hex('#7e776c'));
    }
  }
  pc.outline(0.5);
  return pc;
}

/** Five-storey panel building (хрущёвка) facade with cosy windows. */
export function drawPanelHouse(seed: number, w = 160, h = 92): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  const rng = new Rng(seed);
  const wall = hex(rng.pick(['#e2d3b3', '#d8c8a8', '#e6d9c3']));
  const roof = hex('#5a5560');
  pc.rect(0, 0, w, 7, roof);
  pc.hline(0, w - 1, 0, shade(roof, 1.3));
  pc.rect(0, 6, w, 2, shade(roof, 0.7));
  pc.rect(0, 8, w, h - 8, wall);
  // panel seams
  for (let x = 0; x < w; x += 20) pc.vline(x, 8, h - 1, shade(wall, 0.88));
  for (let y = 8; y < h; y += 18) pc.hline(0, w - 1, y, shade(wall, 0.88));
  pc.rect(0, h - 4, w, 4, shade(wall, 0.75)); // plinth

  const curtains = ['#e57a6e', '#7fb2e5', '#f2d16b', '#9fd38a', '#f1ead8', '#c79ae0'];
  const doorCol = Math.floor(w / 20 / 2);
  for (let floor = 0; floor < 4; floor++) {
    for (let col = 0; col < w / 20; col++) {
      const x = col * 20 + 5;
      const y = 12 + floor * 18;
      if (floor === 3 && col === doorCol) continue;
      const lit = rng.chance(0.35);
      const glass = lit ? hex('#ffe9a8') : hex('#7fa6c4');
      pc.rect(x - 1, y - 1, 12, 13, hex('#f6f2ea'));
      pc.rect(x, y, 10, 11, glass);
      pc.vline(x + 5, y, y + 10, hex('#f6f2ea'));
      pc.hline(x, x + 9, y + 4, hex('#f6f2ea'));
      if (!lit) {
        pc.set(x + 1, y + 1, hex('#c8e0ee'));
        pc.set(x + 2, y + 1, hex('#c8e0ee'));
        pc.set(x + 1, y + 2, hex('#c8e0ee'));
      }
      if (rng.chance(0.55)) {
        const c = hex(rng.pick(curtains));
        pc.rect(x, y, 2, 11, c);
        pc.rect(x + 8, y, 2, 11, c);
      }
      pc.hline(x - 2, x + 11, y + 12, shade(wall, 0.7)); // sill
      if (rng.chance(0.3)) {
        // flower pot on the sill
        pc.rect(x + 3, y + 9, 3, 3, hex('#c0643a'));
        pc.set(x + 4, y + 8, hex('#e0453f'));
        pc.set(x + 3, y + 8, hex('#4f8a3a'));
        pc.set(x + 5, y + 8, hex('#4f8a3a'));
      }
      if (floor < 3 && rng.chance(0.18)) {
        // balcony with laundry
        pc.rect(x - 2, y + 13, 14, 4, shade(wall, 0.82));
        pc.hline(x - 2, x + 11, y + 13, shade(wall, 1.1));
        const lc = [hex('#ff9ec4'), hex('#7fb2e5'), hex('#ffffff')];
        for (let i = 0; i < 3; i++) pc.rect(x + i * 4, y + 9, 2, 3, lc[i]);
      }
    }
  }
  // entrance (подъезд) with canopy and door
  const ex = doorCol * 20 + 3;
  const ey = h - 22;
  pc.rect(ex - 2, ey - 3, 18, 3, shade(roof, 1.1));
  pc.hline(ex - 2, ex + 15, ey - 3, shade(roof, 1.4));
  pc.rect(ex + 2, ey, 10, 18, hex('#7a4f35'));
  pc.rect(ex + 2, ey, 10, 1, hex('#9a6b4a'));
  pc.vline(ex + 7, ey, ey + 17, hex('#5a3a28'));
  pc.rect(ex + 9, ey + 8, 2, 2, hex('#c9c6cf'));
  pc.rect(ex + 13, ey + 6, 2, 3, hex('#3e3a44')); // intercom
  return pc;
}

/** The shelter's van — a cozy cream "буханка" with a paw logo. Faces right. 56x36 */
export function drawVan(): PixelCanvas {
  const pc = new PixelCanvas(56, 36);
  const body = hex('#f2ead8');
  const stripe = hex('#e8833a');
  const glass = hex('#8fb3c9');
  // body
  pc.roundRect(2, 4, 52, 24, 5, body);
  pc.rect(2, 4, 52, 2, shade(body, 1.08));
  pc.rect(2, 22, 52, 6, shade(body, 0.88));
  pc.rect(2, 16, 52, 4, stripe);
  pc.hline(2, 53, 16, shade(stripe, 1.15));
  // windows
  for (const x of [8, 20, 32]) {
    pc.rect(x, 7, 9, 7, glass);
    pc.set(x + 1, 8, hex('#d8eef7'));
    pc.set(x + 2, 8, hex('#d8eef7'));
    pc.set(x + 1, 9, hex('#d8eef7'));
  }
  // cab window
  pc.rect(44, 7, 8, 7, glass);
  pc.set(45, 8, hex('#d8eef7'));
  pc.vline(42, 6, 26, shade(body, 0.75)); // door seam
  pc.rect(38, 18, 3, 1, shade(body, 0.6)); // handle
  // paw logo on the side
  const paw = hex('#7a4f35');
  pc.ellipse(26, 23, 3, 2.2, paw);
  pc.set(22, 20, paw);
  pc.set(24, 19, paw);
  pc.set(28, 19, paw);
  pc.set(30, 20, paw);
  // headlight & bumper
  pc.rect(52, 18, 2, 3, hex('#ffe9a8'));
  pc.rect(50, 26, 6, 2, hex('#5d6670'));
  pc.rect(0, 26, 5, 2, hex('#5d6670'));
  // wheels
  for (const x of [12, 44]) {
    pc.ellipse(x, 29, 5, 5, hex('#2a262c'));
    pc.ellipse(x, 29, 2.2, 2.2, hex('#a9a9b1'));
    pc.set(x - 1, 28, hex('#d8d8de'));
  }
  // roof rack
  pc.rect(8, 2, 32, 2, hex('#5d6670'));
  pc.rect(12, 1, 10, 2, hex('#b97d45'));
  pc.outline(0.45);
  return pc;
}

export function drawFoodPile(amount: number): PixelCanvas {
  const pc = new PixelCanvas(12, 8);
  const bowl = hex('#c8d0d8');
  pc.ellipse(6, 5, 5.5, 2.6, shade(bowl, 0.8));
  pc.ellipse(6, 4.5, 5, 2, bowl);
  pc.hline(2, 9, 6, shade(bowl, 0.65));
  const kib = [hex('#9a5f32'), hex('#b97d45'), hex('#7a4a28')];
  const n = Math.round(amount * 9);
  for (let i = 0; i < n; i++) pc.set(3 + (i % 6), 3 + Math.floor(i / 6) - (i % 2), kib[i % 3]);
  pc.outline(0.45);
  return pc;
}

/** Pet carrier the player carries a caught dog in. 16x14 */
export function drawCarrier(): PixelCanvas {
  const pc = new PixelCanvas(18, 15);
  const plastic = hex('#6fa8dc');
  pc.roundRect(1, 3, 16, 11, 2, plastic);
  pc.rect(1, 3, 16, 2, shade(plastic, 1.2));
  pc.rect(1, 11, 16, 3, shade(plastic, 0.8));
  pc.rect(5, 0, 8, 2, shade(plastic, 0.7)); // handle
  pc.rect(6, 1, 6, 1, 0);
  // grid door with a peeking nose
  pc.rect(4, 6, 10, 6, hex('#2f2c35'));
  for (let x = 5; x < 14; x += 2) pc.vline(x, 6, 11, hex('#c9c6cf'));
  pc.set(8, 8, hex('#ffffff'));
  pc.set(10, 8, hex('#ffffff'));
  pc.outline(0.45);
  return pc;
}

export function drawShadow(w: number, h: number): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  pc.ellipse(w / 2, h / 2, w / 2, h / 2, hex('#1d1622', 70));
  return pc;
}

/** Wooden board fence segment (забор), 32x22 */
export function drawFence(seed: number): PixelCanvas {
  const pc = new PixelCanvas(32, 22);
  const rng = new Rng(seed);
  const wood = hex('#9a7350');
  for (let x = 0; x < 32; x += 4) {
    const h = rng.int(0, 2);
    const c = rng.chance(0.2) ? shade(wood, 0.85) : wood;
    pc.rect(x, 2 + h, 4, 19 - h, c);
    pc.vline(x, 2 + h, 20, shade(c, 1.15));
    pc.vline(x + 3, 2 + h, 20, shade(c, 0.75));
    pc.set(x + 1, 2 + h, shade(c, 1.25));
  }
  pc.hline(0, 31, 7, shade(wood, 0.6));
  pc.hline(0, 31, 16, shade(wood, 0.6));
  pc.outline(0.45);
  return pc;
}
