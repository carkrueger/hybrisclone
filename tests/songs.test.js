import { describe, it, expect } from 'vitest';
import { composeSong, JINGLES, TITLE_SEED } from '../src/audio/composer/arrange.js';
import { INSTRUMENT_NAMES } from '../src/audio/synth/instruments.js';
import { voiceLead, chordShape, SCALES } from '../src/audio/composer/theory.js';
import { generateSector } from '../src/level/generator.js';

const DRUMS = ['kick', 'snare', 'clap', 'hat', 'ohat', 'crash', 'tomL', 'tomM', 'tomH'];

describe('composeSong', () => {
  it('is deterministic per seed and style', () => {
    const { music } = generateSector('HYBRIS', 0);
    expect(JSON.stringify(composeSong(music.main, 'sector'))).toBe(JSON.stringify(composeSong(music.main, 'sector')));
    expect(JSON.stringify(composeSong(music.boss, 'boss'))).toBe(JSON.stringify(composeSong(music.boss, 'boss')));
    expect(JSON.stringify(composeSong(1, 'sector'))).not.toBe(JSON.stringify(composeSong(2, 'sector')));
  });

  it('builds a full arrangement with sections, a key change and many tracks', () => {
    for (const seed of [TITLE_SEED, 1, 42, 99999, 123456789]) {
      for (const style of ['title', 'sector', 'boss']) {
        const song = composeSong(seed, style);
        expect(song.loopSteps % 16).toBe(0);
        expect(song.loopSteps / 16).toBeGreaterThanOrEqual(style === 'sector' ? 48 : 28);
        expect(song.sections.length).toBeGreaterThanOrEqual(5);
        expect(song.sections.some((s) => s.keyShift > 0)).toBe(true);
        expect(song.tracks.length).toBeGreaterThanOrEqual(7);
        const end = song.introSteps + song.loopSteps;
        for (const tr of song.tracks) {
          expect(INSTRUMENT_NAMES).toContain(tr.inst);
          for (const n of tr.notes) {
            expect(n.s).toBeGreaterThanOrEqual(0);
            expect(n.s).toBeLessThan(end);
            if (tr.inst === 'drums') expect(DRUMS).toContain(n.d);
            else {
              expect(n.n).toBeGreaterThan(24);
              expect(n.n).toBeLessThan(108);
            }
          }
        }
        // a lead line and a counter-melody exist
        expect(song.tracks.find((t) => t.name === 'lead').notes.length).toBeGreaterThan(30);
        expect(song.tracks.find((t) => t.name === 'counter').notes.length).toBeGreaterThan(4);
      }
    }
  });

  it('builds jingles', () => {
    expect(JINGLES.gameOver().tracks.length).toBeGreaterThan(0);
    expect(JINGLES.sectorClear().introSteps).toBeGreaterThan(0);
  });
});

describe('voiceLead', () => {
  it('keeps chord tones and moves smoothly', () => {
    const shape = chordShape(SCALES.aeolian, 0, 'triad');
    const a = voiceLead(57, shape, null);
    const b = voiceLead(53, chordShape(SCALES.aeolian, 5, 'triad'), a);
    expect(a.map((p) => p % 12).sort()).toEqual([57, 60, 64].map((p) => p % 12).sort());
    const move = b.reduce((s, p, i) => s + Math.abs(p - a[i]), 0);
    expect(move).toBeLessThanOrEqual(6);
  });
});
