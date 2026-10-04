// Song arranger: turns a seed into a full multi-section, multi-track song.
// composeSong(seed, style) is pure and deterministic.
//
// Song format:
// { bpm, introSteps, loopSteps, sections: [{ name, start, bars, keyShift }],
//   tracks: [{ name, inst, vol, pan, echo, reverb, duck, filter, notes: [{ s, l, n|d, v, slide, arp }] }] }
// Steps are 16th notes. The intro plays once, then [introSteps, introSteps + loopSteps) loops.
import { RNG, hashSeed } from '../../core/rng.js';
import { SCALES, degToMidi, chordShape, voiceLead, PROGRESSIONS } from './theory.js';
import * as M from './melody.js';

const STYLES = {
  sector: {
    bpm: [128, 146],
    scales: ['aeolian', 'dorian', 'harmonic', 'aeolian', 'phrygian', 'mixolydian'],
    leads: ['supersaw', 'pulse', 'supersaw'],
    basses: ['acid', 'bass', 'acid'],
    form: [
      { name: 'intro', bars: 4, prog: 'A', drums: 'intro', bass: 'pedal', pad: 1, arp: 1, sweep: 1, riser: 1 },
      { name: 'verse', bars: 8, prog: 'A', lead: 'verse', drums: 'verse', bass: 'verse', pad: 0.6, arp: 1 },
      { name: 'chorus', bars: 8, prog: 'B', lead: 'hook', drums: 'chorus', bass: 'chorus', pad: 1, arp: 1, counter: 1, crash: 1 },
      { name: 'verse2', bars: 8, prog: 'A', lead: 'verse2', drums: 'verse', bass: 'verse', pad: 0.6, arp: 1, counter: 1 },
      { name: 'chorus2', bars: 8, prog: 'B', lead: 'hook', double: 1, drums: 'chorus', bass: 'chorus', pad: 1, arp: 1, counter: 1, crash: 1 },
      { name: 'break', bars: 8, prog: 'C', lead: 'break', breakInst: 'bell', drums: 'half', bass: 'whole', pad: 1, arp: 1, crash: 1 },
      { name: 'build', bars: 4, prog: 'A', pedal: 4, drums: 'build', bass: 'pedal', arp: 1, riser: 1 },
      { name: 'final', bars: 8, prog: 'B', keyShift: 2, lead: 'hook', double: 1, drums: 'chorus', bass: 'chorus', pad: 1, arp: 1, counter: 1, crash: 1 },
    ],
  },
  boss: {
    bpm: [150, 166],
    scales: ['harmonic', 'phrygian'],
    leads: ['supersaw', 'pulse'],
    basses: ['acid'],
    form: [
      { name: 'intro', bars: 2, prog: 'A', pedal: 0, drums: 'build', bass: 'pedal', riser: 1, stabs: 1 },
      { name: 'riff', bars: 8, prog: 'A', lead: 'riff', drums: 'boss', bass: 'acid', stabs: 1, arp: 1, crash: 1 },
      { name: 'hook', bars: 8, prog: 'B', lead: 'hook', drums: 'boss', bass: 'acid', pad: 1, counter: 1, arp: 1, crash: 1 },
      { name: 'break', bars: 4, prog: 'A', pedal: 0, drums: 'half', bass: 'whole', pad: 1, riser: 1, stabs: 1 },
      { name: 'hook2', bars: 8, prog: 'B', keyShift: 1, lead: 'hook', double: 1, drums: 'boss', bass: 'acid', pad: 1, counter: 1, stabs: 1, crash: 1 },
    ],
  },
  title: {
    bpm: [112, 120],
    scales: ['aeolian', 'dorian', 'ionian'],
    leads: ['supersaw'],
    basses: ['bass'],
    form: [
      { name: 'intro', bars: 4, prog: 'A', lead: 'break', breakInst: 'bell', drums: 'none', bass: 'whole', pad: 1, sweep: 1 },
      { name: 'theme', bars: 8, prog: 'A', lead: 'verse', drums: 'verse', bass: 'verse', pad: 0.8, arp: 1 },
      { name: 'anthem', bars: 8, prog: 'B', lead: 'hook', drums: 'chorus', bass: 'chorus', pad: 1, arp: 1, counter: 1, crash: 1 },
      { name: 'bridge', bars: 8, prog: 'C', lead: 'break', breakInst: 'bell', drums: 'half', bass: 'whole', pad: 1, arp: 1 },
      { name: 'anthem2', bars: 8, prog: 'B', keyShift: 2, lead: 'hook', double: 1, drums: 'chorus', bass: 'chorus', pad: 1, arp: 1, counter: 1, crash: 1 },
    ],
  },
};

