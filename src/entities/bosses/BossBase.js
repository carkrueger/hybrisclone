// Shared boss machinery: parts and weak points, the attack rhythm (one attack at a
// time with pauses in between), phases by health, hit testing and the death sequence.
// Archetypes extend this class and implement build(), attacks() and optionally
// move(), coreOpen(), coreArmor(), tick(), onPartDestroyed().
import Phaser from 'phaser';
import { W, H, U, DEPTH } from '../../config.js';
import { RNG } from '../../core/rng.js';
import { SHADOW_OFFSET } from '../Player.js';
import { segDist2 } from '../projectiles.js';

const ADD = Phaser.BlendModes.ADD;

export class BossBase {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.rng = new RNG(data.seed);
    this.sprites = [];
    this.parts = [];
    this.hulls = []; // {img, w, h} ellipse collision areas
    this.x = W / 2;
    this.y = -500;
    this.baseY = 260;
    this.t = 0;
    this.state = 'enter';
    this.alive = true;
    this.hpMax = data.hp;
    this.hp = data.hp;
    this.busyUntil = 0;
    this.nextAt = 0;
    this.attackIdx = 0;
    this.deathT = 0;
    this.core = null;
    this.tele = data.telegraph;
    this.speed = data.bulletSpeed * U;
    this.build();
    this.y = -this.height() / 2 - 40;
  }

  // ------------------------------------------------------------------ building helpers
  sprite(tex, depth = DEPTH.boss, blend = false) {
    const s = this.scene.add.image(this.x, this.y, tex).setDepth(depth);
    if (blend) s.setBlendMode(ADD);
    this.sprites.push(s);
    return s;
  }

  rim(tex, depth) {
    if (!this.scene.preset.rim || !this.scene.textures.exists(tex + '_rim')) return null;
    return this.sprite(tex + '_rim', depth, true).setTint(this.scene.rimColor).setAlpha(0.75);
  }

  hull(tex, { dx = 0, dy = 0, shadow = true, collide = 0.42 } = {}) {
    const img = this.sprite(tex, DEPTH.boss);
    const h = { img, dx, dy, w: img.width * collide, h: img.height * collide, rim: this.rim(tex, DEPTH.boss + 0.1) };
    if (shadow && this.scene.preset.shadows) h.shadow = this.sprite(tex, DEPTH.airShadows).setTint(0x000000).setAlpha(0.35).setScale(0.85);
    this.hulls.push(h);
    return h;
  }

  /** a damageable part; core: true marks the boss core (health bar) */
  part({ tex, dx = 0, dy = 0, r = 30, hp = 20, core = false, depth = DEPTH.boss + 1, pos = null, score = 500 }) {
    const p = { tex, dx, dy, r, hp, hpMax: hp, core, alive: true, flashUntil: 0, pos, score, recoil: 0, rot: 0 };
    p.sprite = this.sprite(tex, depth);
    p.rim = this.rim(tex, depth + 0.05);
    this.parts.push(p);
    if (core) this.core = p;
    return p;
  }

  partPos(p) {
    if (p.pos) return p.pos();
    return { x: this.x + p.dx, y: this.y + p.dy };
  }

  height() {
    return Math.max(200, ...this.hulls.map((h) => h.img.height));
  }

  // ------------------------------------------------------------------ overridable
  build() {}
  attacks() {
    return [];
  }
  move(dt) {
    const amp = Math.min(520, Math.max(0, (W - (this.hulls[0] ? this.hulls[0].img.width : 400)) / 2 - 60));
    const sp = this.data.moveSpeed * 0.001;
    if (this.data.move === 'figure8') {
      this.x = W / 2 + Math.sin(this.t * sp) * amp;
      this.y = this.baseY + Math.sin(this.t * sp * 2) * 30;
    } else if (this.data.move === 'drift') {
      this.x = W / 2 + Math.sin(this.t * sp * 0.6) * amp;
      this.y = this.baseY + 30 + Math.sin(this.t * sp * 0.35) * 50;
    } else {
      this.x = W / 2 + Math.sin(this.t * sp) * amp;
    }
  }
  coreOpen() {
    return true;
  }
  coreArmor() {
    return 1;
  }
  tick() {}
  onPartDestroyed() {}

  // ------------------------------------------------------------------ helpers for attacks
  get pl() {
    return this.scene.player;
  }

  aimFrom(p) {
    return Math.atan2(this.pl.y - p.y, this.pl.x - p.x);
  }

  pause() {
    return this.rng.range(800, 1400) * this.data.tempo;
  }

  get phase() {
    const f = this.hp / this.hpMax;
    return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  }

  // ------------------------------------------------------------------ update
  update(dt, now) {
    const ms = dt * 1000;
    this.t += ms;
    if (this.state === 'enter') {
      this.y += 140 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.state = 'fight';
        this.t = 0;
        this.nextAt = now + 900;
      }
    } else if (this.state === 'fight') {
      this.move(dt, now);
      if (now >= this.busyUntil && now >= this.nextAt && this.pl.alive) {
        const list = this.attacks().filter(Boolean);
        if (list.length) {
          const fn = list[this.attackIdx++ % list.length];
          const dur = fn.call(this, now) || 600;
          this.busyUntil = now + dur;
          this.nextAt = this.busyUntil + this.pause();
        }
      }
      this.tick(dt, now);
    } else if (this.state === 'dying') {
      this.deathT += ms;
      this.x += Math.sin(this.deathT * 0.05) * 1.5;
      this.y += 14 * dt;
      if (Math.floor(this.deathT / 90) !== Math.floor((this.deathT - ms) / 90)) {
        const hb = this.hulls[0];
        const w = hb ? hb.img.width : 300;
        const h = hb ? hb.img.height : 200;
        const ex = this.x + (Math.random() - 0.5) * w * 0.9;
        const ey = this.y + (Math.random() - 0.5) * h * 0.9;
        this.scene.fx.explode(ex, ey, 1 + Math.random() * 1.2);
        this.scene.playSfx('explodeSmall', ex);
        this.scene.cameras.main.shake(90, 0.004);
      }
      if (this.deathT > (this.data.mid ? 1600 : 2600)) {
        this.finish();
        return;
      }
    }
    this.layout(now, dt);
  }

  layout(now, dt) {
    for (const h of this.hulls) {
      const x = this.x + h.dx;
      const y = this.y + h.dy;
      h.img.setPosition(x, y);
      if (h.rim) h.rim.setPosition(x, y).setAlpha(0.75 * h.img.alpha).setRotation(h.img.rotation);
      if (h.shadow) h.shadow.setPosition(x + SHADOW_OFFSET.x * 1.8, y + SHADOW_OFFSET.y * 1.8).setAlpha(0.35 * h.img.alpha).setRotation(h.img.rotation);
    }
    for (const p of this.parts) {
      if (!p.sprite) continue;
      const pos = this.partPos(p);
      p.recoil *= Math.exp(-dt * 9);
      const a = p.sprite.rotation + Math.PI / 2;
      p.sprite.setPosition(pos.x - Math.cos(a) * p.recoil, pos.y - Math.sin(a) * p.recoil);
      if (now < p.flashUntil) p.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else {
        p.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        if (p.core && !this.coreOpen()) p.sprite.setTint(0x8090b0);
        else if (p.tint) p.sprite.setTint(p.tint);
        else p.sprite.clearTint();
      }
      if (p.rim) p.rim.setPosition(p.sprite.x, p.sprite.y).setRotation(p.sprite.rotation).setScale(p.sprite.scaleX, p.sprite.scaleY).setAlpha(0.75 * p.sprite.alpha);
    }
  }

  /** turn a gun part toward the player */
  aimPart(p, dt, speed = 4) {
    if (!p.sprite) return;
    const pos = this.partPos(p);
    const want = Math.atan2(this.pl.y - pos.y, this.pl.x - pos.x) - Math.PI / 2;
    p.sprite.rotation += Phaser.Math.Angle.Wrap(want - p.sprite.rotation) * Math.min(1, dt * speed);
  }

  // ------------------------------------------------------------------ collisions
  hullContains(x, y, pad = 0) {
    if (this.state === 'dying') return false;
    for (const h of this.hulls) {
      if (h.img.alpha < 0.5) continue;
      const dx = (x - (this.x + h.dx)) / Math.max(1, h.w + pad);
      const dy = (y - (this.y + h.dy)) / Math.max(1, h.h + pad);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  }

  hitTest(bx, by, br) {
    if (this.state !== 'fight') return null;
    for (const p of this.parts) {
      if (!p.alive || (p.sprite && p.sprite.alpha < 0.5)) continue;
      const pos = this.partPos(p);
      if ((bx - pos.x) ** 2 + (by - pos.y) ** 2 < (p.r + br) ** 2) return p;
    }
    return null;
  }

  /** every part touched by a beam segment of half-width hw (player laser) */
  hitSegment(x0, y0, x1, y1, hw) {
    if (this.state !== 'fight') return [];
    return this.parts.filter((p) => {
      if (!p.alive || (p.sprite && p.sprite.alpha < 0.5)) return false;
      const pos = this.partPos(p);
      return segDist2(pos.x, pos.y, x0, y0, x1, y1) < (p.r + hw) ** 2;
    });
  }

  targets() {
    if (this.state !== 'fight') return [];
    return this.parts.filter((p) => p.alive && (!p.core || this.coreOpen())).map((p) => ({ part: p, ...this.partPos(p) }));
  }

  hpFraction() {
    return Math.max(0, this.hp / this.hpMax);
  }

  /** returns score awarded */
  damage(part, n, now) {
    if (this.state !== 'fight' || !part.alive) return 0;
    part.flashUntil = now + 50;
    if (part.core) {
      if (!this.coreOpen()) {
        const pos = this.partPos(part);
        this.scene.fx.hitSpark(pos.x + (Math.random() - 0.5) * 50, pos.y + (Math.random() - 0.5) * 40, 0x90d0ff);
        this.scene.playSfx('armor', pos.x);
        return 0;
      }
      this.hp -= n * this.coreArmor();
      if (this.hp <= 0) {
        this.hp = 0;
        this.die();
        return this.data.score;
      }
      return 10;
    }
    part.hp -= n;
    if (part.hp > 0) return 5;
    this.destroyPart(part);
    return part.score;
  }

  destroyPart(part) {
    part.alive = false;
    const pos = this.partPos(part);
    if (part.sprite) part.sprite.setVisible(false);
    if (part.rim) part.rim.setVisible(false);
    part.sprite = null;
    this.scene.fx.explode(pos.x, pos.y, 1.8);
    this.scene.playSfx('explodeBig', pos.x);
    this.scene.fx.floatText(pos.x, pos.y, String(part.score), 0xffe14a);
    this.scene.cameras.main.shake(140, 0.006);
    this.onPartDestroyed(part);
  }

  die() {
    if (this.state === 'dying') return;
    this.state = 'dying';
    this.deathT = 0;
    this.scene.onBossDying(this);
  }

  finish() {
    this.alive = false;
    const big = this.data.mid ? 3 : 5;
    this.scene.fx.explode(this.x, this.y, big);
    if (!this.data.mid) {
      this.scene.fx.explode(this.x - 160, this.y, 3);
      this.scene.fx.explode(this.x + 160, this.y, 3);
    }
    this.scene.fx.screenFlash(0xffffff, 600, this.data.mid ? 0.6 : 0.9);
    this.scene.cameras.main.shake(600, this.data.mid ? 0.012 : 0.02);
    this.scene.hitStop(140);
    this.scene.playSfx('explodeHuge', this.x);
    this.destroy();
    this.scene.onBossDefeated(this);
  }

  destroy() {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}
