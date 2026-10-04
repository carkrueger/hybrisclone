// Tracker-style sequencer with a lookahead scheduler on the AudioContext clock.
import { mtof } from './chip.js';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

export const INSTRUMENTS = {
  lead: (chip, e, t, sd, out) =>
    chip.tone({
      out, wave: 'p25', freq: mtof(e.n), t, dur: e.l * sd * 0.92, vol: 0.1 * (e.v ?? 1),
      attack: 0.004, decay: 0.12, sustain: 0.55, release: 0.05,
      vib: { rate: 6, depth: 20, delay: 0.16 },
    }),
  echo: (chip, e, t, sd, out) =>
    chip.tone({
      out, wave: 'p12', freq: mtof(e.n), t, dur: e.l * sd * 0.9, vol: 0.04 * (e.v ?? 1),
      attack: 0.004, decay: 0.1, sustain: 0.5, release: 0.05,
    }),
  bass: (chip, e, t, sd, out) =>
    chip.tone({
      out, wave: 'p50', freq: mtof(e.n), t, dur: e.l * sd * 0.8, vol: 0.12 * (e.v ?? 1),
      attack: 0.003, decay: 0.09, sustain: 0.45, release: 0.03,
    }),
  tri: (chip, e, t, sd, out) =>
    chip.tone({
      out, wave: 'triangle', freq: mtof(e.n), t, dur: e.l * sd * 0.85, vol: 0.22 * (e.v ?? 1),
      attack: 0.003, decay: 0.05, sustain: 0.8, release: 0.03,
    }),
  arp: (chip, e, t, sd, out) =>
    chip.tone({
      out, wave: 'p12', freq: mtof(e.n), t, dur: e.l * sd * 0.9, vol: 0.05 * (e.v ?? 1),
      attack: 0.002, decay: 0.05, sustain: 0.75, release: 0.03, arp: e.arp, arpRate: 50,
    }),
  kick: (chip, e, t, sd, out) => {
    chip.tone({
      out, wave: 'sine', freq: 170, slideTo: 38, slideTime: 0.12, t, dur: 0.12, vol: 0.5 * (e.v ?? 1),
      attack: 0.001, decay: 0.08, sustain: 0.3, release: 0.04,
    });
    chip.noise({ out, t, dur: 0.02, vol: 0.12, filter: 'lowpass', freq: 3000 });
  },
  snare: (chip, e, t, sd, out) => {
    chip.noise({ out, t, dur: 0.16, vol: 0.2 * (e.v ?? 1), filter: 'bandpass', freq: 1900, q: 0.8 });
    chip.tone({
      out, wave: 'triangle', freq: 220, slideTo: 120, slideTime: 0.06, t, dur: 0.06, vol: 0.18,
      attack: 0.001, decay: 0.04, sustain: 0.2, release: 0.02,
    });
  },
  hat: (chip, e, t, sd, out) =>
    chip.noise({ out, t, dur: 0.035, vol: 0.06 * (e.v ?? 1), filter: 'highpass', freq: 7000, metal: true }),
  ohat: (chip, e, t, sd, out) =>
    chip.noise({ out, t, dur: 0.14, vol: 0.05 * (e.v ?? 1), filter: 'highpass', freq: 6000, metal: true }),
};

/** Index notes by step once, so playback is a cheap lookup. */
export function prepareSong(song) {
  if (song._prepared) return song;
  for (const tr of song.tracks) {
    tr.byStep = new Map();
    for (const n of tr.notes) {
      if (!tr.byStep.has(n.s)) tr.byStep.set(n.s, []);
      tr.byStep.get(n.s).push(n);
    }
  }
  song._prepared = true;
  return song;
}

export class Sequencer {
  constructor(chip) {
    this.chip = chip;
    this.song = null;
    this.timer = null;
    this.out = null;
    this.onEnd = null;
  }

  play(song, { loop = true, onEnd = null } = {}) {
    this.stop(0.02);
    const ctx = this.chip.ctx;
    if (!ctx) return;
    this.song = prepareSong(song);
    this.loop = loop;
    this.onEnd = onEnd;
    this.step = 0;
    this.stepDur = 60 / song.bpm / 4;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(this.chip.music);
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  tick() {
    const ctx = this.chip.ctx;
    if (!this.song || !ctx || ctx.state !== 'running') return;
    // after a long stall (hidden tab), resync instead of spamming catch-up notes
    if (this.nextTime < ctx.currentTime - 0.25) this.nextTime = ctx.currentTime + 0.02;
    while (this.song && this.nextTime < ctx.currentTime + LOOKAHEAD) {
      for (const tr of this.song.tracks) {
        const evs = tr.byStep.get(this.step);
        if (!evs) continue;
        const inst = INSTRUMENTS[tr.inst];
        for (const e of evs) inst(this.chip, e, this.nextTime, this.stepDur, this.out);
      }
      this.nextTime += this.stepDur;
      this.step++;
      if (this.step >= this.song.length) {
        if (this.loop) this.step = this.song.loopStart || 0;
        else {
          const cb = this.onEnd;
          const endAt = this.nextTime;
          this.song = null;
          clearInterval(this.timer);
          this.timer = null;
          if (cb) setTimeout(cb, Math.max(0, (endAt - ctx.currentTime) * 1000));
        }
      }
    }
  }

  stop(fade = 0.08) {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.onEnd = null;
    const ctx = this.chip.ctx;
    if (this.out && ctx) {
      const o = this.out;
      o.gain.setTargetAtTime(0, ctx.currentTime, fade);
      setTimeout(() => o.disconnect(), 1500);
    }
    this.out = null;
  }
}
