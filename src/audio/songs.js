// Procedural chiptune composer. composeSong(seed, style) is pure: same seed, same tune.
import { RNG, hashSeed } from '../core/rng.js';

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

// scale degrees (0-based) per bar
const PROGRESSIONS = [
  [0, 5, 6, 0],
  [0, 5, 3, 4],
  [0, 3, 4, 0],
  [0, 6, 5, 4],
  [0, 3, 6, 4],
  [0, 2, 3, 4],
  [0, 5, 0, 6],
  [5, 6, 0, 0],
  [0, 4, 5, 3],
];

const BASS_RHYTHMS = [
  { steps: [0, 2, 4, 6, 8, 10, 12, 14], oct: [0, 1, 0, 1, 0, 1, 0, 1], len: 2 },
  { steps: [0, 3, 6, 8, 11, 14], oct: [0, 0, 1, 0, 0, 1], len: 2 },
  { steps: [0, 2, 3, 6, 8, 10, 11, 14], oct: [0, 1, 0, 0, 0, 1, 0, 1], len: 1 },
  { steps: [0, 4, 6, 8, 12, 14], oct: [0, 0, 1, 0, 0, 1], len: 2 },
];

const BOSS_BASS = { steps: [...Array(16).keys()], oct: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1], len: 1 };

// [start, length] pairs inside one 16-step bar
const LEAD_RHYTHMS = [
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 6], [14, 2]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 8]],
  [[0, 4], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 2], [3, 1], [4, 2], [6, 4], [10, 2], [12, 4]],
  [[0, 8], [8, 4], [12, 4]],
];

const KICKS = [[0, 8], [0, 6, 8], [0, 3, 8, 11], [0, 8, 10], [0, 7, 10]];
const SNARES = [[4, 12], [4, 12, 15], [4, 10, 12]];

function degToMidi(scale, root, deg) {
  const oct = Math.floor(deg / 7);
  const idx = ((deg % 7) + 7) % 7;
  return root + oct * 12 + scale[idx];
}

function chordArp(scale, deg) {
  const r = degToMidi(scale, 0, deg);
  return [0, degToMidi(scale, 0, deg + 2) - r, degToMidi(scale, 0, deg + 4) - r];
}

function makeMotif(rng) {
  const bars = [rng.pick(LEAD_RHYTHMS), rng.pick(LEAD_RHYTHMS)];
  const notes = [];
  let cur = rng.pick([0, 2, 4, 7]);
  bars.forEach((rhythm, b) => {
    for (const [s, l] of rhythm) {
      if (s % 4 === 0) {
        const chordTones = [0, 2, 4, 7, 9].filter((d) => Math.abs(d - cur) <= 4);
        cur = chordTones.length ? rng.pick(chordTones) : 4;
      } else {
        cur += rng.pick([-2, -1, -1, 1, 1, 2]);
        cur = Math.max(-2, Math.min(9, cur));
      }
      notes.push({ s: b * 16 + s, l, deg: cur });
    }
  });
  return notes;
}

function varyMotif(rng, motif) {
  return motif.map((n) => (n.s >= 16 && rng.chance(0.5) ? { ...n, deg: Math.max(-2, Math.min(9, n.deg + rng.pick([-2, -1, 1, 2]))) } : n));
}

