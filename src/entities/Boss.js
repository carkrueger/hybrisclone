// End-of-sector boss built from generated data (level/bossgen.js).
import Phaser from 'phaser';
import { W, DEPTH } from '../config.js';
import { RNG, hashSeed } from '../core/rng.js';
import { makeBossHullTexture } from '../gfx/textures.js';

export class Boss {
  constructor(scene, data, seedKey) {
    this.scene = scene;
    this.data = data;
    const { hull } = data;
    this.w = hull.w;
    this.h = hull.h;
    this.profile = hull.profile;

    const key = 'boss_hull_' + seedKey;
    makeBossHullTexture(scene, key, hull, new RNG(hashSeed('hull-deco:' + seedKey)));

    this.x = W / 2;
    this.baseY = 34 + this.h / 2;
    this.y = -this.h;
    this.t = 0;
    this.state = 'enter';
    this.alive = true;

    this.hull = scene.add.image(this.x, this.y, key).setDepth(DEPTH.boss);
    this.coreMax = data.core.hp;
    this.core = {
      kind: 'core',
      dx: 0,
      dy: data.core.y - this.h / 2,
      r: 11,
      hp: data.core.hp,
      alive: true,
      flashUntil: 0,
      sprite: scene.add.image(this.x, this.y, 'boss_core').setDepth(DEPTH.boss + 1),
    };
    this.guns = data.guns.map((g) => ({
      kind: 'gun',
      dx: g.x,
      dy: g.y - this.h / 2,
      r: 7,
      hp: g.hp,
      alive: true,
      flashUntil: 0,
      pattern: g.pattern,
      every: g.every,
      timer: 1500 + g.offset,
      sprite: scene.add.image(this.x, this.y, 'boss_gun').setDepth(DEPTH.boss + 1),
    }));
    this.coreTimers = data.phases.map((ph) => ph.map((p) => 1200 + p.offset));
    this.spiral = null;
    this.deathT = 0;
  }

  get phase() {
    const f = this.core.hp / this.coreMax;
    return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  }

  get gunsAlive() {
    return this.guns.some((g) => g.alive);
  }

  partPos(p) {
    return { x: this.x + p.dx, y: this.y + p.dy };
  }

  update(dt, now) {
    const ms = dt * 1000;
    this.t += ms;

    if (this.state === 'enter') {
      this.y += 40 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.state = 'fight';
        this.t = 0;
      }
    } else if (this.state === 'fight') {
      const amp = Math.max(0, (W - this.w) / 2 - 6);
      const sp = this.data.moveSpeed * 0.001;
      if (this.data.move === 'sway') {
        this.x = W / 2 + Math.sin(this.t * sp) * amp;
      } else if (this.data.move === 'figure8') {
        this.x = W / 2 + Math.sin(this.t * sp) * amp;
        this.y = this.baseY + Math.sin(this.t * sp * 2) * 14;
      } else {
        this.x = W / 2 + Math.sin(this.t * sp * 0.6) * amp;
        this.y = this.baseY + 20 + Math.sin(this.t * sp * 0.35) * 24;
      }
      this.updateAttacks(ms, now);
    } else if (this.state === 'dying') {
      this.deathT += ms;
      this.x += Math.sin(this.deathT * 0.05) * 0.6;
      this.y += 6 * dt;
      if (Math.floor(this.deathT / 90) !== Math.floor((this.deathT - ms) / 90)) {
        const ex = this.x + (Math.random() - 0.5) * this.w * 0.9;
        const ey = this.y + (Math.random() - 0.5) * this.h * 0.9;
        this.scene.fx.explode(ex, ey, 1 + Math.random());
        this.scene.playSfx('explodeSmall');
      }
      if (this.deathT > 2600) {
        this.finish();
        return;
      }
    }

