// Sector bosses (end of level 4): one unique boss per theme, built around
// telegraphed mechanics and weak points instead of bullet spam.
import Phaser from 'phaser';
import { W, H, U, DEPTH } from '../../config.js';
import { paintSectorBoss } from '../../gfx/paint/sectorBosses.js';
import { aimed, burst, lobAt, missiles, ring } from '../attacks.js';
import { BossBase } from './BossBase.js';

const ADD = Phaser.BlendModes.ADD;
const owner = (p) => ({ get alive() { return p.alive; } });

class SectorBoss extends BossBase {
  mainHull(scale = 1) {
    const key = paintSectorBoss(this.scene, this.data.kind, this.data.hull.colors);
    const h = this.hull(key);
    if (scale !== 1) {
      h.img.setScale(scale);
      h.w *= scale;
      h.h *= scale;
    }
    return h;
  }
}

// ---------------------------------------------------------------- 1 Dreadnought Crane
class Crane extends SectorBoss {
  build() {
    this.baseY = 250;
    this.mainHull();
    this.core = this.part({ tex: 'boss_core', dx: 0, dy: 40, r: 38, hp: this.data.hp, core: true });
    this.arms = [-1, 1].map((sx) => {
      const p = this.part({ tex: 'sb_crane_arm', dx: sx * 216, dy: -56, r: 40, hp: Math.round(this.data.hp * 0.3), score: 3000 });
      p.sprite.setOrigin(0.5, 0.04);
      p.side = sx;
      p.angle = 0; // 0 = hanging straight down
      p.pos = () => {
        const a = p.angle;
        // hit point in the middle of the arm
        return { x: this.x + sx * 216 - Math.sin(a) * 150, y: this.y - 56 + Math.cos(a) * 150 };
      };
      return p;
    });
    this.rails = [-1, 1].map((sx) => {
      const g = this.part({ tex: 'boss_gun', dx: sx * 150, dy: 110, r: 26, hp: Math.round(this.data.hp * 0.12), score: 1000 });
      g.sprite.setScale(0.8);
      return g;
    });
  }
  coreOpen() {
    return this.arms.every((a) => !a.alive);
  }
  layout(now, dt) {
    super.layout(now, dt);
    for (const a of this.arms) {
      if (!a.sprite) continue;
      a.sprite.setPosition(this.x + a.side * 216, this.y - 56).setRotation(a.angle);
      if (a.rim) a.rim.setPosition(a.sprite.x, a.sprite.y).setRotation(a.angle).setOrigin(0.5, 0.04);
    }
  }
  tick(dt) {
    for (const r of this.rails) if (r.alive) this.aimPart(r, dt);
    for (const a of this.arms) if (a.alive && !a.swinging) a.angle *= Math.exp(-dt * 3);
  }
  swing(arm) {
    const tip = () => ({ x: this.x + arm.side * 216, y: this.y - 56 });
    const toward = this.aimFrom(tip()) - Math.PI / 2; // arm angle that points at the player
    const from = toward - arm.side * 0.9;
    const to = toward + arm.side * 0.7;
    const midA = (from + to) / 2 + Math.PI / 2;
    this.scene.efire.hazard({ shape: 'cone', x: tip().x, y: tip().y, r: 330, angle: midA, spread: 0.85, warn: this.tele + 200, dur: 800, color: 0xffb030, owner: owner(arm), anchor: () => ({ ...tip(), angle: midA }) });
    arm.swinging = true;
    arm.angle = from;
    this.scene.time.delayedCall(this.tele + 200, () => {
      if (!arm.alive) return;
      this.scene.tweens.add({ targets: arm, angle: to, duration: 800, ease: 'Sine.easeInOut', onComplete: () => (arm.swinging = false) });
      this.scene.cameras.main.shake(160, 0.005);
    });
  }
  attacks() {
    const arms = this.arms.filter((a) => a.alive);
    const list = [];
    if (arms.length) {
      list.push(() => {
        const a = arms[this.attackIdx % arms.length];
        this.swing(a);
        if (this.phase >= 1 && arms.length === 2) this.scene.time.delayedCall(400, () => this.swing(arms.find((x) => x !== a)));
        return this.tele + 1300;
      });
      list.push(() => {
        for (const a of arms) {
          const p = a.pos();
          this.scene.spawnEnemy('mine', p.x, p.y + 130, { pattern: 'drift', params: { xs: [Math.max(80, Math.min(W - 80, this.pl.x + a.side * 140))], speed: 70 * U, y0: p.y + 130 } });
        }
        return 900;
      });
    }
    list.push(() => {
      for (const r of this.rails) {
        if (!r.alive) continue;
        this.scene.efire.beam({ x: 0, y: 0, angle: 0, width: 16, warn: this.tele + 400, dur: 150, color: 0x80d0ff, owner: owner(r), anchor: () => this.partPos(r), aim: () => this.aimFrom(this.partPos(r)) });
        this.scene.time.delayedCall(this.tele + 400, () => (r.recoil = 14));
      }
      return this.tele + 700;
    });
    if (this.coreOpen()) list.push(() => {
      const c = this.partPos(this.core);
      ring(this.scene, c.x, c.y, { n: 8, speed: this.speed * 0.8 });
      return 900;
    });
    return list;
  }
}

