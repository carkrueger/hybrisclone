// A single enemy: follows a seeded movement pattern (see level/waves.js), fires a
// generic attack or delegates to a special behaviour (entities/behaviors.js).
import Phaser from 'phaser';
import { W, H, U, DEPTH } from '../config.js';
import { ENEMY_DEFS } from '../level/enemyDefs.js';
import { SHADOW_OFFSET } from './Player.js';
import { ShipDecor } from './decor.js';
import { BEHAVIORS } from './behaviors.js';
import { aimed, ring, burst } from './attacks.js';

const easeOut = (u) => 1 - (1 - u) * (1 - u);
const TOP = -50;
const ADD = Phaser.BlendModes.ADD;

export class Enemy {
  /**
   * @param wave  wave data (or a pseudo-wave for ground units / spawned minions)
   * @param index index within the wave
   * @param at    optional {x, y} spawn position for minions
   */
  constructor(scene, wave, index, at = null) {
    const def = ENEMY_DEFS[wave.type];
    const diff = scene.level.diff;
    this.scene = scene;
    this.wave = wave;
    this.index = index;
    this.def = def;
    this.type = wave.type;
    this.elite = wave.elite === index;
    this.hp = Math.max(1, Math.round(def.hp * diff.hp * (this.elite ? 2.5 : 1)));
    this.r = def.r * (this.elite ? 1.12 : 1);
    this.score = def.score * (this.elite ? 3 : 1);
    this.ground = !!def.ground;
    this.t = 0;
    this.alive = true;
    this.vuln = true;
    this.shielded = false;
    this.everOnScreen = false;
    this.onScreenAt = -1;
    this.carrier = wave.carrier === index;
    this.fireT = wave.fireDelays ? wave.fireDelays[index] ?? 900 : wave.fireDelay ?? 1000;
    this.canFire = !!def.fire && (wave.canFire ?? true);
    this.fireEvery = def.fire ? def.fire.every * diff.fireInterval * (this.elite ? 0.75 : 1) : 0;
    this.bulletSpeed = Math.min(190, 92 * diff.bulletSpeed + 20) * U;
    this.flashUntil = 0;
    this.custom = false; // behaviour controls the position
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.recoil = 0;

    const preset = scene.preset;
    if (!this.ground && preset.shadows) {
      this.shadow = scene.add.image(-300, -300, def.tex).setDepth(DEPTH.airShadows).setTint(0x000000).setAlpha(0.32);
    }
    this.sprite = scene.add.image(-300, -300, def.tex).setDepth(this.ground ? DEPTH.ground : DEPTH.enemies);
    if (this.elite) this.sprite.setScale(1.15);
    if (scene.textures.exists(def.tex + '_glow')) {
      this.glow = scene.add.image(-300, -300, def.tex + '_glow').setDepth(DEPTH.enemies + 1).setBlendMode(ADD);
    }
    if (this.ground && def.barrel !== false && (this.type === 'turret' || this.type === 'railturret' || this.type === 'sniper')) {
      this.barrel = scene.add.image(-300, -300, this.type === 'turret' ? 'e_barrel' : this.type + '_barrel').setDepth(DEPTH.ground + 1).setOrigin(0.5, 0.78);
      if (wave.raised) this.sprite.setScale(1.08);
    }
    this.decor = new ShipDecor(scene, this.sprite, def.tex, {
      flames: preset.flames,
      rim: preset.rim && !this.ground,
      rimColor: this.elite ? 0xffd040 : scene.rimColor,
    });
    this.x = at ? at.x : -300;
    this.y = at ? at.y : -300;
    this.behavior = def.ai ? BEHAVIORS[def.ai] : null;
    if (this.behavior && this.behavior.init) this.behavior.init(this);
    this.place();
  }

  get params() {
    return this.wave.params || {};
  }

