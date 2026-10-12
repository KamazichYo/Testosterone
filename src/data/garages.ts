import { Decal, GroundGrid, TILE } from '../art/ground';
import type { DistrictDogConfig } from '../dogs/generator';

export type PropKind =
  | 'garage'
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
  | 'fence';

export interface PropPlacement {
  kind: PropKind;
  /** bottom-centre in world pixels */
  x: number;
  y: number;
  variant?: number;
  length?: number;
}

export interface DistrictDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  ground: GroundGrid;
  decals: Decal[];
  props: PropPlacement[];
  dogs: DistrictDogConfig;
  van: { x: number; y: number };
  playerStart: { x: number; y: number };
}

const T = TILE;

/** «Гаражи» — the tutorial district: a garage cooperative between panel houses and a wasteland. */
export function garagesDistrict(): DistrictDef {
  const cols = 32;
  const rows = 48;
  const g = new GroundGrid(cols, rows);

  // street along the houses
  g.paint('s', 0, 6, cols, 1).paint('a', 0, 7, cols, 3).paint('s', 0, 10, cols, 1);
  // entrance into the cooperative
  g.paint('a', 16, 11, 4, 2);
  // garage cooperative
  g.paint('a', 6, 13, 26, 21);
  // wasteland dirt patches
  g.paint('d', 1, 20, 3, 4).paint('d', 0, 30, 4, 3).paint('d', 2, 38, 3, 2);
  // path from the cooperative down to the yard
  g.paint('d', 16, 34, 4, 5);
  // van parking
  g.paint('a', 12, 39, 10, 6);
  // container site
  g.paint('s', 24, 36, 6, 5);
  // concrete footpath in the yard
  g.paint('s', 8, 34, 2, 13).paint('s', 0, 45, 10, 2);
  // trampled dirt around the containers
  g.paint('d', 22, 41, 9, 2);

  const props: PropPlacement[] = [];
  // panel houses
  props.push({ kind: 'house', x: 7 * T + 8, y: 6 * T, variant: 1 });
  props.push({ kind: 'house', x: 24 * T, y: 6 * T, variant: 2 });
  // lamps on the sidewalk
  for (const x of [3, 11, 21, 29]) props.push({ kind: 'lamp', x: x * T, y: 11 * T - 2 });

  // garage rows
  let num = 1;
  const garageRow = (fromCol: number, toCol: number, topRow: number) => {
    for (let c = fromCol; c <= toCol; c += 2) {
      props.push({ kind: 'garage', x: c * T + T, y: topRow * T + 40, variant: (num * 3 + c) % 7, length: num });
      num++;
    }
  };
  garageRow(6, 14, 13);
  garageRow(20, 30, 13);
  garageRow(8, 28, 20);
  garageRow(6, 14, 27);
  garageRow(20, 28, 27);

  // greenery along the street
  props.push({ kind: 'tree', x: 2 * T, y: 13 * T, variant: 1 });
  props.push({ kind: 'bush', x: 7 * T, y: 12 * T + 8, variant: 2 });
  props.push({ kind: 'bushBerry', x: 12 * T, y: 12 * T + 8, variant: 3 });
  props.push({ kind: 'birch', x: 23 * T, y: 12 * T + 12, variant: 4 });
  props.push({ kind: 'bush', x: 27 * T, y: 12 * T + 8, variant: 5 });

  // wasteland with the heating main
  props.push({ kind: 'pipeV', x: 3 * T, y: 33 * T, length: 18 * T });
  props.push({ kind: 'treeAutumn', x: 1 * T, y: 18 * T, variant: 6 });
  props.push({ kind: 'tires', x: 5 * T, y: 25 * T, variant: 0 });
  props.push({ kind: 'bush', x: 1 * T, y: 27 * T, variant: 7 });
  props.push({ kind: 'tree', x: 5 * T, y: 37 * T, variant: 8 });
  props.push({ kind: 'bushBerry', x: 1 * T, y: 41 * T, variant: 9 });

  // yard
  props.push({ kind: 'bench', x: 5 * T, y: 40 * T, variant: 0 });
  props.push({ kind: 'tiresPainted', x: 3 * T, y: 42 * T + 4, variant: 0 });
  props.push({ kind: 'tiresPainted', x: 6 * T + 8, y: 42 * T + 4, variant: 0 });
  props.push({ kind: 'birch', x: 11 * T, y: 37 * T, variant: 10 });
  props.push({ kind: 'birch', x: 13 * T, y: 36 * T, variant: 11 });
  props.push({ kind: 'treeAutumn', x: 23 * T, y: 46 * T, variant: 12 });
  props.push({ kind: 'bench', x: 14 * T, y: 47 * T - 4, variant: 0 });
  props.push({ kind: 'tree', x: 30 * T, y: 36 * T, variant: 13 });
  props.push({ kind: 'bush', x: 30 * T, y: 45 * T, variant: 14 });

  // container site
  for (const x of [25, 26.6, 28.2]) props.push({ kind: 'container', x: x * T, y: 38 * T, variant: Math.round(x) });
  props.push({ kind: 'tires', x: 29 * T + 6, y: 40 * T + 8, variant: 1 });

  // fence along the bottom with a gap for the path
  for (let c = 0; c < cols; c += 2) {
    if (c >= 16 && c < 20) continue;
    props.push({ kind: 'fence', x: c * T + T, y: rows * T, variant: c });
  }

  const decals: Decal[] = [
    { kind: 'puddle', x: 12 * T, y: 17 * T, w: 18, h: 7 },
    { kind: 'puddle', x: 27 * T, y: 18 * T + 6, w: 12, h: 5 },
    { kind: 'puddle', x: 18 * T, y: 25 * T, w: 22, h: 8 },
    { kind: 'puddle', x: 9 * T, y: 31 * T, w: 14, h: 6 },
    { kind: 'puddle', x: 25 * T, y: 32 * T, w: 16, h: 6 },
    { kind: 'puddle', x: 16 * T, y: 43 * T, w: 14, h: 5 },
    { kind: 'oil', x: 22 * T, y: 16 * T + 8, w: 8, h: 4 },
    { kind: 'oil', x: 11 * T, y: 23 * T + 8, w: 10, h: 4 },
    { kind: 'oil', x: 24 * T, y: 30 * T + 8, w: 8, h: 3 },
    { kind: 'manhole', x: 9 * T, y: 8 * T + 8 },
    { kind: 'manhole', x: 26 * T, y: 8 * T + 8 },
    { kind: 'manhole', x: 18 * T, y: 28 * T },
    { kind: 'leaves', x: 1 * T, y: 18 * T + 4, w: 30, h: 10 },
    { kind: 'leaves', x: 23 * T, y: 46 * T + 4, w: 34, h: 10 },
    { kind: 'leaves', x: 4 * T, y: 31 * T, w: 30, h: 16 },
    { kind: 'leaves', x: 20 * T, y: 21 * T, w: 40, h: 6 },
    { kind: 'flowers', x: 3 * T, y: 44 * T, w: 30, h: 10 },
    { kind: 'flowers', x: 27 * T, y: 44 * T, w: 26, h: 12 },
    { kind: 'flowers', x: 14 * T, y: 4 * T, w: 30, h: 10 },
    { kind: 'hopscotch', x: 9 * T, y: 44 * T },
  ];

  return {
    id: 'garages',
    name: 'Гаражи',
    cols,
    rows,
    ground: g,
    decals,
    props,
    van: { x: 17 * T, y: 42 * T + 4 },
    playerStart: { x: 17 * T, y: 39 * T },
    dogs: {
      districtId: 'garages',
      count: 7,
      hasLeader: true,
      temperaments: { friendly: 3, shy: 3, grumpy: 2 },
      spots: [
        { x: 27 * T, y: 39 * T + 8, radius: 44 }, // containers — the leader's spot
        { x: 3 * T, y: 22 * T, radius: 48 }, // warm heating pipe
        { x: 24 * T, y: 18 * T, radius: 70 },
        { x: 13 * T, y: 24 * T + 8, radius: 70 },
        { x: 20 * T, y: 31 * T + 8, radius: 70 },
        { x: 2 * T, y: 35 * T, radius: 40 },
        { x: 9 * T, y: 41 * T, radius: 44 },
      ],
    },
  };
}
