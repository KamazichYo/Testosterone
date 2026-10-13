import { Decal, GroundGrid, TILE } from '../art/ground';
import type { PropPlacement } from '../art/propFactory';
import type { NpcDef, ShelterDef } from './location';

export const VISITOR_LOOKS: NpcDef['look'][] = [
  { skin: '#f2c29b', hair: '#3d2a22', top: '#7cc576', bottom: '#4a5f8c' },
  { skin: '#e8b08a', hair: '#d9a05a', top: '#ff9ec4', bottom: '#5d6670', hat: { kind: 'cap', color: '#ffe066' } },
  { skin: '#c98a62', hair: '#2a1e22', top: '#f29a4a', bottom: '#3d4f78', glasses: true },
];

const T = TILE;

/** Приют «Лапа»: care stations, kennels, an intake pen and the van parking. */
export function shelterLocation(): ShelterDef {
  const cols = 26;
  const rows = 35;
  const g = new GroundGrid(cols, rows);
  // paths
  g.paint('s', 12, 7, 3, 23);
  g.paint('s', 2, 16, 23, 2);
  g.paint('s', 15, 13, 10, 2).paint('s', 15, 20, 10, 2);
  // worn ground in front of the kennels
  g.paint('d', 2, 13, 9, 2).paint('d', 2, 20, 9, 2);
  // intake pen
  g.paint('d', 2, 24, 8, 6);
  // van parking by the gate
  g.paint('a', 10, 30, 8, 5);

  const props: PropPlacement[] = [];
  const P = (kind: PropPlacement['kind'], x: number, y: number, variant = 0) => props.push({ kind, x, y, variant });

  P('shelterHouse', 13 * T, 7 * T);
  P('board', 16 * T + 8, 9 * T + 4);
  P('bath', 17 * T + 8, 13 * T);
  P('kitchen', 22 * T, 13 * T);
  P('vet', 17 * T + 8, 20 * T);
  P('tagDesk', 22 * T, 20 * T);

  // intake pen fence
  for (let x = 2 * T + 8; x <= 9 * T + 8; x += 16) {
    P('picketH', x, 24 * T);
    P('picketH', x, 30 * T);
  }
  for (let y = 24 * T + 18; y <= 30 * T; y += 18) {
    P('picketV', 2 * T, y);
    P('picketV', 10 * T, y);
  }

  // garden
  P('tree', 1 * T + 8, 7 * T, 31);
  P('birch', 24 * T + 4, 7 * T + 8, 32);
  P('tree', 24 * T + 4, 28 * T, 33);
  P('treeAutumn', 19 * T, 28 * T, 34);
  P('bush', 21 * T, 31 * T, 35);
  P('bushBerry', 1 * T + 8, 33 * T, 36);
  P('bench', 5 * T, 9 * T + 8);
  P('bench', 22 * T, 25 * T);
  P('tiresPainted', 9 * T, 9 * T);
  P('lamp', 9 * T + 8, 34 * T);
  P('lamp', 18 * T + 8, 34 * T);

  // perimeter picket fence (gate at the bottom between cols 10–17)
  for (let y = 7 * T + 18; y <= rows * T; y += 18) {
    P('picketV', 4, y);
    P('picketV', cols * T - 4, y);
  }
  for (let x = 8; x < cols * T; x += 16) {
    if (x > 10 * T && x < 18 * T) continue;
    P('picketH', x, rows * T);
  }

  const decals: Decal[] = [
    { kind: 'flowers', x: 4 * T, y: 7 * T + 8, w: 40, h: 8 },
    { kind: 'flowers', x: 22 * T, y: 8 * T, w: 30, h: 8 },
    { kind: 'flowers', x: 22 * T, y: 32 * T, w: 30, h: 10 },
    { kind: 'flowers', x: 6 * T, y: 32 * T, w: 40, h: 10 },
    { kind: 'leaves', x: 19 * T, y: 28 * T + 4, w: 30, h: 10 },
    { kind: 'parking', x: 10 * T, y: 30 * T, w: 8 * T, h: 5 * T },
    { kind: 'puddle', x: 13 * T, y: 31 * T + 8, w: 12, h: 5 },
  ];

  const kennels: { x: number; y: number }[] = [];
  for (const row of [13, 20]) for (const c of [3, 5, 7, 9]) kennels.push({ x: c * T + (c === 9 ? 4 : 0), y: row * T });

  return {
    id: 'shelter',
    name: 'Приют',
    cols,
    rows,
    ground: g,
    decals,
    props,
    van: { x: 14 * T, y: 33 * T + 4 },
    playerStart: { x: 14 * T, y: 29 * T + 8 },
    npcs: [],
    pigeons: [{ x: 20 * T, y: 17 * T, r: 24, count: 3 }],
    cats: [{ x: 6 * T, y: 9 * T + 2, variant: 1 }],
    butterflies: [
      { x: 4 * T, y: 7 * T },
      { x: 22 * T, y: 31 * T },
    ],
    pickups: [],
    stations: [
      { id: 'wash', x: 17 * T + 8, y: 13 * T },
      { id: 'feed', x: 22 * T, y: 13 * T },
      { id: 'vet', x: 17 * T + 8, y: 20 * T },
      { id: 'tag', x: 22 * T, y: 20 * T },
    ],
    kennels,
    intake: { x: 2 * T + 6, y: 24 * T + 6, w: 8 * T - 12, h: 6 * T - 12 },
    board: { x: 16 * T + 8, y: 9 * T + 4 },
    foodStore: { x: 22 * T, y: 13 * T },
    gate: { x: 14 * T, y: rows * T + 10 },
  };
}