  place() {
    const p = this.params;
    const t = this.t;
    const i = this.index;
    const dts = this.scene.dtSec || 0;
    const top = p.y0 ?? TOP;
    let x = this.x;
    let y = this.y;
    if (this.custom || (this.behavior && this.behavior.move && this.behavior.move(this, dts))) {
      x = this.x;
      y = this.y;
    } else {
      switch (this.wave.pattern) {
        case 'line':
          x = p.x;
          y = top + (p.speed * t) / 1000;
          break;
        case 'sine':
          x = p.x + p.amp * Math.sin(t * p.freq);
          y = top + (p.speed * t) / 1000;
          break;
        case 'vform': {
          const k = i - (this.wave.count - 1) / 2;
          x = p.x + k * p.spacing;
          y = top - Math.abs(k) * p.spacing * 0.8 + (p.speed * t) / 1000;
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
            y = top + (p.stopY - top) * easeOut(t / 900);
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
            y = top + (p.cy - top) * (t / 1300);
          } else if (t < 4100) {
            const a = ((t - 1300) / 2800) * Math.PI * 2;
            x = p.cx + p.dir * p.radius * Math.cos(a);
            y = p.cy + p.radius * Math.sin(a);
          } else {
            x = sx;
            y = p.cy + ((t - 4100) * 130 * U) / 1000;
          }
          break;
        }
        case 'hover':
        case 'strafe': {
          const x0 = p.xs[i];
          const sway = (this.wave.pattern === 'strafe' ? 120 : 40) * U;
          const swf = this.wave.pattern === 'strafe' ? 0.0009 : 0.0011;
          if (t < 1500) {
            x = x0;
            y = top - 30 + (p.stopY - top + 30) * easeOut(t / 1500);
          } else if (t < 1500 + p.stay) {
            const t2 = t - 1500;
            x = x0 + Math.sin(t2 * swf) * sway;
            y = p.stopY + Math.sin(t2 * 0.002) * 10 * U;
          } else {
            const t3 = t - 1500 - p.stay;
            x = x0 + Math.sin(p.stay * swf) * sway;
            y = p.stopY + Math.sin(p.stay * 0.002) * 10 * U + ((t3 * t3) / 12000) * U;
          }
          break;
        }
        case 'drift':
          x = p.xs[i] + Math.sin(t * 0.0012 + i * 1.7) * 30 * U;
          y = top + (p.speed * t) / 1000;
          break;
        case 'tumble':
          x = p.xs[i] + Math.sin(t * 0.0008 + i * 2.1) * 40 * U;
          y = top + (p.speed * t) / 1000;
          break;
        case 'traverse':
          x = p.side < 0 ? -90 + (p.speed * t) / 1000 : W + 90 - (p.speed * t) / 1000;
          y = p.y + Math.sin(t * 0.001 + i) * 20 * U;
          break;
        case 'orbit': {
          const cx = p.xs[i];
          if (t < 1300) {
            x = cx + p.radius;
            y = top + (p.cy - top) * easeOut(t / 1300);
          } else if (t < 1300 + p.stay) {
            const a = ((t - 1300) / 2200) * Math.PI * 2;
            x = cx + Math.cos(a) * p.radius;
            y = p.cy + Math.sin(a) * p.radius * 0.6;
          } else {
            x = this.x;
            y = this.y + 220 * dts;
          }
          break;
        }
        case 'zigzag': {
          const tri = (2 / Math.PI) * Math.asin(Math.sin(t * 0.004));
          x = p.xs[i] + tri * p.amp;
          y = top + (p.speed * t) / 1000;
          break;
        }
        case 'burst':
          x = this.x + this.vx * dts;
          y = this.y + this.vy * dts;
          this.vy += 120 * dts;
          break;
        case 'ground':
          x = this.wave.x;
          y = H - (this.wave.d - this.scene.scroll);
          break;
        default:
          break;
      }
    }

