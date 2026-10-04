// Vertical menu driven by the InputManager (keyboard / gamepad) plus mouse hover & click.
import { text, setColor, COLORS } from './text.js';
import { audio } from '../audio/index.js';

export class Menu {
  /**
   * items: [{ label: () => string, onSelect?, onLeft?, onRight?, onClick?(pointer, textObj) }]
   */
  constructor(scene, x, y, items, { spacing = 58, size = 34, depth = 100, width = 760 } = {}) {
    this.scene = scene;
    this.items = items;
    this.index = 0;
    this.enabled = true;
    this.highlight = scene.add.rectangle(x, y, width, spacing - 10, 0x5ae4ff, 0.12).setDepth(depth - 1);
    this.highlight.setStrokeStyle(2, 0x5ae4ff, 0.6);
    this.texts = items.map((it, i) => {
      const t = text(scene, x, y + i * spacing, it.label(), { size, depth, glow: false });
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        if (!this.enabled) return;
        if (this.index !== i) {
          this.index = i;
          audio.sfx('menuMove');
        }
      });
      t.on('pointerdown', (pointer) => {
        if (!this.enabled) return;
        this.index = i;
        if (it.onClick) it.onClick(pointer, t);
        else if (it.onSelect) {
          audio.sfx('menuSelect');
          it.onSelect();
        }
        this.refresh();
      });
      return t;
    });
    this.x = x;
    this.y = y;
    this.spacing = spacing;
    this.refresh();
  }

  get current() {
    return this.items[this.index];
  }

  refresh() {
    const pulse = 0.1 + 0.06 * Math.sin(this.scene.time.now * 0.008);
    this.highlight.setVisible(this.enabled && this.texts[0].visible);
    this.highlight.y += (this.y + this.index * this.spacing - this.highlight.y) * 0.35;
    this.highlight.fillAlpha = pulse;
    this.items.forEach((it, i) => {
      const sel = i === this.index && this.enabled;
      const label = it.label();
      if (this.texts[i].text !== label) this.texts[i].setText(label);
      const color = sel ? COLORS.yellow : it.dim ? COLORS.dim : COLORS.grey;
      if (this.texts[i]._c !== color) {
        this.texts[i]._c = color;
        setColor(this.texts[i], color, false);
        this.texts[i].setShadow(0, 0, sel ? '#ffb020' : '#000000', sel ? 9 : 0, true, true);
      }
    });
  }

  update(input) {
    if (!this.enabled) return;
    if (input.repeat('up')) {
      this.index = (this.index + this.items.length - 1) % this.items.length;
      audio.sfx('menuMove');
    } else if (input.repeat('down')) {
      this.index = (this.index + 1) % this.items.length;
      audio.sfx('menuMove');
    } else if (input.repeat('left') && this.current.onLeft) {
      this.current.onLeft();
      audio.sfx('menuMove');
    } else if (input.repeat('right') && this.current.onRight) {
      this.current.onRight();
      audio.sfx('menuMove');
    } else if (input.pressed('confirm') && this.current.onSelect) {
      audio.sfx('menuSelect');
      this.current.onSelect();
    }
    this.refresh();
  }

  setVisible(v) {
    this.texts.forEach((t) => t.setVisible(v));
    this.highlight.setVisible(v);
  }

  destroy() {
    this.texts.forEach((t) => t.destroy());
    this.highlight.destroy();
  }
}
