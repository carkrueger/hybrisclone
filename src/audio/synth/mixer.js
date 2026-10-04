// Song mix graph: per-track channel strips, ping-pong echo, convolution reverb,
// kick ducking and a master bus with soft saturation and compression.
import { RNG } from '../../core/rng.js';

function reverbImpulse(ctx, seconds = 2.0, seed = 5) {
  const rng = new RNG(seed);
  const len = Math.ceil(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      const damp = 0.9 - 0.75 * (t / seconds); // darker over time
      lp += damp * (rng.float() * 2 - 1 - lp);
      d[i] = lp * Math.pow(1 - t / seconds, 2.2) * (t < 0.012 ? t / 0.012 : 1);
    }
  }
  return ir;
}

function saturationCurve(drive = 1.25) {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return c;
}

export function createMix(ctx, bpm) {
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const shaper = ctx.createWaveShaper();
  shaper.curve = saturationCurve();
  shaper.oversample = '2x';
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.006;
  comp.release.value = 0.2;
  const outGain = ctx.createGain();
  outGain.gain.value = 0.92;
  master.connect(shaper).connect(comp).connect(outGain).connect(ctx.destination);

  // ping-pong echo (dotted eighth)
  const beat = 60 / bpm;
  const echoIn = ctx.createGain();
  const dl = ctx.createDelay(2);
  const dr = ctx.createDelay(2);
  dl.delayTime.value = beat * 0.75;
  dr.delayTime.value = beat * 0.75;
  const fbL = ctx.createGain();
  const fbR = ctx.createGain();
  fbL.gain.value = 0.42;
  fbR.gain.value = 0.42;
  const lpL = ctx.createBiquadFilter();
  const lpR = ctx.createBiquadFilter();
  lpL.type = lpR.type = 'lowpass';
  lpL.frequency.value = lpR.frequency.value = 3200;
  const panL = ctx.createStereoPanner();
  const panR = ctx.createStereoPanner();
  panL.pan.value = -0.75;
  panR.pan.value = 0.75;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.5;
  echoIn.connect(dl);
  dl.connect(lpL).connect(fbL).connect(dr);
  dr.connect(lpR).connect(fbR).connect(dl);
  dl.connect(panL).connect(echoOut);
  dr.connect(panR).connect(echoOut);
  echoOut.connect(master);

  // reverb
  const revIn = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = reverbImpulse(ctx);
  const revOut = ctx.createGain();
  revOut.gain.value = 0.42;
  revIn.connect(conv).connect(revOut).connect(master);

  return { master, echoIn, revIn };
}

/**
 * A channel strip: input -> track filter -> duck gain -> panner -> master + sends.
 * opts: { vol, pan, echo, reverb, duck, filter: [[time, hz], ...] }
 */
export function createTrack(ctx, mix, opts) {
  const input = ctx.createGain();
  input.gain.value = opts.vol ?? 1;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 0.8;
  const nyq = ctx.sampleRate * 0.45;
  filt.frequency.value = nyq;
  const pts = opts.filter || [];
  if (pts.length) {
    filt.frequency.setValueAtTime(Math.min(nyq, pts[0][1]), 0);
    for (const [t, hz] of pts.slice(1)) filt.frequency.exponentialRampToValueAtTime(Math.min(nyq, hz), Math.max(0.01, t));
  }
  const duck = ctx.createGain();
  duck.gain.value = 1;
  const pan = ctx.createStereoPanner();
  pan.pan.value = opts.pan ?? 0;
  input.connect(filt).connect(duck).connect(pan);
  pan.connect(mix.master);
  if (opts.echo) {
    const s = ctx.createGain();
    s.gain.value = opts.echo;
    pan.connect(s).connect(mix.echoIn);
  }
  if (opts.reverb) {
    const s = ctx.createGain();
    s.gain.value = opts.reverb;
    pan.connect(s).connect(mix.revIn);
  }
  return { input, duck, amount: opts.duck || 0 };
}

/** sidechain-style pump on every kick */
export function duckAt(track, t) {
  if (!track.amount) return;
  const g = track.duck.gain;
  g.setTargetAtTime(1 - track.amount, t, 0.004);
  g.setTargetAtTime(1, t + 0.03, 0.09);
}
