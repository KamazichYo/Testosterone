import { Color, hex, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

const O = hex('#3b2a2a');

const ICONS: Record<string, { rows: string[]; pal: Record<string, Color> }> = {
  coin: {
    rows: ['..OOOO..', '.OyyyyO.', 'OyYYyyyO', 'OyYyyy#O', 'OyYyyy#O', 'Oyyyy##O', '.Oy###O.', '..OOOO..'],
    pal: { O, y: hex('#ffd23f'), Y: hex('#fff3b0'), '#': hex('#d99a1f') },
  },
  food: {
    // bag of kibble
    rows: ['.OOOOOO.', 'OwwwwwwO', '.OrrrrO.', 'OrrkkrrO', 'OrkkkkrO', 'OrrkkrrO', 'OrrrrrRO', '.OOOOOO.'],
    pal: { O, w: hex('#f1ead8'), r: hex('#e8833a'), R: hex('#b85f22'), k: hex('#7a4a28') },
  },
  paw: {
    rows: ['.O.O.O..', 'OpOpOpO.', '.O.O.O..', '..OOO...', '.OpppO..', 'OpppppO.', 'OpppppO.', '.OOOOO..'],
    pal: { O, p: hex('#f6d9ad') },
  },
  heart: {
    rows: ['.OO.OO.', 'OrrOrrO', 'OrWrrrO', 'OrrrrrO', '.OrrrO.', '..OrO..', '...O...'],
    pal: { O, r: hex('#ff6b81'), W: hex('#ffd1da') },
  },
  angry: {
    rows: ['.rr..rr.', 'r.r..r.r', '.rr..rr.', '........', '.rr..rr.', 'r.r..r.r', '.rr..rr.'],
    pal: { r: hex('#ff4d4d') },
  },
  sweat: {
    rows: ['..O..', '.ObO.', 'ObWbO', 'ObbbO', '.OOO.'],
    pal: { O: hex('#2d5f8a'), b: hex('#7fc4ff'), W: hex('#e6f6ff') },
  },
  zzz: {
    rows: ['....wwww', '......w.', '.....w..', 'www.wwww', '..w.....', '.w......', 'www.....'],
    pal: { w: hex('#f1ead8') },
  },
  bone: {
    rows: ['OO....OO', 'OwO..OwO', '.OwwwwO.', '.OwwwwO.', 'OwO..OwO', 'OO....OO'],
    pal: { O, w: hex('#f1ead8') },
  },
  hand: {
    rows: ['..O.O...', '.OsOsOO.', '.OsOsOsO', 'OOsssssO', 'OssssssO', '.OsssssO', '..OsssO.', '..OOOO..'],
    pal: { O, s: hex('#f2c29b') },
  },
  van: {
    rows: ['.OOOOOOO..', 'OwbwbwwwO.', 'OwbwbwwbwO', 'OrrrrrrrrO', 'OwwwwwwwwO', '.OkO..OkO.', '..O....O..'],
    pal: { O, w: hex('#f2ead8'), b: hex('#8fb3c9'), r: hex('#e8833a'), k: hex('#2a262c') },
  },
  star: {
    rows: ['...O...', '..OyO..', 'OOOyOOO', 'OyyyyyO', '.OyyyO.', 'OyOOOyO', 'OO...OO'],
    pal: { O, y: hex('#ffd23f') },
  },
  bang: {
    rows: ['OyO', 'OyO', 'OyO', 'OyO', '.O.', 'OyO', '.O.'],
    pal: { O, y: hex('#ffd23f') },
  },
  sound: {
    rows: ['...O....', '..OwO.O.', 'OOwwO..O', 'OwwwO.O.', 'OOwwO..O', '..OwO.O.', '...O....'],
    pal: { O, w: hex('#f1ead8') },
  },
  mute: {
    rows: ['...O....', '..OwO...', 'OOwwOO.O', 'OwwwO.O.', 'OOwwOO.O', '..OwO...', '...O....'],
    pal: { O, w: hex('#f1ead8') },
  },
  check: {
    rows: ['.....OO', '....OgO', 'OO.OgO.', 'OgOgO..', '.OgO...', '..O....'],
    pal: { O, g: hex('#7cc576') },
  },
  drop: {
    rows: ['...O...', '..ObO..', '.ObbbO.', 'ObWbbbO', 'ObWbbbO', 'ObbbbbO', '.ObbbO.', '..OOO..'],
    pal: { O, b: hex('#7fc4ff'), W: hex('#e6f6ff') },
  },
  cross: {
    rows: ['..OOO..', '..OgO..', 'OOOgOOO', 'OgggggO', 'OOOgOOO', '..OgO..', '..OOO..'],
    pal: { O, g: hex('#7cc576') },
  },
  house: {
    rows: ['...OO...', '..OrrO..', '.OrrrrO.', 'OrrrrrrO', '.OwwwwO.', '.OwOOwO.', '.OwOOwO.', '.OOOOOO.'],
    pal: { O, r: hex('#e0604a'), w: hex('#f4e4c1') },
  },
  talk: {
    rows: ['.OOOOOO.', 'OwwwwwwO', 'OwOwOwwO', 'OwwwwwwO', '.OOwOOO.', '..OO....'],
    pal: { O, w: hex('#fff6e0') },
  },
  tag: {
    rows: ['.OOOO.', 'OyyWyO', 'OyyyyO', 'OyOOyO', 'OyyyyO', '.OOOO.'],
    pal: { O, y: hex('#ffd23f'), W: hex('#fff3b0') },
  },
};

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function drawIcon(name: IconName): PixelCanvas {
  const { rows, pal } = ICONS[name];
  const w = Math.max(...rows.map((r) => r.length));
  const pc = new PixelCanvas(w, rows.length);
  pc.stamp(rows, pal);
  return pc;
}

/** 9-slice panel: cream paper with a dark rounded border and a soft drop shadow. 12x12, slice 4. */
export function drawPanel(fill = hex('#f4e4c1')): PixelCanvas {
  const pc = new PixelCanvas(12, 12);
  pc.roundRect(0, 1, 12, 11, 3, shade(O, 1));
  pc.roundRect(0, 0, 12, 11, 3, O);
  pc.roundRect(1, 1, 10, 9, 2, fill);
  pc.hline(2, 9, 1, shade(fill, 1.1));
  pc.hline(2, 9, 9, shade(fill, 0.85));
  return pc;
}

/** Round button face. 28x28 */
export function drawRoundButton(fill: Color): PixelCanvas {
  const pc = new PixelCanvas(28, 30);
  pc.ellipse(14, 16, 14, 14, shade(fill, 0.55));
  pc.ellipse(14, 14, 14, 14, O);
  pc.ellipse(14, 14, 12.6, 12.6, (nx, ny) => (ny > 0.5 ? shade(fill, 0.82) : ny < -0.55 && nx < 0.3 ? shade(fill, 1.2) : fill));
  return pc;
}

export function drawJoystickBase(): PixelCanvas {
  const pc = new PixelCanvas(40, 40);
  pc.ellipse(20, 20, 20, 20, hex('#2b2433', 120));
  pc.ellipse(20, 20, 18, 18, hex('#f4e4c1', 50));
  pc.ellipse(20, 20, 16, 16, hex('#2b2433', 60));
  return pc;
}

export function drawJoystickKnob(): PixelCanvas {
  const pc = new PixelCanvas(18, 18);
  pc.ellipse(9, 9, 9, 9, O);
  pc.ellipse(9, 9, 7.6, 7.6, (nx, ny) => (ny < -0.4 && nx < 0.2 ? hex('#fff6e0') : ny > 0.4 ? hex('#d9c49a') : hex('#f4e4c1')));
  return pc;
}

/** A small sparkle used for success effects. */
export function drawSparkle(): PixelCanvas {
  const pc = new PixelCanvas(7, 7);
  const c = hex('#fff3b0');
  pc.vline(3, 0, 6, c);
  pc.hline(0, 6, 3, c);
  pc.set(3, 3, hex('#ffffff'));
  return pc;
}

export function drawKibble(): PixelCanvas {
  const pc = new PixelCanvas(4, 4);
  pc.ellipse(2, 2, 2, 1.6, hex('#9a5f32'));
  pc.set(1, 1, hex('#c98a55'));
  return pc;
}
