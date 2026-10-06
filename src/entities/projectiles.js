// Enemy fire: bullets, homing missiles, lobbed grenades, laser beams and hazard
// zones. Every dangerous attack except plain bullets is telegraphed first
// (warning lines, target circles, outlines), and the number of enemy bullets on
// screen is capped by the level's bullet budget.
import Phaser from 'phaser';
import { W, H, DEPTH, PLAYER_HIT_RADIUS } from '../config.js';
import { SpritePool } from './pool.js';

const ADD = Phaser.BlendModes.ADD;
const ELONGATED = new Set(['eb_shard', 'eb_needle']);

export function segDist2(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2));
  const cx = x0 + dx * t - px;
  const cy = y0 + dy * t - py;
  return cx * cx + cy * cy;
}

export class EnemyFire {
  constructor(scene) {
    this.scene = scene;
    this.bullets = new SpritePool(scene, DEPTH.enemyBullets, ADD);
    this.missiles = [];
    this.lobs = [];
    this.beams = [];
    this.hazards = [];
    this.marks = [];
    this.g = scene.add.graphics().setDepth(DEPTH.enemyBullets - 1);
    this.fillG = scene.add.graphics().setDepth(DEPTH.ground + 1).setBlendMode(ADD);
    this.budget = 60;
    this.maxSeen = 0;
  }

  get count() {
    return this.bullets.countActive() + this.missiles.length;
  }

  canFire(n = 1) {
    return this.count + n <= this.budget && this.scene.phase !== 'gameover';
  }

  // ------------------------------------------------------------------ spawners
  bullet(tex, x, y, angle, speed, { r = null, scale = 1, drag = 0, life = 0 } = {}) {
    if (!this.canFire()) return null;
    const b = this.bullets.get(tex, x, y);
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = r ?? (tex === 'eb_big' ? 10 : 8) * scale;
    b.setScale(scale);
    b.drag = drag;
    b.life = life;
    b.rotation = ELONGATED.has(tex) ? angle + Math.PI / 2 : 0;
    return b;
  }

  missile(x, y, angle, { speed = 260, turn = 1.8, life = 5200 } = {}) {
    if (!this.canFire()) return null;
    const s = this.scene.add.image(x, y, 'em_missile').setDepth(DEPTH.enemyBullets);
    const glow = this.scene.add.image(x, y, 'glow').setDepth(DEPTH.enemyBullets - 0.1).setBlendMode(ADD).setTint(0xff7030).setScale(0.35);
    const m = { s, glow, x, y, angle, speed, turn, life, r: 13 };
    this.missiles.push(m);
    return m;
  }

  /** arcing grenade: a target circle marks the landing spot; onLand(x, y) fires on impact */
  lob(x0, y0, x1, y1, { flight = 950, onLand = null, tex = 'eb_big', color = 0xff8030 } = {}) {
    const s = this.scene.add.image(x0, y0, tex).setDepth(DEPTH.enemyBullets).setBlendMode(ADD);
    const l = { s, x0, y0, x1, y1, t: 0, flight, onLand, color };
    this.lobs.push(l);
    this.marks.push({ kind: 'circle', x: x1, y: y1, r: 70, color, until: this.scene.clock + flight, born: this.scene.clock });
    return l;
  }

  /**
   * Laser beam: `warn` ms of a flashing warning line, then `dur` ms of damage.
   * anchor(): {x, y} keeps the origin attached to an enemy part,
   * aim(): angle to track during the warning (locks 220 ms before firing).
   */
  beam({ x, y, angle, len = 2600, width = 30, warn = 800, dur = 700, color = 0xff4060, sweep = 0, owner = null, anchor = null, aim = null }) {
    const img = this.scene.add.image(x, y, 'beam').setOrigin(0, 0.5).setDepth(DEPTH.enemyBullets - 0.5).setBlendMode(ADD).setTint(color).setVisible(false);
    const b = { img, x, y, angle, len, width, warn, dur, color, sweep, owner, anchor, aim, t: 0, phase: 'warn', done: false };
    this.beams.push(b);
    return b;
  }

