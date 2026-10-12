import type { PropKind, PropPlacement } from '../data/garages';
import type { PixelCanvas } from './PixelCanvas';
import {
  drawBench,
  drawBirch,
  drawBush,
  drawContainer,
  drawFence,
  drawGarage,
  drawLamp,
  drawPanelHouse,
  drawPipeV,
  drawTires,
  drawTree,
} from './props';

export function drawProp(p: PropPlacement): PixelCanvas {
  const v = p.variant ?? 0;
  switch (p.kind) {
    case 'garage':
      return drawGarage(v, p.length ?? 1);
    case 'tree':
      return drawTree(v, 0.1);
    case 'treeAutumn':
      return drawTree(v, 0.7);
    case 'birch':
      return drawBirch(v);
    case 'bush':
      return drawBush(v);
    case 'bushBerry':
      return drawBush(v, true);
    case 'tires':
      return drawTires();
    case 'tiresPainted':
      return drawTires(true);
    case 'container':
      return drawContainer(v);
    case 'bench':
      return drawBench();
    case 'lamp':
      return drawLamp();
    case 'house':
      return drawPanelHouse(v);
    case 'pipeV':
      return drawPipeV(p.length ?? 64);
    case 'fence':
      return drawFence(v);
  }
}

/** Texture cache key: props with identical looks share one texture. */
export function propKey(p: PropPlacement): string {
  return `prop_${p.kind}_${p.variant ?? 0}_${p.length ?? 0}`;
}

/** Collision footprint (w×h) anchored at the bottom-centre of the sprite. Null = walk-through. */
export const PROP_COLLIDER: Record<PropKind, { w: number; h: number } | null> = {
  garage: { w: 32, h: 30 },
  tree: { w: 8, h: 5 },
  treeAutumn: { w: 8, h: 5 },
  birch: { w: 6, h: 4 },
  bush: { w: 18, h: 6 },
  bushBerry: { w: 18, h: 6 },
  tires: { w: 16, h: 8 },
  tiresPainted: { w: 16, h: 6 },
  container: { w: 22, h: 10 },
  bench: { w: 28, h: 5 },
  lamp: { w: 4, h: 3 },
  house: { w: 160, h: 40 },
  pipeV: { w: 18, h: 0 },
  fence: { w: 32, h: 6 },
};