// ---------------------------------------------------------------- 2 Prism Queen
class Prism extends SectorBoss {
  build() {
    this.baseY = 270;
    this.mainHull();
    this.core = this.part({ tex: 'boss_core', dx: 0, dy: 0, r: 38, hp: this.data.hp, core: true });
    this.core.tint = 0xa0e0ff;
    this.crystals = [0, 1, 2, 3].map((k) => {
      const p = this.part({ tex: 'e_prism', r: 34, hp: Math.round(this.data.hp * 0.14), score: 1500 });
      p.sprite.setScale(1.3);
      p.k = k;
      p.pos = () => {
        const a = this.t * 0.0007 + (k * Math.PI) / 2;
        return { x: this.x + Math.cos(a) * 300, y: this.y + 40 + Math.sin(a) * 110 };
      };
      return p;
    });
    this.openUntil = 0;
  }
  coreOpen() {
    return this.scene.clock < this.openUntil || this.crystals.every((c) => !c.alive);
  }
  tick(dt) {
    for (const c of this.crystals) if (c.sprite) c.sprite.rotation += dt * 1.5;
  }
  attacks() {
    return [
      () => {
        const live = this.crystals.filter((c) => c.alive);
        live.forEach((cr, i) => {
          this.scene.efire.beam({ x: 0, y: 0, angle: 0, width: 26, warn: this.tele + 300, dur: 800, color: 0x9ae8ff, owner: owner(cr), anchor: () => this.partPos(cr), aim: () => this.aimFrom(this.partPos(cr)) + (i - (live.length - 1) / 2) * 0.12 });
        });
        if (!live.length) {
          const c = this.partPos(this.core);
          this.scene.efire.beam({ x: c.x, y: c.y, angle: this.aimFrom(c), width: 34, warn: this.tele, dur: 1000, sweep: 0.4, color: 0x9ae8ff, owner: this, anchor: () => this.partPos(this.core) });
        }
        this.scene.playSfx('telegraph', this.x);
        return this.tele + 1100;
      },
      () => {
        const c = this.partPos(this.core);
        aimed(this.scene, c.x, c.y, { n: 5, spread: 0.18, speed: this.speed, tex: 'eb_shard' });
        return 700;
      },
      () => {
        // recharge: the core opens up
        this.openUntil = this.scene.clock + 2400;
        const c = this.partPos(this.core);
        this.scene.efire.circleMark(c.x, c.y, 60, 2400, 0x60ff90);
        return 2400;
      },
    ];
  }
}

