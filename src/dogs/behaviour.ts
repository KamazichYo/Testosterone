import type { DogData, DogStats } from './types';

/** Pure rules for how a dog feels and reacts — kept free of Phaser so they are easy to test and tune. */

export const AGGRESSIVE_AT = 55;
export const TRUSTING_AT = 50;
export const SMELL_RADIUS = 140;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function isAggressive(s: DogStats): boolean {
  return s.aggression >= AGGRESSIVE_AT;
}

export function isTrusting(s: DogStats): boolean {
  return s.trust >= TRUSTING_AT && !isAggressive(s);
}

/**
 * A street dog never turns down a treat — even a full one. (Earlier only hungry dogs reacted to food,
 * so a fed dog that escaped a catch could no longer be approached at all.)
 */
export function wantsFood(_s: DogStats): boolean {
  return true;
}

/** Eating a portion: less hungry, calmer, more trusting. A full dog treats it as a snack — still builds trust. */
export function applyMeal(dog: DogData): void {
  const s = dog.stats;
  const glutton = dog.traits.includes('glutton');
  const cuddly = dog.traits.includes('cuddly');
  const grumbler = dog.traits.includes('grumbler');
  s.hunger = clamp(s.hunger - (glutton ? 30 : 45));
  s.aggression = clamp(s.aggression - (glutton ? 32 : 24) + (grumbler ? 6 : 0));
  s.trust = clamp(s.trust + 22 + (cuddly ? 12 : 0));
}

export function applyCatchFail(dog: DogData): void {
  dog.stats.trust = clamp(dog.stats.trust - 6);
  dog.stats.aggression = clamp(dog.stats.aggression + 4);
}

export type PlayerReaction = 'alert' | 'flee' | 'follow' | null;

/** What a calm (wandering/idle) dog does when the player is `dist` pixels away. */
export function reactToPlayer(dog: DogData, dist: number): PlayerReaction {
  const s = dog.stats;
  if (dog.state === 'released') return dist < 48 ? 'follow' : null;
  if (isAggressive(s)) return dist < 64 ? 'alert' : null;
  if (s.trust >= TRUSTING_AT) return dist < 72 ? 'follow' : null;
  // the more a shy dog trusts you, the closer it lets you come
  const base = dog.traits.includes('coward') ? 62 : 46;
  const fleeRadius = base * (1 - s.trust / 140);
  return dist < fleeRadius ? 'flee' : null;
}

export interface CatchDifficulty {
  rounds: number;
  /** 1 = relaxed ring speed */
  speed: number;
  /** width of the green zone in ring-radius units (0..1) */
  window: number;
}

export function catchDifficulty(s: DogStats): CatchDifficulty {
  const a = s.aggression;
  const rounds = a <= 30 ? 1 : a <= 60 ? 2 : 3;
  const trustBonus = s.trust / 100;
  return {
    rounds,
    speed: 0.8 + a / 130,
    window: Math.max(0.18, 0.36 - a / 400 + trustBonus * 0.08),
  };
}

/** Coins the city pays for a caught dog (контракт ОСВВ). Harder dogs pay more. */
export function catchReward(s: DogStats, isLeader: boolean): number {
  return 10 + catchDifficulty(s).rounds * 5 + (isLeader ? 25 : 0);
}

// ------------------------------------------------------------------ shelter care

export type CareStep = 'wash' | 'feed' | 'vet' | 'tag';

export function careDone(dog: DogData, step: CareStep): boolean {
  switch (step) {
    case 'wash':
      return dog.stats.dirt <= 0;
    case 'feed':
      return dog.stats.hunger <= 0;
    case 'vet':
      return dog.vaccinated && dog.sterilized;
    case 'tag':
      return !!dog.tagId;
  }
}

/** Why a station can't take this dog right now, or null if it can. */
export function careBlocker(dog: DogData, step: CareStep): string | null {
  if (careDone(dog, step)) return 'уже сделано';
  if (step === 'tag' && !(careDone(dog, 'wash') && careDone(dog, 'feed') && careDone(dog, 'vet')))
    return 'сначала помыть, накормить и осмотреть';
  return null;
}

let tagCounter = 0;
export function applyCare(dog: DogData, step: CareStep): void {
  const s = dog.stats;
  switch (step) {
    case 'wash':
      s.dirt = 0;
      s.trust = clamp(s.trust + 10);
      break;
    case 'feed':
      s.hunger = 0;
      s.aggression = clamp(s.aggression - 20);
      s.trust = clamp(s.trust + 10);
      break;
    case 'vet':
      s.health = 100;
      dog.vaccinated = true;
      dog.sterilized = true;
      break;
    case 'tag':
      tagCounter++;
      dog.tagId = `${dog.district.slice(0, 2).toUpperCase()}-${String(Date.now() % 100000).padStart(5, '0')}${tagCounter}`;
      dog.state = 'tagged';
      s.aggression = Math.min(s.aggression, 10);
      s.trust = Math.max(s.trust, 80);
      break;
  }
}

export function careProgress(dog: DogData): number {
  return (['wash', 'feed', 'vet', 'tag'] as CareStep[]).filter((st) => careDone(dog, st)).length;
}

export const ADOPT_REWARD = 40;
export const RELEASE_REWARD = 15;
