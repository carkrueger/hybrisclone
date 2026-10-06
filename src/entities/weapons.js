// Hybris-style upgrade ladder: each power pod moves the ship one rung up.
// `main` is the level of whichever main gun is active (vulcan / laser / homing).
import { U } from '../config.js';

export const LADDER = [
  { main: 1, side: 0, rear: 0 },
  { main: 2, side: 0, rear: 0 },
  { main: 2, side: 1, rear: 0 },
  { main: 3, side: 1, rear: 0 },
  { main: 3, side: 1, rear: 1 },
  { main: 4, side: 1, rear: 1 },
  { main: 4, side: 2, rear: 1 },
  { main: 5, side: 2, rear: 1 },
  { main: 5, side: 2, rear: 2 },
  { main: 6, side: 2, rear: 2 },
];
export const MAX_POWER = LADDER.length - 1;

const MAIN_SPEED = 430 * U;
const deg = (d) => (d * Math.PI) / 180;

// [dx, angle from straight up in degrees, texture]
const P5 = [[-11, 0, 'pb_main'], [0, 0, 'pb_main'], [11, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread'], [-18, -20, 'pb_spread'], [18, 20, 'pb_spread']];
const MAIN_PATTERNS = {
  1: [[0, 0, 'pb_main']],
  2: [[-8, 0, 'pb_main'], [8, 0, 'pb_main']],
  3: [[-8, 0, 'pb_main'], [8, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread']],
  4: [[-11, 0, 'pb_main'], [0, 0, 'pb_main'], [11, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread']],
  5: P5,
  6: P5,
};
const MAIN_CADENCE = { 6: 90 };

// homing main gun: missiles per salvo and salvo interval (ms), per main level
const HOMING_LEVELS = {
  1: { n: 1, ms: 380 },
  2: { n: 2, ms: 380 },
  3: { n: 2, ms: 300 },
  4: { n: 3, ms: 300 },
  5: { n: 4, ms: 280 },
  6: { n: 4, ms: 220 },
};

export class WeaponSystem {
  /** laser: a PlayerLaser (laser.js), injected so this module stays Phaser-free */
  constructor(scene, laser) {
    this.scene = scene;
    this.timers = { main: 0, missile: 0, side: 0, rear: 0 };
    this.laser = laser;
  }

  /** ship dead / respawning: nothing should stay on screen */
  idle() {
    this.laser.stop();
  }

  update(dt, firing, player, power, type = 'vulcan') {
    const w = LADDER[power];
    for (const k in this.timers) this.timers[k] = Math.max(0, this.timers[k] - dt * 1000);
    if (type === 'laser') this.laser.update(dt, firing, player, w.main);
    else this.laser.stop();
    if (!firing) return;
    const { x, y } = player;
    const s = this.scene;
    let fired = false;

    if (type === 'vulcan' && this.timers.main <= 0) {
      for (const [dx, a, tex] of MAIN_PATTERNS[w.main]) {
        const ang = deg(a);
        s.spawnPlayerBullet(tex, x + dx, y - 50, Math.sin(ang) * MAIN_SPEED, -Math.cos(ang) * MAIN_SPEED, 1, ang);
      }
      s.fx.muzzle(x, y - 58);
      this.timers.main = MAIN_CADENCE[w.main] || 105;
      fired = true;
    }
    if (type === 'homing') {
      if (this.timers.main <= 0) {
        s.spawnPlayerBullet('pb_main', x, y - 50, 0, -MAIN_SPEED, 1, 0);
        s.fx.muzzle(x, y - 58);
        this.timers.main = 105;
        fired = true;
      }
      if (this.timers.missile <= 0) {
        const { n, ms } = HOMING_LEVELS[w.main];
        for (let k = 0; k < n; k++) {
          const side = k % 2 ? 1 : -1;
          const row = Math.floor(k / 2);
          s.spawnMissile(x + side * (26 + row * 16), y + 10 - row * 10, -Math.PI / 2 + side * deg(18 + row * 22));
        }
        this.timers.missile = ms;
      }
    }
    if (w.side && this.timers.side <= 0) {
      const v = 300 * U;
      s.spawnPlayerBullet('pb_side', x - 40, y + 20, -v, 0, 1, 0);
      s.spawnPlayerBullet('pb_side', x + 40, y + 20, v, 0, 1, 0);
      if (w.side >= 2) {
        s.spawnPlayerBullet('pb_spread', x - 30, y, -v * 0.8, -v * 0.8, 1, deg(-45));
        s.spawnPlayerBullet('pb_spread', x + 30, y, v * 0.8, -v * 0.8, 1, deg(45));
      }
      this.timers.side = 210;
    }
    if (w.rear && this.timers.rear <= 0) {
      const v = 360 * U;
      s.spawnPlayerBullet('pb_main', x, y + 56, 0, v, 1, Math.PI);
      s.spawnPlayerBullet('pb_spread', x - 10, y + 56, -v * 0.3, v * 0.92, 1, Math.PI + deg(18));
      s.spawnPlayerBullet('pb_spread', x + 10, y + 56, v * 0.3, v * 0.92, 1, Math.PI - deg(18));
      if (w.rear >= 2) {
        s.spawnPlayerBullet('pb_spread', x - 20, y + 50, -v * 0.62, v * 0.78, 1, Math.PI + deg(38));
        s.spawnPlayerBullet('pb_spread', x + 20, y + 50, v * 0.62, v * 0.78, 1, Math.PI - deg(38));
      }
      this.timers.rear = 230;
    }
    if (fired) s.playSfx('shoot', x);
  }
}