  /** shape: 'circle' {r} | 'cone' {r, spread} | 'rect' {w, h} (x,y = centre top for rect) */
  hazard({ shape, x, y, r = 80, angle = Math.PI / 2, spread = 0.4, w = 120, h = H, warn = 0, dur = 1000, color = 0xff6020, owner = null, anchor = null, sprite = null }) {
    const hz = { shape, x, y, r, angle, spread, w, h, warn, dur, color, owner, anchor, t: 0, phase: warn > 0 ? 'warn' : 'active', done: false };
    if (sprite) {
      hz.img = this.scene.add.image(x, y, sprite).setDepth(DEPTH.ground + 0.5).setVisible(warn <= 0);
      if (shape === 'circle') hz.img.setScale((r * 2) / hz.img.width);
    }
    this.hazards.push(hz);
    return hz;
  }

  arrow(x, y, angle, len, ms, color = 0xff4040) {
    this.marks.push({ kind: 'arrow', x, y, angle, len, color, until: this.scene.clock + ms, born: this.scene.clock });
  }

  circleMark(x, y, r, ms, color = 0xff4040) {
    this.marks.push({ kind: 'circle', x, y, r, color, until: this.scene.clock + ms, born: this.scene.clock });
  }

  line(x0, y0, x1, y1, ms, color = 0xff4040) {
    this.marks.push({ kind: 'line', x: x0, y: y0, x1, y1, color, until: this.scene.clock + ms, born: this.scene.clock });
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const now = this.scene.clock;
    const ms = dt * 1000;
    const pl = this.scene.player;
    const m = 70;
    this.bullets.forEach((b) => {
      if (b.drag) {
        b.vx *= 1 - b.drag * dt;
        b.vy *= 1 - b.drag * dt;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life) {
        b.life -= ms;
        if (b.life <= 0) {
          this.bullets.release(b);
          return;
        }
      }
      if (b.y < -m || b.y > H + m || b.x < -m || b.x > W + m) this.bullets.release(b);
    });
    this.maxSeen = Math.max(this.maxSeen, this.count);

    for (const mi of this.missiles) {
      mi.life -= ms;
      if (pl.alive) {
        const want = Math.atan2(pl.y - mi.y, pl.x - mi.x);
        mi.angle += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(want - mi.angle), -mi.turn * dt, mi.turn * dt);
      }
      mi.x += Math.cos(mi.angle) * mi.speed * dt;
      mi.y += Math.sin(mi.angle) * mi.speed * dt;
      mi.s.setPosition(mi.x, mi.y).setRotation(mi.angle + Math.PI / 2);
      mi.glow.setPosition(mi.x - Math.cos(mi.angle) * 18, mi.y - Math.sin(mi.angle) * 18).setAlpha(0.6 + Math.random() * 0.4);
      if (mi.life <= 0 || mi.x < -100 || mi.x > W + 100 || mi.y < -100 || mi.y > H + 100) this.killMissile(mi, mi.life <= 0);
    }
    this.missiles = this.missiles.filter((mi) => !mi.dead);

    for (const l of this.lobs) {
      l.t += ms;
      const u = Math.min(1, l.t / l.flight);
      const x = l.x0 + (l.x1 - l.x0) * u;
      const y = l.y0 + (l.y1 - l.y0) * u;
      const lift = Math.sin(u * Math.PI);
      l.s.setPosition(x, y - lift * 120).setScale(0.9 + lift * 1.1).setRotation(l.t * 0.01);
      if (u >= 1) {
        l.dead = true;
        l.s.destroy();
        this.scene.fx.explode(l.x1, l.y1, 0.8);
        if (l.onLand) l.onLand(l.x1, l.y1);
      }
    }
    this.lobs = this.lobs.filter((l) => !l.dead);

