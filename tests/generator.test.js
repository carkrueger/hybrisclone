import { describe, it, expect } from 'vitest';
import { generateLevel } from '../src/level/generator.js';
import { dualGridTiles } from '../src/level/dualgrid.js';
import { COLS, W } from '../src/config.js';
import { MEGA_KINDS } from '../src/level/megastructures.js';
import { PROPS } from '../src/level/tileIds.js';
import { THEMES, themeFor, rosterFor } from '../src/level/themes.js';
import { difficulty } from '../src/level/difficulty.js';
import { ENEMY_DEFS } from '../src/level/enemyDefs.js';
import { MID_ARCHETYPES, SECTOR_BOSSES } from '../src/level/bosses.js';
import { PODS } from '../src/entities/pickups.js';

describe('generateLevel', () => {
  it('is deterministic for the same seed, sector and level', () => {
    for (const [s, l] of [[0, 0], [1, 2], [5, 3], [7, 1]]) {
      expect(JSON.stringify(generateLevel('ABC', s, l))).toBe(JSON.stringify(generateLevel('ABC', s, l)));
    }
  });

  it('differs between seeds, sectors and levels', () => {
    const a = JSON.stringify(generateLevel('ABC', 0, 0));
    expect(JSON.stringify(generateLevel('ABD', 0, 0))).not.toBe(a);
    expect(JSON.stringify(generateLevel('ABC', 1, 0))).not.toBe(a);
    expect(JSON.stringify(generateLevel('ABC', 0, 1))).not.toBe(a);
  });

  it('cycles the six themes and counts rounds', () => {
    for (let s = 0; s < 14; s++) {
      const lv = generateLevel('HYBRIS', s, 0);
      expect(lv.theme).toBe(THEMES[s % 6].id);
      expect(lv.round).toBe(Math.floor(s / 6));
    }
  });

  it('uses mid-bosses on levels 1-3 and the theme boss on level 4', () => {
    for (let s = 0; s < 6; s++) {
      for (let l = 0; l < 4; l++) {
        const b = generateLevel('HYBRIS', s, l).boss;
        if (l < 3) {
          expect(b.mid).toBe(true);
          expect(MID_ARCHETYPES).toContain(b.kind);
          expect(b.kind).toBe(themeFor(s).midBosses[l]);
        } else {
          expect(b.mid).toBe(false);
          expect(b.kind).toBe(themeFor(s).sectorBoss);
          expect(SECTOR_BOSSES).toContain(b.kind);
        }
      }
    }
  });

  it('only spawns enemies from the level roster', () => {
    for (let s = 0; s < 8; s++) {
      for (let l = 0; l < 4; l++) {
        const lv = generateLevel('ROSTER', s, l);
        const roster = new Set(lv.roster);
        for (const w of lv.waves) {
          expect(roster.has(w.type)).toBe(true);
          expect(ENEMY_DEFS[w.type].patterns).toContain(w.pattern);
        }
        for (const t of lv.turrets) {
          expect(roster.has(t.type)).toBe(true);
          expect(ENEMY_DEFS[t.type].ground).toBe(true);
        }
      }
    }
  });

  it('grows the roster through the levels of a sector', () => {
    for (let s = 0; s < 6; s++) {
      let prev = 0;
      for (let l = 0; l < 4; l++) {
        const n = rosterFor(s, l).length;
        expect(n).toBeGreaterThanOrEqual(prev);
        prev = n;
      }
      // every signature enemy of the theme appears by level 4
      for (const t of themeFor(s).signature) expect(rosterFor(s, 3)).toContain(t);
    }
  });

  it('produces a sane level', () => {
    for (const seed of ['HYBRIS', 'X', '12345']) {
      for (let s = 0; s < 6; s++) {
        const lv = generateLevel(seed, s, s % 4);
        const { base, raised, deco, rows } = lv.backdrop;
        expect(base.length).toBe(rows);
        expect(base.every((row) => row.length === COLS)).toBe(true);
        for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
          if (raised[r][c]) expect(base[r][c]).toBe(1);
          if (deco[r][c] >= 0) expect(base[r][c]).toBe(1);
        }
        expect(lv.waves.length).toBeGreaterThan(10);
        for (let i = 1; i < lv.waves.length; i++) expect(lv.waves[i].d).toBeGreaterThanOrEqual(lv.waves[i - 1].d);
        for (const w of lv.waves) {
          expect(w.count).toBeGreaterThan(0);
          expect(w.fireDelays.length).toBe(w.count);
        }
        for (let i = 0; i < lv.mega.length; i++) {
          expect(MEGA_KINDS).toContain(lv.mega[i].kind);
          expect(lv.mega[i].x).toBeGreaterThan(-200);
          expect(lv.mega[i].x).toBeLessThan(W + 200);
        }
        const taken = new Set();
        const turretCells = new Set(lv.backdrop.turrets.map((t) => t.row + ':' + t.col));
        for (const pr of lv.backdrop.props) {
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
        for (const d of lv.ambient.drones) expect(base[d.row][d.col]).toBe(1);
        expect(lv.boss.hull.profile.length).toBe(lv.boss.hull.h);
      }
    }
  });

  it('only drops known pods and mixes in weapon types and specials', () => {
    const seen = new Set();
    for (let s = 0; s < 6; s++) {
      for (let l = 0; l < 4; l++) {
        for (const w of generateLevel('PODS', s, l).waves) {
          if (w.pod === null) continue;
          expect(Object.keys(PODS)).toContain(w.pod);
          seen.add(PODS[w.pod].kind);
        }
      }
    }
    for (const kind of ['power', 'bomb', 'weapon', 'special', 'shield']) expect(seen).toContain(kind);
  });
});

describe('difficulty', () => {
  it('increases monotonically and stays within caps', () => {
    let prev = null;
    for (let s = 0; s < 14; s++) {
      for (let l = 0; l < 4; l++) {
        const d = difficulty(s, l);
        if (prev) {
          expect(d.D).toBeGreaterThan(prev.D);
          expect(d.hp).toBeGreaterThan(prev.hp);
          expect(d.budget).toBeGreaterThanOrEqual(prev.budget);
          expect(d.telegraph).toBeLessThanOrEqual(prev.telegraph);
        }
        expect(d.budget).toBeLessThanOrEqual(110);
        expect(d.telegraph).toBeGreaterThanOrEqual(350);
        expect(d.bulletSpeed).toBeLessThanOrEqual(1.6);
        expect(d.fireInterval).toBeGreaterThanOrEqual(0.5);
        prev = d;
      }
    }
  });
});

describe('dualGridTiles', () => {
  it('maps vertex neighbourhoods to masks', () => {
    expect(dualGridTiles([[0, 1, 0]], 1)).toEqual([
      [-1, 8, 4, -1],
      [-1, 2, 1, -1],
    ]);
  });

  it('extends structures past the screen edges', () => {
    expect(dualGridTiles([[1, 0]], 1)[0][0]).toBe(4 | 8);
  });
});