const BREAK_RHYTHMS = [
  [[0, 8], [8, 8]],
  [[0, 6], [6, 10]],
  [[0, 4], [4, 4], [8, 8]],
  [[0, 12], [12, 4]],
];
const RIFF_RHYTHMS = [
  [[0, 1], [2, 1], [3, 1], [6, 2], [8, 1], [10, 1], [11, 1], [14, 2]],
  [[0, 2], [3, 1], [4, 2], [7, 1], [8, 2], [11, 1], [12, 3]],
  [[0, 1], [1, 1], [2, 2], [6, 1], [7, 1], [8, 2], [12, 2], [14, 2]],
];

// ---------------------------------------------------------------- drums
function drumBar(kind, rng, b, bars, nextIsBreak, sectionStart) {
  const ev = [];
  const hit = (s, d, v = 1) => ev.push({ s, d, v: v * rng.range(0.86, 1) });
  const lastBar = b === bars - 1;
  const phraseEnd = b % 4 === 3;
  switch (kind) {
    case 'none':
      break;
    case 'intro':
      for (let s = 0; s < 16; s += 2) if (b >= bars - 2) hit(s, 'hat', s % 4 ? 0.5 : 0.8);
      if (lastBar) {
        hit(0, 'kick');
        for (let s = 8; s < 16; s++) hit(s, 'snare', 0.35 + (s - 8) * 0.08);
      }
      break;
    case 'verse':
      for (const s of [0, 7, 8, 10]) hit(s, 'kick', s ? 0.85 : 1);
      hit(4, 'snare');
      hit(12, 'snare');
      for (let s = 0; s < 16; s += 2) hit(s, 'hat', s % 4 ? 0.45 : 0.75);
      if (b % 2 === 1) hit(14, 'ohat', 0.6);
      if (rng.chance(0.4)) hit(rng.pick([6, 11, 15]), 'snare', 0.25);
      break;
    case 'chorus':
      for (const s of [0, 4, 8, 12]) hit(s, 'kick');
      hit(4, 'snare');
      hit(12, 'snare');
      hit(4, 'clap', 0.8);
      hit(12, 'clap', 0.8);
      for (let s = 0; s < 16; s += 2) hit(s, s % 4 === 2 ? 'ohat' : 'hat', s % 4 === 2 ? 0.55 : 0.7);
      if (rng.chance(0.35)) hit(15, 'snare', 0.3);
      break;
    case 'half':
      hit(0, 'kick');
      if (b % 2) hit(10, 'kick', 0.8);
      hit(8, 'snare', 0.9);
      for (let s = 0; s < 16; s += 4) hit(s + 2, 'hat', 0.4);
      break;
    case 'build': {
      for (const s of [0, 4, 8, 12]) hit(s, 'kick', 0.9);
      const density = b < bars / 2 ? 4 : b < bars - 1 ? 2 : 1;
      for (let s = 0; s < 16; s += density) hit(s, 'snare', 0.3 + 0.6 * ((b * 16 + s) / (bars * 16)));
      for (let s = 0; s < 16; s += 2) hit(s, 'hat', 0.4);
      return ev;
    }
    case 'boss':
      for (const s of [0, 4, 8, 12]) hit(s, 'kick');
      if (b % 2) hit(14, 'kick', 0.7);
      hit(4, 'snare');
      hit(12, 'snare');
      for (let s = 0; s < 16; s++) hit(s, s % 4 === 2 ? 'ohat' : 'hat', s % 4 === 2 ? 0.5 : s % 2 ? 0.35 : 0.6);
      break;
  }
  if (kind === 'none' || kind === 'intro') return ev;
  // fills
  if (lastBar && !nextIsBreak) {
    const keep = ev.filter((e) => e.s < 8);
    const toms = ['tomH', 'tomH', 'tomM', 'tomM', 'tomL', 'tomL', 'tomL', 'snare'];
    for (let s = 8; s < 16; s++) keep.push({ s, d: toms[s - 8], v: 0.7 + (s - 8) * 0.04 });
    return keep;
  }
  if (phraseEnd && rng.chance(0.75)) {
    const keep = ev.filter((e) => e.s < 12 || e.d === 'kick');
    for (let s = 12; s < 16; s++) keep.push({ s, d: 'snare', v: 0.45 + (s - 12) * 0.15 });
    return keep;
  }
  return ev;
}