    for (const b of this.beams) {
      if (b.owner && !b.owner.alive) b.done = true;
      if (b.done) continue;
      b.t += ms;
      if (b.anchor) {
        const p = b.anchor();
        b.x = p.x;
        b.y = p.y;
      }
      if (b.phase === 'warn') {
        if (b.aim && b.t < b.warn - 220) b.angle = b.aim();
        if (b.t >= b.warn) {
          b.phase = 'fire';
          b.t = 0;
          b.img.setVisible(true);
          this.scene.playSfx('laser', b.x);
        }
      } else {
        b.angle += b.sweep * dt;
        if (b.t >= b.dur) b.done = true;
      }
      if (b.phase === 'fire') {
        const k = Math.min(1, b.t / 80) * (b.t > b.dur - 120 ? Math.max(0, (b.dur - b.t) / 120) : 1);
        b.img.setPosition(b.x, b.y).setRotation(b.angle).setScale(b.len / 64, (b.width / 32) * (0.85 + Math.random() * 0.3) * Math.max(0.1, k));
        if (this.scene.lightLayer) this.scene.lightLayer.add(b.x + Math.cos(b.angle) * 200, b.y + Math.sin(b.angle) * 200, 260, b.color, 60, 0.5);
      }
    }
    for (const b of this.beams) if (b.done) b.img.destroy();
    this.beams = this.beams.filter((b) => !b.done);

