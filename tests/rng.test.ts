import { describe, expect, it } from 'vitest';
import { hash2, Rng } from '../src/core/rng';

describe('Rng', () => {
  it('repeats for the same seed and stays in range', () => {
    const a = new Rng('x');
    const b = new Rng('x');
    for (let i = 0; i < 100; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() covers the inclusive range', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 4));
    expect([...seen].sort()).toEqual([1, 2, 3, 4]);
  });

  it('hash2 is stable', () => {
    expect(hash2(10, 20, 3)).toBe(hash2(10, 20, 3));
    expect(hash2(10, 20, 3)).not.toBe(hash2(11, 20, 3));
  });
});
