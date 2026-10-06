// Specials that ride along with the ship until it is lost: an indestructible
// orbiting ball, a wingman escort, a point-defense turret and a one-hit
// deflector shield that bursts outwards when it takes a hit.
import Phaser from 'phaser';
import { U, DEPTH } from '../config.js';
import { ShipDecor } from './decor.js';
import { PODS } from './pickups.js';

const ADD = Phaser.BlendModes.ADD;

class Orb {
  static R = 16;
  static ORBIT = 95;
  static SPEED = 3.2; // rad/s
  static DMG = 2;
  static COOLDOWN = 150; // ms between hits on the same target

  constructor(scene) {
    this.scene = scene;
    this.color = PODS.O.color;
    this.angle = -Math.PI / 2;
    this.glow = scene.add.image(0, 0, 'glow').setDepth(DEPTH.player + 1.9).setBlendMode(ADD).setTint(this.color).setScale(0.75);
    this.sprite = scene.add.image(0, 0, 'sp_orb').setDepth(DEPTH.player + 2);
    this.place();
  }

  place() {
    const pl = this.scene.player;
    this.x = pl.x + Math.cos(this.angle) * Orb.ORBIT;
    this.y = pl.y + Math.sin(this.angle) * Orb.ORBIT;
    this.sprite.setPosition(this.x, this.y);
    this.glow.setPosition(this.x, this.y);
  }

  update(dt, now) {
    const s = this.scene;
    this.angle += Orb.SPEED * dt;
    this.place();
    this.sprite.rotation += dt * 5;
    this.glow.setAlpha(0.55 + Math.random() * 0.25);
    const r = Orb.R;
    for (const e of s.enemies) {
      if (!e.alive || (e.orbHitAt || 0) + Orb.COOLDOWN > now) continue;
      if ((e.x - this.x) ** 2 + (e.y - this.y) ** 2 < (e.r + r) ** 2) {
        e.orbHitAt = now;
        s.fx.hitSpark(this.x, this.y, this.color);
        s.hitEnemy(e, Orb.DMG, now);
      }
    }
    if (s.boss) {
      const part = s.boss.hitTest(this.x, this.y, r);
      if (part && (part.orbHitAt || 0) + Orb.COOLDOWN <= now) {
        part.orbHitAt = now;
        s.fx.hitSpark(this.x, this.y, this.color);
        s.addScore(s.boss.damage(part, Orb.DMG, now));
      }
    }
    s.efire.clearCircle(this.x, this.y, r + 4, true, this.color);
  }

  destroy() {
    this.sprite.destroy();
    this.glow.destroy();
  }
}

class Wingman {
  static SLOT = { x: -90, y: 40 };
  static FOLLOW = 6; // 1/s, exponential smoothing
  static CADENCE = 140;
  static SCALE = 0.45;

  constructor(scene) {
    this.scene = scene;
    const pl = scene.player;
    this.sprite = scene.add.image(pl.x + Wingman.SLOT.x, pl.y + Wingman.SLOT.y, 'player').setScale(Wingman.SCALE).setDepth(DEPTH.player - 0.2);
    this.decor = new ShipDecor(scene, this.sprite, 'player', { flames: scene.preset.flames, rim: false, scale: Wingman.SCALE });
    this.timer = 0;
    this.bank = 0;
  }

  get x() {
    return this.sprite.x;
  }

  get y() {
    return this.sprite.y;
  }

  update(dt, now, firing) {
    const s = this.scene;
    const pl = s.player;
    const sp = this.sprite;
    const k = 1 - Math.exp(-Wingman.FOLLOW * dt);
    const dx = (pl.x + Wingman.SLOT.x - sp.x) * k;
    sp.x += dx;
    sp.y += (pl.y + Wingman.SLOT.y - sp.y) * k;
    const vx = Phaser.Math.Clamp(dx / Math.max(1e-3, dt) / 400, -1, 1);
    this.bank += (vx - this.bank) * Math.min(1, dt * 10);
    sp.setRotation(this.bank * 0.12);
    sp.setScale(Wingman.SCALE * (1 - Math.abs(this.bank) * 0.14), Wingman.SCALE);
    this.decor.update();

    this.timer = Math.max(0, this.timer - dt * 1000);
    if (firing && this.timer <= 0) {
      const v = 430 * U;
      s.spawnPlayerBullet('pb_spread', sp.x - 7, sp.y - 26, 0, -v, 1, 0);
      s.spawnPlayerBullet('pb_spread', sp.x + 7, sp.y - 26, 0, -v, 1, 0);
      s.fx.muzzle(sp.x, sp.y - 30, 0x80f0ff);
      this.timer = Wingman.CADENCE;
    }
  }

