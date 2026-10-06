// Direct sample synthesis (Float32Array) for the drum kit and sound effects.
// These "samples" are generated once and played back like a MOD tracker would.
import { RNG } from '../../core/rng.js';

const TAU = Math.PI * 2;

export function synth(sampleRate, seconds, fn) {
  const n = Math.ceil(sampleRate * seconds);
  const out = new Float32Array(n);
  const state = {};
  for (let i = 0; i < n; i++) out[i] = fn(i / sampleRate, i, state);
  return normalize(out, 0.95);
}

export function normalize(buf, peak = 0.95) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

/** one-pole low-pass helper keyed by name inside a state object */
const lp = (st, key, x, a) => (st[key] = (st[key] ?? 0) + a * (x - (st[key] ?? 0)));
const coef = (fc, sr) => 1 - Math.exp((-TAU * fc) / sr);

function noiseGen(seed) {
  const r = new RNG(seed);
  return () => r.float() * 2 - 1;
}

const sq = (ph) => (ph % 1 < 0.5 ? 1 : -1);
const METAL = [205.3, 304.4, 369.6, 522.7, 540, 800];

export function drumKit(sr) {
  const nz = noiseGen(7);
  const kit = {};
  kit.kick = synth(sr, 0.5, (t, i, st) => {
    st.ph = (st.ph || 0) + (48 + 130 * Math.exp(-t * 28)) / sr;
    const body = Math.sin(TAU * st.ph) * Math.exp(-t * 6.5);
    const click = nz() * Math.exp(-t * 400) * 0.35;
    return Math.tanh((body + click) * 1.6);
  });
  kit.snare = synth(sr, 0.4, (t, i, st) => {
    const n = nz();
    const hp = n - lp(st, 'l', n, coef(1500, sr));
    const body = Math.sin(TAU * 185 * t) * Math.exp(-t * 22) * 0.6 + Math.sin(TAU * 330 * t) * Math.exp(-t * 28) * 0.3;
    return hp * Math.exp(-t * 13) * 0.9 + body;
  });
  kit.clap = synth(sr, 0.45, (t, i, st) => {
    const n = nz();
    const bp = lp(st, 'b', n - lp(st, 'h', n, coef(900, sr)), coef(2600, sr));
    let env = 0;
    for (const o of [0, 0.011, 0.023]) if (t >= o) env = Math.max(env, Math.exp(-(t - o) * 160));
    env = Math.max(env, t > 0.03 ? Math.exp(-(t - 0.03) * 16) * 0.7 : 0);
    return bp * env * 3;
  });
  const metal = (decay, len) =>
    synth(sr, len, (t, i, st) => {
      let s = 0;
      for (const f of METAL) s += sq(f * 1.6 * t);
      s = s / 6 + nz() * 0.25;
      const h1 = s - lp(st, 'a', s, coef(6500, sr));
      const h2 = h1 - lp(st, 'b', h1, coef(6500, sr));
      return h2 * Math.exp(-t * decay);
    });
  kit.hat = metal(55, 0.12);
  kit.ohat = metal(7, 0.6);
  kit.crash = synth(sr, 2.6, (t, i, st) => {
    let s = 0;
    for (const f of METAL) s += sq(f * 2.3 * t);
    s = s / 6 * 0.5 + nz();
    const h = s - lp(st, 'a', s, coef(4000, sr));
    return h * (Math.exp(-t * 2.1) * 0.9 + Math.exp(-t * 30) * 0.4);
  });
  const tom = (f0) =>
    synth(sr, 0.5, (t, i, st) => {
      st.ph = (st.ph || 0) + (f0 * (1 + 0.6 * Math.exp(-t * 18))) / sr;
      return Math.sin(TAU * st.ph) * Math.exp(-t * 7) + nz() * Math.exp(-t * 60) * 0.15;
    });
  kit.tomL = tom(95);
  kit.tomM = tom(135);
  kit.tomH = tom(185);
  return kit;
}

