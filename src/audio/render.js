// Offline song renderer. Songs are rendered section by section ("segments"), each
// into its own OfflineAudioContext with a reverb/echo tail. Playback overlaps the
// tail of one segment with the start of the next, which reproduces a continuous
// render (the mix graph is linear apart from the gentle master saturation), so
// music can start as soon as the first section is ready.
import { playNote } from './synth/instruments.js';
import { createMix, createTrack, duckAt } from './synth/mixer.js';
import { drumKit } from './synth/dsp.js';

export const MUSIC_RATE = 32000;
export const TAIL = 2.5;

const kitCache = new Map();
function kitFor(ctx) {
  const sr = ctx.sampleRate;
  if (!kitCache.has(sr)) {
    const raw = drumKit(sr);
    const noise = new Float32Array(sr);
    let x = 12345;
    for (let i = 0; i < noise.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      noise[i] = (x / 0x7fffffff) * 2 - 1;
    }
    raw.noise = noise;
    kitCache.set(sr, raw);
  }
  const kit = {};
  for (const [k, data] of Object.entries(kitCache.get(sr))) {
    const b = ctx.createBuffer(1, data.length, sr);
    b.copyToChannel(data, 0);
    kit[k] = b;
  }
  return kit;
}

export const stepDuration = (song) => 60 / song.bpm / 4;

/** One segment per section: [{ from, to, dur }] in steps / seconds. */
export function songSegments(song) {
  const sd = stepDuration(song);
  return song.sections.map((s) => {
    const from = s.start;
    const to = s.start + s.bars * 16;
    return { from, to, dur: (to - from) * sd, name: s.name };
  });
}

/** Render steps [from, to) of a song into a stereo buffer of (to-from) steps + TAIL seconds. */
export async function renderSegment(song, from, to, sampleRate = MUSIC_RATE) {
  const sd = stepDuration(song);
  const dur = (to - from) * sd + TAIL;
  const ctx = new OfflineAudioContext(2, Math.ceil(dur * sampleRate), sampleRate);
  const kit = kitFor(ctx);
  const mix = createMix(ctx, song.bpm);
  const strips = song.tracks.map((tr) => {
    const pts = (tr.filter || []).map(([s, hz]) => [(s - from) * sd, hz]).filter(([t]) => t >= -0.001 && t <= dur);
    return createTrack(ctx, mix, { ...tr, filter: pts });
  });
  song.tracks.forEach((tr, ti) => {
    for (const n of tr.notes) {
      if (n.s < from || n.s >= to) continue;
      const t = (n.s - from) * sd;
      playNote(tr.inst, ctx, strips[ti].input, n, t, (n.l || 1) * sd, kit);
      if (tr.inst === 'drums' && n.d === 'kick') for (const s of strips) duckAt(s, t);
    }
  });
  return ctx.startRendering();
}
