import { describe, it, expect } from 'vitest';
import { composeSong, JINGLES, TITLE_SEED } from '../src/audio/songs.js';
import { generateSector } from '../src/level/generator.js';

describe('composeSong', () => {
  it('is deterministic per seed and style', () => {
    const { music } = generateSector('HYBRIS', 0);
    expect(JSON.stringify(composeSong(music.main, 'sector'))).toBe(JSON.stringify(composeSong(music.main, 'sector')));
    expect(JSON.stringify(composeSong(music.boss, 'boss'))).toBe(JSON.stringify(composeSong(music.boss, 'boss')));
    expect(JSON.stringify(composeSong(1, 'sector'))).not.toBe(JSON.stringify(composeSong(2, 'sector')));
  });

  it('keeps every note inside the song and in a sane pitch range', () => {
    for (const seed of [TITLE_SEED, 1, 42, 99999]) {
      for (const style of ['title', 'sector', 'boss']) {
        const song = composeSong(seed, style);
        expect(song.length % 16).toBe(0);
        for (const tr of song.tracks) {
          for (const n of tr.notes) {
            expect(n.s).toBeGreaterThanOrEqual(0);
            expect(n.s).toBeLessThan(song.length);
            if (n.n !== undefined) {
              expect(n.n).toBeGreaterThan(20);
              expect(n.n).toBeLessThan(110);
            }
          }
        }
      }
    }
  });

  it('builds jingles', () => {
    expect(JINGLES.gameOver().tracks.length).toBeGreaterThan(0);
    expect(JINGLES.sectorClear().length).toBeGreaterThan(0);
  });
});
