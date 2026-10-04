// Image pool with a free list: bullets and similar short-lived sprites.
export class SpritePool {
  constructor(scene, depth, blendMode = 0) {
    this.scene = scene;
    this.depth = depth;
    this.blendMode = blendMode;
    this.items = [];
    this.free = [];
  }

  get(tex, x, y) {
    let s = this.free.pop();
    if (!s) {
      s = this.scene.add.image(x, y, tex).setDepth(this.depth).setBlendMode(this.blendMode);
      this.items.push(s);
    }
    s.setTexture(tex).setPosition(x, y).setActive(true).setVisible(true);
    s.setAlpha(1).setScale(1).setRotation(0).clearTint();
    s.alive = true;
    return s;
  }

  release(s) {
    if (!s.alive) return;
    s.alive = false;
    s.setActive(false).setVisible(false);
    this.free.push(s);
  }

  forEach(fn) {
    for (const s of this.items) if (s.alive) fn(s);
  }

  releaseAll() {
    for (const s of this.items) this.release(s);
  }

  countActive() {
    return this.items.length - this.free.length;
  }
}
