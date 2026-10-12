import { Rng } from '../core/rng';
import { FEMALE_NAMES, LEADER_NAMES, MALE_NAMES } from '../data/names';
import type { DogData, DogLook, DogSize, Pattern, Sex, Temperament, Trait } from './types';

interface Coat {
  base: string;
  accent: string;
  patch: string;
  patterns: Pattern[];
}

/** Realistic street-dog coats (дворняжки): ginger, black-and-tan, piebald, grey, cream… */
const COATS: Coat[] = [
  { base: '#d8873f', accent: '#f6d9ad', patch: '#a85f2a', patterns: ['none', 'mask', 'socks'] },
  { base: '#c99a62', accent: '#f4e2c2', patch: '#8d6238', patterns: ['none', 'saddle', 'socks'] },
  { base: '#3d3438', accent: '#c58a52', patch: '#241e22', patterns: ['mask', 'socks', 'none'] },
  { base: '#efe4cf', accent: '#ffffff', patch: '#c08a55', patterns: ['spots', 'saddle'] },
  { base: '#f0ead9', accent: '#ffffff', patch: '#3d3438', patterns: ['spots', 'saddle'] },
  { base: '#8f8b93', accent: '#dcd8dc', patch: '#5f5b63', patterns: ['none', 'saddle', 'socks'] },
  { base: '#7a4f35', accent: '#c99773', patch: '#4e3122', patterns: ['none', 'socks', 'mask'] },
  { base: '#b07d4a', accent: '#ecd2a6', patch: '#4b3428', patterns: ['saddle', 'mask'] },
  { base: '#e2c08a', accent: '#fbf0d8', patch: '#b88d55', patterns: ['none', 'socks'] },
];

const EYES = ['#2b1d1d', '#4a2c1a', '#5a3a1a', '#2b1d1d'];

export interface DogSpot {
  x: number;
  y: number;
  radius: number;
}

export interface DistrictDogConfig {
  districtId: string;
  count: number;
  /** relative weights of temperaments in this district */
  temperaments: Record<Temperament, number>;
  spots: DogSpot[];
  hasLeader: boolean;
}

function weighted<T extends string>(rng: Rng, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function generateLook(rng: Rng, size?: DogSize): DogLook {
  const coat = rng.pick(COATS);
  return {
    size: size ?? weighted<DogSize>(rng, { small: 3, medium: 5, large: 2 }),
    base: coat.base,
    accent: coat.accent,
    patch: coat.patch,
    pattern: rng.pick(coat.patterns),
    ears: weighted(rng, { up: 4, floppy: 4, half: 3 }),
    tail: weighted(rng, { curl: 4, straight: 3, fluffy: 3 }),
    eye: rng.pick(EYES),
    seed: rng.int(0, 1e9),
  };
}

const TRAITS_BY_TEMPERAMENT: Record<Temperament, Trait[]> = {
  friendly: ['cuddly', 'glutton', 'sleepy', 'fidget'],
  shy: ['coward', 'sleepy', 'glutton', 'fidget'],
  grumpy: ['grumbler', 'glutton', 'fidget'],
};

export function generateDog(rng: Rng, id: string, districtId: string, temperament: Temperament, spot: DogSpot, usedNames: Set<string>, isLeader = false): DogData {
  const look = generateLook(rng, isLeader ? 'large' : undefined);
  const sex: Sex = isLeader ? 'm' : rng.chance(0.5) ? 'm' : 'f';
  const pool = isLeader ? LEADER_NAMES : sex === 'm' ? MALE_NAMES : FEMALE_NAMES;
  let name = rng.pick(pool);
  for (let i = 0; i < 20 && usedNames.has(name); i++) name = rng.pick(pool);
  usedNames.add(name);

  const aggression =
    temperament === 'grumpy' ? rng.int(62, 88) : temperament === 'shy' ? rng.int(25, 45) : rng.int(12, 32);
  const traits: Trait[] = [rng.pick(TRAITS_BY_TEMPERAMENT[temperament])];

  return {
    id,
    name,
    sex,
    district: districtId,
    look,
    temperament,
    traits,
    isLeader,
    stats: {
      hunger: rng.int(55, 95),
      dirt: rng.int(55, 95),
      health: rng.int(45, 85),
      aggression: isLeader ? Math.max(aggression, 80) : aggression,
      trust: rng.int(0, 15),
    },
    state: 'wild',
    home: { ...spot },
    vaccinated: false,
    sterilized: false,
  };
}

/** Deterministic: the same district + seed always produces the same dogs. */
export function generateDistrictDogs(cfg: DistrictDogConfig, seed: number | string): DogData[] {
  const rng = new Rng(`${cfg.districtId}:${seed}`);
  const used = new Set<string>();
  const dogs: DogData[] = [];
  for (let i = 0; i < cfg.count; i++) {
    const spot = cfg.spots[i % cfg.spots.length];
    const leader = cfg.hasLeader && i === 0;
    const temperament = leader ? 'grumpy' : weighted(rng, cfg.temperaments);
    dogs.push(generateDog(rng, `${cfg.districtId}-${i}`, cfg.districtId, temperament, spot, used, leader));
  }
  return dogs;
}
