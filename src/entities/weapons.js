// Hybris-style upgrade ladder: each power pod moves the ship one rung up.
import { U } from '../config.js';

export const LADDER = [
  { main: 1, side: 0, rear: 0, homing: 0 },
  { main: 2, side: 0, rear: 0, homing: 0 },
  { main: 2, side: 1, rear: 0, homing: 0 },
  { main: 3, side: 1, rear: 0, homing: 0 },
  { main: 3, side: 1, rear: 1, homing: 0 },
  { main: 3, side: 1, rear: 1, homing: 1 },
  { main: 4, side: 1, rear: 1, homing: 1 },
  { main: 4, side: 2, rear: 1, homing: 1 },
  { main: 5, side: 2, rear: 1, homing: 1 },
  { main: 5, side: 2, rear: 1, homing: 2 },
];
export const MAX_POWER = LADDER.length - 1;

const MAIN_SPEED = 430 * U;
const deg = (d) => (d * Math.PI) / 180;

// [dx, angle from straight up in degrees, texture]
const MAIN_PATTERNS = {
  1: [[0, 0, 'pb_main']],
  2: [[-8, 0, 'pb_main'], [8, 0, 'pb_main']],
  3: [[-8, 0, 'pb_main'], [8, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread']],
  4: [[-11, 0, 'pb_main'], [0, 0, 'pb_main'], [11, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread']],
  5: [[-11, 0, 'pb_main'], [0, 0, 'pb_main'], [11, 0, 'pb_main'], [-14, -10, 'pb_spread'], [14, 10, 'pb_spread'], [-18, -20, 'pb_spread'], [18, 20, 'pb_spread']],
};

export class WeaponSystem {
  constructor(scene) {
    this.scene = scene;
    this.timers = { main: 0, side: 0, rear: 0, homing: 0 };
  }

  update(dt, firing, player, power) {
    const w = LADDER[power];
    for (const k in this.timers) this.timers[k] = Math.max(0, this.timers[k] - dt * 1000);
    if (!firing) return;
    const { x, y } = player;
    const s = this.scene;
    let fired = false;

    if (this.timers.main <= 0) {
      for (const [dx, a, tex] of MAIN_PATTERNS[w.main]) {
        const ang = deg(a);
        s.spawnPlayerBullet(tex, x + dx, y - 50, Math.sin(ang) * MAIN_SPEED, -Math.cos(ang) * MAIN_SPEED, 1, ang);
      }
      s.fx.muzzle(x, y - 58);
      this.timers.main = 105;
      fired = true;
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
      this.timers.rear = 230;
    }
    if (w.homing && this.timers.homing <= 0) {
      s.spawnMissile(x - 26, y + 10);
      if (w.homing >= 2) s.spawnMissile(x + 26, y + 10);
      this.timers.homing = 480;
    }
    if (fired) s.playSfx('shoot', x);
  }
}