// ---------------------------------------------------------------- 3 Brood Mother
class Brood extends SectorBoss {
  build() {
    this.baseY = 260;
    this.mainHull();
    this.core = this.part({ tex: 'sb_brood_eye', dx: 0, dy: 20, r: 44, hp: this.data.hp, core: true, depth: DEPTH.boss + 0.5 });
    this.eyeOpen = 0;
    this.openUntil = 0;
    this.tentacles = [-1, 1].map((sx) => {
      const segs = Array.from({ length: 9 }, () => this.sprite('sb_tentacle', DEPTH.boss - 0.2));
      return { sx, segs, ext: 0, target: null };
    });
  }
  coreOpen() {
    return this.eyeOpen > 0.6;
  }
  tick(dt, now) {
    const want = now < this.openUntil ? 1 : 0;
    this.eyeOpen += (want - this.eyeOpen) * Math.min(1, dt * 6);
    if (this.core.sprite) this.core.sprite.setScale(1, Math.max(0.08, this.eyeOpen));
    for (const t of this.tentacles) {
      const base = { x: this.x + t.sx * 170, y: this.y + 60 };
      const tgt = t.target || { x: base.x + t.sx * 40, y: base.y + 120 };
      t.segs.forEach((s, k) => {
        const u = ((k + 1) / t.segs.length) * Math.max(0.15, t.ext);
        const wob = Math.sin(this.t * 0.004 + k * 0.7) * 20 * (1 - t.ext);
        s.setPosition(base.x + (tgt.x - base.x) * u + wob, base.y + (tgt.y - base.y) * u).setScale(1.2 - k * 0.06);
      });
    }
  }
  afterAttack(ms) {
    this.scene.time.delayedCall(ms, () => (this.openUntil = this.scene.clock + 1600));
    return ms + 1600;
  }
  attacks() {
    return [
      () => {
        for (let k = 0; k < 8; k++) this.scene.spawnEnemy('swarmer', this.x + (k - 3.5) * 30, this.y + 120, { pattern: 'flock', params: { x: this.x, y0: this.y + 120, speed: 150 * U }, index: k });
        return this.afterAttack(900);
      },
      () => {
        for (let k = 0; k < 3; k++) {
          const tx = Math.max(80, Math.min(W - 80, this.pl.x + (k - 1) * 200));
          this.scene.time.delayedCall(k * 220, () => lobAt(this.scene, this.x, this.y + 80, tx, Math.min(H - 80, this.pl.y), { acid: true, burstN: 0, flight: 1000 }));
        }
        return this.afterAttack(1300);
      },
      () => {
        for (const t of this.tentacles) {
          const tgt = { x: this.pl.x + t.sx * 60, y: this.pl.y };
          this.scene.efire.circleMark(tgt.x, tgt.y, 80, this.tele + 200, 0xff60d0);
          this.scene.time.delayedCall(this.tele + 200, () => {
            if (this.state !== 'fight') return;
            t.target = tgt;
            this.scene.tweens.add({ targets: t, ext: 1, duration: 260, yoyo: true, hold: 500, onComplete: () => (t.target = null) });
            this.scene.efire.hazard({ shape: 'circle', x: tgt.x, y: tgt.y, r: 80, dur: 700, color: 0xff60d0 });
            this.scene.cameras.main.shake(140, 0.005);
          });
        }
        return this.afterAttack(this.tele + 1300);
      },
    ];
  }
}

// ---------------------------------------------------------------- 4 Magma Forge
class Forge extends SectorBoss {
  build() {
    this.baseY = 240;
    this.mainHull();
    this.core = this.part({ tex: 'boss_core', dx: 0, dy: 40, r: 38, hp: this.data.hp, core: true });
    this.core.tint = 0xffb080;
    this.vents = [-1, 0, 1].map((k) => this.part({ tex: 'sb_forge_vent', dx: k * 170, dy: -110, r: 38, hp: Math.round(this.data.hp * 0.15), score: 1500 }));
  }
  coreArmor() {
    return this.vents.some((v) => v.alive) ? 0.35 : 1.2;
  }
  attacks() {
    return [
      () => {
        const n = 1 + this.vents.filter((v) => v.alive).length;
        const xs = [this.pl.x];
        for (let k = 1; k < n; k++) xs.push(this.pl.x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 330);
        for (const x of xs) {
          if (x < 0 || x > W) continue;
          this.scene.efire.hazard({ shape: 'rect', x, y: this.y + 120, w: 150, h: H, warn: this.tele + 300, dur: 1300, color: 0xff6a20 });
        }
        this.scene.playSfx('telegraph', this.x);
        return this.tele + 1700;
      },
      () => {
        missiles(this.scene, this.x, this.y + 100, { n: 3, speed: 230 });
        return 1000;
      },
      () => {
        for (const sx of [-1, 1]) lobAt(this.scene, this.x + sx * 200, this.y + 80, Math.max(80, Math.min(W - 80, this.pl.x + sx * 160)), Math.min(H - 100, this.pl.y - 60), { flight: 900, cross: true, tex: 'eb_ember', speed: 210 });
        return 1100;
      },
    ];
  }
}

