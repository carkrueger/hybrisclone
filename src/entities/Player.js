import { W, H, DEPTH, PLAYER_SPEED, PLAYER_MOUSE_SPEED } from '../config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.sprite = scene.add.image(W / 2, H - 60, 'player').setDepth(DEPTH.player);
    this.flame = scene.add.image(W / 2, H - 50, 'flame').setDepth(DEPTH.player - 1).setOrigin(0.5, 0);
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

  spawn(now, invulnMs) {
    this.alive = true;
    this.sprite.setPosition(W / 2, H + 20).setVisible(true);
    this.flame.setVisible(true);
    this.invulnUntil = now + invulnMs;
    this.entering = true;
  }

  kill() {
    this.alive = false;
    this.sprite.setVisible(false);
    this.flame.setVisible(false);
  }

  update(dt, input, now) {
    if (!this.alive) return;
    const s = this.sprite;
    let vx = 0;

    if (this.entering) {
      s.y -= 120 * dt;
      if (s.y <= H - 60) this.entering = false;
    } else if (input.pointerTarget) {
      const dx = input.pointerTarget.x - s.x;
      const dy = input.pointerTarget.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.5) {
        const step = Math.min(dist, PLAYER_MOUSE_SPEED * dt);
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
        vx = Math.max(-1, Math.min(1, dx / 12));
      }
    } else {
      s.x += input.moveX * PLAYER_SPEED * dt;
      s.y += input.moveY * PLAYER_SPEED * dt;
      vx = input.moveX;
    }
    s.x = Math.max(9, Math.min(W - 9, s.x));
    if (!this.entering) s.y = Math.max(28, Math.min(H - 22, s.y));

    // slight banking squash when strafing
    this.bank += (vx - this.bank) * Math.min(1, dt * 12);
    s.setScale(1 - Math.abs(this.bank) * 0.15, 1);

    this.flame.setPosition(s.x, s.y + 8);
    this.flame.setScale(0.8 + Math.random() * 0.4, 0.7 + Math.random() * 0.7);

    const blinking = this.isInvulnerable(now) && Math.floor(now / 70) % 2 === 0;
    s.setAlpha(blinking ? 0.25 : 1);
    this.flame.setAlpha(blinking ? 0.25 : 1);
  }
}
