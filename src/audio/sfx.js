// Sample-based sound effects, synthesized once (synth/dsp.js) and played through
// a stereo panner so they follow the on-screen position.
import { sfxBank } from './synth/dsp.js';

export const SFX_THROTTLE = {
  shoot: 70,
  missile: 120,
  hit: 35,
  armor: 50,
  enemyShoot: 60,
  explodeSmall: 40,
  explodeBig: 120,
  explodeHuge: 300,
  pickup: 80,
  menuMove: 30,
  laser: 120,
  telegraph: 90,
};

const LEVEL = {
  shoot: 0.22,
  enemyShoot: 0.16,
  missile: 0.25,
  hit: 0.22,
  armor: 0.3,
  explodeSmall: 0.6,
  explodeBig: 0.85,
  explodeHuge: 1,
  playerDie: 0.9,
  bomb: 0.9,
  pickup: 0.45,
  bonus: 0.4,
  extraLife: 0.5,
  warning: 0.45,
  menuMove: 0.3,
  menuSelect: 0.4,
  laser: 0.5,
  telegraph: 0.25,
};

// pitch variation keeps rapid repeats from sounding mechanical
const JITTER = { shoot: 0.04, hit: 0.1, explodeSmall: 0.12, explodeBig: 0.06, enemyShoot: 0.06, armor: 0.08 };

export class SfxPlayer {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    const raw = sfxBank(ctx.sampleRate);
    this.buffers = {};
    for (const [k, data] of Object.entries(raw)) {
      const b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.copyToChannel(data, 0);
      this.buffers[k] = b;
    }
  }

  play(name, pan = 0) {
    const buf = this.buffers[name];
    if (!buf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const j = JITTER[name] || 0;
    if (j) src.playbackRate.value = 1 + (Math.random() * 2 - 1) * j;
    const g = ctx.createGain();
    g.gain.value = LEVEL[name] ?? 0.5;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.out);
    src.start();
  }
}
