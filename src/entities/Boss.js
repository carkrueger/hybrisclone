// End-of-sector boss built from generated data (level/bossgen.js), drawn at BOSS_SCALE.
import Phaser from 'phaser';
import { W, U, DEPTH, BOSS_SCALE } from '../config.js';
import { RNG, hashSeed } from '../core/rng.js';
import { paintBossHull, paintBossPlate, BOSS_PAD } from '../gfx/paint/boss.js';
import { SHADOW_OFFSET } from './Player.js';

const S = BOSS_SCALE;

export class Boss {
  constructor(scene, data, seedKey) {
    this.scene = scene;
    this.data = data;
    const { hull } = data;
    this.w = hull.w * S;
    this.h = hull.h * S;
    this.profile = hull.profile;

    const key = 'boss_hull_' + seedKey;
    paintBossHull(scene, key, hull, new RNG(hashSeed('hull-deco:' + seedKey)));

    this.x = W / 2;
    this.baseY = 70 + this.h / 2;
    this.y = -this.h;
    this.t = 0;
    this.state = 'enter';
    this.alive = true;

    if (scene.preset.shadows) {
      this.shadowImg = scene.add.image(this.x, this.y, key).setDepth(DEPTH.airShadows).setTint(0x000000).setAlpha(0.35).setScale(0.85);
    }
    this.hull = scene.add.image(this.x, this.y, key).setDepth(DEPTH.boss);
    const ADD = Phaser.BlendModes.ADD;
    const rimOn = scene.preset.rim;
    this.rims = [];
    const rim = (tex, depth) => {
      if (!rimOn || !scene.textures.exists(tex + '_rim')) return null;
      const r = scene.add.image(0, 0, tex + '_rim').setBlendMode(ADD).setTint(scene.rimColor).setAlpha(0.8).setDepth(depth);
      this.rims.push(r);
      return r;
    };
    this.hullRim = rim(key, DEPTH.boss + 0.1);
    // sliding armour plates over the core
    this.plates = (data.plates || []).map((pd, k) => {
      const pkey = key + '_plate' + k;
      paintBossPlate(scene, pkey, pd.w * S, pd.h * S, hull.colors);
      const mk = (flip) => scene.add.image(0, 0, pkey).setDepth(DEPTH.boss + 1.5).setFlipX(flip);
      const left = mk(true);
      const right = mk(false);
      return { ...pd, left, right, rl: rim(pkey, DEPTH.boss + 1.6), rr: rim(pkey, DEPTH.boss + 1.6), open: 0 };
    });
    this.coreMax = data.core.hp;
    this.core = {
      kind: 'core',
      dx: 0,
      dy: data.core.y * S - this.h / 2,
      r: 34,
      hp: data.core.hp,
      alive: true,
      flashUntil: 0,
      sprite: scene.add.image(this.x, this.y, 'boss_core').setDepth(DEPTH.boss + 1),
    };
    this.coreGlow = scene.add.image(this.x, this.y, 'boss_core_glow').setDepth(DEPTH.boss + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.guns = data.guns.map((g) => ({
      kind: 'gun',
      dx: g.x * S,
      dy: g.y * S - this.h / 2,
      r: 28,
      hp: g.hp,
      alive: true,
      flashUntil: 0,
      pattern: g.pattern,
      every: g.every,
      timer: 1500 + g.offset,
      recoil: 0,
      sprite: scene.add.image(this.x, this.y, 'boss_gun').setDepth(DEPTH.boss + 1),
    }));
    for (const g of this.guns) g.rim = rim('boss_gun', DEPTH.boss + 1.1);
    this.core.rim = rim('boss_core', DEPTH.boss + 1.1);
    this.coreTimers = data.phases.map((ph) => ph.map((p) => 1200 + p.offset));
    this.spiral = null;
    this.deathT = 0;
  }

  get phase() {
    const f = this.core.hp / this.coreMax;
    return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
  }

  /** core is shielded while the armour plates are mostly closed */
  get coreShielded() {
    if (!this.plates.length) return false;
    return this.plates.reduce((s, p) => s + p.open, 0) / this.plates.length < 0.55;
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
    const pl = this.scene.player;

    if (this.state === 'enter') {
      this.y += 90 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.state = 'fight';
        this.t = 0;
      }
    } else if (this.state === 'fight') {
      const amp = Math.min(560, Math.max(0, (W - this.w) / 2 - 60));
      const sp = this.data.moveSpeed * 0.001;
      if (this.data.move === 'sway') {
        this.x = W / 2 + Math.sin(this.t * sp) * amp;
      } else if (this.data.move === 'figure8') {
        this.x = W / 2 + Math.sin(this.t * sp) * amp;
        this.y = this.baseY + Math.sin(this.t * sp * 2) * 14 * U;
      } else {
        this.x = W / 2 + Math.sin(this.t * sp * 0.6) * amp;
        this.y = this.baseY + 20 * U + Math.sin(this.t * sp * 0.35) * 24 * U;
      }
      this.updateAttacks(ms, now);
    } else if (this.state === 'dying') {
      this.deathT += ms;
      this.x += Math.sin(this.deathT * 0.05) * 1.5;
      this.y += 14 * dt;
      if (Math.floor(this.deathT / 90) !== Math.floor((this.deathT - ms) / 90)) {
        const ex = this.x + (Math.random() - 0.5) * this.w * 0.9;
        const ey = this.y + (Math.random() - 0.5) * this.h * 0.9;
        this.scene.fx.explode(ex, ey, 1 + Math.random() * 1.2);
        this.scene.playSfx('explodeSmall', ex);
        this.scene.cameras.main.shake(90, 0.004);
      }
      if (this.deathT > 2600) {
        this.finish();
        return;
      }
    }

    this.hull.setPosition(this.x, this.y);
    if (this.hullRim) this.hullRim.setPosition(this.x, this.y);
    // plates: open/close cycle; fully open while dying
    for (const p of this.plates) {
      const target = this.state === 'fight' ? Phaser.Math.Clamp(0.5 + Math.sin((this.t / p.period) * Math.PI * 2 + p.phase) * 1.3, 0, 1) : 1;
      p.open += (target - p.open) * Math.min(1, dt * 6);
      const dx = ((p.w / 2) + p.open * 17) * S;
      const py = this.y + p.y * S - this.h / 2;
      p.left.setPosition(this.x - dx, py);
      p.right.setPosition(this.x + dx, py);
      if (p.rl) p.rl.setPosition(this.x - dx, py).setFlipX(true);
      if (p.rr) p.rr.setPosition(this.x + dx, py);
    }
    if (this.shadowImg) this.shadowImg.setPosition(this.x + SHADOW_OFFSET.x * 1.6, this.y + SHADOW_OFFSET.y * 1.6);
    for (const p of [this.core, ...this.guns]) {
      if (!p.sprite) {
        if (p.rim) p.rim.setVisible(false);
        continue;
      }
      const pos = this.partPos(p);
      if (p.kind === 'gun') {
        if (pl.alive) {
          const want = Math.atan2(pl.y - pos.y, pl.x - pos.x) - Math.PI / 2;
          p.sprite.rotation += Phaser.Math.Angle.Wrap(want - p.sprite.rotation) * Math.min(1, dt * 4);
        }
        p.recoil *= Math.exp(-dt * 9);
        const a = p.sprite.rotation + Math.PI / 2;
        p.sprite.setPosition(pos.x - Math.cos(a) * p.recoil, pos.y - Math.sin(a) * p.recoil);
      } else p.sprite.setPosition(pos.x, pos.y);
      if (p.rim) p.rim.setPosition(p.sprite.x, p.sprite.y).setRotation(p.sprite.rotation);
      if (now < p.flashUntil) p.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else {
        p.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
        if (p.kind === 'core' && this.gunsAlive) p.sprite.setTint(0x9090b0);
        else p.sprite.clearTint();
      }
    }
    const cp = this.partPos(this.core);
    const pulse = this.gunsAlive ? 0.35 : 0.65 + 0.35 * Math.sin(now * 0.012);
    this.coreGlow.setPosition(cp.x, cp.y).setAlpha(this.core.alive ? pulse : 0).setScale(0.9 + this.phase * 0.15);
  }

