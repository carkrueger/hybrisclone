// Player laser main gun: a continuous piercing beam straight up from the nose.
// Damage is applied in fixed ticks and ramps up the longer a target stays in it.
import Phaser from 'phaser';
import { DEPTH } from '../config.js';
import { WEAPON_TYPES } from './pickups.js';

const ADD = Phaser.BlendModes.ADD;
const TICK_MS = 60;
const RAMP_MS = 1200;
const RAMP_MAX = 2.5;
const COLOR = WEAPON_TYPES.laser.color;
const NOSE = 56;

export const laserWidth = (lvl) => 16 + 7 * lvl;
export const laserDps = (lvl) => 6 + 3 * lvl;
/** damage multiplier after `ms` continuous time on target */
export const laserRamp = (ms) => 1 + (RAMP_MAX - 1) * Math.min(1, ms / RAMP_MS);

export class PlayerLaser {
  constructor(scene) {
    this.scene = scene;
    this.outer = scene.add.image(0, 0, 'beam').setOrigin(0, 0.5).setRotation(-Math.PI / 2).setDepth(DEPTH.playerBullets).setBlendMode(ADD).setTint(COLOR).setVisible(false);
    this.inner = scene.add.image(0, 0, 'beam').setOrigin(0, 0.5).setRotation(-Math.PI / 2).setDepth(DEPTH.playerBullets + 0.1).setBlendMode(ADD).setVisible(false);
    this.on = false;
    this.t = 0;
    this.tick = 0;
    this.heat = new Map(); // target -> ms on beam
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    this.outer.setVisible(false);
    this.inner.setVisible(false);
    this.heat.clear();
  }

  update(dt, firing, player, lvl) {
    if (!firing) {
      this.stop();
      return;
    }
    const s = this.scene;
    const ms = dt * 1000;
    if (!this.on) {
      this.on = true;
      this.t = 0;
      this.tick = 0;
    }
    this.t += ms;
    const x = player.x;
    const y0 = player.y - NOSE;
    const y1 = -40;
    const len = y0 - y1;
    const w = laserWidth(lvl);
    const grow = Math.min(1, this.t / 90);
    const flick = 0.85 + Math.random() * 0.3;
    this.outer.setVisible(true).setPosition(x, y0).setScale(len / 64, (w / 32) * flick * grow);
    this.inner.setVisible(true).setPosition(x, y0).setScale(len / 64, (w * 0.4 / 32) * flick * grow);

    this.tick -= ms;
    if (this.tick > 0) return;
    this.tick += TICK_MS;
    const tickMs = TICK_MS;
    s.fx.muzzle(x, y0, COLOR);
    if (s.lightLayer) s.lightLayer.add(x, y0 - len * 0.35, 220, COLOR, TICK_MS * 1.5, 0.45);
    s.playSfx('playerLaser', x);
    this.applyDamage(x, y0, y1, w / 2, lvl, tickMs);
  }

  applyDamage(x, y0, y1, halfW, lvl, tickMs) {
    const s = this.scene;
    const now = s.clock;
    const base = (laserDps(lvl) * tickMs) / 1000;
    const seen = new Set();
    const dose = (key) => {
      const ms = (this.heat.get(key) || 0) + tickMs;
      this.heat.set(key, ms);
      seen.add(key);
      return base * laserRamp(ms);
    };
    for (const e of s.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.x - x) > e.r + halfW || e.y > y0 + e.r || e.y < y1 - e.r) continue;
      if (Math.random() < 0.5) s.fx.hitSpark(x + (Math.random() - 0.5) * halfW, e.y + e.r * 0.5, COLOR);
      s.hitEnemy(e, dose(e), now);
    }
    if (s.boss) {
      for (const p of s.boss.hitSegment(x, y0, x, y1, halfW)) {
        if (s.boss.state !== 'fight') break;
        const pos = s.boss.partPos(p);
        if (Math.random() < 0.5) s.fx.hitSpark(pos.x, pos.y + p.r * 0.5, COLOR);
        s.addScore(s.boss.damage(p, dose(p), now));
      }
    }
    for (const k of this.heat.keys()) if (!seen.has(k)) this.heat.delete(k);
  }
}
