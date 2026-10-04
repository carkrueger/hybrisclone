import Phaser from 'phaser';
import { W, H } from '../config.js';
import { InputManager } from '../core/input.js';
import { Menu } from '../ui/menu.js';
import { text, COLORS } from '../ui/text.js';
import { audio } from '../audio/index.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    this.add.rectangle(0, 0, W, H, 0x000010, 0.65).setOrigin(0);
    text(this, W / 2, H / 2 - 50, 'PAUSED', { scale: 3, tint: COLORS.yellow });
    this.controls = new InputManager(this);
    this.controls.latch();
    this.menu = new Menu(this, W / 2, H / 2, [
      { label: () => 'RESUME', onSelect: () => this.resumeGame() },
      { label: () => 'QUIT TO TITLE', onSelect: () => this.quit() },
    ]);
    text(this, W / 2, H / 2 + 50, 'ESC / P / START TO RESUME', { tint: COLORS.dim });
  }

  update(time, delta) {
    this.controls.update(delta);
    if (this.controls.pressed('pause') || this.controls.pressed('back')) {
      this.resumeGame();
      return;
    }
    this.menu.update(this.controls);
  }

  resumeGame() {
    this.scene.resume('Game');
    this.scene.stop();
  }

  quit() {
    audio.resume();
    audio.stopMusic();
    this.scene.stop('Hud');
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
