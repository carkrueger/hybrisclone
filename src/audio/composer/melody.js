// Melody generation: motifs, development, hooks, ornaments, counter-melodies.
// Melody notes are expressed as scale degrees relative to the current chord root.

// [start, length] pairs inside one 16-step bar
export const RHYTHMS = [
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]],
  [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
  [[0, 6], [6, 2], [8, 6], [14, 2]],
  [[0, 1], [1, 1], [2, 2], [4, 2], [6, 2], [8, 8]],
  [[0, 4], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]],
  [[0, 2], [3, 1], [4, 2], [6, 4], [10, 2], [12, 4]],
  [[0, 3], [3, 3], [6, 3], [9, 3], [12, 4]],
  [[2, 2], [4, 2], [6, 2], [8, 4], [12, 2], [14, 2]],
];

export const HOOK_RHYTHMS = [
  [[0, 4], [4, 2], [6, 2], [8, 8]],
  [[0, 6], [6, 2], [8, 4], [12, 4]],
  [[0, 3], [3, 3], [6, 2], [8, 8]],
  [[0, 2], [2, 2], [4, 4], [8, 6], [14, 2]],
];

const CHORD_TONES = [0, 2, 4, 7];

export function makeMotif(rng, { bars = 2, rhythms = RHYTHMS, low = -2, high = 9, start = null } = {}) {
  const notes = [];
  let cur = start ?? rng.pick(CHORD_TONES);
  for (let b = 0; b < bars; b++) {
    const rhythm = rng.pick(rhythms);
    for (const [s, l] of rhythm) {
      if (s % 4 === 0) {
        const near = [0, 2, 4, 7, 9].filter((d) => Math.abs(d - cur) <= 4 && d >= low && d <= high);
        cur = near.length ? rng.pick(near) : 4;
      } else {
        cur += rng.pick([-2, -1, -1, 1, 1, 2]);
        cur = Math.max(low, Math.min(high, cur));
      }
      notes.push({ s: b * 16 + s, l, deg: cur });
    }
  }
  return notes;
}

/** small variations: change some pitches in the second half, keep rhythm */
export function vary(rng, motif, amount = 0.5) {
  const half = Math.max(...motif.map((n) => n.s)) / 2;
  return motif.map((n) =>
    n.s >= half && rng.chance(amount) ? { ...n, deg: Math.max(-2, Math.min(10, n.deg + rng.pick([-2, -1, 1, 2]))) } : { ...n }
  );
}

/** melodic sequence: same shape shifted by scale steps */
export const transpose = (motif, steps) => motif.map((n) => ({ ...n, deg: n.deg + steps }));

/** mirror the contour around the first note */
export function invert(motif) {
  const pivot = motif[0].deg;
  return motif.map((n) => ({ ...n, deg: Math.max(-3, Math.min(10, pivot - (n.deg - pivot))) }));
}

/** rhythmic variation: split long notes, merge short pairs */
export function rerhythm(rng, motif) {
  const out = [];
  for (const n of motif) {
    if (n.l >= 4 && rng.chance(0.5)) {
      const h = Math.floor(n.l / 2);
      out.push({ ...n, l: h });
      out.push({ ...n, s: n.s + h, l: n.l - h, deg: n.deg + rng.pick([-1, 1, 2]) });
    } else out.push({ ...n });
  }
  return out;
}

/** end a phrase on a long chord tone */
export function cadence(rng, motif, target = 0) {
  const out = motif.map((n) => ({ ...n }));
  const last = out[out.length - 1];
  const end = Math.max(...out.map((n) => n.s + n.l));
  last.deg = target;
  last.l = Math.max(last.l, end - last.s);
  return out;
}

/** 8-bar phrase built from a 2-bar motif: A, A', sequence, cadence */
export function phrase8(rng, motif) {
  const parts = [
    motif,
    vary(rng, motif, 0.4),
    rng.chance(0.5) ? transpose(motif, rng.pick([1, 2, -1])) : rerhythm(rng, motif),
    cadence(rng, rng.chance(0.4) ? invert(motif) : vary(rng, motif, 0.7), rng.pick([0, 0, 4, 7])),
  ];
  const out = [];
  parts.forEach((p, i) => p.forEach((n) => out.push({ ...n, s: n.s + i * 32 })));
  return out;
}

/** decorate: grace notes before long notes, slides on leaps */
export function ornament(rng, notes, { graceChance = 0.2, slideChance = 0.35 } = {}) {
  const out = [];
  let prev = null;
  for (const n of notes) {
    const m = { ...n };
    if (prev && Math.abs(m.n - prev.n) >= 4 && rng.chance(slideChance)) m.slide = prev.n;
    if (m.l >= 4 && m.s > 0 && rng.chance(graceChance) && !(prev && prev.s + prev.l > m.s - 1)) {
      out.push({ s: m.s - 1, l: 1, n: m.n + rng.pick([1, 2, -1]), v: 0.6 });
    }
    out.push(m);
    prev = m;
  }
  return out;
}

/**
 * Counter-melody: one note per half bar, a chord tone that moves against the lead
 * (thirds/sixths below, contrary motion when the lead leaps).
 */
export function counterMelody(rng, lead, chordAt, lo = 60, hi = 79) {
  const out = [];
  const maxStep = Math.max(...lead.map((n) => n.s + n.l), 0);
  let prevLead = null;
  let prev = null;
  for (let s = 0; s < maxStep; s += 8) {
    const ln = lead.filter((n) => n.s <= s + 2 && n.s + n.l > s).pop() || lead.find((n) => n.s >= s && n.s < s + 8);
    const tones = chordAt(s);
    let target;
    if (ln) {
      const want = prevLead !== null && prev !== null ? prev - Math.sign(ln.n - prevLead) * 3 : ln.n - rng.pick([3, 4, 8, 9]);
      target = want;
      prevLead = ln.n;
    } else target = prev ?? (lo + hi) / 2;
    let best = null;
    for (let p = lo; p <= hi; p++) {
      if (!tones.includes(p % 12)) continue;
      if (ln && Math.abs(p - ln.n) < 3) continue;
      if (best === null || Math.abs(p - target) < Math.abs(best - target)) best = p;
    }
    if (best !== null && rng.chance(0.85)) {
      out.push({ s, l: rng.pick([6, 8, 8]), n: best, v: 0.8 });
      prev = best;
    }
  }
  return out;
}
