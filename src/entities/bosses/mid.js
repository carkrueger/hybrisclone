// Mid-boss archetypes (end of levels 1-3). Each has one clear mechanic and a
// small attack list; the theme decides which three appear in a sector.
import { W, H, U, BOSS_SCALE } from '../../config.js';
import { RNG, hashSeed } from '../../core/rng.js';
import { paintBossHull, paintBossPlate } from '../../gfx/paint/boss.js';
import { themeFor } from '../../level/themes.js';
import { aimed, burst, lobAt, missiles } from '../attacks.js';
import { BossBase } from './BossBase.js';

const S = BOSS_SCALE;

class MidBoss extends BossBase {
  buildHull(suffix = '') {
    const key = `mid_hull_${this.data.seed}${suffix}`;
    paintBossHull(this.scene, key, this.data.hull, new RNG(hashSeed('deco' + suffix, this.data.seed)));
    this.hullKey = key;
    return this.hull(key);
  }

  get hw() {
    return (this.data.hull.w * S) / 2;
  }

  get hh() {
    return (this.data.hull.h * S) / 2;
  }

  coreY() {
    return this.data.hull.coreY * S - this.hh;
  }

  addCore(hp = this.data.hp) {
    const c = this.part({ tex: 'boss_core', dx: 0, dy: this.coreY(), r: 34, hp, core: true });
    c.sprite.setScale(0.85);
    return c;
  }

  gun(dx, dy, hpMul = 0.14, tint = null) {
    const g = this.part({ tex: 'boss_gun', dx, dy, r: 26, hp: Math.round(this.data.hp * hpMul), score: 800 });
    g.sprite.setScale(0.85);
    if (tint) g.tint = tint;
    return g;
  }

  aliveGuns() {
    return this.parts.filter((p) => !p.core && p.alive);
  }

  tick(dt) {
    for (const p of this.aliveGuns()) if (p.aims !== false) this.aimPart(p, dt);
  }
}

// ---------------------------------------------------------------- warden
class Warden extends MidBoss {
  build() {
    this.buildHull();
    this.addCore();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) this.gun(sx * this.hw * 0.55, sy * this.hh * 0.45);
  }
  coreOpen() {
    return this.aliveGuns().length === 0;
  }
  attacks() {
    const list = [
      () => {
        this.aliveGuns().forEach((g, k) =>
          this.scene.time.delayedCall(k * 220, () => {
            if (!g.alive) return;
            const p = this.partPos(g);
            aimed(this.scene, p.x, p.y, { n: 2, spread: 0.12, speed: this.speed });
            g.recoil = 10;
          })
        );
        return 1100;
      },
      () => {
        for (const g of this.aliveGuns()) {
          const p = this.partPos(g);
          aimed(this.scene, p.x, p.y, { n: 3, spread: 0.22, speed: this.speed * 0.9 });
          g.recoil = 10;
        }
        return 700;
      },
    ];
    if (this.coreOpen() || this.phase > 0) {
      list.push(() => {
        const c = this.partPos(this.core);
        this.scene.efire.beam({ x: c.x, y: c.y, angle: this.aimFrom(c), width: 34, warn: this.tele + 200, dur: 900, color: 0xff5040, owner: this, anchor: () => this.partPos(this.core), aim: () => this.aimFrom(this.partPos(this.core)) });
        return this.tele + 1200;
      });
    }
    return list;
  }
}

// ---------------------------------------------------------------- charger
class Charger extends MidBoss {
  build() {
    this.buildHull();
    this.addCore();
    this.mode = 'idle';
  }
  coreArmor() {
    return this.mode === 'rest' ? 1.2 : this.mode === 'ram' ? 0.3 : 1;
  }
  move(dt, now) {
    if (this.mode === 'ram') {
      this.x += this.ramV.x * dt;
      this.y += this.ramV.y * dt;
      if (this.y > H + this.hh + 60 || this.x < -this.hw - 60 || this.x > W + this.hw + 60) {
        this.mode = 'return';
        this.x = this.rng.range(W * 0.25, W * 0.75);
        this.y = -this.hh - 60;
      }
    } else if (this.mode === 'return') {
      this.y += 420 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.mode = 'rest';
        this.restUntil = now + 1600;
        this.scene.efire.circleMark(this.x, this.y + this.coreY(), 60, 1600, 0x60ff90);
      }
    } else if (this.mode === 'rest') {
      if (now > this.restUntil) this.mode = 'idle';
    } else if (this.mode !== 'aim') super.move(dt);
  }
  attacks() {
    return [
      (now) => {
        if (this.mode !== 'idle') return 400;
        this.mode = 'aim';
        const a = Math.atan2(this.pl.y - this.y, this.pl.x - this.x);
        this.scene.efire.arrow(this.x, this.y + this.hh, a, 300, this.tele + 200, 0xff5030);
        this.scene.playSfx('telegraph', this.x);
        this.scene.time.delayedCall(this.tele + 200, () => {
          if (this.state !== 'fight') return;
          this.mode = 'ram';
          this.ramV = { x: Math.cos(a) * 1100, y: Math.sin(a) * 1100 };
          this.scene.cameras.main.shake(200, 0.006);
        });
        return this.tele + 3600;
      },
      () => {
        if (this.mode !== 'idle' && this.mode !== 'rest') return 300;
        burst(this.scene, () => (this.state === 'fight' ? { x: this.x, y: this.y + this.hh * 0.6 } : null), { count: 3, gap: 160, n: 3, spread: 0.2, speed: this.speed });
        return 800;
      },
    ];
  }
}

