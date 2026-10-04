import { describe, it, expect } from 'vitest';
import { RNG, hashSeed, normalizeSeed } from '../src/core/rng.js';

describe('RNG', () => {
  it('produces a stable sequence for a known seed', () => {
    const a = RNG.fromString('HYBRIS');
    const b = RNG.fromString('hybris');
    const seqA = Array.from({ length: 10 }, () => a.nextU32());
    const seqB = Array.from({ length: 10 }, () => b.nextU32());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds', () => {
    expect(RNG.fromString('A').nextU32()).not.toBe(RNG.fromString('B').nextU32());
  });

  it('forks independently of consumption order', () => {
    const r1 = RNG.fromString('SEED');
    const f1 = r1.fork('x').nextU32();
    const r2 = RNG.fromString('SEED');
    r2.nextU32();
    r2.fork('y');
    expect(r2.fork('x').nextU32()).toBe(f1);
  });

  it('int() stays in range and float() in [0,1)', () => {
    const r = new RNG(123);
    for (let i = 0; i < 5000; i++) {
      const v = r.int(-3, 7);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(7);
      const f = r.float();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('normalizes seeds', () => {
    expect(normalizeSeed(' ab-c1 ')).toBe('ABC1');
    expect(hashSeed('ABC')).toBe(hashSeed('ABC'));
  });
});
