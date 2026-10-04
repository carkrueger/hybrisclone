// Per-ship decoration sprites: animated engine flames and a coloured rim light.
import Phaser from 'phaser';
import { SHIP_ENGINES } from '../gfx/paint/ships.js';

const ADD = Phaser.BlendModes.ADD;

export class ShipDecor {
  constructor(scene, sprite, key, { flames = true, rim = true, rimColor = 0x5ae4ff, depth } = {}) {
    this.sprite = sprite;
    this.flames = [];
    const d = depth ?? sprite.depth;
    const eng = SHIP_ENGINES[key];
    if (flames && eng) {
      for (const [ex, ey] of eng.at) {
        const f = scene.add.image(0, 0, eng.tex).setOrigin(0.5, 0).setBlendMode(ADD).setDepth(d - 0.5);
        this.flames.push({ img: f, ex, ey, dir: eng.dir, s: eng.scale });
      }
    }
    this.rim = null;
    if (rim && scene.textures.exists(key + '_rim')) {
      this.rim = scene.add.image(0, 0, key + '_rim').setBlendMode(ADD).setTint(rimColor).setAlpha(0.85).setDepth(d + 0.2);
    }
  }

  update() {
    const s = this.sprite;
    const cos = Math.cos(s.rotation);
    const sin = Math.sin(s.rotation);
    for (const f of this.flames) {
      const x = s.x + (f.ex * cos - f.ey * sin) * s.scaleX;
      const y = s.y + (f.ex * sin + f.ey * cos) * s.scaleY;
      f.img.setPosition(x, y);
      f.img.rotation = s.rotation + (f.dir < 0 ? Math.PI : 0);
      f.img.setScale(f.s * (0.85 + Math.random() * 0.3), f.s * (0.65 + Math.random() * 0.6));
      f.img.setAlpha(s.alpha * (0.8 + Math.random() * 0.2));
      f.img.setVisible(s.visible);
    }
    if (this.rim) {
      this.rim.setPosition(s.x, s.y).setRotation(s.rotation).setScale(s.scaleX, s.scaleY).setVisible(s.visible);
      this.rim.alpha = 0.85 * s.alpha;
    }
  }

  setVisible(v) {
    for (const f of this.flames) f.img.setVisible(v);
    if (this.rim) this.rim.setVisible(v);
  }

  destroy() {
    for (const f of this.flames) f.img.destroy();
    if (this.rim) this.rim.destroy();
  }
}