    this.hull.setPosition(Math.round(this.x), Math.round(this.y));
    for (const p of [this.core, ...this.guns]) {
      if (!p.sprite) continue;
      const pos = this.partPos(p);
      p.sprite.setPosition(Math.round(pos.x), Math.round(pos.y));
      if (now < p.flashUntil) p.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else {
        p.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        if (p.kind === 'core' && this.gunsAlive) p.sprite.setTint(0x8080a0);
        else if (p.kind === 'core') p.sprite.setTint(Math.floor(now / 100) % 2 ? 0xffffff : 0xffc0c0);
        else p.sprite.clearTint();
      }
    }
    if (this.state === 'fight') this.core.sprite.rotation += dt * (1 + this.phase);
  }

  updateAttacks(ms, now) {
    const s = this.scene;
    const pl = s.player;
    const v = this.data.bulletSpeed;

    for (const g of this.guns) {
      if (!g.alive) continue;
      g.timer -= ms;
      if (g.timer > 0) continue;
      g.timer = g.every;
      if (!pl.alive) continue;
      const pos = this.partPos(g);
      const aim = Math.atan2(pl.y - pos.y, pl.x - pos.x);
      if (g.pattern === 'aimed') s.spawnEnemyBullet('ebullet', pos.x, pos.y + 6, aim, v);
      else if (g.pattern === 'fan3') for (let k = -1; k <= 1; k++) s.spawnEnemyBullet('ebullet', pos.x, pos.y + 6, aim + k * 0.22, v);
      else {
        for (let k = 0; k < 3; k++) {
          s.time.delayedCall(k * 110, () => {
            if (g.alive && this.state === 'fight') s.spawnEnemyBullet('ebullet', this.partPos(g).x, this.partPos(g).y + 6, aim, v * 1.1);
          });
        }
      }
      s.playSfx('enemyShoot');
    }

    const phase = this.phase;
    const attacks = this.data.phases[phase];
    const timers = this.coreTimers[phase];
    const c = this.partPos(this.core);
    attacks.forEach((a, i) => {
      timers[i] -= ms;
      if (timers[i] > 0) return;
      timers[i] = a.every;
      if (!pl.alive) return;
      const aim = Math.atan2(pl.y - c.y, pl.x - c.x);
      switch (a.pattern) {
        case 'fan':
          for (let k = 0; k < a.n; k++) s.spawnEnemyBullet('ebullet', c.x, c.y, aim + (k - (a.n - 1) / 2) * 0.12, v);
          break;
        case 'ring': {
          const off = Math.random() * Math.PI;
          const n = a.n + 4;
          for (let k = 0; k < n; k++) s.spawnEnemyBullet('ebullet2', c.x, c.y, off + (k * Math.PI * 2) / n, v * 0.8);
          break;
        }
        case 'spiral':
          this.spiral = { until: this.t + 1600, angle: aim, acc: 0 };
          break;
        case 'aimed3':
          for (let b = 0; b < 3; b++) {
            s.time.delayedCall(b * 140, () => {
              if (this.state !== 'fight') return;
              const cc = this.partPos(this.core);
              const aa = Math.atan2(pl.y - cc.y, pl.x - cc.x);
              for (let k = -1; k <= 1; k++) s.spawnEnemyBullet('ebullet', cc.x, cc.y, aa + k * 0.15, v * 1.15);
            });
          }
          break;
        case 'rain':
          for (let k = 0; k < a.n; k++) {
            const bx = this.x + (Math.random() - 0.5) * this.w * 0.8;
            s.time.delayedCall(k * 60, () => {
              if (this.state === 'fight') s.spawnEnemyBullet('ebullet2', bx, this.y + this.h / 2 - 4, Math.PI / 2 + (Math.random() - 0.5) * 0.3, v * 0.75);
            });
          }
          break;
        case 'wave':
          for (let k = 0; k < a.n; k++) {
            const ang = Math.PI / 2 + (k / (a.n - 1) - 0.5) * 2.2;
            s.spawnEnemyBullet(k % 2 ? 'ebullet' : 'ebullet2', c.x, c.y, ang, v * (k % 2 ? 1 : 0.7));
          }
          break;
      }
      s.playSfx('enemyShoot');
    });

    if (this.spiral && this.t < this.spiral.until) {
      this.spiral.acc += ms;
      while (this.spiral.acc >= 70) {
        this.spiral.acc -= 70;
        this.spiral.angle += 0.38;
        for (let arm = 0; arm < 2; arm++) s.spawnEnemyBullet('ebullet', c.x, c.y, this.spiral.angle + arm * Math.PI, v * 0.85);
      }
    }
  }

  /** Is the world point inside the hull silhouette? */
  hullContains(x, y, pad = 0) {
    const ly = Math.round(y - (this.y - this.h / 2));
    if (ly < 0 || ly >= this.h) return false;
    return Math.abs(x - this.x) <= this.profile[ly] + pad;
  }

  /** Test a player bullet against the damageable parts; shots fly over the hull itself. */
  hitTest(bx, by, br) {
    if (this.state !== 'fight') return null;
    for (const p of [...this.guns, this.core]) {
      if (!p.alive) continue;
      const pos = this.partPos(p);
      const dx = bx - pos.x;
      const dy = by - pos.y;
      if (dx * dx + dy * dy < (p.r + br) * (p.r + br)) return p;
    }
    return null;
  }

  /** returns score awarded */
  damage(part, n, now) {
    if (this.state !== 'fight' || !part.alive) return 0;
    let dmg = n;
    if (part.kind === 'core' && this.gunsAlive) {
      dmg = n * 0.35;
      this.scene.playSfx('armor');
    }
    part.hp -= dmg;
    part.flashUntil = now + 50;
    if (part.hp > 0) return 10;
    part.alive = false;
    const pos = this.partPos(part);
    if (part.kind === 'gun') {
      part.sprite.destroy();
      part.sprite = null;
      this.scene.fx.explode(pos.x, pos.y, 1.5);
      this.scene.playSfx('explodeSmall');
      this.scene.fx.floatText(pos.x, pos.y, '1000', 0xffe040);
      return 1000;
    }
    this.state = 'dying';
    this.deathT = 0;
    this.scene.onBossDying(this);
    return this.data.score;
  }

  finish() {
    this.alive = false;
    this.scene.fx.explode(this.x, this.y, 4);
    this.scene.fx.screenFlash(0xffffff, 500);
    this.scene.cameras.main.shake(500, 0.02);
    this.scene.playSfx('explodeBig');
    this.destroy();
    this.scene.onBossDefeated(this);
  }

  destroy() {
    this.hull.destroy();
    for (const p of [this.core, ...this.guns]) if (p.sprite) p.sprite.destroy();
  }
}
