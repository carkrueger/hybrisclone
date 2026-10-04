import { describe, it, expect } from 'vitest';
import { generateSector } from '../src/level/generator.js';
import { COLS } from '../src/config.js';

describe('generateSector', () => {
  it('is deterministic for the same seed and sector', () => {
    for (let n = 0; n < 4; n++) {
      expect(JSON.stringify(generateSector('ABC', n))).toBe(JSON.stringify(generateSector('ABC', n)));
    }
  });

  it('differs between seeds and between sectors', () => {
    const a = JSON.stringify(generateSector('ABC', 0));
    expect(JSON.stringify(generateSector('ABD', 0))).not.toBe(a);
    expect(JSON.stringify(generateSector('ABC', 1))).not.toBe(a);
  });

  it('produces a sane level', () => {
    for (const seed of ['HYBRIS', 'X', '12345', 'ZZZZZZZZZZ']) {
      for (let n = 0; n < 6; n++) {
        const s = generateSector(seed, n);
        expect(s.waves.length).toBeGreaterThan(10);
        expect(s.backdrop.grid.every((row) => row.length === COLS)).toBe(true);
        expect(s.waves.some((w) => w.pod)).toBe(true);
        for (const w of s.waves) {
          expect(w.count).toBeGreaterThan(0);
          expect(w.fireDelays.length).toBe(w.count);
        }
        expect(s.boss.guns.length % 2).toBe(0);
        expect(s.boss.hull.profile.length).toBe(s.boss.hull.h);
      }
    }
  });
});
