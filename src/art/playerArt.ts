import { hex, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const PLAYER_W = 16;
export const PLAYER_H = 24;

/** Frame layout: [down idle, down walk×4, up idle, up walk×4, side idle, side walk×4] */
export const PLAYER_FRAMES = {
  down: { idle: 0, walk: [1, 2, 3, 4] },
  up: { idle: 5, walk: [6, 7, 8, 9] },
  side: { idle: 10, walk: [11, 12, 13, 14] },
} as const;

const SKIN = hex('#f2c29b');
const HAIR = hex('#7a4a2e');
const CAP = hex('#e8833a');
const VEST = hex('#7cc576');
const SHIRT = hex('#f6f2ea');
const JEANS = hex('#4a5f8c');
const SHOE = hex('#f1ead8');
const SOLE = hex('#c0453f');
const EYE = hex('#2a1e22');
const BLUSH = hex('#f39a8f');

type Dir = 'down' | 'up' | 'side';

function drawPlayer(dir: Dir, phase: number): PixelCanvas {
  const pc = new PixelCanvas(PLAYER_W, PLAYER_H);
  // walk cycle: legs alternate, body bobs on passing frames
  const walking = phase >= 0;
  const legA = walking ? [1, 0, -1, 0][phase] : 0;
  const bob = walking && (phase === 1 || phase === 3) ? -1 : 0;
  const armSwing = walking ? [1, 0, -1, 0][phase] : 0;

  if (dir === 'side') {
    // legs (stride)
    const hipY = 17 + bob;
    pc.rect(6 + legA, hipY, 2, 22 - hipY, shade(JEANS, 0.8));
    pc.rect(8 - legA, hipY, 2, 22 - hipY, JEANS);
    pc.rect(6 + legA, 21, 3, 2, SHOE);
    pc.hline(6 + legA, 8 + legA, 22, SOLE);
    pc.rect(8 - legA, 21, 3, 2, SHOE);
    pc.hline(8 - legA, 10 - legA, 22, SOLE);
    // torso
    pc.rect(5, 10 + bob, 6, 8, VEST);
    pc.rect(5, 10 + bob, 6, 1, shade(VEST, 1.15));
    pc.rect(9, 11 + bob, 2, 6, shade(VEST, 0.82));
    pc.rect(5, 16 + bob, 6, 1, shade(JEANS, 0.9));
    // arm swinging
    pc.rect(7 + armSwing, 11 + bob, 2, 5, SHIRT);
    pc.rect(7 + armSwing, 15 + bob, 2, 1, SKIN);
    // head
    pc.ellipse(8, 6 + bob, 4.5, 4.5, SKIN);
    pc.rect(4, 2 + bob, 6, 6, HAIR);
    pc.set(10, 7 + bob, shade(SKIN, 0.85)); // ear
    pc.set(12, 6 + bob, SKIN); // nose
    pc.set(10, 6 + bob, EYE);
    pc.set(10, 5 + bob, EYE);
    pc.set(11, 8 + bob, BLUSH);
    // cap with brim forward
    pc.ellipse(8, 3 + bob, 4.6, 2.6, CAP);
    pc.hline(4, 9, 1 + bob, shade(CAP, 1.2));
    pc.rect(10, 4 + bob, 4, 1, shade(CAP, 0.8));
    pc.set(5, 6 + bob, HAIR);
    pc.set(4, 7 + bob, HAIR); // ponytail
    pc.set(3, 8 + bob, HAIR);
  } else {
    const back = dir === 'up';
    // legs
    const hipY = 17 + bob;
    const l1 = walking ? (legA > 0 ? 1 : 0) : 0;
    const l2 = walking ? (legA < 0 ? 1 : 0) : 0;
    pc.rect(5, hipY, 3, 22 - hipY - l1, JEANS);
    pc.rect(8, hipY, 3, 22 - hipY - l2, shade(JEANS, 0.9));
    pc.rect(5, 21 - l1, 3, 2, SHOE);
    pc.hline(5, 7, 22 - l1, SOLE);
    pc.rect(8, 21 - l2, 3, 2, SHOE);
    pc.hline(8, 10, 22 - l2, SOLE);
    // torso
    pc.rect(4, 10 + bob, 8, 8, VEST);
    pc.rect(4, 10 + bob, 8, 1, shade(VEST, 1.15));
    pc.rect(4, 17 + bob, 8, 1, shade(VEST, 0.8));
    if (!back) {
      pc.rect(7, 10 + bob, 2, 5, SHIRT); // shirt between vest halves
      pc.set(5, 13 + bob, shade(VEST, 0.8)); // pocket
      pc.set(6, 13 + bob, shade(VEST, 0.8));
    } else {
      // paw logo on the back of the vest
      const paw = hex('#f6f2ea');
      pc.rect(7, 13 + bob, 2, 2, paw);
      pc.set(6, 12 + bob, paw);
      pc.set(9, 12 + bob, paw);
      pc.set(7, 11 + bob, paw);
      pc.set(8, 11 + bob, paw);
    }
    // arms
    pc.rect(2, 11 + bob + armSwing, 2, 5, SHIRT);
    pc.rect(12, 11 + bob - armSwing, 2, 5, SHIRT);
    pc.set(2, 16 + bob + armSwing, SKIN);
    pc.set(3, 16 + bob + armSwing, SKIN);
    pc.set(12, 16 + bob - armSwing, SKIN);
    pc.set(13, 16 + bob - armSwing, SKIN);
    // head
    pc.ellipse(8, 6 + bob, 4.6, 4.6, SKIN);
    if (back) {
      pc.ellipse(8, 6 + bob, 4.6, 4.4, HAIR);
      pc.rect(7, 9 + bob, 2, 2, HAIR); // ponytail
      pc.ellipse(8, 3 + bob, 4.8, 2.8, CAP);
      pc.hline(6, 9, 5 + bob, shade(CAP, 0.7)); // strap
    } else {
      pc.rect(4, 3 + bob, 1, 5, HAIR);
      pc.rect(11, 3 + bob, 1, 5, HAIR);
      pc.set(6, 7 + bob, EYE);
      pc.set(6, 6 + bob, EYE);
      pc.set(10, 7 + bob, EYE);
      pc.set(10, 6 + bob, EYE);
      pc.set(5, 8 + bob, BLUSH);
      pc.set(11, 8 + bob, BLUSH);
      pc.set(8, 8 + bob, shade(SKIN, 0.8));
      pc.ellipse(8, 3 + bob, 4.8, 2.8, CAP);
      pc.hline(4, 11, 5 + bob, shade(CAP, 0.75)); // brim
      pc.hline(5, 10, 1 + bob, shade(CAP, 1.2));
      pc.set(8, 3 + bob, hex('#f6f2ea')); // badge
    }
  }
  pc.outline(0.4);
  return pc;
}

export function drawPlayerSheet(): PixelCanvas {
  const sheet = new PixelCanvas(PLAYER_W * 15, PLAYER_H);
  const dirs: Dir[] = ['down', 'up', 'side'];
  dirs.forEach((d, di) => {
    for (let f = 0; f < 5; f++) sheet.blit(drawPlayer(d, f - 1), (di * 5 + f) * PLAYER_W, 0);
  });
  return sheet;
}
