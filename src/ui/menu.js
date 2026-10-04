// Vertical menu driven by the InputManager (keyboard / gamepad) plus mouse hover & click.
import { text, COLORS } from './text.js';
import { audio } from '../audio/index.js';

export class Menu {
  /**
   * items: [{ label: () => string, onSelect?, onLeft?, onRight?, onClick?(pointer, textObj) }]
   */
  constructor(scene, x, y, items, { spacing = 14, depth = 100 } = {}) {
    this.scene = scene;
    this.items = items;
    this.index = 0;
    this.enabled = true;
    this.texts = items.map((it, i) => {
      const t = text(scene, x, y + i * spacing, it.label(), { depth });
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
    this.refresh();
  }

  get current() {
    return this.items[this.index];
  }

  refresh() {
    const blink = Math.floor(this.scene.time.now / 250) % 2 === 0;
    this.items.forEach((it, i) => {
      const sel = i === this.index && this.enabled;
      const label = it.label();
      this.texts[i].setText(sel ? (blink ? '> ' : '  ') + label + (blink ? ' <' : '  ') : label);
      this.texts[i].setTint(sel ? COLORS.yellow : it.dim ? COLORS.dim : COLORS.grey);
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
  }

  destroy() {
    this.texts.forEach((t) => t.destroy());
  }
}
