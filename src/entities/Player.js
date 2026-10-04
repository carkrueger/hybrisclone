import Phaser from 'phaser';
import { W, H, U, DEPTH, PLAYER_SPEED, PLAYER_MOUSE_SPEED } from '../config.js';
import { ShipDecor } from './decor.js';

export const SHADOW_OFFSET = { x: 22 * U, y: 34 * U, scale: 0.8 };

export class Player {
  constructor(scene, preset) {
    this.scene = scene;
    this.shadow = scene.add.image(0, 0, 'player').setDepth(DEPTH.airShadows).setTint(0x000000).setAlpha(0.38);
    this.shadow.setVisible(preset.shadows);
    this.useShadow = preset.shadows;
    this.sprite = scene.add.image(W / 2, H - 140, 'player').setDepth(DEPTH.player);
    this.glow = scene.add.image(W / 2, H - 140, 'player_glow').setDepth(DEPTH.player + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.decor = new ShipDecor(scene, this.sprite, 'player', { flames: preset.flames, rim: preset.rim, rimColor: scene.rimColor || 0x5ae4ff });
    this.trail = null;
    if (preset.trails) {
      this.trail = scene.add
        .particles(0, 0, 'spark', {
          speed: { min: 60, max: 140 },
          angle: { min: 80, max: 100 },
          lifespan: { min: 160, max: 320 },
          scale: { start: 1.6, end: 0 },
          alpha: { start: 0.8, end: 0 },
          color: [0xffffff, 0x80e0ff, 0x2080ff],
          blendMode: Phaser.BlendModes.ADD,
          frequency: 16,
          quantity: 2,
          follow: this.sprite,
          followOffset: { x: 0, y: 56 },
        })
        .setDepth(DEPTH.player - 1);
    }
    this.alive = true;
    this.invulnUntil = 0;
    this.bank = 0;
    this.entering = false;
  }

  get x() {
    return this.sprite.x;
  }

  get y() {
    return this.sprite.y;
  }

  isInvulnerable(now) {
    return now < this.invulnUntil;
  }

  setVisible(v) {
    this.sprite.setVisible(v);
    this.glow.setVisible(v);
    this.shadow.setVisible(v && this.useShadow);
    this.decor.setVisible(v);
    if (this.trail) this.trail.emitting = v;
  }

  spawn(now, invulnMs) {
    this.alive = true;
    this.sprite.setPosition(W / 2, H + 80);
    this.setVisible(true);
    this.invulnUntil = now + invulnMs;
    this.entering = true;
  }

  kill() {
    this.alive = false;
    this.setVisible(false);
  }

  update(dt, input, now) {
    if (!this.alive) return;
    const s = this.sprite;
    let vx = 0;

    if (this.entering) {
      s.y -= 280 * dt;
      if (s.y <= H - 150) this.entering = false;
    } else if (input.pointerTarget) {
      const dx = input.pointerTarget.x - s.x;
      const dy = input.pointerTarget.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1) {
        const step = Math.min(dist, PLAYER_MOUSE_SPEED * dt);
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
        vx = Math.max(-1, Math.min(1, dx / 40));
      }
    } else {
      s.x += input.moveX * PLAYER_SPEED * dt;
      s.y += input.moveY * PLAYER_SPEED * dt;
      vx = input.moveX;
    }
    s.x = Math.max(56, Math.min(W - 56, s.x));
    if (!this.entering) s.y = Math.max(110, Math.min(H - 80, s.y));

    // banking
    this.bank += (vx - this.bank) * Math.min(1, dt * 10);
    s.setRotation(this.bank * 0.1);
    s.setScale(1 - Math.abs(this.bank) * 0.14, 1);
    this.glow.setPosition(s.x, s.y).setRotation(s.rotation).setScale(s.scaleX, 1);
    this.glow.setAlpha(0.75 + Math.random() * 0.25);
    this.shadow
      .setPosition(s.x + SHADOW_OFFSET.x, s.y + SHADOW_OFFSET.y)
      .setRotation(s.rotation)
      .setScale(s.scaleX * SHADOW_OFFSET.scale, SHADOW_OFFSET.scale);

    const blinking = this.isInvulnerable(now) && Math.floor(now / 70) % 2 === 0;
    s.setAlpha(blinking ? 0.3 : 1);
    this.decor.update();
  }
}
