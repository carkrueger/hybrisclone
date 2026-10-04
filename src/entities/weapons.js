// Hybris-style upgrade ladder: each power pod moves the ship one rung up.
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

const MAIN_SPEED = 430;
const deg = (d) => (d * Math.PI) / 180;

// [dx, angle from straight up in degrees, texture]
const MAIN_PATTERNS = {
  1: [[0, 0, 'pshot']],
  2: [[-3, 0, 'pshot'], [3, 0, 'pshot']],
  3: [[-3, 0, 'pshot'], [3, 0, 'pshot'], [-5, -10, 'pshot2'], [5, 10, 'pshot2']],
  4: [[-4, 0, 'pshot'], [0, 0, 'pshot'], [4, 0, 'pshot'], [-5, -10, 'pshot2'], [5, 10, 'pshot2']],
  5: [[-4, 0, 'pshot'], [0, 0, 'pshot'], [4, 0, 'pshot'], [-5, -10, 'pshot2'], [5, 10, 'pshot2'], [-6, -20, 'pshot2'], [6, 20, 'pshot2']],
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
        s.spawnPlayerBullet(tex, x + dx, y - 8, Math.sin(ang) * MAIN_SPEED, -Math.cos(ang) * MAIN_SPEED, 1, ang);
      }
      this.timers.main = 105;
      fired = true;
    }
    if (w.side && this.timers.side <= 0) {
      s.spawnPlayerBullet('pside', x - 8, y + 3, -300, 0, 1, Math.PI);
      s.spawnPlayerBullet('pside', x + 8, y + 3, 300, 0, 1, 0);
      if (w.side >= 2) {
        s.spawnPlayerBullet('pshot2', x - 7, y, -240, -240, 1, deg(-45));
        s.spawnPlayerBullet('pshot2', x + 7, y, 240, -240, 1, deg(45));
      }
      this.timers.side = 210;
    }
    if (w.rear && this.timers.rear <= 0) {
      s.spawnPlayerBullet('pshot', x, y + 9, 0, 360, 1, Math.PI);
      s.spawnPlayerBullet('pshot2', x - 3, y + 9, -110, 330, 1, Math.PI + deg(18));
      s.spawnPlayerBullet('pshot2', x + 3, y + 9, 110, 330, 1, Math.PI - deg(18));
      this.timers.rear = 230;
    }
    if (w.homing && this.timers.homing <= 0) {
      s.spawnMissile(x - 6, y);
      if (w.homing >= 2) s.spawnMissile(x + 6, y);
      this.timers.homing = 480;
    }
    if (fired) s.playSfx('shoot');
  }
}