// ---------------------------------------------------------------- bass
function bassBar(kind, rng, root, fifth, b) {
  const ev = [];
  const n = (s, l, p, v = 1, slide) => ev.push({ s, l, n: p, v, ...(slide ? { slide } : {}) });
  switch (kind) {
    case 'verse':
      for (const [s, l, w] of [[0, 2, 0], [3, 1, 0], [4, 2, 12], [6, 2, 0], [8, 2, 0], [11, 1, 7], [12, 2, 12], [14, 2, 0]]) {
        n(s, l, root + (w === 7 ? fifth : w), s % 4 === 0 ? 1 : 0.75);
      }
      break;
    case 'chorus':
      for (let s = 0; s < 16; s += 2) n(s, 2, root + (s % 4 === 2 ? 12 : 0), s % 4 === 0 ? 1 : 0.8);
      break;
    case 'whole':
      n(0, 14, root, 0.9);
      break;
    case 'pedal':
      for (let s = 0; s < 16; s += 2) n(s, 1, root + (b % 2 && s >= 8 ? 12 : 0), 0.8);
      break;
    case 'acid': {
      const pat = [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 10, 0, 12, 0, 7, 0];
      let prev = null;
      for (let s = 0; s < 16; s++) {
        if (s % 4 === 3 && rng.chance(0.3)) continue;
        const p = root + (pat[s] === 7 ? fifth : pat[s]);
        const slide = prev !== null && Math.abs(p - prev) >= 7 && rng.chance(0.35) ? prev : null;
        n(s, 1, p, s % 4 === 0 ? 1 : rng.range(0.45, 0.8), slide);
        prev = p;
      }
      break;
    }
  }
  return ev;
}