// ---------------------------------------------------------------- sound effects
export function sfxBank(sr) {
  const nz = noiseGen(99);
  const b = {};
  b.shoot = synth(sr, 0.09, (t, i, st) => {
    st.ph = (st.ph || 0) + (1700 * Math.exp(-t * 22) + 350) / sr;
    return (sq(st.ph) * 0.6 + Math.sin(TAU * st.ph * 2) * 0.3) * Math.exp(-t * 32) * (1 + nz() * 0.1);
  });
  b.enemyShoot = synth(sr, 0.14, (t, i, st) => {
    st.ph = (st.ph || 0) + (700 * Math.exp(-t * 12) + 220) / sr;
    return Math.sin(TAU * st.ph + Math.sin(TAU * st.ph * 3) * 1.5) * Math.exp(-t * 20);
  });
  b.missile = synth(sr, 0.3, (t, i, st) => {
    const n = nz();
    const bp = lp(st, 'b', n - lp(st, 'h', n, coef(800 + 3000 * t, sr)), coef(2400 + 6000 * t, sr));
    return bp * Math.min(1, t * 40) * Math.exp(-t * 9) * 3;
  });
  b.hit = synth(sr, 0.06, (t, i, st) => {
    let s = 0;
    for (const f of METAL) s += sq(f * 3.1 * t);
    return (s / 6 + nz() * 0.5) * Math.exp(-t * 70);
  });
  b.armor = synth(sr, 0.12, (t) => (Math.sin(TAU * 140 * t) + sq(311 * t) * 0.4 + nz() * 0.3) * Math.exp(-t * 40));
  const boom = (len, cutoff, decay, rumble, seedShift) =>
    synth(sr, len, (t, i, st) => {
      const n = nz();
      const c = coef(cutoff * Math.exp(-t * 3) + 60, sr);
      const l1 = lp(st, 'a', n, c);
      const l2 = lp(st, 'b', l1, c);
      st.ph = (st.ph || 0) + (rumble * Math.exp(-t * 4) + 30) / sr;
      const thump = Math.sin(TAU * st.ph) * Math.exp(-t * (decay * 0.8));
      const crackle = t < 0.4 && ((i + seedShift) * 7919) % 97 === 0 ? nz() * 2 : 0;
      return Math.tanh((l2 * 4 + thump * 0.9 + crackle * 0.3) * Math.exp(-t * decay) * 1.4);
    });
  b.explodeSmall = boom(0.6, 4000, 6, 110, 1);
  b.explodeBig = boom(1.4, 2600, 2.8, 80, 2);
  b.explodeHuge = boom(3.0, 2000, 1.3, 55, 3);
  b.playerDie = synth(sr, 1.6, (t, i, st) => {
    const n = nz();
    const l = lp(st, 'a', n, coef(3000 * Math.exp(-t * 2) + 80, sr));
    st.ph = (st.ph || 0) + (900 * Math.exp(-t * 2.5) + 40) / sr;
    return Math.tanh((l * 3 + sq(st.ph) * 0.35) * Math.exp(-t * 1.8));
  });
  b.bomb = synth(sr, 2.2, (t, i, st) => {
    const n = nz();
    const l = lp(st, 'a', n, coef(7000 * Math.exp(-t * 1.8) + 60, sr));
    st.ph = (st.ph || 0) + (500 * Math.exp(-t * 2.2) + 28) / sr;
    return Math.tanh((l * 2.5 + Math.sin(TAU * st.ph) * 0.9) * Math.exp(-t * 1.3) * 1.3);
  });
  const chime = (notes, step, wave = 'sq') =>
    synth(sr, notes.length * step + 0.35, (t) => {
      let s = 0;
      notes.forEach((m, k) => {
        const t0 = t - k * step;
        if (t0 < 0) return;
        const f = 440 * Math.pow(2, (m - 69) / 12);
        const v = wave === 'sq' ? sq(f * t0) * 0.5 + Math.sin(TAU * f * 2 * t0) * 0.3 : Math.sin(TAU * f * t0 + Math.sin(TAU * f * 3.5 * t0) * 2 * Math.exp(-t0 * 8));
        s += v * Math.exp(-t0 * 9);
      });
      return s;
    });
  b.pickup = chime([72, 76, 79, 84, 88], 0.045);
  b.bonus = chime([79, 86, 91, 98], 0.04, 'fm');
  b.extraLife = chime([67, 71, 74, 79, 74, 79, 83, 86, 91], 0.06);
  b.menuMove = chime([88], 0.02, 'fm');
  b.menuSelect = chime([81, 93], 0.05, 'fm');
  b.laser = synth(sr, 0.7, (t, i, st) => {
    st.ph = (st.ph || 0) + (180 + 60 * Math.sin(t * 40)) / sr;
    const buzz = sq(st.ph) * 0.4 + Math.sin(TAU * st.ph * 3) * 0.3;
    const hiss = nz() * 0.3;
    return (buzz + hiss) * Math.min(1, t * 30) * Math.exp(-t * 3);
  });
  b.playerLaser = synth(sr, 0.18, (t, i, st) => {
    st.ph = (st.ph || 0) + (620 + 90 * Math.sin(t * 70)) / sr;
    const buzz = sq(st.ph) * 0.35 + Math.sin(TAU * st.ph * 2) * 0.35;
    return (buzz + nz() * 0.12) * Math.min(1, t * 60) * Math.exp(-t * 9);
  });
  b.zap = synth(sr, 0.05, (t, i, st) => {
    st.ph = (st.ph || 0) + (2600 * Math.exp(-t * 60) + 900) / sr;
    return (sq(st.ph) * 0.5 + nz() * 0.25) * Math.exp(-t * 70);
  });
  b.telegraph = synth(sr, 0.18, (t) => (sq(1400 * t) * 0.4 + sq(1405 * t) * 0.4) * Math.exp(-t * 18));
  b.warning = synth(sr, 1.6, (t) => {
    const f = Math.floor(t / 0.25) % 2 ? 660 : 880;
    const seg = t % 0.25;
    return (sq(f * t) * 0.5 + sq(f * 1.005 * t) * 0.5) * Math.min(1, seg * 60) * Math.exp(-seg * 3) * 0.8;
  });
  return b;
}
