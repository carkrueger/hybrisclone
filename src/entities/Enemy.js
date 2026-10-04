// A single enemy following one of the seeded wave patterns (see level/waves.js).
import Phaser from 'phaser';
import { W, H, U, DEPTH } from '../config.js';
import { ENEMY_DEFS } from '../level/waves.js';
import { SHADOW_OFFSET } from './Player.js';
import { ShipDecor } from './decor.js';

const easeOut = (u) => 1 - (1 - u) * (1 - u);
const TOP = -50;

export class Enemy {
  /**
   * @param wave  wave data (or a pseudo-wave for ground turrets)
   * @param index index within the wave
   */
  constructor(scene, wave, index, sector) {
    const def = ENEMY_DEFS[wave.type];
    this.scene = scene;
    this.wave = wave;
    this.index = index;
    this.def = def;
    this.type = wave.type;
    this.hp = Math.max(1, Math.round(def.hp * (1 + 0.3 * sector)));
    this.r = def.r;
    this.score = def.score;
    this.ground = !!def.ground;
    this.t = 0;
    this.alive = true;
    this.everOnScreen = false;
    this.onScreenAt = -1;
    this.carrier = wave.carrier === index;
    this.fireT = wave.fireDelays ? wave.fireDelays[index] : wave.fireDelay ?? 1000;
    this.canFire = !!def.fire && (wave.canFire ?? true);
    this.fireEvery = def.fire ? def.fire.every * Math.max(0.55, 1 - 0.08 * sector) : 0;
    this.bulletSpeed = Math.min(190, 92 + sector * 14) * U;
    this.flashUntil = 0;
    this.diveV = null;
    this.exitV = null;
    this.heading = 0;

    const preset = scene.preset;
    if (!this.ground && preset.shadows) {
      this.shadow = scene.add.image(-200, -200, def.tex).setDepth(DEPTH.airShadows).setTint(0x000000).setAlpha(0.32);
    }
    this.sprite = scene.add.image(-200, -200, def.tex).setDepth(this.ground ? DEPTH.ground : DEPTH.enemies);
    if (scene.textures.exists(def.tex + '_glow')) {
      this.glow = scene.add.image(-200, -200, def.tex + '_glow').setDepth(DEPTH.enemies + 1).setBlendMode(Phaser.BlendModes.ADD);
    }
    if (this.ground) {
      this.barrel = scene.add.image(-200, -200, 'e_barrel').setDepth(DEPTH.ground + 1).setOrigin(0.5, 0.78);
      if (wave.raised) this.sprite.setScale(1.08);
    }
    this.decor = new ShipDecor(scene, this.sprite, def.tex, { flames: preset.flames, rim: preset.rim && !this.ground, rimColor: scene.rimColor });
    this.recoil = 0;
    this.x = -200;
    this.y = -200;
    this.place();
  }