// ---------------------------------------------------------------- 5 Revenant
class Revenant extends SectorBoss {
  build() {
    this.baseY = 270;
    this.h0 = this.mainHull();
    this.core = this.part({ tex: 'boss_core', dx: 0, dy: 10, r: 38, hp: this.data.hp, core: true });
    this.core.tint = 0xb0ffd8;
    this.guns = [-1, 1].map((sx) => {
      const g = this.part({ tex: 'boss_gun', dx: sx * 180, dy: -20, r: 26, hp: Math.round(this.data.hp * 0.1), score: 1000 });
      g.sprite.setScale(0.8);
      return g;
    });
    this.vis = 1;
  }
  coreOpen() {
    return this.vis > 0.8;
  }
  setVis(v) {
    this.vis = v;
    for (const s of this.sprites) s.setAlpha(v);
  }
  move(dt) {
    if (this.phasing) return;
    super.move(dt);
  }
  tick(dt) {
    for (const g of this.guns) if (g.alive) this.aimPart(g, dt);
  }
  attacks() {
    return [
      () => {
        this.phasing = true;
        this.scene.tweens.addCounter({
          from: 1,
          to: 0.12,
          duration: 600,
          onUpdate: (tw) => this.setVis(tw.getValue()),
          onComplete: () => {
            this.x = this.rng.range(W * 0.25, W * 0.75);
            this.y = this.rng.range(220, 320);
            this.baseY = this.y;
            this.scene.tweens.addCounter({ from: 0.12, to: 1, duration: 600, delay: 300, onUpdate: (tw) => this.setVis(tw.getValue()), onComplete: () => (this.phasing = false) });
          },
        });
        return 1600;
      },
      () => {
        for (const g of this.guns) {
          if (!g.alive) continue;
          this.scene.efire.beam({ x: 0, y: 0, angle: 0, width: 14, warn: this.tele + 700, dur: 130, color: 0xa0ffc0, owner: owner(g), anchor: () => this.partPos(g), aim: () => this.aimFrom(this.partPos(g)) });
          this.scene.time.delayedCall(this.tele + 700, () => (g.recoil = 14));
        }
        return this.tele + 1000;
      },
      () => {
        for (let k = 0; k < 3; k++) this.scene.spawnEnemy('mine', this.x + (k - 1) * 160, this.y + 120, { pattern: 'drift', params: { xs: [this.x + (k - 1) * 220], speed: 55 * U, y0: this.y + 120 } });
        return 900;
      },
      () => {
        burst(this.scene, () => (this.state === 'fight' ? this.partPos(this.core) : null), { count: 4, gap: 150, speed: this.speed, tex: 'eb_ghost' });
        return 900;
      },
    ];
  }
}

