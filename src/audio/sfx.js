// Synthesized sound effects. Each takes (chip, t) and schedules nodes on the sfx bus.
import { mtof } from './chip.js';

export const SFX = {
  shoot: (c, t) =>
    c.tone({ bus: 'sfx', wave: 'p12', freq: 1500, slideTo: 600, slideTime: 0.06, t, dur: 0.05, vol: 0.05, decay: 0.03, sustain: 0.4, release: 0.02 }),
  missile: (c, t) =>
    c.noise({ t, dur: 0.12, vol: 0.06, filter: 'bandpass', freq: 1200, freqEnd: 3000, q: 2 }),
  hit: (c, t) => c.noise({ t, dur: 0.04, vol: 0.08, filter: 'highpass', freq: 3000, metal: true }),
  armor: (c, t) =>
    c.tone({ bus: 'sfx', wave: 'p50', freq: 180, t, dur: 0.03, vol: 0.06, decay: 0.02, sustain: 0.3, release: 0.01 }),
  enemyShoot: (c, t) =>
    c.tone({ bus: 'sfx', wave: 'p25', freq: 500, slideTo: 300, slideTime: 0.08, t, dur: 0.07, vol: 0.035, decay: 0.04, sustain: 0.4, release: 0.02 }),
  explodeSmall: (c, t) => {
    c.noise({ t, dur: 0.3, vol: 0.28, filter: 'lowpass', freq: 3500, freqEnd: 150 });
    c.tone({ bus: 'sfx', wave: 'p50', freq: 160, slideTo: 40, t, dur: 0.15, vol: 0.12, decay: 0.1, sustain: 0.3, release: 0.05 });
  },
  explodeBig: (c, t) => {
    c.noise({ t, dur: 0.9, vol: 0.4, filter: 'lowpass', freq: 2200, freqEnd: 60 });
    c.tone({ bus: 'sfx', wave: 'triangle', freq: 120, slideTo: 30, slideTime: 0.6, t, dur: 0.6, vol: 0.4, decay: 0.3, sustain: 0.4, release: 0.2 });
  },
  pickup: (c, t) => {
    [0, 4, 7, 12, 16].forEach((st, i) =>
      c.tone({ bus: 'sfx', wave: 'p25', freq: mtof(72 + st), t: t + i * 0.045, dur: 0.05, vol: 0.09, decay: 0.03, sustain: 0.6, release: 0.02 })
    );
  },
  bonus: (c, t) => {
    [0, 7, 12, 19].forEach((st, i) =>
      c.tone({ bus: 'sfx', wave: 'p12', freq: mtof(79 + st), t: t + i * 0.04, dur: 0.04, vol: 0.07, decay: 0.03, sustain: 0.6, release: 0.02 })
    );
  },
  extraLife: (c, t) => {
    [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((st, i) =>
      c.tone({ bus: 'sfx', wave: 'p25', freq: mtof(67 + st), t: t + i * 0.06, dur: 0.06, vol: 0.09, decay: 0.03, sustain: 0.6, release: 0.02 })
    );
  },
  bomb: (c, t) => {
    c.noise({ t, dur: 1.4, vol: 0.45, filter: 'lowpass', freq: 5000, freqEnd: 80 });
    c.tone({ bus: 'sfx', wave: 'sine', freq: 600, slideTo: 30, slideTime: 1.0, t, dur: 1.0, vol: 0.35, decay: 0.5, sustain: 0.5, release: 0.2 });
  },
  playerDie: (c, t) => {
    c.noise({ t, dur: 1.2, vol: 0.45, filter: 'lowpass', freq: 4000, freqEnd: 50 });
    c.tone({ bus: 'sfx', wave: 'p50', freq: 880, slideTo: 55, slideTime: 1.0, t, dur: 1.0, vol: 0.15, decay: 0.3, sustain: 0.6, release: 0.2 });
  },
  warning: (c, t) => {
    for (let i = 0; i < 6; i++) {
      c.tone({ bus: 'sfx', wave: 'p50', freq: i % 2 ? 660 : 880, t: t + i * 0.25, dur: 0.22, vol: 0.1, decay: 0.05, sustain: 0.9, release: 0.02 });
    }
  },
  menuMove: (c, t) =>
    c.tone({ bus: 'sfx', wave: 'p25', freq: 1200, t, dur: 0.03, vol: 0.06, decay: 0.02, sustain: 0.5, release: 0.01 }),
  menuSelect: (c, t) => {
    c.tone({ bus: 'sfx', wave: 'p25', freq: 880, t, dur: 0.05, vol: 0.08, decay: 0.03, sustain: 0.6, release: 0.02 });
    c.tone({ bus: 'sfx', wave: 'p25', freq: 1760, t: t + 0.05, dur: 0.08, vol: 0.08, decay: 0.03, sustain: 0.6, release: 0.02 });
  },
};

// minimum ms between two plays of the same effect
export const SFX_THROTTLE = {
  shoot: 70,
  missile: 120,
  hit: 35,
  armor: 50,
  enemyShoot: 60,
  explodeSmall: 40,
  explodeBig: 150,
  pickup: 80,
  menuMove: 30,
};
