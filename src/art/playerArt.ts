import { drawHuman, HUMAN_H, HUMAN_W, HumanLook, HumanPose } from './humanArt';
import { PixelCanvas } from './PixelCanvas';

export const PLAYER_W = HUMAN_W;
export const PLAYER_H = HUMAN_H;

type Dir = 'down' | 'up' | 'side';

/** The hero: a shelter volunteer in a green vest and an orange cap. */
export const HERO_LOOK: HumanLook = {
  skin: '#f2c29b',
  hair: '#7a4a2e',
  hairStyle: 'ponytail',
  hat: { kind: 'cap', color: '#e8833a' },
  top: '#f6f2ea',
  topStyle: 'vest',
  accent: '#7cc576',
  bottom: '#4a5f8c',
  bottomStyle: 'pants',
  shoes: '#ece4d4',
};

/**
 * Per direction 13 frames: idle×2 (breathing), walk×4, throw, carry idle, carry walk×4, crouch.
 * Directions are laid out one after another: down, up, side.
 */
const PER_DIR = 13;
const DIR_INDEX: Record<Dir, number> = { down: 0, up: 1, side: 2 };
export const PLAYER_FRAMES = (dir: Dir) => {
  const o = DIR_INDEX[dir] * PER_DIR;
  return {
    idle: [o, o + 1],
    walk: [o + 2, o + 3, o + 4, o + 5],
    throw: [o + 6],
    carryIdle: [o + 7],
    carryWalk: [o + 8, o + 9, o + 10, o + 11],
    crouch: [o + 12],
  };
};

export function drawPlayerSheet(look: HumanLook = HERO_LOOK): PixelCanvas {
  const dirs: Dir[] = ['down', 'up', 'side'];
  const sheet = new PixelCanvas(PLAYER_W * PER_DIR * dirs.length, PLAYER_H);
  dirs.forEach((dir, di) => {
    const pose = (p: Partial<HumanPose>): PixelCanvas => drawHuman(look, { dir, step: -1, arms: 'swing', ...p });
    const frames = [
      pose({}),
      pose({ breathe: -0.6 }),
      ...[0, 1, 2, 3].map((step) => pose({ step })),
      pose({ arms: 'throw' }),
      pose({ arms: 'up' }),
      ...[0, 1, 2, 3].map((step) => pose({ step, arms: 'up' })),
      pose({ arms: 'crouch', crouch: true }),
    ];
    frames.forEach((f, i) => sheet.blit(f, (di * PER_DIR + i) * PLAYER_W, 0));
  });
  return sheet;
}