// ---------------------------------------------------------------- carrier
class Carrier extends MidBoss {
  build() {
    this.buildHull();
    this.addCore();
    const key = `mid_door_${this.data.seed}`;
    paintBossPlate(this.scene, key, 26 * S * 0.6, 18 * S * 0.6, this.data.hull.colors);
    this.doors = [-1, 1].map((sx) => {
      const d = this.part({ tex: key, dx: sx * this.hw * 0.5, dy: this.hh * 0.25, r: 34, hp: Math.round(this.data.hp * 0.22), score: 1000 });
      d.aims = false;
      if (sx < 0) d.sprite.setFlipX(true);
      return d;
    });
  }
  coreArmor() {
    return this.doors.some((d) => d.alive) ? 0.25 : 1.2;
  }
  attacks() {
    const theme = themeFor(this.scene.sector);
    const minion = theme.basics.find((t) => ['drone', 'fighter', 'kamikaze', 'interceptor'].includes(t)) || 'drone';
    return [
      () => {
        const open = this.doors.filter((d) => d.alive);
        if (!open.length) return 200;
        for (const d of open) {
          const p = this.partPos(d);
          this.scene.efire.circleMark(p.x, p.y, 50, 600, 0xffb030);
          this.scene.time.delayedCall(600, () => {
            if (!d.alive || this.state !== 'fight') return;
            for (let k = 0; k < 2; k++) {
              const q = this.partPos(d);
              this.scene.spawnEnemy(minion, q.x + (k - 0.5) * 40, q.y, { pattern: 'dive', params: { xs: [q.x + (k - 0.5) * 300], stopY: q.y + 160, y0: q.y } });
            }
          });
        }
        return 1700;
      },
      () => {
        const c = this.partPos(this.core);
        aimed(this.scene, c.x, c.y, { n: 2, spread: 0.18, speed: this.speed });
        return 700;
      },
    ];
  }
}

// ---------------------------------------------------------------- lancer
class Lancer extends MidBoss {
  build() {
    this.buildHull();
    this.addCore();
    this.emitters = [-1, 1].map((sx) => {
      const e = this.gun(sx * this.hw * 0.65, this.hh * 0.15, 0.2, 0x90e0ff);
      e.side = sx;
      return e;
    });
  }
  coreArmor() {
    return this.emitters.some((e) => e.alive) ? 0.4 : 1.1;
  }
  attacks() {
    return [
      () => {
        for (const e of this.emitters) {
          if (!e.alive) continue;
          const p = this.partPos(e);
          const a = this.aimFrom(p) - e.side * 0.5;
          this.scene.efire.beam({ x: p.x, y: p.y, angle: a, width: 30, warn: this.tele, dur: 1300, sweep: e.side * 0.75, color: 0x80e0ff, owner: { get alive() { return e.alive; } }, anchor: () => this.partPos(e) });
        }
        this.scene.playSfx('telegraph', this.x);
        return this.tele + 1500;
      },
      () => {
        const live = this.emitters.filter((e) => e.alive);
        if (!live.length) {
          const c = this.partPos(this.core);
          aimed(this.scene, c.x, c.y, { n: 3, spread: 0.2, speed: this.speed });
          return 700;
        }
        for (const e of live) {
          const p = this.partPos(e);
          this.scene.efire.beam({ x: p.x, y: p.y, angle: this.aimFrom(p), width: 24, warn: this.tele + 200, dur: 500, color: 0xc0f0ff, owner: { get alive() { return e.alive; } }, anchor: () => this.partPos(e), aim: () => this.aimFrom(this.partPos(e)) });
        }
        return this.tele + 800;
      },
    ];
  }
}

