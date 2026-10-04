// WebAudio instrument patches used when rendering songs offline.
// Each patch: (ctx, out, note, t, dur, kit) where note = { n: midi, v, slide, arp }.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const nyq = (ctx, f) => Math.min(f, ctx.sampleRate * 0.45);

function adsr(param, t, dur, { a = 0.005, d = 0.1, s = 0.7, r = 0.1, peak = 1 }) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + a);
  param.setTargetAtTime(peak * s, t + a, d / 3);
  const end = t + Math.max(dur, a + 0.01);
  param.setTargetAtTime(0, end, r / 4);
  return end + r * 1.5;
}

function osc(ctx, type, freq, t, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  return o;
}

function glide(o, from, to, t, time = 0.07) {
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + time);
}

function vibrato(ctx, oscs, t, stop, { rate = 5.5, depth = 14, delay = 0.18 } = {}) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.25);
  lfo.connect(g);
  for (const o of oscs) g.connect(o.detune);
  lfo.start(t);
  lfo.stop(stop);
}

const PATCHES = {
  supersaw(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const v = note.v ?? 1;
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(nyq(ctx, f * 3), t);
    filt.frequency.linearRampToValueAtTime(nyq(ctx, f * 9), t + 0.04);
    filt.frequency.setTargetAtTime(nyq(ctx, f * 5), t + 0.05, 0.25);
    const stop = adsr(amp.gain, t, dur, { a: 0.01, d: 0.25, s: 0.75, r: 0.18, peak: 0.16 * v });
    const oscs = [-16, -8, 0, 8, 16].map((dt) => osc(ctx, 'sawtooth', f, t, dt));
    if (note.slide) for (const o of oscs) glide(o, mtof(note.slide), f, t);
    vibrato(ctx, oscs, t, stop);
    for (const o of oscs) {
      o.connect(filt);
      o.start(t);
      o.stop(stop);
    }
    filt.connect(amp).connect(out);
  },
  pulse(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 4200;
    const stop = adsr(amp.gain, t, dur, { a: 0.006, d: 0.15, s: 0.65, r: 0.12, peak: 0.2 * (note.v ?? 1) });
    const oscs = [osc(ctx, 'square', f, t, -7), osc(ctx, 'square', f, t, 7)];
    if (note.slide) for (const o of oscs) glide(o, mtof(note.slide), f, t);
    vibrato(ctx, oscs, t, stop, { depth: 18 });
    for (const o of oscs) {
      o.connect(filt);
      o.start(t);
      o.stop(stop);
    }
    filt.connect(amp).connect(out);
  },
  acid(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const v = note.v ?? 1;
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 11;
    const peak = 300 + 3600 * v * v;
    filt.frequency.setValueAtTime(peak, t);
    filt.frequency.setTargetAtTime(180, t + 0.01, 0.09);
    const stop = adsr(amp.gain, t, dur, { a: 0.003, d: 0.12, s: 0.6, r: 0.05, peak: 0.22 * (0.7 + 0.3 * v) });
    const o = osc(ctx, 'sawtooth', f, t);
    if (note.slide) glide(o, mtof(note.slide), f, t, 0.05);
    o.connect(filt).connect(amp).connect(out);
    o.start(t);
    o.stop(stop);
  },
  bass(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 2;
    filt.frequency.setValueAtTime(nyq(ctx, f * 8), t);
    filt.frequency.setTargetAtTime(nyq(ctx, f * 2.5), t, 0.08);
    const stop = adsr(amp.gain, t, dur, { a: 0.003, d: 0.15, s: 0.55, r: 0.05, peak: 0.28 * (note.v ?? 1) });
    const o1 = osc(ctx, 'square', f, t);
    const o2 = osc(ctx, 'sine', f / 2, t);
    if (note.slide) {
      glide(o1, mtof(note.slide), f, t, 0.05);
      glide(o2, mtof(note.slide) / 2, f / 2, t, 0.05);
    }
    const sub = ctx.createGain();
    sub.gain.value = 0.9;
    o1.connect(filt);
    o2.connect(sub).connect(filt);
    filt.connect(amp).connect(out);
    for (const o of [o1, o2]) {
      o.start(t);
      o.stop(stop);
    }
  },
  pad(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 0.7;
    filt.frequency.setValueAtTime(700, t);
    filt.frequency.linearRampToValueAtTime(2400, t + dur * 0.6);
    const stop = adsr(amp.gain, t, dur, { a: 0.35, d: 0.6, s: 0.85, r: 0.8, peak: 0.085 * (note.v ?? 1) });
    for (const dt of [-9, 9]) {
      const o = osc(ctx, 'sawtooth', f, t, dt);
      o.connect(filt);
      o.start(t);
      o.stop(stop);
    }
    filt.connect(amp).connect(out);
  },
  bell(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const car = osc(ctx, 'sine', f, t);
    const mod = osc(ctx, 'sine', f * 3.5, t);
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(f * 2.4, t);
    mg.gain.setTargetAtTime(f * 0.2, t, 0.15);
    mod.connect(mg).connect(car.frequency);
    const stop = t + Math.max(dur, 0.2) + 1.2;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.2 * (note.v ?? 1), t + 0.004);
    amp.gain.setTargetAtTime(0, t + 0.01, 0.35);
    car.connect(amp).connect(out);
    for (const o of [car, mod]) {
      o.start(t);
      o.stop(stop);
    }
  },
  pluck(ctx, out, note, t, dur) {
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 3;
    filt.frequency.setValueAtTime(nyq(ctx, f * 10), t);
    filt.frequency.setTargetAtTime(nyq(ctx, f * 1.5), t, 0.06);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(0.13 * (note.v ?? 1), t + 0.003);
    amp.gain.setTargetAtTime(0, t + 0.01, Math.min(0.2, dur * 0.5));
    const o = osc(ctx, 'sawtooth', f, t);
    o.connect(filt).connect(amp).connect(out);
    o.start(t);
    o.stop(t + dur + 0.6);
  },
  amiga(ctx, out, note, t, dur) {
    // classic tracker arpeggio: the chord cycles at 50Hz on one channel
    const f = mtof(note.n);
    const amp = ctx.createGain();
    const o = osc(ctx, 'square', f, t);
    const arp = note.arp || [0, 4, 7];
    let k = 0;
    for (let tt = t; tt < t + dur; tt += 1 / 50, k++) o.frequency.setValueAtTime(f * Math.pow(2, arp[k % arp.length] / 12), tt);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 5000;
    const stop = adsr(amp.gain, t, dur, { a: 0.003, d: 0.08, s: 0.7, r: 0.04, peak: 0.075 * (note.v ?? 1) });
    o.connect(filt).connect(amp).connect(out);
    o.start(t);
    o.stop(stop);
  },
  stab(ctx, out, note, t, dur) {
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 4;
    filt.frequency.setValueAtTime(400, t);
    filt.frequency.linearRampToValueAtTime(3200, t + 0.015);
    filt.frequency.setTargetAtTime(500, t + 0.02, 0.1);
    const stop = adsr(amp.gain, t, dur, { a: 0.004, d: 0.12, s: 0.3, r: 0.08, peak: 0.09 * (note.v ?? 1) });
    for (const off of note.arp || [0, 3, 7]) {
      const o = osc(ctx, 'sawtooth', mtof(note.n + off), t, (off % 5) * 3);
      o.connect(filt);
      o.start(t);
      o.stop(stop);
    }
    filt.connect(amp).connect(out);
  },
  riser(ctx, out, note, t, dur, kit) {
    const src = ctx.createBufferSource();
    src.buffer = kit.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.35 * (note.v ?? 1), t + dur);
    amp.gain.setTargetAtTime(0, t + dur, 0.05);
    src.connect(bp).connect(amp).connect(out);
    src.start(t);
    src.stop(t + dur + 0.3);
  },
  drums(ctx, out, note, t, dur, kit) {
    const buf = kit[note.d];
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (note.pitch) src.playbackRate.value = note.pitch;
    const g = ctx.createGain();
    g.gain.value = (note.v ?? 1) * (DRUM_LEVEL[note.d] ?? 0.5);
    const p = ctx.createStereoPanner();
    p.pan.value = DRUM_PAN[note.d] ?? 0;
    src.connect(g).connect(p).connect(out);
    src.start(t);
  },
};

const DRUM_LEVEL = { kick: 0.85, snare: 0.55, clap: 0.42, hat: 0.2, ohat: 0.2, crash: 0.3, tomL: 0.5, tomM: 0.5, tomH: 0.5 };
const DRUM_PAN = { hat: 0.25, ohat: 0.25, crash: -0.25, tomL: -0.35, tomM: 0, tomH: 0.35, clap: -0.05 };

export function playNote(inst, ctx, out, note, t, dur, kit) {
  const p = PATCHES[inst];
  if (p) p(ctx, out, note, t, dur, kit);
}

export const INSTRUMENT_NAMES = Object.keys(PATCHES);
