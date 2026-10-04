// A single enemy following one of the seeded wave patterns (see level/waves.js).
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';
import { ENEMY_DEFS } from '../level/waves.js';

const easeOut = (u) => 1 - (1 - u) * (1 - u);

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
    this.carrier = wave.carrier === index;
    this.fireT = wave.fireDelays ? wave.fireDelays[index] : wave.fireDelay ?? 1000;
    this.canFire = !!def.fire && (wave.canFire ?? true);
    this.fireEvery = def.fire ? def.fire.every * Math.max(0.55, 1 - 0.08 * sector) : 0;
    this.bulletSpeed = Math.min(190, 92 + sector * 14);
    this.onScreenAt = -1;
    this.flashUntil = 0;
    this.diveV = null;

    this.sprite = scene.add.image(-100, -100, def.tex).setDepth(this.ground ? DEPTH.ground : DEPTH.enemies);
    if (this.ground) {
      this.barrel = scene.add.image(-100, -100, 'e_barrel').setDepth(DEPTH.ground + 1).setOrigin(0.5, 0.85);
    }
    this.x = -100;
    this.y = -100;
    this.place();
  }

  place() {
    const p = this.wave.params || {};
    const t = this.t;
    const i = this.index;
    let x = this.x;
    let y = this.y;
    switch (this.wave.pattern) {
      case 'line':
        x = p.x;
        y = -12 + (p.speed * t) / 1000;
        break;
      case 'sine':
        x = p.x + p.amp * Math.sin(t * p.freq);
        y = -12 + (p.speed * t) / 1000;
        break;
      case 'vform': {
        const k = i - (this.wave.count - 1) / 2;
        x = p.x + k * p.spacing;
        y = -12 - Math.abs(k) * p.spacing * 0.8 + (p.speed * t) / 1000;
        break;
      }
      case 'swoop': {
        const u = t / p.dur;
        const x0 = p.side < 0 ? -16 : W + 16;
        const x2 = W - x0;
        const iu = 1 - u;
        x = iu * iu * x0 + 2 * iu * u * (W / 2) + u * u * x2;
        y = iu * iu * p.y0 + 2 * iu * u * p.cy + u * u * p.y1;
        if (u > 1.05) this.leave();
        break;
      }
      case 'dive': {
        if (t < 900) {
          x = p.xs[i];
          y = -12 + (p.stopY + 12) * easeOut(t / 900);
        } else if (t < 1500) {
          x = p.xs[i] + Math.sin(t * 0.03) * 1.5;
          y = p.stopY;
        } else {
          if (!this.diveV) {
            const pl = this.scene.player;
            const a = Math.atan2(pl.y - this.y, pl.x - this.x);
            this.diveV = { a, v: 90 };
          }
          this.diveV.v = Math.min(300, this.diveV.v + 400 * this.scene.dtSec);
          x = this.x + Math.cos(this.diveV.a) * this.diveV.v * this.scene.dtSec;
          y = this.y + Math.sin(this.diveV.a) * this.diveV.v * this.scene.dtSec;
        }
        break;
      }
      case 'circle': {
        const sx = p.cx + p.dir * p.radius;
        if (t < 1300) {
          x = sx;
          y = -12 + (p.cy + 12) * (t / 1300);
        } else if (t < 1300 + 2800) {
          const a = ((t - 1300) / 2800) * Math.PI * 2;
          x = p.cx + p.dir * p.radius * Math.cos(a);
          y = p.cy + p.radius * Math.sin(a);
        } else {
          x = sx;
          y = p.cy + ((t - 4100) * 130) / 1000;
        }
        break;
      }
      case 'hover': {
        const x0 = p.xs[i];
        if (t < 1500) {
          x = x0;
          y = -20 + (p.stopY + 20) * easeOut(t / 1500);
        } else if (t < 1500 + p.stay) {
          const t2 = t - 1500;
          x = x0 + Math.sin(t2 * 0.0011) * 40;
          y = p.stopY + Math.sin(t2 * 0.002) * 10;
        } else {
          const t3 = t - 1500 - p.stay;
          x = x0 + Math.sin(p.stay * 0.0011) * 40;
          y = p.stopY + Math.sin(p.stay * 0.002) * 10 + (t3 * t3) / 12000;
        }
        break;
      }
      case 'ground':
        x = this.wave.x;
        y = H - (this.wave.d - this.scene.scroll);
        break;
    }

    const dx = x - this.x;
    const dy = y - this.y;
    this.x = x;
    this.y = y;
    this.sprite.setPosition(Math.round(x), Math.round(y));
    if (this.def.spin) this.sprite.rotation += this.def.spin * this.scene.dtSec;
    else if ((this.type === 'fighter' || this.type === 'kamikaze') && (dx || dy) && t > 0) {
      this.sprite.rotation = Math.atan2(dy, dx) - Math.PI / 2;
    }
    if (this.barrel) {
      this.barrel.setPosition(this.sprite.x, this.sprite.y);
      const pl = this.scene.player;
      this.barrel.rotation = Math.atan2(pl.y - this.y, pl.x - this.x) + Math.PI / 2;
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

    const onScreen = this.x > -12 && this.x < W + 12 && this.y > -12 && this.y < H + 12;
    if (onScreen && !this.everOnScreen) this.onScreenAt = this.t;
    if (onScreen) this.everOnScreen = true;
    const gone = this.y > H + 30 || this.x < -40 || this.x > W + 40 || (this.everOnScreen && this.y < -40) || this.t > 30000;
    if (gone) {
      this.leave();
      return;
    }

    // power-up carriers glow
    if (now < this.flashUntil) {
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.carrier) this.sprite.setTint(Math.floor(now / 120) % 2 ? 0xffff60 : 0x80ffff);
      else this.sprite.clearTint();
    }

    if (this.canFire) {
      this.fireT -= dt * 1000;
      if (this.fireT <= 0) {
        this.fireT = this.fireEvery;
        const pl = this.scene.player;
        const settled = this.everOnScreen && this.t - this.onScreenAt > 800;
        if (onScreen && settled && this.y > 16 && this.y < H - 110 && pl.alive && Math.abs(pl.y - this.y) > 40) this.fire(pl);
      }
    }
  }

  fire(pl) {
    const f = this.def.fire;
    const aim = Math.atan2(pl.y - this.y, pl.x - this.x);
    const s = this.scene;
    const v = this.bulletSpeed;
    if (f.kind === 'aimed') {
      s.spawnEnemyBullet('ebullet', this.x, this.y, aim, v);
    } else if (f.kind === 'ring') {
      const off = this.sprite.rotation;
      for (let k = 0; k < f.n; k++) s.spawnEnemyBullet('ebullet', this.x, this.y, off + (k * Math.PI * 2) / f.n, v * 0.8);
    } else if (f.kind === 'fan') {
      for (let k = 0; k < f.n; k++) {
        const a = aim + (k - (f.n - 1) / 2) * (f.spread / Math.max(1, f.n - 1));
        s.spawnEnemyBullet('ebullet2', this.x, this.y + 6, a, v * 0.9);
      }
    }
    s.playSfx('enemyShoot');
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
  }
}