  place() {
    const p = this.wave.params || {};
    const t = this.t;
    const i = this.index;
    const dts = this.scene.dtSec || 0;
    let x = this.x;
    let y = this.y;
    switch (this.wave.pattern) {
      case 'line':
        x = p.x;
        y = TOP + (p.speed * t) / 1000;
        break;
      case 'sine':
        x = p.x + p.amp * Math.sin(t * p.freq);
        y = TOP + (p.speed * t) / 1000;
        break;
      case 'vform': {
        const k = i - (this.wave.count - 1) / 2;
        x = p.x + k * p.spacing;
        y = TOP - Math.abs(k) * p.spacing * 0.8 + (p.speed * t) / 1000;
        break;
      }
      case 'swoop': {
        const u = t / p.dur;
        const cxp = (p.x0 + p.x2) / 2;
        if (u <= 1) {
          const iu = 1 - u;
          x = iu * iu * p.x0 + 2 * iu * u * cxp + u * u * p.x2;
          y = iu * iu * p.y0 + 2 * iu * u * p.cy + u * u * p.y1;
        } else {
          // keep flying along the end tangent until off-screen
          if (!this.exitV) {
            const tx = 2 * (p.x2 - cxp);
            const ty = 2 * (p.y1 - p.cy);
            const len = Math.hypot(tx, ty) || 1;
            const sp = len / (p.dur / 1000);
            this.exitV = { x: (tx / len) * sp, y: (ty / len) * sp };
          }
          x = this.x + this.exitV.x * dts;
          y = this.y + this.exitV.y * dts;
        }
        break;
      }
      case 'dive': {
        if (t < 900) {
          x = p.xs[i];
          y = TOP + (p.stopY - TOP) * easeOut(t / 900);
        } else if (t < 1500) {
          x = p.xs[i] + Math.sin(t * 0.03) * 3;
          y = p.stopY;
        } else {
          if (!this.diveV) {
            const pl = this.scene.player;
            this.diveV = { a: Math.atan2(pl.y - this.y, pl.x - this.x), v: 90 * U };
          }
          this.diveV.v = Math.min(300 * U, this.diveV.v + 400 * U * dts);
          x = this.x + Math.cos(this.diveV.a) * this.diveV.v * dts;
          y = this.y + Math.sin(this.diveV.a) * this.diveV.v * dts;
        }
        break;
      }
      case 'circle': {
        const sx = p.cx + p.dir * p.radius;
        if (t < 1300) {
          x = sx;
          y = TOP + (p.cy - TOP) * (t / 1300);
        } else if (t < 1300 + 2800) {
          const a = ((t - 1300) / 2800) * Math.PI * 2;
          x = p.cx + p.dir * p.radius * Math.cos(a);
          y = p.cy + p.radius * Math.sin(a);
        } else {
          x = sx;
          y = p.cy + ((t - 4100) * 130 * U) / 1000;
        }
        break;
      }
      case 'hover': {
        const x0 = p.xs[i];
        const sway = 40 * U;
        if (t < 1500) {
          x = x0;
          y = TOP - 30 + (p.stopY - TOP + 30) * easeOut(t / 1500);
        } else if (t < 1500 + p.stay) {
          const t2 = t - 1500;
          x = x0 + Math.sin(t2 * 0.0011) * sway;
          y = p.stopY + Math.sin(t2 * 0.002) * 10 * U;
        } else {
          const t3 = t - 1500 - p.stay;
          x = x0 + Math.sin(p.stay * 0.0011) * sway;
          y = p.stopY + Math.sin(p.stay * 0.002) * 10 * U + ((t3 * t3) / 12000) * U;
        }
        break;
      }
      case 'drift':
        x = p.xs[i] + Math.sin(t * 0.0012 + i * 1.7) * 30 * U;
        y = TOP + (p.speed * t) / 1000;
        break;
      case 'ground':
        x = this.wave.x;
        y = H - (this.wave.d - this.scene.scroll);
        break;
    }

    const dx = x - this.x;
    const dy = y - this.y;
    this.x = x;
    this.y = y;
    const s = this.sprite;
    s.setPosition(x, y);
    if (this.def.spin) s.rotation += this.def.spin * dts;
    else if ((this.type === 'fighter' || this.type === 'kamikaze') && (dx || dy) && t > 0) {
      const want = Math.atan2(dy, dx) - Math.PI / 2;
      this.heading += Phaser.Math.Angle.Wrap(want - this.heading) * Math.min(1, dts * 10);
      s.rotation = this.heading;
    } else if (this.type === 'drone' || this.type === 'bomber' || this.type === 'gunship' || this.type === 'interceptor') {
      s.rotation = Phaser.Math.Clamp(dx * 0.02, -0.25, 0.25);
    }
    if (this.glow) this.glow.setPosition(x, y).setRotation(s.rotation).setAlpha(0.7 + Math.random() * 0.3);
    this.decor.update();
    if (this.shadow) {
      this.shadow.setPosition(x + SHADOW_OFFSET.x, y + SHADOW_OFFSET.y).setRotation(s.rotation).setScale(SHADOW_OFFSET.scale);
    }
    if (this.barrel) {
      const pl = this.scene.player;
      const want = Math.atan2(pl.y - y, pl.x - x) + Math.PI / 2;
      this.barrel.rotation += Phaser.Math.Angle.Wrap(want - this.barrel.rotation) * Math.min(1, dts * 5);
      // recoil: kick back along the barrel, then settle
      this.recoil *= Math.exp(-dts * 10);
      const a = this.barrel.rotation - Math.PI / 2;
      this.barrel.setPosition(x - Math.cos(a) * this.recoil, y - Math.sin(a) * this.recoil);
    }
  }

