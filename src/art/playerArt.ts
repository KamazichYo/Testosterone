import { hex, shade } from './color';
import { PixelCanvas } from './PixelCanvas';

export const PLAYER_W = 16;
export const PLAYER_H = 24;

type Dir = 'down' | 'up' | 'side';
type Arms = 'swing' | 'up' | 'throw';

/**
 * Per direction 12 frames: idle×2 (breathing), walk×4, throw, carry idle, carry walk×4.
 * Directions are laid out one after another: down, up, side.
 */
const PER_DIR = 12;
const DIR_INDEX: Record<Dir, number> = { down: 0, up: 1, side: 2 };
export const PLAYER_FRAMES = (dir: Dir) => {
  const o = DIR_INDEX[dir] * PER_DIR;
  return {
    idle: [o, o + 1],
    walk: [o + 2, o + 3, o + 4, o + 5],
    throw: [o + 6],
    carryIdle: [o + 7],
    carryWalk: [o + 8, o + 9, o + 10, o + 11],
  };
};

const SKIN = hex('#f2c29b');
const HAIR = hex('#7a4a2e');
const CAP = hex('#e8833a');
const VEST = hex('#7cc576');
const STRIPE = hex('#f4f1c8');
const SHIRT = hex('#f6f2ea');
const JEANS = hex('#4a5f8c');
const SHOE = hex('#f1ead8');
const SOLE = hex('#c0453f');
const EYE = hex('#2a1e22');
const BLUSH = hex('#f39a8f');