// ---------------------------------------------------------------- 6 Overseer
class Overseer extends SectorBoss {
  build() {
    this.baseY = 270;
    this.mainHull();
    this.core = this.part({ tex: 'boss_core', dx: 0, dy: 10, r: 40, hp: this.data.hp, core: true });
    this.core.tint = 0xffe0a0;
    this.drones = [0, 1, 2, 3].map((k) => {
      const p = this.part({ tex: 'e_shielddrone', r: 28, hp: Math.round(this.data.hp * 0.08), score: 1200 });
      p.pos = () => {
        const a = this.t * 0.0012 + (k * Math.PI) / 2;
        return { x: this.x + Math.cos(a) * 200, y: this.y + 10 + Math.sin(a) * 150 };
      };
      return p;
    });
    this.tether = this.scene.add.graphics().setDepth(DEPTH.boss + 0.9).setBlendMode(ADD);
    this.sprites.push(this.tether);
    this.mode = 'idle';
  }
  get stage() {
    if (this.drones.some((d) => d.alive)) return 0;
    return this.hp / this.hpMax > 0.5 ? 1 : 2;
  }
  coreOpen() {
    return this.stage > 0;
  }
  move(dt) {
    if (this.mode === 'ram') {
      this.x += this.ramV.x * dt;
      this.y += this.ramV.y * dt;
      if (this.y > H + 260) {
        this.mode = 'return';
        this.x = W / 2;
        this.y = -260;
      }
    } else if (this.mode === 'return') {
      this.y += 480 * dt;
      if (this.y >= this.baseY) {
        this.y = this.baseY;
        this.mode = 'idle';
      }
    } else if (this.mode !== 'aim') super.move(dt);
  }
  tick() {
    const g = this.tether;
    g.clear();
    const c = this.partPos(this.core);
    for (const d of this.drones) {
      if (!d.alive) continue;
      const p = this.partPos(d);
      g.lineStyle(4, 0x80c8ff, 0.4 + 0.3 * Math.sin(this.t * 0.02));
      g.lineBetween(p.x, p.y, c.x, c.y);
    }
    if (this.stage === 0) {
      g.lineStyle(6, 0x80c8ff, 0.5);
      g.strokeCircle(c.x, c.y, 70);
    }
  }
  attacks() {
    const st = this.stage;
    if (st === 0) {
      return [
        () => {
          burst(this.scene, () => (this.state === 'fight' ? this.partPos(this.core) : null), { count: 3, gap: 120, speed: this.speed * 1.2, tex: 'eb_gold' });
          return 800;
        },
        () => {
          for (const d of this.drones.filter((x) => x.alive)) {
            const p = this.partPos(d);
            aimed(this.scene, p.x, p.y, { speed: this.speed, tex: 'eb_gold' });
          }
          return 700;
        },
      ];
    }
    if (st === 1) {
      return [
        () => {
          this.scene.spawnEnemy('gatepylon', 0, 0, { pattern: 'gate', params: { xL: this.rng.int(80, 360), xR: W - this.rng.int(80, 360), speed: 30 * U }, count: 2 });
          return 2600;
        },
        () => {
          const c = this.partPos(this.core);
          this.scene.efire.beam({ x: c.x, y: c.y, angle: this.aimFrom(c) - 0.5, width: 36, warn: this.tele, dur: 1300, sweep: 0.8, color: 0xffd060, owner: this, anchor: () => this.partPos(this.core) });
          return this.tele + 1500;
        },
      ];
    }
    return [
      () => {
        if (this.mode !== 'idle') return 400;
        this.mode = 'aim';
        const a = Math.atan2(this.pl.y - this.y, this.pl.x - this.x);
        this.scene.efire.arrow(this.x, this.y + 200, a, 340, this.tele + 200, 0xffd060);
        this.scene.time.delayedCall(this.tele + 200, () => {
          if (this.state !== 'fight') return;
          this.mode = 'ram';
          this.ramV = { x: Math.cos(a) * 1150, y: Math.sin(a) * 1150 };
        });
        return this.tele + 3200;
      },
      () => {
        if (this.mode !== 'idle') return 300;
        const c = this.partPos(this.core);
        aimed(this.scene, c.x, c.y, { n: 5, spread: 0.16, speed: this.speed * 1.1, tex: 'eb_gold' });
        return 800;
      },
    ];
  }
}

export const SECTOR_BOSS_CLASSES = { crane: Crane, prism: Prism, brood: Brood, forge: Forge, revenant: Revenant, overseer: Overseer };