  leave() {
    this.alive = false;
    this.destroySprites();
  }

  update(dt, now) {
    this.t += dt * 1000;
    this.place();
    if (!this.alive) return;

    const m = 30;
    const onScreen = this.x > -m && this.x < W + m && this.y > -m && this.y < H + m;
    if (onScreen && !this.everOnScreen) this.onScreenAt = this.t;
    if (onScreen) this.everOnScreen = true;
    const gone =
      this.y > H + 120 || this.x < -160 || this.x > W + 160 || (this.everOnScreen && this.y < -140) || this.t > 30000;
    if (gone) {
      this.leave();
      return;
    }

    if (now < this.flashUntil) {
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.carrier) this.sprite.setTint(Math.floor(now / 120) % 2 ? 0xffff90 : 0x90ffff);
      else this.sprite.clearTint();
    }

    if (this.def.mine) {
      const pl = this.scene.player;
      if (pl.alive && onScreen && Math.hypot(pl.x - this.x, pl.y - this.y) < 150) {
        this.scene.detonateMine(this);
        return;
      }
      this.sprite.setTint(Math.floor(now / 180) % 2 ? 0xffffff : 0xff9090);
    }

    if (this.canFire) {
      this.fireT -= dt * 1000;
      if (this.fireT <= 0) {
        this.fireT = this.fireEvery;
        const pl = this.scene.player;
        const settled = this.everOnScreen && this.t - this.onScreenAt > 800;
        if (onScreen && settled && this.y > 40 && this.y < H - 250 && pl.alive && Math.abs(pl.y - this.y) > 90) this.fire(pl);
      }
    }
  }

  fire(pl) {
    const f = this.def.fire;
    const aim = Math.atan2(pl.y - this.y, pl.x - this.x);
    const s = this.scene;
    const v = this.bulletSpeed;
    if (f.kind === 'aimed') {
      s.spawnEnemyBullet('eb_orb', this.x, this.y, aim, v);
    } else if (f.kind === 'ring') {
      const off = this.sprite.rotation;
      for (let k = 0; k < f.n; k++) s.spawnEnemyBullet('eb_orb', this.x, this.y, off + (k * Math.PI * 2) / f.n, v * 0.8);
    } else if (f.kind === 'spread3') {
      for (let k = -1; k <= 1; k++) s.spawnEnemyBullet('eb_orb', this.x, this.y + 20, aim + k * 0.2, v * 1.1);
    } else if (f.kind === 'twin') {
      for (let b = 0; b < 3; b++) {
        s.time.delayedCall(b * 130, () => {
          if (!this.alive) return;
          for (const sx of [-38, 38]) {
            const gx = this.x + sx;
            const gy = this.y + 60;
            s.spawnEnemyBullet('eb_orb', gx, gy, Math.atan2(pl.y - gy, pl.x - gx), v);
            s.fx.muzzle(gx, gy, 0xffa040);
          }
        });
      }
    } else if (f.kind === 'fan') {
      for (let k = 0; k < f.n; k++) {
        const a = aim + (k - (f.n - 1) / 2) * (f.spread / Math.max(1, f.n - 1));
        s.spawnEnemyBullet('eb_big', this.x, this.y + 30, a, v * 0.9);
      }
    }
    if (this.barrel) this.recoil = 12;
    s.fx.muzzle(this.x, this.y + 10, 0xff70c0);
    s.playSfx('enemyShoot', this.x);
  }

  /** returns true if this hit killed the enemy */
  damage(n, now) {
    if (!this.alive) return false;
    this.hp -= n;
    this.flashUntil = now + 60;
    if (this.hp <= 0) {
      this.alive = false;
      this.destroySprites();
      return true;
    }
    return false;
  }

  destroySprites() {
    this.sprite.destroy();
    if (this.barrel) this.barrel.destroy();
    if (this.shadow) this.shadow.destroy();
    if (this.glow) this.glow.destroy();
    this.decor.destroy();
  }
}