function drawPlayer(dir: Dir, phase: number, arms: Arms, breathe: number): PixelCanvas {
  const pc = new PixelCanvas(PLAYER_W, PLAYER_H);
  const walking = phase >= 0;
  const legA = walking ? [1, 0, -1, 0][phase] : 0;
  const bob = (walking && (phase === 1 || phase === 3) ? -1 : 0) + breathe;
  const swing = walking && arms === 'swing' ? [1, 0, -1, 0][phase] : 0;
  const headBob = walking ? bob : 0; // the head stays put while breathing, only the chest rises

  const legs = (back: boolean) => {
    const hipY = 17 + (walking ? bob : 0);
    if (dir === 'side') {
      pc.rect(6 + legA, hipY, 2, 22 - hipY, shade(JEANS, 0.8));
      pc.rect(8 - legA, hipY, 2, 22 - hipY, JEANS);
      pc.rect(6 + legA, 21, 3, 2, SHOE);
      pc.hline(6 + legA, 8 + legA, 22, SOLE);
      pc.rect(8 - legA, 21, 3, 2, SHOE);
      pc.hline(8 - legA, 10 - legA, 22, SOLE);
      pc.set(9 - legA, 21, shade(SHOE, 0.8)); // lace
      return;
    }
    const l1 = walking && legA > 0 ? 1 : 0;
    const l2 = walking && legA < 0 ? 1 : 0;
    pc.rect(5, hipY, 3, 22 - hipY - l1, JEANS);
    pc.rect(8, hipY, 3, 22 - hipY - l2, shade(JEANS, 0.9));
    pc.vline(7, hipY + 1, 20 - l1, shade(JEANS, 0.8));
    pc.rect(5, 21 - l1, 3, 2, SHOE);
    pc.hline(5, 7, 22 - l1, SOLE);
    pc.rect(8, 21 - l2, 3, 2, SHOE);
    pc.hline(8, 10, 22 - l2, SOLE);
    if (!back) {
      pc.set(6, 21 - l1, shade(SHOE, 0.8));
      pc.set(9, 21 - l2, shade(SHOE, 0.8));
    }
  };

  const torso = (back: boolean) => {
    const y = 10 + bob;
    if (dir === 'side') {
      pc.rect(5, y, 6, 8, VEST);
      pc.rect(5, y, 6, 1, shade(VEST, 1.15));
      pc.rect(9, y + 1, 2, 6, shade(VEST, 0.82));
      pc.hline(5, 10, y + 5, STRIPE);
      pc.rect(5, y + 6, 6, 1, shade(JEANS, 0.9));
      return;
    }
    pc.rect(4, y, 8, 8, VEST);
    pc.rect(4, y, 8, 1, shade(VEST, 1.15));
    pc.rect(4, y + 7, 8, 1, shade(VEST, 0.8));
    pc.hline(4, 11, y + 5, STRIPE); // reflective stripe
    if (!back) {
      pc.rect(7, y, 2, 5, SHIRT);
      pc.set(5, y + 3, shade(VEST, 0.8));
      pc.set(6, y + 3, shade(VEST, 0.8));
    } else {
      const paw = SHIRT;
      pc.rect(7, y + 2, 2, 2, paw);
      pc.set(6, y + 1, paw);
      pc.set(9, y + 1, paw);
      pc.set(7, y, paw);
      pc.set(8, y, paw);
    }
  };

  const armsDraw = () => {
    const y = 11 + bob;
    if (arms === 'up') {
      // holding the carrier above the head
      if (dir === 'side') {
        pc.rect(7, y - 6, 2, 7, SHIRT);
        pc.rect(7, y - 7, 2, 1, SKIN);
      } else {
        pc.rect(2, y - 6, 2, 7, SHIRT);
        pc.rect(12, y - 6, 2, 7, SHIRT);
        pc.rect(2, y - 7, 2, 1, SKIN);
        pc.rect(12, y - 7, 2, 1, SKIN);
      }
      return;
    }
    if (arms === 'throw') {
      if (dir === 'side') {
        pc.line(8, y, 12, y - 4, SHIRT);
        pc.line(8, y + 1, 12, y - 3, SHIRT);
        pc.set(13, y - 5, SKIN);
      } else {
        pc.rect(12, y - 5, 2, 6, SHIRT);
        pc.rect(12, y - 6, 2, 1, SKIN);
        pc.rect(2, y, 2, 5, SHIRT);
        pc.set(2, y + 5, SKIN);
      }
      return;
    }
    if (dir === 'side') {
      pc.rect(7 + swing, y, 2, 5, SHIRT);
      pc.rect(7 + swing, y + 4, 2, 1, SKIN);
      return;
    }
    pc.rect(2, y + swing, 2, 5, SHIRT);
    pc.rect(12, y - swing, 2, 5, SHIRT);
    pc.hline(2, 3, y + 5 + swing, SKIN);
    pc.hline(12, 13, y + 5 - swing, SKIN);
  };

  const head = () => {
    const hy = headBob;
    if (dir === 'side') {
      pc.ellipse(8, 6 + hy, 4.5, 4.5, SKIN);
      pc.rect(4, 2 + hy, 6, 6, HAIR);
      pc.set(5, 3 + hy, shade(HAIR, 1.25));
      pc.set(10, 7 + hy, shade(SKIN, 0.85));
      pc.set(12, 6 + hy, SKIN);
      pc.set(10, 6 + hy, EYE);
      pc.set(10, 5 + hy, EYE);
      pc.set(11, 8 + hy, BLUSH);
      pc.ellipse(8, 3 + hy, 4.6, 2.6, CAP);
      pc.hline(4, 9, 1 + hy, shade(CAP, 1.2));
      pc.rect(10, 4 + hy, 4, 1, shade(CAP, 0.8));
      pc.set(5, 6 + hy, HAIR);
      pc.set(4, 7 + hy, HAIR);
      pc.set(3, 8 + hy, HAIR);
      pc.set(3, 9 + hy, shade(HAIR, 0.85));
      return;
    }
    pc.ellipse(8, 6 + hy, 4.6, 4.6, SKIN);
    if (dir === 'up') {
      pc.ellipse(8, 6 + hy, 4.6, 4.4, HAIR);
      pc.set(6, 5 + hy, shade(HAIR, 1.2));
      pc.rect(7, 9 + hy, 2, 3, HAIR);
      pc.set(7, 11 + hy, shade(HAIR, 0.85));
      pc.ellipse(8, 3 + hy, 4.8, 2.8, CAP);
      pc.hline(6, 9, 5 + hy, shade(CAP, 0.7));
      return;
    }
    pc.rect(4, 3 + hy, 1, 5, HAIR);
    pc.rect(11, 3 + hy, 1, 5, HAIR);
    pc.set(6, 7 + hy, EYE);
    pc.set(6, 6 + hy, EYE);
    pc.set(10, 7 + hy, EYE);
    pc.set(10, 6 + hy, EYE);
    pc.set(6, 6 + hy, shade(EYE, 2.5)); // eye shine
    pc.set(10, 6 + hy, shade(EYE, 2.5));
    pc.set(5, 8 + hy, BLUSH);
    pc.set(11, 8 + hy, BLUSH);
    pc.hline(7, 9, 9 + hy, shade(SKIN, 0.78)); // smile
    pc.ellipse(8, 3 + hy, 4.8, 2.8, CAP);
    pc.hline(4, 11, 5 + hy, shade(CAP, 0.75));
    pc.hline(5, 10, 1 + hy, shade(CAP, 1.2));
    pc.set(8, 3 + hy, SHIRT);
  };

  const back = dir === 'up';
  legs(back);
  if (back && arms !== 'up') armsDraw();
  torso(back);
  if (!back || arms === 'up') armsDraw();
  head();
  if (arms === 'up' && dir !== 'side') {
    // arms in front of the head when lifting
    pc.rect(2, 4 + bob, 2, 3, SHIRT);
    pc.rect(12, 4 + bob, 2, 3, SHIRT);
  }
  pc.outline(0.4);
  return pc;
}

export function drawPlayerSheet(): PixelCanvas {
  const dirs: Dir[] = ['down', 'up', 'side'];
  const sheet = new PixelCanvas(PLAYER_W * PER_DIR * dirs.length, PLAYER_H);
  dirs.forEach((d, di) => {
    const frames: PixelCanvas[] = [
      drawPlayer(d, -1, 'swing', 0),
      drawPlayer(d, -1, 'swing', -1),
      ...[0, 1, 2, 3].map((p) => drawPlayer(d, p, 'swing', 0)),
      drawPlayer(d, -1, 'throw', 0),
      drawPlayer(d, -1, 'up', 0),
      ...[0, 1, 2, 3].map((p) => drawPlayer(d, p, 'up', 0)),
    ];
    frames.forEach((f, i) => sheet.blit(f, (di * PER_DIR + i) * PLAYER_W, 0));
  });
  return sheet;
}
