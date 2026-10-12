import type { DogData, DogStats } from './types';

/** Pure rules for how a dog feels and reacts — kept free of Phaser so they are easy to test and tune. */

export const AGGRESSIVE_AT = 55;
export const TRUSTING_AT = 50;
export const SMELL_RADIUS = 130;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function isAggressive(s: DogStats): boolean {
  return s.aggression >= AGGRESSIVE_AT;
}

export function isTrusting(s: DogStats): boolean {
  return s.trust >= TRUSTING_AT && !isAggressive(s);
}

export function wantsFood(s: DogStats): boolean {
  return s.hunger > 20;
}

/** Eating a portion: less hungry, calmer, more trusting. */
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
  dog.stats.trust = clamp(dog.stats.trust - 10);
  dog.stats.aggression = clamp(dog.stats.aggression + 6);
}

export type PlayerReaction = 'alert' | 'flee' | 'follow' | null;

/** What a calm (wandering/idle) dog does when the player is `dist` pixels away. */
export function reactToPlayer(dog: DogData, dist: number): PlayerReaction {
  const s = dog.stats;
  if (isAggressive(s)) return dist < 64 ? 'alert' : null;
  if (s.trust >= TRUSTING_AT) return dist < 72 ? 'follow' : null;
  const fleeRadius = dog.traits.includes('coward') ? 62 : 46;
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
    speed: 0.85 + a / 120,
    window: Math.max(0.16, 0.34 - a / 400 + trustBonus * 0.08),
  };
}

/** Coins the city pays for a caught dog (контракт ОСВВ). Harder dogs pay more. */
export function catchReward(s: DogStats, isLeader: boolean): number {
  return 10 + catchDifficulty(s).rounds * 5 + (isLeader ? 25 : 0);
}