  destroy() {
    this.sprite.destroy();
    this.decor.destroy();
  }
}

class PointDefense {
  static RANGE = 280;
  static CADENCE = 250;
  static MOUNT_Y = 18;

  constructor(scene) {
    this.scene = scene;
    this.color = PODS.T.color;
    this.sprite = scene.add.image(0, 0, 'sp_turret').setDepth(DEPTH.player + 0.6);
    this.aim = -Math.PI / 2;
    this.timer = 0;
  }

  get x() {
    return this.scene.player.x;
  }

  get y() {
    return this.scene.player.y + PointDefense.MOUNT_Y;
  }

  update(dt, now) {
    const s = this.scene;
    const { x, y } = this;
    this.timer = Math.max(0, this.timer - dt * 1000);
    const shot = s.efire.nearestShot(x, y, PointDefense.RANGE);
    if (shot) {
      const want = Math.atan2(shot.y - y, shot.x - x);
      this.aim += Phaser.Math.Angle.Wrap(want - this.aim) * Math.min(1, dt * 18);
    } else this.aim += Phaser.Math.Angle.Wrap(-Math.PI / 2 - this.aim) * Math.min(1, dt * 3);
    this.sprite.setPosition(x, y).setRotation(this.aim + Math.PI / 2);
    if (!shot || this.timer > 0) return;

    this.timer = PointDefense.CADENCE;
    s.efire.destroyShot(shot);
    const ang = Math.atan2(shot.y - y, shot.x - x);
    const dist = Math.hypot(shot.x - x, shot.y - y);
    const tr = s.fx.sprite('beam', x, y, DEPTH.player + 0.7).setOrigin(0, 0.5).setRotation(ang).setScale(dist / 64, 0.22).setTint(this.color);
    s.tweens.add({ targets: tr, alpha: 0, duration: 90, onComplete: () => s.fx.release(tr) });
    s.fx.hitSpark(shot.x, shot.y, this.color);
    s.playSfx('zap', x);
    if (shot.kind === 'missile') s.addScore(50);
  }

  destroy() {
    this.sprite.destroy();
  }
}

const KINDS = { orb: Orb, wing: Wingman, pd: PointDefense };

export class Specials {
  static SHIELD_BURST_R = 320;
  static SHIELD_BURST_DMG = 6;

  constructor(scene) {
    this.scene = scene;
    this.items = {};
    this.shield = false;
    this.shieldImg = null;
  }

  has(id) {
    return !!this.items[id];
  }

  ids() {
    return Object.keys(this.items);
  }

  add(id) {
    if (this.items[id] || !KINDS[id]) return;
    this.items[id] = new KINDS[id](this.scene);
  }

  setShield(on) {
    this.shield = on;
    if (on && !this.shieldImg) {
      this.shieldImg = this.scene.add.image(0, 0, 'ring').setDepth(DEPTH.player + 1.5).setBlendMode(ADD).setTint(PODS.D.color);
    } else if (!on && this.shieldImg) {
      this.shieldImg.destroy();
      this.shieldImg = null;
    }
  }

  update(dt, now, firing) {
    const pl = this.scene.player;
    if (!pl.alive) return;
    for (const it of Object.values(this.items)) it.update(dt, now, firing);
    if (this.shieldImg) {
      const pulse = Math.sin(now * 0.006);
      this.shieldImg.setPosition(pl.x, pl.y).setScale(1.05 + pulse * 0.04).setAlpha(0.6 + pulse * 0.2);
    }
  }

  /** the ship was hit: a shield absorbs it and bursts. Returns true if the hit was absorbed. */
  absorbHit(now) {
    if (!this.shield) return false;
    const s = this.scene;
    const pl = s.player;
    const R = Specials.SHIELD_BURST_R;
    const color = PODS.D.color;
    this.setShield(false);
    s.efire.clearCircle(pl.x, pl.y, R, true, color);
    for (const e of s.enemies) {
      if (e.alive && (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < (R + e.r) ** 2) s.hitEnemy(e, Specials.SHIELD_BURST_DMG, now);
    }
    s.fx.shockRing(pl.x, pl.y, (R * 2) / 160 * 1.2, color, 600);
    s.fx.light(pl.x, pl.y, 300, color, 500);
    s.cameras.main.shake(220, 0.008);
    s.playSfx('explodeBig', pl.x);
    pl.invulnUntil = Math.max(pl.invulnUntil, now + 1000);
    return true;
  }

  /** ship lost: everything goes */
  clear(explode = false) {
    for (const it of Object.values(this.items)) {
      if (explode) this.scene.fx.explode(it.x, it.y, 0.6);
      it.destroy();
    }
    this.items = {};
    this.setShield(false);
  }
}