// ---------------------------------------------------------------- compose
export function composeSong(seed, style = 'sector', hints = null) {
  const base = STYLES[style];
  // theme hints colour the sector music; boss music keeps its driving style but borrows the scales
  const cfg = hints
    ? {
        ...base,
        scales: style === 'boss' ? [...base.scales, ...hints.scales.slice(0, 1)] : hints.scales,
        bpm: style === 'boss' ? base.bpm : hints.bpm,
        leads: hints.leads,
        basses: style === 'boss' ? base.basses : hints.basses,
      }
    : base;
  const rng = new RNG(seed);
  const bpm = rng.int(cfg.bpm[0], cfg.bpm[1]);
  const scaleName = rng.pick(cfg.scales);
  const scale = SCALES[scaleName];
  const major = scaleName === 'ionian' || scaleName === 'mixolydian';
  const key = rng.int(40, 47); // bass root E2..B2
  const progLib = major ? PROGRESSIONS.major : PROGRESSIONS.minor;
  const progs = { A: rng.pick(progLib) };
  progs.B = rng.pick(progLib.filter((p) => p !== progs.A));
  progs.C = rng.pick(progLib.filter((p) => p !== progs.A && p !== progs.B));
  const leadInst = rng.pick(cfg.leads);
  const bassInst = rng.pick(cfg.basses);
  const arpInst = style === 'boss' ? 'amiga' : rng.pick(['amiga', 'pluck', 'pluck']);
  const arpPattern = rng.pick(['up', 'updown', 'random']);
  const sevenths = rng.range(0.2, 0.6);

  // themes
  const verseMotif = M.makeMotif(rng, { bars: 2 });
  const hookMotif = M.makeMotif(rng, { bars: 2, rhythms: M.HOOK_RHYTHMS, low: 2, high: 11, start: rng.pick([4, 7]) });
  const breakMotif = M.makeMotif(rng, { bars: 2, rhythms: BREAK_RHYTHMS, low: 0, high: 9 });
  const riffMotif = M.makeMotif(rng, { bars: 1, rhythms: RIFF_RHYTHMS, low: -2, high: 5 });
  const phrases = {
    verse: M.phrase8(rng, verseMotif),
    verse2: M.phrase8(rng, M.rerhythm(rng, M.vary(rng, verseMotif, 0.6))),
    hook: (() => {
      const out = [];
      [hookMotif, M.vary(rng, hookMotif, 0.3), hookMotif, M.cadence(rng, M.vary(rng, hookMotif, 0.6), 0)].forEach((p, i) =>
        p.forEach((n) => out.push({ ...n, s: n.s + i * 32 }))
      );
      return out;
    })(),
    break: M.phrase8(rng, breakMotif),
    riff: (() => {
      const out = [];
      for (let i = 0; i < 8; i++) {
        const src = i % 4 === 3 ? M.vary(rng, riffMotif, 0.8) : riffMotif;
        src.forEach((n) => out.push({ ...n, s: n.s + i * 16 }));
      }
      return out;
    })(),
  };

  const T = {
    lead: { name: 'lead', inst: leadInst, vol: 1, pan: 0, echo: 0.22, reverb: 0.2, notes: [] },
    lead2: { name: 'lead2', inst: leadInst === 'pulse' ? 'supersaw' : 'pulse', vol: 0.5, pan: 0.3, echo: 0.2, reverb: 0.25, notes: [] },
    breakLead: { name: 'breakLead', inst: 'bell', vol: 0.8, pan: -0.15, echo: 0.4, reverb: 0.4, notes: [] },
    counter: { name: 'counter', inst: 'bell', vol: 0.6, pan: -0.35, echo: 0.3, reverb: 0.35, notes: [] },
    arp: { name: 'arp', inst: arpInst, vol: 0.85, pan: 0.35, echo: 0.22, reverb: 0.15, duck: 0.35, notes: [] },
    pad: { name: 'pad', inst: 'pad', vol: 1, pan: 0, reverb: 0.5, duck: 0.5, notes: [] },
    stab: { name: 'stab', inst: 'stab', vol: 0.8, pan: -0.2, echo: 0.25, reverb: 0.2, notes: [] },
    bass: { name: 'bass', inst: bassInst, vol: 1, pan: 0, duck: 0.2, notes: [] },
    drums: { name: 'drums', inst: 'drums', vol: 1, pan: 0, reverb: 0.1, notes: [] },
    fx: { name: 'fx', inst: 'riser', vol: 0.6, pan: 0, reverb: 0.4, notes: [] },
  };

  const sections = [];
  let bar = 0;
  let prevVoicing = null;
  cfg.form.forEach((sec, si) => {
    const start = bar * 16;
    const ks = sec.keyShift || 0;
    const nextIsBreak = cfg.form[si + 1] && cfg.form[si + 1].drums === 'half';
    sections.push({ name: sec.name, start, bars: sec.bars, keyShift: ks });
    const chordPcs = [];
    const chordDegs = [];

    for (let b = 0; b < sec.bars; b++) {
      const s0 = (bar + b) * 16;
      const deg = sec.pedal !== undefined ? sec.pedal : progs[sec.prog][b % 4];
      chordDegs.push(deg);
      const root = degToMidi(scale, key, deg) + ks;
      const fifth = degToMidi(scale, 0, deg + 4) - degToMidi(scale, 0, deg);
      const type = rng.chance(sevenths) ? 'seventh' : rng.chance(0.12) ? 'sus2' : 'triad';
      const shape = chordShape(scale, deg, type);
      chordPcs.push(shape.map((s) => (root + s) % 12));

      // drums
      for (const e of drumBar(sec.drums, rng, b, sec.bars, nextIsBreak, start)) T.drums.notes.push({ ...e, s: s0 + e.s });
      if (sec.crash && b === 0) T.drums.notes.push({ s: s0, d: 'crash', v: 0.9 });

      // bass
      for (const e of bassBar(sec.bass, rng, root, fifth, b)) T.bass.notes.push({ ...e, s: s0 + e.s });

      // pad: voice-led chord, one per bar
      const voicing = voiceLead(root, shape, prevVoicing);
      prevVoicing = voicing;
      if (sec.pad) for (const p of voicing) T.pad.notes.push({ s: s0, l: 16, n: p, v: sec.pad });

      // arpeggio / tracker arp
      if (sec.arp) {
        if (arpInst === 'amiga') {
          const offs = shape.slice(0, 3);
          for (let s = 0; s < 16; s += 4) T.arp.notes.push({ s: s0 + s, l: 3, n: root + 24, arp: offs, v: s === 0 ? 1 : 0.8 });
        } else {
          const tones = [...voicing, ...voicing.map((p) => p + 12)];
          for (let s = 0; s < 16; s++) {
            let idx;
            if (arpPattern === 'up') idx = s % tones.length;
            else if (arpPattern === 'updown') {
              const cyc = tones.length * 2 - 2;
              const k = s % cyc;
              idx = k < tones.length ? k : cyc - k;
            } else idx = (s * 5 + b * 3) % tones.length;
            T.arp.notes.push({ s: s0 + s, l: 1, n: tones[idx] + 12, v: s % 4 === 0 ? 0.9 : 0.6 });
          }
        }
      }

      // stabs on the off-beats
      if (sec.stabs) {
        for (const s of [2, 6, 10, 14]) if (rng.chance(0.75)) T.stab.notes.push({ s: s0 + s, l: 1, n: root + 24, arp: shape.slice(0, 3), v: 0.9 });
      }
    }

    // riser over the last 2 bars
    if (sec.riser) T.fx.notes.push({ s: start + Math.max(0, sec.bars - 2) * 16, l: Math.min(2, sec.bars) * 16, n: 60, v: 1 });

    // lead melody
    if (sec.lead) {
      const ph = phrases[sec.lead].filter((n) => n.s < sec.bars * 16);
      const leadRoot = key + 24 + (sec.lead === 'hook' ? 0 : sec.lead === 'riff' ? -12 : 0);
      const abs = ph.map((n) => {
        const deg = chordDegs[Math.floor(n.s / 16)];
        return { s: n.s, l: n.l, n: degToMidi(scale, leadRoot, deg + n.deg) + ks, v: 1 };
      });
      const notes = M.ornament(rng, abs, { graceChance: sec.lead === 'riff' ? 0 : 0.2 });
      const target = sec.breakInst ? T.breakLead : T.lead;
      for (const n of notes) target.notes.push({ ...n, s: start + n.s });
      if (sec.double) for (const n of notes) T.lead2.notes.push({ ...n, s: start + n.s, n: n.n + 12, v: 0.7, slide: n.slide ? n.slide + 12 : undefined });
      if (sec.counter) {
        const cm = M.counterMelody(rng, abs, (s) => chordPcs[Math.min(chordPcs.length - 1, Math.floor(s / 16))]);
        for (const n of cm) T.counter.notes.push({ ...n, s: start + n.s });
      }
    }
    bar += sec.bars;
  });

  const introSteps = cfg.form[0].bars * 16;
  const totalSteps = bar * 16;
  // filter sweep over the intro on pad + arp + lead
  const sweep = cfg.form[0].sweep ? [[0, 350], [introSteps, 14000]] : null;
  if (sweep) {
    T.pad.filter = sweep;
    T.arp.filter = sweep;
  }

  const tracks = Object.values(T).filter((t) => t.notes.length);
  for (const t of tracks) {
    t.notes.sort((a, b) => a.s - b.s);
    for (const n of t.notes) if (n.slide === undefined) delete n.slide;
  }
  return {
    style,
    bpm,
    scale: scaleName,
    key,
    introSteps,
    loopSteps: totalSteps - introSteps,
    sections,
    tracks,
  };
}