  updateAttacks(ms, now) {
    const s = this.scene;
    const pl = s.player;
    const v = this.data.bulletSpeed * U;

    for (const g of this.guns) {
      if (!g.alive) continue;
      g.timer -= ms;
      if (g.timer > 0) continue;
      g.timer = g.every;
      if (!pl.alive) continue;
      const pos = this.partPos(g);
      const aim = Math.atan2(pl.y - pos.y, pl.x - pos.x);
      const mx = pos.x + Math.cos(aim) * 36;
      const my = pos.y + Math.sin(aim) * 36;
      if (g.pattern === 'aimed') s.spawnEnemyBullet('eb_orb', mx, my, aim, v);
      else if (g.pattern === 'fan3') for (let k = -1; k <= 1; k++) s.spawnEnemyBullet('eb_orb', mx, my, aim + k * 0.22, v);
      else {
        for (let k = 0; k < 3; k++) {
          s.time.delayedCall(k * 110, () => {
            if (g.alive && this.state === 'fight') {
              const pp = this.partPos(g);
              s.spawnEnemyBullet('eb_orb', pp.x + Math.cos(aim) * 36, pp.y + Math.sin(aim) * 36, aim, v * 1.1);
            }
          });
        }
      }
      s.fx.muzzle(mx, my, 0xff7040);
      g.recoil = 10;
      s.playSfx('enemyShoot', pos.x);
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
          for (let k = 0; k < a.n; k++) s.spawnEnemyBullet('eb_orb', c.x, c.y, aim + (k - (a.n - 1) / 2) * 0.12, v);
          break;
        case 'ring': {
          const off = Math.random() * Math.PI;
          const n = a.n + 6;
          for (let k = 0; k < n; k++) s.spawnEnemyBullet('eb_big', c.x, c.y, off + (k * Math.PI * 2) / n, v * 0.8);
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
              for (let k = -1; k <= 1; k++) s.spawnEnemyBullet('eb_orb', cc.x, cc.y, aa + k * 0.15, v * 1.15);
            });
          }
          break;
        case 'rain':
          for (let k = 0; k < a.n + 4; k++) {
            const bx = this.x + (Math.random() - 0.5) * this.w * 0.85;
            s.time.delayedCall(k * 55, () => {
              if (this.state === 'fight') s.spawnEnemyBullet('eb_big', bx, this.y + this.h / 2 - 10, Math.PI / 2 + (Math.random() - 0.5) * 0.3, v * 0.75);
            });
          }
          break;
        case 'wave':
          for (let k = 0; k < a.n + 4; k++) {
            const ang = Math.PI / 2 + (k / (a.n + 3) - 0.5) * 2.4;
            s.spawnEnemyBullet(k % 2 ? 'eb_orb' : 'eb_big', c.x, c.y, ang, v * (k % 2 ? 1 : 0.7));
          }
          break;
      }
      s.fx.muzzle(c.x, c.y, 0xff4060);
      s.playSfx('enemyShoot', c.x);
    });

    if (this.spiral && this.t < this.spiral.until) {
      this.spiral.acc += ms;
      while (this.spiral.acc >= 60) {
        this.spiral.acc -= 60;
        this.spiral.angle += 0.34;
        for (let arm = 0; arm < 3; arm++) s.spawnEnemyBullet('eb_orb', c.x, c.y, this.spiral.angle + (arm * Math.PI * 2) / 3, v * 0.85);
      }
    }
  }

  /** Is the world point inside the hull silhouette? */
  hullContains(x, y, pad = 0) {
    const ly = Math.floor((y - (this.y - this.h / 2)) / S);
    if (ly < 0 || ly >= this.profile.length) return false;
    return Math.abs(x - this.x) <= this.profile[ly] * S + pad;
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
    if (part.kind === 'core') {
      if (this.gunsAlive) dmg *= 0.35;
      if (this.coreShielded) {
        dmg *= 0.1;
        const c = this.partPos(this.core);
        this.scene.fx.hitSpark(c.x + (Math.random() - 0.5) * 40, c.y + (Math.random() - 0.5) * 30, 0x90d0ff);
      }
      if (dmg < n) this.scene.playSfx('armor', this.x);
    }
    part.hp -= dmg;
    part.flashUntil = now + 50;
    if (part.hp > 0) return 10;
    part.alive = false;
    const pos = this.partPos(part);
    if (part.kind === 'gun') {
      part.sprite.destroy();
      part.sprite = null;
      this.scene.fx.explode(pos.x, pos.y, 2);
      this.scene.playSfx('explodeBig', pos.x);
      this.scene.fx.floatText(pos.x, pos.y, '1000', 0xffe14a);
      return 1000;
    }
    this.state = 'dying';
    this.deathT = 0;
    this.scene.onBossDying(this);
    return this.data.score;
  }

  finish() {
    this.alive = false;
    this.scene.fx.explode(this.x, this.y, 5);
    this.scene.fx.explode(this.x - this.w * 0.25, this.y, 3);
    this.scene.fx.explode(this.x + this.w * 0.25, this.y, 3);
    this.scene.fx.screenFlash(0xffffff, 600, 0.9);
    this.scene.cameras.main.shake(600, 0.02);
    this.scene.hitStop(140);
    this.scene.playSfx('explodeHuge', this.x);
    this.destroy();
    this.scene.onBossDefeated(this);
  }

  destroy() {
    this.hull.destroy();
    if (this.shadowImg) this.shadowImg.destroy();
    this.coreGlow.destroy();
    for (const r of this.rims) r.destroy();
    for (const p of this.plates) {
      p.left.destroy();
      p.right.destroy();
    }
    for (const p of [this.core, ...this.guns]) if (p.sprite) p.sprite.destroy();
  }
}

export { BOSS_PAD };
