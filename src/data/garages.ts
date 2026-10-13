import { Decal, GroundGrid, TILE } from '../art/ground';
import type { PropPlacement } from '../art/propFactory';
import type { LocationDef } from './location';

const T = TILE;

/** «Гаражи» — the first district: garage cooperative, panel houses, a wasteland with a heating main and a cosy yard. */
export function garagesDistrict(): LocationDef {
  const cols = 36;
  const rows = 60;
  const g = new GroundGrid(cols, rows);

  // street along the houses
  g.paint('s', 0, 6, cols, 1).paint('a', 0, 7, cols, 3).paint('s', 0, 10, cols, 1);
  // entrance into the cooperative
  g.paint('a', 17, 11, 4, 2);
  // garage cooperative
  g.paint('a', 7, 13, 29, 22);
  // wasteland dirt patches
  g.paint('d', 1, 20, 3, 4).paint('d', 0, 30, 4, 3).paint('d', 4, 26, 2, 2).paint('d', 0, 36, 4, 2);
  // path from the cooperative down to the yard
  g.paint('d', 17, 35, 4, 5);
  // van parking
  g.paint('a', 14, 40, 10, 6);
  // container site
  g.paint('s', 27, 37, 7, 5).paint('d', 26, 42, 9, 2);
  // playground
  g.paint('d', 1, 38, 11, 10);
  // footpaths
  g.paint('s', 13, 35, 2, 20).paint('s', 0, 55, cols, 2);

  const props: PropPlacement[] = [];
  const P = (kind: PropPlacement['kind'], x: number, y: number, variant = 0, length?: number) =>
    props.push({ kind, x, y, variant, length });

  // panel houses with a little courtyard between them
  P('house', 6 * T, 6 * T, 1);
  P('house', 29 * T, 6 * T, 2);
  P('laundry', 17 * T, 4 * T + 8);
  P('bench', 13 * T + 8, 5 * T + 10);
  P('bench', 21 * T, 5 * T + 10);
  P('birch', 12 * T, 3 * T, 21);
  P('tree', 22 * T + 8, 3 * T, 22);
  for (const x of [3, 12, 24, 33]) P('lamp', x * T, 11 * T - 2);
  // parked cars on the street
  P('car', 6 * T, 8 * T + 6, 0);
  P('car', 28 * T, 8 * T + 6, 1);

  // garage rows (one garage is open — дядя Миша чинит машину)
  let num = 1;
  const garageRow = (fromCol: number, toCol: number, topRow: number) => {
    for (let c = fromCol; c <= toCol; c += 2) {
      if (topRow === 13 && c === 25) P('garageOpen', c * T + T, topRow * T + 40);
      else P('garage', c * T + T, topRow * T + 40, (num * 3 + c) % 7, num);
      num++;
    }
  };
  garageRow(7, 15, 13);
  garageRow(21, 33, 13);
  garageRow(9, 31, 20);
  garageRow(7, 15, 27);
  garageRow(21, 29, 27);
  P('car', 26 * T, 18 * T + 10, 3); // Misha's car in front of his garage
  P('car', 11 * T, 18 * T + 4, 2);
  P('tires', 34 * T, 33 * T, 1);

  // greenery along the street
  P('tree', 2 * T, 13 * T, 1);
  P('bush', 8 * T, 12 * T + 8, 2);
  P('bushBerry', 13 * T, 12 * T + 8, 3);
  P('birch', 23 * T, 12 * T + 12, 4);
  P('bush', 29 * T, 12 * T + 8, 5);
  P('bushBerry', 34 * T, 12 * T + 8, 6);

  // wasteland with the heating main
  P('pipeV', 3 * T, 34 * T, 0, 20 * T);
  P('treeAutumn', 1 * T, 18 * T, 6);
  P('tires', 5 * T, 25 * T, 0);
  P('bush', 1 * T, 27 * T, 7);
  P('birch', 5 * T + 8, 31 * T, 9);
  P('bushBerry', 1 * T, 33 * T, 8);
  P('tree', 6 * T, 36 * T, 10);

  // playground
  P('pullup', 3 * T, 40 * T);
  P('swing', 9 * T, 40 * T);
  P('sandbox', 6 * T, 44 * T);
  P('tiresPainted', 2 * T, 48 * T + 6);
  P('tiresPainted', 11 * T, 48 * T + 6);

  // yard
  P('bench', 9 * T, 52 * T);
  P('bench', 19 * T, 49 * T);
  P('carpetRack', 24 * T, 49 * T);
  P('laundry', 30 * T, 51 * T);
  P('birch', 17 * T, 51 * T, 11);
  P('birch', 21 * T + 8, 53 * T, 12);
  P('treeAutumn', 26 * T, 54 * T, 13);
  P('tree', 34 * T, 47 * T, 14);
  P('tree', 3 * T, 53 * T, 15);
  P('bush', 34 * T, 54 * T, 16);
  P('tree', 35 * T - 8, 36 * T, 17);
  P('bush', 25 * T, 38 * T, 18);

  // container site
  for (const x of [28, 29.6, 31.2]) P('container', x * T, 39 * T, Math.round(x));
  P('tires', 33 * T + 6, 41 * T + 8, 1);

  // fence along the bottom with a gap for the path
  for (let c = 0; c < cols; c += 2) {
    if (c >= 16 && c < 20) continue;
    props.push({ kind: 'fence', x: c * T + T, y: rows * T, variant: c });
  }

  const decals: Decal[] = [
    // road markings
    { kind: 'dashes', x: 0, y: 8 * T + 7, w: cols * T },
    { kind: 'zebra', x: 17 * T, y: 7 * T, w: 4 * T, h: 3 * T },
    { kind: 'parking', x: 14 * T, y: 40 * T, w: 10 * T, h: 6 * T },
    { kind: 'patch', x: 10 * T, y: 21 * T + 12, w: 14, h: 8 },
    { kind: 'patch', x: 30 * T, y: 29 * T + 12, w: 18, h: 9 },
    { kind: 'patch', x: 24 * T, y: 8 * T, w: 20, h: 8 },
    { kind: 'grate', x: 20 * T + 8, y: 34 * T },
    { kind: 'grate', x: 8 * T, y: 26 * T },
    { kind: 'puddle', x: 13 * T, y: 17 * T, w: 18, h: 7 },
    { kind: 'puddle', x: 31 * T, y: 18 * T + 6, w: 12, h: 5 },
    { kind: 'puddle', x: 19 * T, y: 25 * T, w: 22, h: 8 },
    { kind: 'puddle', x: 10 * T, y: 32 * T, w: 14, h: 6 },
    { kind: 'puddle', x: 28 * T, y: 32 * T, w: 16, h: 6 },
    { kind: 'puddle', x: 17 * T, y: 44 * T, w: 14, h: 5 },
    { kind: 'puddle', x: 6 * T, y: 47 * T, w: 12, h: 5 },
    { kind: 'oil', x: 23 * T, y: 16 * T + 8, w: 8, h: 4 },
    { kind: 'oil', x: 11 * T, y: 24 * T, w: 10, h: 4 },
    { kind: 'oil', x: 26 * T, y: 19 * T + 6, w: 12, h: 4 },
    { kind: 'manhole', x: 10 * T, y: 8 * T + 8 },
    { kind: 'manhole', x: 31 * T, y: 8 * T + 8 },
    { kind: 'manhole', x: 19 * T, y: 29 * T },
    { kind: 'leaves', x: 1 * T, y: 18 * T + 4, w: 30, h: 10 },
    { kind: 'leaves', x: 26 * T, y: 54 * T + 4, w: 34, h: 10 },
    { kind: 'leaves', x: 4 * T, y: 31 * T, w: 30, h: 16 },
    { kind: 'leaves', x: 21 * T, y: 21 * T, w: 40, h: 6 },
    { kind: 'leaves', x: 35 * T - 8, y: 36 * T + 4, w: 30, h: 10 },
    { kind: 'flowers', x: 3 * T, y: 50 * T, w: 30, h: 10 },
    { kind: 'flowers', x: 28 * T, y: 46 * T, w: 26, h: 12 },
    { kind: 'flowers', x: 17 * T, y: 2 * T, w: 30, h: 10 },
    { kind: 'flowers', x: 33 * T, y: 52 * T, w: 20, h: 10 },
    { kind: 'hopscotch', x: 14 * T, y: 51 * T },
  ];

  return {
    id: 'garages',
    name: 'Гаражи',
    cols,
    rows,
    ground: g,
    decals,
    props,
    van: { x: 19 * T, y: 43 * T + 4 },
    playerStart: { x: 19 * T, y: 39 * T + 8 },
    npcs: [
      {
        id: 'zina',
        name: 'Бабушка Зина',
        x: 9 * T,
        y: 52 * T - 1,
        sitting: true,
        quest: 'zina',
        look: { skin: '#f2c29b', hair: '#d8d4cc', top: '#8a5aa8', bottom: '#4a3d5c', hat: { kind: 'scarf', color: '#e05a5a' }, glasses: true },
        lines: ['Хорошая сегодня погода!', 'Голубей кормлю — а они всё летят и летят.', 'Береги собачек, внучок.'],
      },
      {
        id: 'misha',
        name: 'Дядя Миша',
        x: 27 * T + 12,
        y: 16 * T + 4,
        quest: 'misha',
        look: { skin: '#e8b08a', hair: '#5a3a28', top: '#4f74a3', bottom: '#3d4f78', hat: { kind: 'cap', color: '#e8e0c8' }, beard: true },
        lines: ['Карбюратор барахлит…', 'Атаман у контейнеров — тот ещё вожак, корми его щедрее.', 'Гаражи — это жизнь!'],
      },
      {
        id: 'petya',
        name: 'Петя',
        x: 8 * T,
        y: 46 * T + 4,
        quest: 'kids',
        look: { skin: '#f2c29b', hair: '#7a4a2e', top: '#e0453f', bottom: '#4a5f8c', hat: { kind: 'cap', color: '#4f9de0' }, small: true },
        lines: ['А ты собак ловишь? Круто!', 'Мы строим замок из песка!'],
      },
      {
        id: 'masha',
        name: 'Маша',
        x: 4 * T + 8,
        y: 45 * T + 4,
        look: { skin: '#f2c29b', hair: '#d9a05a', top: '#ff9ec4', bottom: '#7fb2e5', small: true },
        lines: ['Я хочу щеночка!', 'Белка самая добрая собака, я знаю!'],
      },
    ],
    pigeons: [
      { x: 7 * T, y: 54 * T, r: 26, count: 5 },
      { x: 18 * T, y: 11 * T - 4, r: 30, count: 4 },
      { x: 30 * T, y: 43 * T, r: 24, count: 3 },
    ],
    cats: [
      { x: 29.6 * T, y: 39 * T - 20, variant: 0 },
      { x: 12 * T, y: 20 * T + 6, variant: 1 },
      { x: 30 * T, y: 13 * T + 6, variant: 2 },
    ],
    butterflies: [
      { x: 3 * T, y: 50 * T },
      { x: 28 * T, y: 46 * T },
      { x: 17 * T, y: 2 * T },
      { x: 33 * T, y: 52 * T },
    ],
    pickups: [
      { id: 'bone1', kind: 'bone', x: 2 * T, y: 24 * T },
      { id: 'bone2', kind: 'bone', x: 22 * T, y: 25 * T },
      { id: 'bone3', kind: 'bone', x: 33 * T, y: 32 * T },
      { id: 'bone4', kind: 'bone', x: 10 * T, y: 37 * T },
      { id: 'bone5', kind: 'bone', x: 27 * T, y: 44 * T },
      { id: 'coin1', kind: 'coin', x: 8 * T, y: 17 * T },
      { id: 'coin2', kind: 'coin', x: 30 * T, y: 24 * T },
      { id: 'coin3', kind: 'coin', x: 12 * T, y: 32 * T },
      { id: 'coin4', kind: 'coin', x: 34 * T, y: 50 * T },
      { id: 'coin5', kind: 'coin', x: 16 * T, y: 8 * T },
      { id: 'wrench', kind: 'wrench', x: 1 * T + 8, y: 29 * T },
      { id: 'ball', kind: 'ball', x: 14 * T + 4, y: 12 * T + 12 },
    ],
    dogs: {
      districtId: 'garages',
      count: 7,
      hasLeader: true,
      temperaments: { friendly: 3, shy: 3, grumpy: 2 },
      spots: [
        { x: 29 * T, y: 41 * T + 8, radius: 44 }, // containers — the leader's spot
        { x: 3 * T, y: 24 * T, radius: 48 }, // warm heating pipe
        { x: 28 * T, y: 17 * T + 8, radius: 70 },
        { x: 15 * T, y: 24 * T + 8, radius: 70 },
        { x: 24 * T, y: 31 * T + 8, radius: 70 },
        { x: 2 * T, y: 38 * T, radius: 40 },
        { x: 21 * T, y: 50 * T, radius: 50 },
      ],
    },
  };
}
