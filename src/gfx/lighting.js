// Dynamic lighting: a quarter-resolution additive lightmap (shots, engines and
// explosions light up the station), god-ray light shafts from the sector sun,
// and lens-flare chains.
import Phaser from 'phaser';
import { W, H, DEPTH } from '../config.js';

const ADD = Phaser.BlendModes.ADD;
const Q = 4; // lightmap downscale

export class LightLayer {
  constructor(scene, preset) {
    this.scene = scene;
    this.enabled = !!preset.lightmap;
    this.lights = [];
    if (!this.enabled) return;
    this.rt = scene.add.renderTexture(0, 0, W / Q, H / Q).setOrigin(0).setScale(Q).setDepth(DEPTH.lightmap).setBlendMode(ADD).setAlpha(0.85);
  }

  /** transient light (explosions, muzzle flashes) */
  add(x, y, radius, color, duration = 400, intensity = 1) {
    if (!this.enabled) return false;
    if (this.lights.length > 60) this.lights.shift();
    this.lights.push({ x, y, radius, color, life: duration, max: duration, intensity });
    return true;
  }

  stamp(x, y, radius, color, alpha) {
    if (x < -radius || x > W + radius || y < -radius || y > H + radius) return;
    this.rt.stamp('glow', null, x / Q, y / Q, { scale: radius / (64 * Q), tint: color, alpha, blendMode: ADD });
  }

  update(dt) {
    if (!this.enabled) return;
    const s = this.scene;
    this.rt.clear();
    // player & engines
    const pl = s.player;
    if (pl && pl.alive && pl.sprite.visible) this.stamp(pl.x, pl.y + 60, 220, 0x4a90ff, 0.5);
    // shots
    let n = 0;
    s.pBullets.forEach((b) => {
      if (n++ % 2) return;
      this.stamp(b.x, b.y, b.homing ? 110 : 80, b.homing ? 0xff9040 : 0xffc060, 0.3);
    });
    n = 0;
    s.eBullets.forEach((b) => {
      if (n++ > 160 || n % 2) return;
      this.stamp(b.x, b.y, 70, 0xff50b0, 0.3);
    });
    // big enemies glow from their engines
    for (const e of s.enemies) if (e.alive && (e.type === 'bomber' || e.type === 'gunship')) this.stamp(e.x, e.y - 50, 140, 0xff8a30, 0.35);
    // decaying lights
    const ms = dt * 1000;
    this.lights = this.lights.filter((l) => (l.life -= ms) > 0);
    for (const l of this.lights) {
      const k = l.life / l.max;
      this.stamp(l.x, l.y, l.radius * (1.3 - 0.3 * k), l.color, Math.min(1, k * k * l.intensity));
    }
    this.rt.render();
  }

  destroy() {
    if (this.rt) this.rt.destroy();
  }
}

/** Slow, breathing light shafts streaming in from the sector sun. */
export class GodRays {
  constructor(scene, sun, preset, seed = 1) {
    this.rays = [];
    this.flareChain = null;
    if (!preset.godrays) return;
    const sx = sun.x * W;
    const sy = sun.y * H;
    const toCenter = Math.atan2(H * 0.6 - sy, W / 2 - sx) - Math.PI / 2;
    const n = 4 + (seed % 2);
    for (let i = 0; i < n; i++) {
      const r = scene.add.image(sx, sy, 'godray').setOrigin(0.5, 0).setBlendMode(ADD).setDepth(DEPTH.godrays).setTint(sun.color);
      r.base = toCenter + (i - (n - 1) / 2) * 0.13 + Math.sin(seed + i * 2.3) * 0.05;
      r.width0 = 0.8 + ((seed * 7 + i * 3) % 5) * 0.25;
      r.speed = 0.00025 + i * 0.00007;
      r.phase = i * 1.9 + seed;
      r.setScale(r.width0, 2.6);
      this.rays.push(r);
    }
    this.sunGlow = scene.add.image(sx, sy, 'glow').setBlendMode(ADD).setDepth(DEPTH.godrays).setTint(sun.color).setScale(9).setAlpha(0.35);
  }

  update(now) {
    for (const r of this.rays) {
      r.rotation = r.base + Math.sin(now * r.speed + r.phase) * 0.035;
      r.alpha = 0.07 + 0.05 * Math.sin(now * r.speed * 2.3 + r.phase);
    }
  }

  destroy() {
    for (const r of this.rays) r.destroy();
    if (this.sunGlow) this.sunGlow.destroy();
  }
}

const CHAIN = [
  [0.22, 'flare_hex', 0.35, 0x80c0ff],
  [0.42, 'flare_ring', 0.55, 0xffb070],
  [0.6, 'flare_hex', 0.22, 0xa0ff90],
  [0.85, 'glow', 0.4, 0xffffff],
  [1.15, 'flare_ring', 0.9, 0x70a0ff],
  [1.45, 'flare_hex', 0.5, 0xff80c0],
];

/** Lens-flare chains along the line from a light source through the screen centre. */
export class Flares {
  constructor(scene, sun, preset) {
    this.scene = scene;
    this.enabled = !!preset.godrays;
    this.sunChain = [];
    if (!this.enabled) return;
    this.sun = { x: sun.x * W, y: sun.y * H };
    for (const [t, tex, sc, tint] of CHAIN) {
      const img = scene.add.image(0, 0, tex).setBlendMode(ADD).setDepth(DEPTH.fx + 5).setTint(tint).setScale(sc).setAlpha(0.12);
      img.t = t;
      this.sunChain.push(img);
    }
  }

  place(chain, sx, sy, alphaMul = 1) {
    const cx = W / 2;
    const cy = H / 2;
    for (const img of chain) {
      img.setPosition(sx + (cx - sx) * img.t * 2, sy + (cy - sy) * img.t * 2);
      if (alphaMul !== null) img.alpha = 0.1 * alphaMul;
    }
  }

  update(now) {
    if (!this.enabled) return;
    // gentle shimmer of the permanent sun flare
    this.place(this.sunChain, this.sun.x, this.sun.y, 1 + 0.3 * Math.sin(now * 0.0013));
  }

  /** transient flare for big explosions / bombs */
  burst(x, y, strength = 1) {
    if (!this.enabled) return;
    const chain = CHAIN.map(([t, tex, sc, tint]) => {
      const img = this.scene.add.image(0, 0, tex).setBlendMode(ADD).setDepth(DEPTH.fx + 5).setTint(tint).setScale(sc * strength);
      img.t = t * 0.5;
      return img;
    });
    this.place(chain, x, y, null);
    for (const img of chain) {
      img.setAlpha(0.55 * Math.min(1, strength));
      this.scene.tweens.add({ targets: img, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => img.destroy() });
    }
  }

  destroy() {
    for (const i of this.sunChain) i.destroy();
  }
}
