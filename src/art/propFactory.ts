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
import {
  drawBathStation,
  drawBoard,
  drawCar,
  drawCarpetRack,
  drawKennel,
  drawKitchenStation,
  drawLaundry,
  drawOpenGarage,
  drawPicketH,
  drawPicketV,
  drawPullupBar,
  drawSandbox,
  drawShelterHouse,
  drawSignPost,
  drawSwing,
  drawTagStation,
  drawVetStation,
} from './props2';

export type PropKind =
  | 'garage'
  | 'garageOpen'
  | 'tree'
  | 'treeAutumn'
  | 'birch'
  | 'bush'
  | 'bushBerry'
  | 'tires'
  | 'tiresPainted'
  | 'container'
  | 'bench'
  | 'lamp'
  | 'house'
  | 'pipeV'
  | 'fence'
  | 'car'
  | 'swing'
  | 'sandbox'
  | 'carpetRack'
  | 'laundry'
  | 'pullup'
  | 'shelterHouse'
  | 'kennel'
  | 'bath'
  | 'kitchen'
  | 'vet'
  | 'tagDesk'
  | 'board'
  | 'picketH'
  | 'picketV'
  | 'signpost';

export interface PropPlacement {
  kind: PropKind;
  /** bottom-centre in world pixels */
  x: number;
  y: number;
  variant?: number;
  length?: number;
  flip?: boolean;
}

interface PropSpec {
  draw?: (p: PropPlacement) => PixelCanvas;
  /** animated props: all frames, played in a loop */
  frames?: (p: PropPlacement) => PixelCanvas[];
  frameRate?: number;
  /** collision footprint anchored at the bottom-centre; null = walk-through */
  collider: ((p: PropPlacement) => { w: number; h: number } | null) | { w: number; h: number } | null;
  /** soft contact shadow under the prop */
  shadow?: { w: number; h: number };
  /** rows above this y (from the sprite top) sway in the wind */
  sway?: number;
}

const v = (p: PropPlacement) => p.variant ?? 0;

export const PROPS: Record<PropKind, PropSpec> = {
  garage: { draw: (p) => drawGarage(v(p), p.length ?? 1), collider: { w: 32, h: 30 } },
  garageOpen: { draw: () => drawOpenGarage(), collider: { w: 32, h: 26 } },
  tree: { draw: (p) => drawTree(v(p), 0.1), collider: { w: 8, h: 5 }, shadow: { w: 34, h: 9 }, sway: 31 },
  treeAutumn: { draw: (p) => drawTree(v(p), 0.7), collider: { w: 8, h: 5 }, shadow: { w: 34, h: 9 }, sway: 31 },
  birch: { draw: (p) => drawBirch(v(p)), collider: { w: 6, h: 4 }, shadow: { w: 24, h: 7 }, sway: 27 },
  bush: { draw: (p) => drawBush(v(p)), collider: { w: 18, h: 6 }, shadow: { w: 24, h: 6 } },
  bushBerry: { draw: (p) => drawBush(v(p), true), collider: { w: 18, h: 6 }, shadow: { w: 24, h: 6 } },
  tires: { draw: () => drawTires(), collider: { w: 16, h: 8 }, shadow: { w: 20, h: 6 } },
  tiresPainted: { draw: () => drawTires(true), collider: { w: 16, h: 6 } },
  container: { draw: (p) => drawContainer(v(p)), collider: { w: 22, h: 10 }, shadow: { w: 26, h: 6 } },
  bench: { draw: () => drawBench(), collider: { w: 28, h: 5 }, shadow: { w: 30, h: 5 } },
  lamp: { draw: () => drawLamp(), collider: { w: 4, h: 3 }, shadow: { w: 10, h: 4 } },
  house: { draw: (p) => drawPanelHouse(v(p)), collider: { w: 160, h: 40 } },
  pipeV: { draw: (p) => drawPipeV(p.length ?? 64), collider: (p) => ({ w: 18, h: (p.length ?? 64) - 6 }) },
  fence: { draw: (p) => drawFence(v(p)), collider: { w: 32, h: 6 } },
  car: { draw: (p) => drawCar(v(p)), collider: { w: 42, h: 10 }, shadow: { w: 46, h: 8 } },
  swing: { frames: () => [0, 1, 2, 3].map((f) => drawSwing(f)), frameRate: 2.2, collider: { w: 30, h: 4 } },
  sandbox: { draw: () => drawSandbox(), collider: { w: 32, h: 14 } },
  carpetRack: { draw: () => drawCarpetRack(), collider: { w: 34, h: 4 }, shadow: { w: 36, h: 6 } },
  laundry: { frames: () => [drawLaundry(0), drawLaundry(1)], frameRate: 1.6, collider: { w: 44, h: 3 } },
  pullup: { draw: () => drawPullupBar(), collider: { w: 22, h: 3 } },
  shelterHouse: { draw: () => drawShelterHouse(), collider: { w: 144, h: 44 } },
  kennel: { draw: (p) => drawKennel(v(p)), collider: { w: 22, h: 10 }, shadow: { w: 26, h: 6 } },
  bath: { draw: () => drawBathStation(), collider: { w: 32, h: 8 }, shadow: { w: 36, h: 6 } },
  kitchen: { draw: () => drawKitchenStation(), collider: { w: 34, h: 8 } },
  vet: { draw: () => drawVetStation(), collider: { w: 34, h: 8 }, shadow: { w: 36, h: 6 } },
  tagDesk: { draw: () => drawTagStation(), collider: { w: 28, h: 6 }, shadow: { w: 30, h: 6 } },
  board: { draw: () => drawBoard(), collider: { w: 24, h: 4 }, shadow: { w: 26, h: 5 } },
  picketH: { draw: () => drawPicketH(), collider: { w: 16, h: 4 } },
  picketV: { draw: () => drawPicketV(), collider: { w: 4, h: 18 } },
  signpost: { draw: () => drawSignPost(), collider: { w: 3, h: 3 } },
};

export function propCollider(p: PropPlacement): { w: number; h: number } | null {
  const c = PROPS[p.kind].collider;
  return typeof c === 'function' ? c(p) : c;
}

/** Texture cache key: props with identical looks share one texture. */
export function propKey(p: PropPlacement): string {
  return `prop_${p.kind}_${p.variant ?? 0}_${p.length ?? 0}`;
}

/** Static art for a prop (first frame for animated ones). */
export function drawProp(p: PropPlacement): PixelCanvas {
  const spec = PROPS[p.kind];
  return spec.draw ? spec.draw(p) : spec.frames!(p)[0];
}
