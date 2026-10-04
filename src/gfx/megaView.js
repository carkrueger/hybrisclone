// Renders the capital-ship layer: hulls, lit windows, engine plumes and running lights.
import Phaser from 'phaser';
import { H, DEPTH, MEGA_PARALLAX } from '../config.js';
import { paintMega } from './paint/megastructures.js';

const ADD = Phaser.BlendModes.ADD;

export class MegaView {
  constructor(scene, objects, { tint = 0xc8d4ea, preset, prefix = 'mega' } = {}) {
    this.scene = scene;
    this.keys = [];
    this.items = [];
    const Color = Phaser.Display.Color;
    // atmospheric haze: desaturate toward a blue-grey and let the nebula shine through a little
    const t = Color.ValueToColor(tint);
    const hz = Color.Interpolate.ColorWithColor(t, Color.ValueToColor(0x8098c0), 100, 45);
    const haze = Color.GetColor(hz.r * 0.82, hz.g * 0.82, hz.b * 0.82);
    objects.forEach((obj, i) => {
      const key = `${prefix}_${i}`;
      const info = paintMega(scene, key, obj);
      this.keys.push(key, key + '_lit');
      const fx = obj.flip ? -1 : 1;
      const hull = scene.add.image(obj.x, -9999, key).setDepth(DEPTH.mega).setTint(haze).setFlipX(obj.flip).setAlpha(0.86);
      const lit = scene.add.image(obj.x, -9999, key + '_lit').setDepth(DEPTH.mega + 0.1).setBlendMode(ADD).setFlipX(obj.flip).setAlpha(1);
      const parts = [];
      if (preset.lights) {
        for (const e of info.engines) {
          const plume = scene.add.image(0, 0, 'plume').setOrigin(0.5, 0).setBlendMode(ADD).setDepth(DEPTH.mega + 0.2);
          plume.setScale((e.r * 2.4) / 48, (e.r * 6) / 220);
          const glow = scene.add.image(0, 0, 'glow').setBlendMode(ADD).setDepth(DEPTH.mega + 0.2).setTint(0x80b8ff).setScale(e.r / 40);
          parts.push({ img: plume, ox: e.x * fx, oy: e.y, kind: 'plume', base: plume.scaleY });
          parts.push({ img: glow, ox: e.x * fx, oy: e.y - e.r * 0.3, kind: 'glow', base: glow.scaleX });
        }
        for (const lt of info.lights) {
          const g = scene.add.image(0, 0, 'glow').setBlendMode(ADD).setDepth(DEPTH.mega + 0.3).setTint(lt.color).setScale(lt.size || 0.4);
          parts.push({ img: g, ox: lt.x * fx, oy: lt.y, kind: 'light', rate: lt.rate || 0.003, phase: lt.phase ?? (lt.x * 0.01 + lt.y * 0.02) });
        }
      }
      this.items.push({ obj, info, hull, lit, parts, angle: 0, h: Math.max(info.h, info.w) });
    });
  }

  update(scroll, now, dt) {
    const ms = scroll * MEGA_PARALLAX;
    for (const it of this.items) {
      const y = H - (it.obj.d - ms);
      const visible = y + it.h / 2 > -60 && y - it.h / 2 < H + 60;
      it.hull.setVisible(visible);
      it.lit.setVisible(visible);
      for (const p of it.parts) p.img.setVisible(visible);
      if (!visible) continue;
      const x = it.obj.x;
      it.hull.setPosition(x, y);
      it.lit.setPosition(x, y);
      if (it.info.spin) {
        it.angle += it.info.spin * dt;
        it.hull.rotation = it.angle;
        it.lit.rotation = it.angle;
      }
      const cos = Math.cos(it.angle);
      const sin = Math.sin(it.angle);
      for (const p of it.parts) {
        const px = x + p.ox * cos - p.oy * sin;
        const py = y + p.ox * sin + p.oy * cos;
        p.img.setPosition(px, py);
        if (p.kind === 'light') p.img.alpha = Math.max(0, Math.sin(now * p.rate + p.phase)) ** 3;
        else if (p.kind === 'plume') p.img.scaleY = p.base * (0.85 + Math.random() * 0.3);
        else p.img.alpha = 0.7 + Math.random() * 0.3;
      }
    }
  }

  destroy() {
    for (const it of this.items) {
      it.hull.destroy();
      it.lit.destroy();
      for (const p of it.parts) p.img.destroy();
    }
    for (const k of this.keys) if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    this.items = [];
    this.keys = [];
  }
}