    const dx = x - this.x;
    const dy = y - this.y;
    this.x = x;
    this.y = y;
    const s = this.sprite;
    s.setPosition(x, y);
    if (this.def.spin) s.rotation += this.def.spin * dts;
    else if (this.faceMotion !== false && ['fighter', 'kamikaze', 'swarmer', 'driller', 'interceptor', 'claw'].includes(this.type) && (dx || dy) && t > 0) {
      const want = Math.atan2(dy, dx) - Math.PI / 2;
      this.heading += Phaser.Math.Angle.Wrap(want - this.heading) * Math.min(1, dts * 10);
      s.rotation = this.heading;
    } else if (!this.ground) {
      s.rotation = Phaser.Math.Clamp(dx * 0.02, -0.25, 0.25);
    }
    if (this.glow) this.glow.setPosition(x, y).setRotation(s.rotation).setAlpha((0.7 + Math.random() * 0.3) * s.alpha);
    this.decor.update();
    if (this.shadow) {
      this.shadow.setPosition(x + SHADOW_OFFSET.x, y + SHADOW_OFFSET.y).setRotation(s.rotation).setScale(SHADOW_OFFSET.scale * s.scaleX).setAlpha(0.32 * s.alpha);
    }
    if (this.bubble) {
      this.bubble.setVisible(this.shielded).setPosition(x, y);
      if (this.shielded) this.bubble.setScale((this.r * 2.6) / 160).setAlpha(0.5 + 0.2 * Math.sin(this.t * 0.01));
    }
    if (this.barrel) {
      const pl = this.scene.player;
      const want = Math.atan2(pl.y - y, pl.x - x) + Math.PI / 2;
      if (!this.lockAim) this.barrel.rotation += Phaser.Math.Angle.Wrap(want - this.barrel.rotation) * Math.min(1, dts * 5);
      this.recoil *= Math.exp(-dts * 10);
      const a = this.barrel.rotation - Math.PI / 2;
      this.barrel.setPosition(x - Math.cos(a) * this.recoil, y - Math.sin(a) * this.recoil);
    }
  }

  setShielded(on) {
    this.shielded = on;
    if (on && !this.bubble) this.bubble = this.scene.add.image(this.x, this.y, 'ring').setDepth(DEPTH.enemies + 2).setBlendMode(ADD).setTint(0x80c8ff);
  }

  leave() {
    this.alive = false;
    this.destroySprites();
  }

  get onScreen() {
    const m = 30;
    return this.x > -m && this.x < W + m && this.y > -m && this.y < H + m;
  }

  update(dt, now) {
    this.t += dt * 1000;
    this.place();
    if (!this.alive) return;

    const onScreen = this.onScreen;
    if (onScreen && !this.everOnScreen) this.onScreenAt = this.t;
    if (onScreen) this.everOnScreen = true;
    const gone = this.y > H + 140 || this.x < -200 || this.x > W + 200 || (this.everOnScreen && this.y < -160) || this.t > 40000;
    if (gone) {
      this.leave();
      return;
    }

    if (now < this.flashUntil) {
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.carrier) this.sprite.setTint(Math.floor(now / 120) % 2 ? 0xffff90 : 0x90ffff);
      else if (this.elite) this.sprite.setTint(0xffe8a0);
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

    const settled = this.everOnScreen && this.t - this.onScreenAt > 800;
    const pl = this.scene.player;
    const fireZone = onScreen && settled && this.y > 40 && this.y < H - 250 && pl.alive && Math.abs(pl.y - this.y) > 90;
    if (this.behavior && this.behavior.update) this.behavior.update(this, dt, now, fireZone);

    if (this.canFire) {
      this.fireT -= dt * 1000;
      if (this.fireT <= 0) {
        this.fireT = this.fireEvery;
        if (fireZone) this.fire(pl);
      }
    }
  }

  fire() {
    const f = this.def.fire;
    const s = this.scene;
    const v = this.bulletSpeed;
    const tex = s.themeBullet;
    if (f.kind === 'aimed') aimed(s, this.x, this.y, { speed: v, tex });
    else if (f.kind === 'ring') ring(s, this.x, this.y, { n: f.n, speed: v * 0.8, tex, offset: this.sprite.rotation });
    else if (f.kind === 'spread3') aimed(s, this.x, this.y + 20, { n: 3, spread: 0.2, speed: v * 1.1, tex });
    else if (f.kind === 'fan') aimed(s, this.x, this.y + 30, { n: f.n, spread: f.spread / (f.n - 1), speed: v * 0.9, tex: 'eb_big' });
    else if (f.kind === 'twin') {
      for (const sx of [-38, 38]) burst(s, () => (this.alive ? { x: this.x + sx, y: this.y + 60 } : null), { count: 3, gap: 140, speed: v, tex });
    }
    if (this.barrel) this.recoil = 12;
    s.fx.muzzle(this.x, this.y + 10, 0xff70c0);
    s.playSfx('enemyShoot', this.x);
  }

  /** returns true if this hit killed the enemy */
  damage(n, now) {
    if (!this.alive) return false;
    if (!this.vuln || this.shielded) {
      this.scene.fx.hitSpark(this.x + (Math.random() - 0.5) * this.r, this.y + (Math.random() - 0.5) * this.r, 0x90d0ff);
      return false;
    }
    this.hp -= n;
    this.flashUntil = now + 60;
    if (this.hp <= 0) {
      this.alive = false;
      if (this.behavior && this.behavior.onDeath) this.behavior.onDeath(this);
      this.destroySprites();
      return true;
    }
    return false;
  }

  destroySprites() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.behavior && this.behavior.cleanup) this.behavior.cleanup(this);
    this.sprite.destroy();
    if (this.barrel) this.barrel.destroy();
    if (this.shadow) this.shadow.destroy();
    if (this.glow) this.glow.destroy();
    if (this.bubble) this.bubble.destroy();
    this.decor.destroy();
  }
}
