// Explosions, light flashes, shockwaves, debris, floating text and banners.
// Cosmetic only: uses Math.random freely.
import Phaser from 'phaser';
import { DEPTH, W, H, U } from '../config.js';
import { text } from '../ui/text.js';

const ADD = Phaser.BlendModes.ADD;

export class FX {
  constructor(scene, preset) {
    this.scene = scene;
    this.q = preset.particles;
    const mk = (tex, cfg, depth) => scene.add.particles(0, 0, tex, { emitting: false, ...cfg }).setDepth(depth);
    this.sparks = mk(
      'spark',
      {
        speed: { min: 120, max: 720 },
        lifespan: { min: 220, max: 750 },
        scale: { start: 1.3, end: 0 },
        color: [0xffffff, 0xffe080, 0xff9a30, 0xc02010],
        blendMode: ADD,
      },
      DEPTH.fx + 2
    );
    this.fire = mk(
      'fire0',
      {
        speed: { min: 20, max: 170 },
        lifespan: { min: 300, max: 750 },
        scale: { start: 0.35, end: 1.5 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: ADD,
      },
      DEPTH.fx + 1
    );
    this.fire2 = mk(
      'fire1',
      {
        speed: { min: 10, max: 90 },
        lifespan: { min: 400, max: 900 },
        scale: { start: 0.5, end: 1.9 },
        alpha: { start: 0.9, end: 0 },
        rotate: { min: 0, max: 360 },
        blendMode: ADD,
      },
      DEPTH.fx + 1
    );
    this.smoke = mk(
      'smoke',
      {
        speed: { min: 10, max: 80 },
        lifespan: { min: 800, max: 1700 },
        scale: { start: 0.6, end: 2.4 },
        alpha: { start: 0.55, end: 0 },
        rotate: { min: 0, max: 360 },
        speedY: { min: 20, max: 70 },
      },
      DEPTH.fx
    );
    this.debris = mk(
      'debris1',
      {
        speed: { min: 80, max: 380 },
        lifespan: { min: 600, max: 1300 },
        scale: { start: 1.4, end: 0.6 },
        rotate: { start: 0, end: 720 },
        alpha: { start: 1, end: 0.2 },
        gravityY: 260,
      },
      DEPTH.fx
    );
    this.pool = [];
  }

  sprite(tex, x, y, depth = DEPTH.fx + 3) {
    let s = this.pool.find((o) => !o.active && o.texture.key === tex);
    if (!s) {
      s = this.scene.add.image(x, y, tex).setBlendMode(ADD);
      this.pool.push(s);
    }
    return s.setActive(true).setVisible(true).setPosition(x, y).setDepth(depth).setAlpha(1).setRotation(0);
  }

  release(s) {
    s.setActive(false).setVisible(false);
  }

  light(x, y, radius, tint = 0xffc080, duration = 350, alpha = 0.9) {
    const ll = this.scene.lightLayer;
    if (ll && ll.add(x, y, radius * 1.8, tint, duration * 1.3, alpha * 1.1)) return;
    const s = this.sprite('glow', x, y, DEPTH.lights + 1).setTint(tint).setScale(radius / 64).setAlpha(alpha);
    this.scene.tweens.add({ targets: s, alpha: 0, scale: (radius / 64) * 1.25, duration, ease: 'Quad.easeOut', onComplete: () => this.release(s) });
  }

  explode(x, y, size = 1) {
    const q = this.q;
    const n = (k) => Math.max(1, Math.round(k * q));
    this.sparks.explode(n(14 + 14 * size), x, y);
    this.fire.explode(n(5 + 6 * size), x, y);
    this.fire2.explode(n(3 + 4 * size), x, y);
    this.smoke.explode(n(3 + 4 * size), x, y);
    if (size >= 1) this.debris.explode(n(4 * size), x, y);

    const flash = this.sprite('glow', x, y).setTint(0xffe8c0).setScale(0.4 * size);
    this.scene.tweens.add({ targets: flash, scale: 2.2 * size, alpha: 0, duration: 260 + 60 * size, ease: 'Quad.easeOut', onComplete: () => this.release(flash) });
    this.light(x, y, 150 * size, 0xff9a40, 420 + 120 * size);

    if (size >= 1.5) {
      const ring = this.sprite('ring', x, y).setTint(0xffd8a0).setScale(0.2);
      this.scene.tweens.add({ targets: ring, scale: 1.6 * size, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => this.release(ring) });
    }
    if (size >= 2.5 && this.scene.flares) this.scene.flares.burst(x, y, Math.min(1.6, size / 3));
    if (size >= 2.5) {
      const fl = this.sprite('flare', x, y).setTint(0xffe0b0).setScale(0.6 * size).setRotation(Math.random() * 0.4 - 0.2);
      this.scene.tweens.add({ targets: fl, scaleX: 2.2 * size, scaleY: 0.3, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => this.release(fl) });
    }
  }

  hitSpark(x, y, tint = 0xfff0c0) {
    this.sparks.explode(Math.max(1, Math.round(4 * this.q)), x, y);
    const s = this.sprite('glow', x, y).setTint(tint).setScale(0.35);
    this.scene.tweens.add({ targets: s, scale: 0.6, alpha: 0, duration: 120, onComplete: () => this.release(s) });
  }

  muzzle(x, y, tint = 0xffd080) {
    if (this.scene.lightLayer) this.scene.lightLayer.add(x, y, 90, tint, 90, 0.6);
    const s = this.sprite('glow', x, y, DEPTH.player + 1).setTint(tint).setScale(0.3);
    this.scene.tweens.add({ targets: s, scale: 0.45, alpha: 0, duration: 70, onComplete: () => this.release(s) });
  }

  sparkle(x, y, tint) {
    for (let i = 0; i < 2; i++) {
      const s = this.sprite('flare', x, y).setTint(tint).setScale(0.15).setRotation(i * 0.8);
      this.scene.tweens.add({ targets: s, scale: 0.7, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => this.release(s) });
    }
  }

  floatText(x, y, str, color = 0xffffff) {
    const t = text(this.scene, x, y, str, { size: 26, color, depth: DEPTH.overlay });
    this.scene.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1000, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  banner(str, { color = 0xffffff, size = 84, y = H / 2 - 100, hold = 1600, blink = false } = {}) {
    const t = text(this.scene, W / 2, y, str, { size, color, depth: DEPTH.overlay + 5, spacing: size / 10 });
    t.setAlpha(0).setScale(1.3);
    this.scene.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
    if (blink) {
      this.scene.tweens.add({ targets: t, alpha: 0.25, duration: 180, yoyo: true, repeat: Math.floor(hold / 360), delay: 260 });
    }
    this.scene.tweens.add({ targets: t, alpha: 0, scale: 0.95, duration: 320, delay: hold + 260, onComplete: () => t.destroy() });
    return t;
  }

  screenFlash(color = 0xffffff, duration = 400, alpha = 1) {
    const r = this.scene.add.rectangle(W / 2, H / 2, W, H, color, alpha).setDepth(DEPTH.overlay);
    this.scene.tweens.add({ targets: r, alpha: 0, duration, onComplete: () => r.destroy() });
  }
}

export const FX_SCALE = U;
