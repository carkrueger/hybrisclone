// Music theory helpers for the composer. All pitches are MIDI numbers.

export const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

/** midi pitch of scale degree `deg` (can be negative / beyond 7) above `root` */
export function degToMidi(scale, root, deg) {
  const oct = Math.floor(deg / 7);
  const idx = ((deg % 7) + 7) % 7;
  return root + oct * 12 + scale[idx];
}

/**
 * Diatonic chord on a scale degree.
 * type: 'triad' | 'seventh' | 'sus2' | 'sus4' | 'add9'
 * returns semitone offsets relative to the chord root (root = 0)
 */
export function chordShape(scale, deg, type = 'triad') {
  const r = degToMidi(scale, 0, deg);
  const at = (k) => degToMidi(scale, 0, deg + k) - r;
  switch (type) {
    case 'seventh':
      return [0, at(2), at(4), at(6)];
    case 'sus2':
      return [0, at(1), at(4)];
    case 'sus4':
      return [0, at(3), at(4)];
    case 'add9':
      return [0, at(2), at(4), at(8)];
    default:
      return [0, at(2), at(4)];
  }
}

/**
 * Voice a chord inside [lo, hi] as close as possible to the previous voicing
 * (smooth voice leading for pads).
 */
export function voiceLead(rootPitch, shape, prev, lo = 52, hi = 74) {
  const pcs = shape.map((s) => (rootPitch + s) % 12);
  const candidates = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    for (let base = lo; base <= hi - 7; base++) {
      if (base % 12 !== pcs[inv]) continue;
      const v = [base];
      for (let k = 1; k < pcs.length; k++) {
        const pc = pcs[(inv + k) % pcs.length];
        let n = v[v.length - 1] + 1;
        while (n % 12 !== pc) n++;
        v.push(n);
      }
      if (v[v.length - 1] <= hi + 4) candidates.push(v);
    }
  }
  if (!candidates.length) return shape.map((s) => rootPitch + s);
  if (!prev) return candidates[Math.floor(candidates.length / 2)];
  let best = candidates[0];
  let bestCost = Infinity;
  for (const c of candidates) {
    const avg = c.reduce((a, b) => a + b, 0) / c.length;
    const pavg = prev.reduce((a, b) => a + b, 0) / prev.length;
    let cost = Math.abs(avg - pavg) * 2;
    for (const n of c) cost += Math.min(...prev.map((p) => Math.abs(p - n)));
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  return best;
}

// Progressions as scale degrees (0-based) with a chord colour hint.
export const PROGRESSIONS = {
  minor: [
    [0, 5, 6, 0],
    [0, 5, 3, 4],
    [0, 3, 4, 0],
    [0, 6, 5, 4],
    [0, 3, 6, 4],
    [0, 2, 3, 4],
    [5, 6, 0, 0],
    [0, 4, 5, 3],
    [3, 4, 0, 5],
    [0, 6, 3, 4],
  ],
  major: [
    [0, 4, 5, 3],
    [0, 5, 3, 4],
    [3, 4, 0, 0],
    [0, 3, 4, 3],
    [5, 3, 0, 4],
  ],
};
