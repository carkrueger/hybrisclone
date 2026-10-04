import { describe, it, expect } from 'vitest';
import { generateSector } from '../src/level/generator.js';
import { dualGridTiles } from '../src/level/dualgrid.js';
import { COLS, W } from '../src/config.js';
import { MEGA_KINDS } from '../src/level/megastructures.js';
import { PROPS } from '../src/level/tileIds.js';

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
        const { base, raised, deco, rows } = s.backdrop;
        expect(base.length).toBe(rows);
        expect(base.every((row) => row.length === COLS)).toBe(true);
        // raised plateaus only sit on top of base plating
        for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (raised[r][c]) expect(base[r][c]).toBe(1);
        // decorations only on plating
        for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (deco[r][c] >= 0) expect(base[r][c]).toBe(1);
        expect(s.mid.every((row) => row.length === COLS)).toBe(true);
        expect(s.waves.length).toBeGreaterThan(20);
        expect(s.backdrop.props.length).toBeGreaterThan(0);
        expect(s.waves.some((w) => w.pod)).toBe(true);
        for (let i = 1; i < s.waves.length; i++) expect(s.waves[i].d).toBeGreaterThanOrEqual(s.waves[i - 1].d);
        for (const w of s.waves) {
          expect(w.count).toBeGreaterThan(0);
          expect(w.fireDelays.length).toBe(w.count);
          for (const k of ['x', 'cx']) if (w.params[k] !== undefined) {
            expect(w.params[k]).toBeGreaterThan(0);
            expect(w.params[k]).toBeLessThan(W);
          }
        }
        // capital ships: sorted, valid kinds, near the screen horizontally
        expect(s.mega.length).toBeGreaterThan(1);
        for (let i = 0; i < s.mega.length; i++) {
          const m = s.mega[i];
          expect(MEGA_KINDS).toContain(m.kind);
          expect(m.x).toBeGreaterThan(-200);
          expect(m.x).toBeLessThan(W + 200);
          if (i) expect(m.d).toBeGreaterThan(s.mega[i - 1].d);
        }
        // props: on plain plating, no deco/turret underneath, no overlaps
        const taken = new Set();
        const turretCells = new Set(s.backdrop.turrets.map((t) => t.row + ':' + t.col));
        for (const pr of s.backdrop.props) {
          expect(PROPS[pr.type]).toEqual([pr.w, pr.h]);
          for (let r = pr.row; r < pr.row + pr.h; r++) {
            for (let c = pr.col; c < pr.col + pr.w; c++) {
              expect(base[r][c]).toBe(1);
              expect(raised[r][c]).toBe(0);
              expect(deco[r][c]).toBe(-1);
              expect(turretCells.has(r + ':' + c)).toBe(false);
              expect(taken.has(r + ':' + c)).toBe(false);
              taken.add(r + ':' + c);
            }
          }
        }
        expect(s.ambient.traffic.length).toBeGreaterThan(3);
        for (const d of s.ambient.drones) expect(base[d.row][d.col]).toBe(1);
        expect(s.boss.plates.length).toBeGreaterThan(0);
        expect(s.boss.guns.length % 2).toBe(0);
        expect(s.boss.hull.profile.length).toBe(s.boss.hull.h);
      }
    }
  });
});

describe('dualGridTiles', () => {
  it('maps vertex neighbourhoods to masks', () => {
    // a single interior cell: its 4 corner vertices see it as BR, BL, TR, TL
    expect(dualGridTiles([[0, 1, 0]], 1)).toEqual([
      [-1, 8, 4, -1],
      [-1, 2, 1, -1],
    ]);
  });

  it('extends structures past the screen edges', () => {
    expect(dualGridTiles([[1, 0]], 1)[0][0]).toBe(4 | 8);
  });
});