export function composeSong(seed, style = 'sector') {
  const rng = new RNG(seed);
  const boss = style === 'boss';
  const title = style === 'title';
  const bpm = boss ? rng.int(150, 166) : title ? 120 : rng.int(124, 142);
  const scale = SCALES[boss ? rng.pick(['harmonic', 'phrygian']) : rng.pick(['minor', 'dorian', 'harmonic', 'minor', 'mixolydian'])];
  const root = rng.int(40, 47); // bass root (E2..B2)
  const leadRoot = root + 24;

  const progA = rng.pick(PROGRESSIONS);
  let progB = rng.pick(PROGRESSIONS);
  if (progB === progA) progB = PROGRESSIONS[(PROGRESSIONS.indexOf(progA) + 3) % PROGRESSIONS.length];

  const bassR = boss ? BOSS_BASS : rng.pick(BASS_RHYTHMS);
  const kick = boss ? [0, 4, 8, 12] : rng.pick(KICKS);
  const snare = rng.pick(SNARES);
  const hatStep = boss ? 1 : rng.pick([2, 2, 4]);
  const arpSteps = rng.pick([[0, 4, 8, 12], [0, 8], [0, 2, 4, 6, 8, 10, 12, 14], [0, 6, 12]]);
  const arpLen = Math.max(1, Math.round(16 / arpSteps.length) - 1);

  const motifA = makeMotif(rng);
  const motifA2 = varyMotif(rng, motifA);
  const motifB = makeMotif(rng);
  const leadShiftB = rng.pick([0, 2, 7]);

  // arrangement: intro (2 bars) then a looped A A' B A'
  const plan = [
    ...[0, 1].map((i) => ({ sec: 'intro', prog: progA, bar: i })),
    ...[0, 1, 2, 3].map((i) => ({ sec: 'A', prog: progA, bar: i, motif: motifA })),
    ...[0, 1, 2, 3].map((i) => ({ sec: 'A2', prog: progA, bar: i, motif: motifA2 })),
    ...[0, 1, 2, 3].map((i) => ({ sec: 'B', prog: progB, bar: i, motif: motifB, shift: leadShiftB })),
    ...[0, 1, 2, 3].map((i) => ({ sec: 'A3', prog: progA, bar: i, motif: i < 2 ? motifA : motifA2 })),
  ];

  const lead = [];
  const echo = [];
  const bass = [];
  const arp = [];
  const kicks = [];
  const snares = [];
  const hats = [];

  plan.forEach((bar, bi) => {
    const base = bi * 16;
    const chord = bar.prog[bar.bar % 4];
    const chordRoot = degToMidi(scale, root, chord);

    bassR.steps.forEach((s, i) => {
      bass.push({ s: base + s, l: bassR.len, n: chordRoot + (bassR.oct[i] ? 12 : 0), v: s % 4 === 0 ? 1 : 0.8 });
    });

    for (const s of kick) kicks.push({ s: base + s });
    if (bar.sec !== 'intro' || bar.bar === 1) for (const s of snare) snares.push({ s: base + s });
    for (let s = 0; s < 16; s += hatStep) hats.push({ s: base + s, v: s % 4 === 0 ? 1 : 0.6 });
    if (!boss && bar.bar === 3) hats.push({ s: base + 14 });

    if (bar.sec === 'intro') return;

    const arpOffsets = chordArp(scale, chord);
    for (const s of arpSteps) arp.push({ s: base + s, l: arpLen, n: degToMidi(scale, root + 24, chord), arp: arpOffsets });

    // two-bar motif, played over bars (0,1) and (2,3), transposed onto each chord
    const half = bar.bar % 2;
    for (const n of bar.motif) {
      if (Math.floor(n.s / 16) !== half) continue;
      const deg = chord + n.deg + (bar.shift || 0);
      const note = { s: base + (n.s % 16), l: n.l, n: degToMidi(scale, leadRoot, deg) };
      lead.push(note);
      echo.push({ ...note, s: note.s + 3 });
    }
  });

  const length = plan.length * 16;
  const loopStart = 32;
  const wrap = (n) => ({ ...n, s: n.s >= length ? loopStart + (n.s - length) : n.s });

  return {
    bpm,
    length,
    loopStart,
    tracks: [
      { inst: 'lead', notes: lead },
      { inst: 'echo', notes: echo.map(wrap) },
      { inst: title ? 'tri' : 'bass', notes: bass },
      { inst: 'arp', notes: arp },
      { inst: 'kick', notes: kicks },
      { inst: 'snare', notes: snares },
      { inst: boss ? 'hat' : 'hat', notes: hats },
    ],
  };
}

export const TITLE_SEED = hashSeed('HYBRISCLONE-TITLE');

function jingle(bpm, leadNotes, bassNotes) {
  const length = Math.max(...leadNotes.map((n) => n.s + n.l), ...bassNotes.map((n) => n.s + n.l)) + 2;
  return {
    bpm,
    length,
    loopStart: 0,
    tracks: [
      { inst: 'lead', notes: leadNotes },
      { inst: 'echo', notes: leadNotes.map((n) => ({ ...n, s: n.s + 2 })) },
      { inst: 'bass', notes: bassNotes },
    ],
  };
}

export const JINGLES = {
  gameOver: () =>
    jingle(
      96,
      [
        { s: 0, l: 4, n: 72 },
        { s: 4, l: 4, n: 71 },
        { s: 8, l: 4, n: 68 },
        { s: 12, l: 4, n: 67 },
        { s: 16, l: 16, n: 63 },
      ],
      [
        { s: 0, l: 8, n: 48 },
        { s: 8, l: 8, n: 44 },
        { s: 16, l: 16, n: 39 },
      ]
    ),
  sectorClear: () =>
    jingle(
      140,
      [
        { s: 0, l: 2, n: 67 },
        { s: 2, l: 2, n: 72 },
        { s: 4, l: 2, n: 76 },
        { s: 6, l: 2, n: 79 },
        { s: 8, l: 3, n: 84 },
        { s: 11, l: 1, n: 79 },
        { s: 12, l: 12, n: 84 },
      ],
      [
        { s: 0, l: 4, n: 48 },
        { s: 4, l: 4, n: 55 },
        { s: 8, l: 4, n: 53 },
        { s: 12, l: 12, n: 48 },
      ]
    ),
};