// ---------------------------------------------------------------- bombard
class Bombard extends MidBoss {
  build() {
    this.buildHull();
    this.addCore();
    this.mortars = [-1, 1].map((sx) => this.gun(sx * this.hw * 0.5, -this.hh * 0.1, 0.18));
  }
  attacks() {
    return [
      () => {
        const pl = this.pl;
        const live = this.mortars.filter((m) => m.alive);
        const src = live.length ? live : [this.core];
        for (let k = 0; k < 3; k++) {
          const m = src[k % src.length];
          const p = this.partPos(m);
          const tx = Math.max(80, Math.min(W - 80, pl.x + (k - 1) * 180));
          const ty = Math.max(200, Math.min(H - 80, pl.y + (k === 1 ? 0 : -80)));
          this.scene.time.delayedCall(k * 180, () => lobAt(this.scene, p.x, p.y, tx, ty, { flight: 1000, burstN: 4, speed: this.speed * 0.8 }));
          m.recoil = 12;
        }
        return 1400;
      },
      () => {
        for (const sx of [-1, 1]) this.scene.spawnEnemy('mine', this.x + sx * this.hw * 0.4, this.y + this.hh * 0.5, { pattern: 'drift', params: { xs: [this.x + sx * this.hw * 0.4], speed: 60 * U, y0: this.y + this.hh * 0.5 } });
        return 900;
      },
      () => {
        const c = this.partPos(this.core);
        aimed(this.scene, c.x, c.y, { n: 3, spread: 0.25, speed: this.speed });
        return 600;
      },
    ];
  }
}

// ---------------------------------------------------------------- twins
class Twins extends MidBoss {
  build() {
    const half = Math.round(this.data.hp / 2);
    this.bodies = [-1, 1].map((sx, k) => {
      const h = this.buildHull('_' + k);
      h.dx = sx * 280;
      h.img.setScale(0.75);
      if (h.rim) h.rim.setScale(0.75);
      if (h.shadow) h.shadow.setScale(0.65);
      h.w *= 0.75;
      h.h *= 0.75;
      const c = this.part({ tex: 'boss_core', dx: sx * 280, dy: this.coreY() * 0.75, r: 30, hp: half, score: 2500 });
      c.sprite.setScale(0.7);
      c.aims = false;
      c.twin = true;
      return { sx, hull: h, core: c };
    });
    this.core = null;
  }
  move(dt) {
    super.move(dt);
    const sep = 260 + Math.sin(this.t * 0.0011) * 120;
    for (const b of this.bodies) {
      b.hull.dx = b.sx * sep;
      b.core.dx = b.sx * sep;
    }
  }
  damage(part, n, now) {
    const r = super.damage(part, n, now);
    this.hp = this.bodies.reduce((s, b) => s + Math.max(0, b.core.hp), 0);
    return r;
  }
  onPartDestroyed(part) {
    const b = this.bodies.find((x) => x.core === part);
    if (b) {
      b.hull.img.setAlpha(0.25);
      this.scene.fx.explode(this.x + b.hull.dx, this.y, 3);
    }
    if (this.bodies.every((x) => !x.core.alive)) {
      this.hp = 0;
      this.die();
    } else {
      this.data = { ...this.data, tempo: this.data.tempo * 0.6 };
      this.scene.fx.banner('ENRAGED', { size: 40, y: 200, color: 0xff4a4a, hold: 900 });
    }
  }
  attacks() {
    const live = this.bodies.filter((b) => b.core.alive);
    return [
      () => {
        const b = live[this.attackIdx % live.length];
        if (!b) return 300;
        const p = this.partPos(b.core);
        aimed(this.scene, p.x, p.y, { n: 3, spread: 0.2, speed: this.speed });
        const o = live.find((x) => x !== b) || b;
        const q = this.partPos(o.core);
        this.scene.efire.beam({ x: q.x, y: q.y, angle: this.aimFrom(q), width: 26, warn: this.tele + 100, dur: 600, color: 0xff70c0, owner: { get alive() { return o.core.alive; } }, anchor: () => this.partPos(o.core), aim: () => this.aimFrom(this.partPos(o.core)) });
        return this.tele + 900;
      },
      () => {
        for (const b of live) {
          const p = this.partPos(b.core);
          burst(this.scene, () => (b.core.alive ? this.partPos(b.core) : null), { count: 2, gap: 200, speed: this.speed * 1.1 });
          if (this.phase > 0) missiles(this.scene, p.x, p.y, { n: 1 });
        }
        return 900;
      },
    ];
  }
}

export const MID_BOSSES = { warden: Warden, charger: Charger, carrier: Carrier, lancer: Lancer, bombard: Bombard, twins: Twins };