// ---------------------------------------------------------------- jingles
function jingle(bpm, bars, parts) {
  const tracks = parts.map((p) => ({ vol: 1, pan: 0, echo: 0.25, reverb: 0.35, ...p }));
  return { style: 'jingle', bpm, introSteps: bars * 16, loopSteps: 0, sections: [{ name: 'jingle', start: 0, bars, keyShift: 0 }], tracks };
}

export const JINGLES = {
  sectorClear: () =>
    jingle(140, 3, [
      {
        name: 'lead',
        inst: 'supersaw',
        notes: [
          { s: 0, l: 2, n: 67 },
          { s: 2, l: 2, n: 72 },
          { s: 4, l: 2, n: 76 },
          { s: 6, l: 2, n: 79 },
          { s: 8, l: 3, n: 84 },
          { s: 11, l: 1, n: 79 },
          { s: 12, l: 4, n: 84 },
          { s: 16, l: 20, n: 88 },
        ],
      },
      { name: 'lead2', inst: 'pulse', vol: 0.5, pan: 0.3, notes: [{ s: 8, l: 3, n: 79 }, { s: 12, l: 4, n: 79 }, { s: 16, l: 20, n: 84 }] },
      { name: 'pad', inst: 'pad', reverb: 0.5, notes: [60, 64, 67, 72].map((n) => ({ s: 16, l: 28, n })) },
      { name: 'bass', inst: 'bass', echo: 0, reverb: 0, notes: [{ s: 0, l: 4, n: 36 }, { s: 4, l: 4, n: 43 }, { s: 8, l: 4, n: 41 }, { s: 12, l: 4, n: 43 }, { s: 16, l: 24, n: 48 }] },
      {
        name: 'drums',
        inst: 'drums',
        echo: 0,
        reverb: 0.15,
        notes: [
          ...Array.from({ length: 12 }, (_, i) => ({ s: 4 + i, d: 'snare', v: 0.3 + i * 0.06 })),
          { s: 16, d: 'kick' },
          { s: 16, d: 'crash' },
        ],
      },
    ]),
  gameOver: () =>
    jingle(84, 3, [
      { name: 'bell', inst: 'bell', notes: [{ s: 0, l: 4, n: 76 }, { s: 4, l: 4, n: 74 }, { s: 8, l: 4, n: 72 }, { s: 12, l: 4, n: 71 }, { s: 16, l: 24, n: 69 }] },
      {
        name: 'pad',
        inst: 'pad',
        reverb: 0.55,
        notes: [
          ...[57, 60, 64].map((n) => ({ s: 0, l: 8, n })),
          ...[53, 57, 60].map((n) => ({ s: 8, l: 8, n })),
          ...[52, 56, 59].map((n) => ({ s: 16, l: 26, n })),
        ],
      },
      { name: 'bass', inst: 'bass', echo: 0, reverb: 0.1, notes: [{ s: 0, l: 8, n: 45 }, { s: 8, l: 8, n: 41 }, { s: 16, l: 24, n: 40 }] },
    ]),
};

export const TITLE_SEED = hashSeed('HYBRISCLONE-TITLE-V2');
