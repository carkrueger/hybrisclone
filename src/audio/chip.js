// Tiny WebAudio "chip": pulse waves with variable duty, triangle, noise, envelopes,
// hardware-style arpeggios and vibrato. Everything is scheduled on the audio clock.

function pulseWave(ctx, duty, harmonics = 48) {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    real[n] = Math.sin(2 * Math.PI * n * duty) / (n * Math.PI);
    imag[n] = (1 - Math.cos(2 * Math.PI * n * duty)) / (n * Math.PI);
  }
  return ctx.createPeriodicWave(real, imag);
}

export class Chip {
  constructor() {
    this.ctx = null;
    this.musicVol = 0.6;
    this.sfxVol = 0.7;
  }

  get ready() {
    return !!this.ctx;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch {
        return false;
      }
      this.build();
    }
    if (this.ctx.state === 'suspended' && !this.userSuspended) this.ctx.resume().catch(() => {});
    return true;
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // Amiga-ish output low-pass, then a compressor to keep things tidy.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 9000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(lp).connect(comp).connect(ctx.destination);

    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.setVolumes(this.musicVol, this.sfxVol);

    this.waves = {
      p12: pulseWave(ctx, 0.125),
      p25: pulseWave(ctx, 0.25),
      p50: pulseWave(ctx, 0.5),
    };

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // short looped noise sounds "metallic", like the NES/Paula periodic noise
    const mlen = 93 * 8;
    this.metalBuf = ctx.createBuffer(1, mlen, ctx.sampleRate);
    const m = this.metalBuf.getChannelData(0);
    for (let i = 0; i < mlen; i += 8) {
      const v = Math.random() < 0.5 ? -1 : 1;
      for (let j = 0; j < 8; j++) m[i + j] = v;
    }
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music * music, t, 0.02);
    this.sfx.gain.setTargetAtTime(sfx * sfx, t, 0.02);
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  bus(name, out) {
    return out || (name === 'sfx' ? this.sfx : this.music);
  }

  tone({
    bus = 'music',
    out = null,
    wave = 'p50',
    freq = 440,
    t = this.now(),
    dur = 0.1,
    vol = 0.2,
    attack = 0.004,
    decay = 0.08,
    sustain = 0.6,
    release = 0.04,
    slideTo = 0,
    slideTime = 0,
    vib = null,
    arp = null,
    arpRate = 50,
  }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (this.waves[wave]) osc.setPeriodicWave(this.waves[wave]);
    else osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (arp && arp.length) {
      const step = 1 / arpRate;
      let i = 0;
      for (let tt = t; tt < t + dur; tt += step, i++) {
        osc.frequency.setValueAtTime(freq * Math.pow(2, arp[i % arp.length] / 12), tt);
      }
    }
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t + (slideTime || dur));

    const end = t + dur + release * 4 + 0.02;
    if (vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = vib.rate;
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + vib.delay);
      lg.gain.linearRampToValueAtTime(vib.depth, t + vib.delay + 0.12);
      lfo.connect(lg).connect(osc.detune);
      lfo.start(t);
      lfo.stop(end);
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.linearRampToValueAtTime(vol * sustain, t + attack + decay);
    g.gain.setTargetAtTime(0, t + Math.max(dur, attack + 0.001), release);
    osc.connect(g).connect(this.bus(bus, out));
    osc.start(t);
    osc.stop(end);
  }

  noise({
    bus = 'sfx',
    out = null,
    t = this.now(),
    dur = 0.2,
    vol = 0.2,
    filter = 'lowpass',
    freq = 4000,
    freqEnd = 0,
    q = 1,
    metal = false,
    attack = 0.002,
    rate = 1,
  }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = metal ? this.metalBuf : this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    if (freqEnd > 0) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(this.bus(bus, out));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
}

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