    for (const hz of this.hazards) {
      if (hz.owner && !hz.owner.alive) hz.done = true;
      if (hz.done) continue;
      hz.t += ms;
      if (hz.anchor) {
        const p = hz.anchor();
        hz.x = p.x;
        hz.y = p.y;
        if (p.angle !== undefined) hz.angle = p.angle;
      }
      if (hz.phase === 'warn' && hz.t >= hz.warn) {
        hz.phase = 'active';
        hz.t = 0;
        if (hz.img) hz.img.setVisible(true);
      } else if (hz.phase === 'active' && hz.t >= hz.dur) hz.done = true;
      if (hz.img) {
        hz.img.setPosition(hz.x, hz.y);
        if (hz.phase === 'active') hz.img.alpha = Math.min(1, (hz.dur - hz.t) / 300);
      }
      if (hz.phase === 'active' && hz.shape === 'cone' && Math.random() < 0.7) {
        const a = hz.angle + (Math.random() - 0.5) * hz.spread * 2;
        const d = Math.random() * hz.r;
        this.scene.fx.hitSpark(hz.x + Math.cos(a) * d, hz.y + Math.sin(a) * d, hz.color);
      }
    }
    for (const hz of this.hazards) if (hz.done && hz.img) hz.img.destroy();
    this.hazards = this.hazards.filter((hz) => !hz.done);
    this.marks = this.marks.filter((mk) => mk.until > now);
    this.draw(now);
  }

  draw(now) {
    const g = this.g;
    const f = this.fillG;
    g.clear();
    f.clear();
    const pulse = 0.45 + 0.4 * Math.sin(now * 0.03);
    for (const b of this.beams) {
      if (b.phase !== 'warn') continue;
      const x1 = b.x + Math.cos(b.angle) * b.len;
      const y1 = b.y + Math.sin(b.angle) * b.len;
      const prog = b.t / b.warn;
      g.lineStyle(2 + prog * 4, b.color, pulse * (0.4 + prog * 0.6));
      g.lineBetween(b.x, b.y, x1, y1);
      g.fillStyle(b.color, 0.5 + prog * 0.5);
      g.fillCircle(b.x, b.y, 8 + prog * 16);
    }
    for (const mk of this.marks) {
      const prog = Math.min(1, (now - mk.born) / Math.max(1, mk.until - mk.born));
      g.lineStyle(3, mk.color, pulse);
      if (mk.kind === 'circle') {
        g.strokeCircle(mk.x, mk.y, mk.r);
        g.strokeCircle(mk.x, mk.y, mk.r * (1 - prog));
      } else if (mk.kind === 'line') {
        g.lineStyle(2, mk.color, pulse * 0.9);
        g.lineBetween(mk.x, mk.y, mk.x1, mk.y1);
      } else if (mk.kind === 'arrow') {
        const x1 = mk.x + Math.cos(mk.angle) * mk.len;
        const y1 = mk.y + Math.sin(mk.angle) * mk.len;
        g.lineStyle(10, mk.color, pulse * 0.6);
        g.lineBetween(mk.x, mk.y, x1, y1);
        const hx = Math.cos(mk.angle);
        const hy = Math.sin(mk.angle);
        g.fillStyle(mk.color, pulse);
        g.fillTriangle(x1 + hx * 40, y1 + hy * 40, x1 - hy * 26, y1 + hx * 26, x1 + hy * 26, y1 - hx * 26);
      }
    }
    for (const hz of this.hazards) {
      const warn = hz.phase === 'warn';
      const a = warn ? pulse * 0.5 : 0.35 + 0.15 * Math.sin(now * 0.02);
      if (warn) g.lineStyle(3, hz.color, pulse);
      if (hz.shape === 'cone') {
        const tgt = warn ? g : f;
        tgt.fillStyle(hz.color, warn ? 0.12 : a);
        tgt.slice(hz.x, hz.y, hz.r, hz.angle - hz.spread, hz.angle + hz.spread, false);
        tgt.fillPath();
        if (warn) {
          g.beginPath();
          g.slice(hz.x, hz.y, hz.r, hz.angle - hz.spread, hz.angle + hz.spread, false);
          g.strokePath();
        }
      } else if (hz.shape === 'rect') {
        if (warn) {
          g.fillStyle(hz.color, 0.1 + 0.1 * pulse);
          g.fillRect(hz.x - hz.w / 2, hz.y, hz.w, hz.h);
          g.strokeRect(hz.x - hz.w / 2, hz.y, hz.w, hz.h);
        } else {
          f.fillStyle(hz.color, 0.55);
          f.fillRect(hz.x - hz.w / 2, hz.y, hz.w, hz.h);
          f.fillStyle(0xffffff, 0.35);
          f.fillRect(hz.x - hz.w * 0.15, hz.y, hz.w * 0.3, hz.h);
        }
      } else if (!hz.img) {
        if (warn) g.strokeCircle(hz.x, hz.y, hz.r);
        else {
          f.fillStyle(hz.color, a);
          f.fillCircle(hz.x, hz.y, hz.r);
        }
      } else if (warn) g.strokeCircle(hz.x, hz.y, hz.r);
    }
  }

  // ------------------------------------------------------------------ collisions
  /** returns true when the player at (px, py) is hit */
  collidePlayer(px, py) {
    const pr = PLAYER_HIT_RADIUS;
    let hit = false;
    this.bullets.forEach((b) => {
      if (hit) return;
      const dx = b.x - px;
      const dy = b.y - py;
      const rr = b.r + pr;
      if (dx * dx + dy * dy < rr * rr) {
        hit = true;
        this.bullets.release(b);
      }
    });
    if (hit) return true;
    for (const mi of this.missiles) {
      if ((mi.x - px) ** 2 + (mi.y - py) ** 2 < (mi.r + pr) ** 2) {
        this.killMissile(mi, true);
        return true;
      }
    }
    for (const b of this.beams) {
      if (b.phase !== 'fire') continue;
      const x1 = b.x + Math.cos(b.angle) * b.len;
      const y1 = b.y + Math.sin(b.angle) * b.len;
      if (segDist2(px, py, b.x, b.y, x1, y1) < (b.width * 0.42 + pr) ** 2) return true;
    }
    for (const hz of this.hazards) {
      if (hz.phase !== 'active') continue;
      if (hz.shape === 'circle' && (px - hz.x) ** 2 + (py - hz.y) ** 2 < (hz.r * 0.85) ** 2) return true;
      if (hz.shape === 'rect' && Math.abs(px - hz.x) < hz.w * 0.42 && py > hz.y && py < hz.y + hz.h) return true;
      if (hz.shape === 'cone') {
        const d = Math.hypot(px - hz.x, py - hz.y);
        const a = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py - hz.y, px - hz.x) - hz.angle));
        if (d < hz.r && a < hz.spread) return true;
      }
    }
    return false;
  }

  /** player bullets can shoot down missiles; returns number destroyed */
  collideShots(pBullets) {
    let n = 0;
    if (!this.missiles.length) return 0;
    pBullets.forEach((b) => {
      for (const mi of this.missiles) {
        if (mi.dead) continue;
        if ((mi.x - b.x) ** 2 + (mi.y - b.y) ** 2 < (mi.r + b.r) ** 2) {
          pBullets.release(b);
          this.killMissile(mi, true);
          n++;
          return;
        }
      }
    });
    this.missiles = this.missiles.filter((mi) => !mi.dead);
    return n;
  }

  /** orb / shield burst: remove bullets and missiles inside a circle */
  clearCircle(x, y, r, spark = true, tint = 0xb0e0ff) {
    let bullets = 0;
    let missiles = 0;
    this.bullets.forEach((b) => {
      if ((b.x - x) ** 2 + (b.y - y) ** 2 < (r + b.r) ** 2) {
        if (spark) this.scene.fx.hitSpark(b.x, b.y, tint);
        this.bullets.release(b);
        bullets++;
      }
    });
    for (const mi of this.missiles) {
      if (!mi.dead && (mi.x - x) ** 2 + (mi.y - y) ** 2 < (r + mi.r) ** 2) {
        this.killMissile(mi, true);
        missiles++;
      }
    }
    if (missiles) this.missiles = this.missiles.filter((mi) => !mi.dead);
    return { bullets, missiles };
  }

  /** point defense: nearest missile within maxR, else nearest bullet; {kind, obj, x, y} or null */
  nearestShot(x, y, maxR) {
    const r2 = maxR * maxR;
    let best = null;
    let bestD = r2;
    for (const mi of this.missiles) {
      if (mi.dead) continue;
      const d = (mi.x - x) ** 2 + (mi.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { kind: 'missile', obj: mi, x: mi.x, y: mi.y };
      }
    }
    if (best) return best;
    this.bullets.forEach((b) => {
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { kind: 'bullet', obj: b, x: b.x, y: b.y };
      }
    });
    return best;
  }

  /** destroy a shot returned by nearestShot */
  destroyShot(shot) {
    if (shot.kind === 'missile') {
      this.killMissile(shot.obj, true);
      this.missiles = this.missiles.filter((mi) => !mi.dead);
    } else this.bullets.release(shot.obj);
  }

  killMissile(mi, boom) {
    if (mi.dead) return;
    mi.dead = true;
    if (boom) this.scene.fx.explode(mi.x, mi.y, 0.6);
    mi.s.destroy();
    mi.glow.destroy();
  }

  /** bomb / boss death: wipe everything */
  clear(spark = false) {
    if (spark) this.bullets.forEach((b) => this.scene.fx.hitSpark(b.x, b.y, 0xb0e0ff));
    this.bullets.releaseAll();
    for (const mi of this.missiles) this.killMissile(mi, spark);
    this.missiles = [];
    for (const l of this.lobs) l.s.destroy();
    this.lobs = [];
    for (const b of this.beams) b.img.destroy();
    this.beams = [];
    for (const hz of this.hazards) if (hz.img) hz.img.destroy();
    this.hazards = [];
    this.marks = [];
  }
}
