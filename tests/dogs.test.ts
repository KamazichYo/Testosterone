import { describe, expect, it } from 'vitest';
import { applyCatchFail, applyMeal, catchDifficulty, catchReward, isAggressive, reactToPlayer } from '../src/dogs/behaviour';
import { generateDistrictDogs } from '../src/dogs/generator';
import { garagesDistrict } from '../src/data/garages';
import type { DogData } from '../src/dogs/types';

const cfg = garagesDistrict().dogs;

function dog(over: Partial<DogData['stats']> = {}, traits: DogData['traits'] = []): DogData {
  const d = generateDistrictDogs(cfg, 1)[1];
  return { ...d, traits, stats: { ...d.stats, hunger: 80, aggression: 70, trust: 0, ...over } };
}

describe('district dog generation', () => {
  it('is deterministic for the same seed', () => {
    expect(generateDistrictDogs(cfg, 1)).toEqual(generateDistrictDogs(cfg, 1));
  });

  it('creates the configured number of wild dogs with unique ids and names', () => {
    const dogs = generateDistrictDogs(cfg, 1);
    expect(dogs).toHaveLength(cfg.count);
    expect(new Set(dogs.map((d) => d.id)).size).toBe(cfg.count);
    expect(new Set(dogs.map((d) => d.name)).size).toBe(cfg.count);
    expect(dogs.every((d) => d.state === 'wild')).toBe(true);
  });

  it('makes the leader big and grumpy', () => {
    const leader = generateDistrictDogs(cfg, 1).find((d) => d.isLeader)!;
    expect(leader.look.size).toBe('large');
    expect(isAggressive(leader.stats)).toBe(true);
  });
});

describe('dog behaviour', () => {
  it('feeding calms an angry dog down within a few meals', () => {
    const d = dog({ aggression: 85 });
    let meals = 0;
    while (isAggressive(d.stats) && meals < 10) {
      applyMeal(d);
      meals++;
    }
    expect(meals).toBeGreaterThan(0);
    expect(meals).toBeLessThanOrEqual(3);
    expect(d.stats.trust).toBeGreaterThan(0);
  });

  it('stats stay within 0..100', () => {
    const d = dog({ hunger: 5, aggression: 3, trust: 98 }, ['cuddly']);
    applyMeal(d);
    expect(d.stats.hunger).toBe(0);
    expect(d.stats.aggression).toBe(0);
    expect(d.stats.trust).toBe(100);
    applyCatchFail(d);
    expect(d.stats.trust).toBeLessThanOrEqual(100);
  });

  it('angry dogs bark, scared dogs flee, trusting dogs follow', () => {
    expect(reactToPlayer(dog({ aggression: 80 }), 40)).toBe('alert');
    expect(reactToPlayer(dog({ aggression: 30, trust: 10 }), 30)).toBe('flee');
    expect(reactToPlayer(dog({ aggression: 20, trust: 70 }), 40)).toBe('follow');
    expect(reactToPlayer(dog({ aggression: 30, trust: 10 }), 200)).toBeNull();
  });

  it('cowards notice the player from further away', () => {
    const brave = dog({ aggression: 30, trust: 10 });
    const coward = dog({ aggression: 30, trust: 10 }, ['coward']);
    expect(reactToPlayer(brave, 55)).toBeNull();
    expect(reactToPlayer(coward, 55)).toBe('flee');
  });

  it('angrier dogs are harder to catch and pay more', () => {
    const calm = catchDifficulty({ hunger: 0, dirt: 0, health: 100, aggression: 10, trust: 60 });
    const angry = catchDifficulty({ hunger: 0, dirt: 0, health: 100, aggression: 80, trust: 0 });
    expect(angry.rounds).toBeGreaterThan(calm.rounds);
    expect(angry.speed).toBeGreaterThan(calm.speed);
    expect(angry.window).toBeLessThan(calm.window);
    expect(catchReward({ hunger: 0, dirt: 0, health: 100, aggression: 80, trust: 0 }, false)).toBeGreaterThan(
      catchReward({ hunger: 0, dirt: 0, health: 100, aggression: 10, trust: 60 }, false),
    );
  });
});
