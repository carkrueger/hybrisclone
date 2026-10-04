// Explosions, flashes and floating score text. Cosmetic only: uses Math.random freely.
import Phaser from 'phaser';
import { DEPTH, W, H } from '../config.js';
import { text } from '../ui/text.js';

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.sparks = scene.add
      .particles(0, 0, 'spark', {
        emitting: false,
        speed: { min: 30, max: 170 },
        lifespan: { min: 200, max: 600 },
        scale: { start: 1.6, end: 0 },
        color: [0xffffff, 0xffe080, 0xff9030, 0xa02010],
        blendMode: 'ADD',
      })
      .setDepth(DEPTH.fx);
    this.debris = scene.add
      .particles(0, 0, 'dot', {
        emitting: false,
        speed: { min: 20, max: 90 },
        lifespan: { min: 400, max: 900 },
        scale: { start: 0.8, end: 0.2 },
        gravityY: 40,
        color: [0xc0c8e0, 0x606880, 0x303040],
      })
      .setDepth(DEPTH.fx - 1);
    this.smoke = scene.add
      .particles(0, 0, 'smoke', {
        emitting: false,
        speed: { min: 5, max: 35 },
        lifespan: { min: 500, max: 1000 },
        scale: { start: 0.6, end: 1.8 },
        alpha: { start: 0.45, end: 0 },
        tint: 0x705848,
      })
      .setDepth(DEPTH.fx - 2);
    this.flashes = [];
  }

  flashAt(x, y, scale = 1, tint = 0xffe0a0) {
    let f = this.flashes.find((o) => !o.active);
    if (!f) {
      f = this.scene.add.image(x, y, 'flash').setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      this.flashes.push(f);
    }
    f.setActive(true).setVisible(true).setPosition(x, y).setTint(tint).setScale(0.2 * scale).setAlpha(1);
    this.scene.tweens.add({
      targets: f,
      scale: 1.3 * scale,
      alpha: 0,
      duration: 260 + 80 * scale,
      ease: 'Quad.easeOut',
      onComplete: () => f.setActive(false).setVisible(false),
    });
  }

  explode(x, y, size = 1) {
    this.sparks.explode(Math.round(10 + 10 * size), x, y);
    this.smoke.explode(Math.round(2 + 3 * size), x, y);
    if (size >= 1) this.debris.explode(Math.round(3 * size), x, y);
    this.flashAt(x, y, size);
  }

  hitSpark(x, y) {
    this.sparks.explode(3, x, y);
  }

  floatText(x, y, str, tint = 0xffffff) {
    const t = text(this.scene, x, y, str, { tint, depth: DEPTH.overlay });
    this.scene.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  banner(str, { tint = 0xffffff, scale = 2, y = H / 2 - 40, hold = 1600, blink = false } = {}) {
    const t = text(this.scene, W / 2, y, str, { tint, scale, depth: DEPTH.overlay + 5 });
    t.setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 1, duration: 200 });
    if (blink) {
      this.scene.tweens.add({ targets: t, alpha: 0.2, duration: 180, yoyo: true, repeat: Math.floor(hold / 360), delay: 200 });
    }
    this.scene.tweens.add({ targets: t, alpha: 0, duration: 300, delay: hold + 200, onComplete: () => t.destroy() });
    return t;
  }

  screenFlash(color = 0xffffff, duration = 400, alpha = 1) {
    const r = this.scene.add.rectangle(W / 2, H / 2, W, H, color, alpha).setDepth(DEPTH.overlay);
    this.scene.tweens.add({ targets: r, alpha: 0, duration, onComplete: () => r.destroy() });
  }
}
