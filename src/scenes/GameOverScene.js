import Phaser from 'phaser';
import { W, H } from '../config.js';
import { InputManager } from '../core/input.js';
import { storage } from '../core/storage.js';
import { audio } from '../audio/index.js';
import { text, pad, COLORS } from '../ui/text.js';
import { onTypedKey } from '../ui/typing.js';

const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
const NAME_MAX = 8;
const CONTINUE_SECONDS = 9;

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.result = data;
  }

  create() {
    const { score, seed, sector } = this.result;
    this.result.level = this.result.level || 0;
    this.stageTag = `${sector + 1}-${this.result.level + 1}`;
    this.controls = new InputManager(this);
    this.controls.latch();
    this.add.tileSprite(0, 0, W, H, 'nebula_title').setOrigin(0).setAlpha(0.7);
    this.stars = this.add.tileSprite(0, 0, W, H, 'stars_far').setOrigin(0);

    text(this, W / 2, 120, 'GAME OVER', { size: 120, color: COLORS.red, spacing: 10 });
    text(this, W / 2, 230, 'SCORE  ' + pad(score), { size: 48 });
    text(this, W / 2, 285, `REACHED SECTOR ${this.stageTag}     SEED ${seed}`, { size: 24, font: 'body', color: COLORS.grey, glow: false });

    this.items = [];
    audio.playJingle('gameOver');
    this.cameras.main.fadeIn(400);

    if (score > 0 && storage.isHighScore(score)) this.startNameEntry();
    else this.startContinue(-1);

    onTypedKey(this, (ev) => this.handleKey(ev));
  }

  clearItems() {
    this.items.forEach((o) => o.destroy());
    this.items = [];
  }

  // ------------------------------------------------------------ name entry
  startNameEntry() {
    this.state = 'name';
    this.controls.typing = true;
    this.name = (storage.getLastName() || 'PLAYER').slice(0, NAME_MAX).split('');
    this.cursor = this.name.length - 1;
    this.items.push(text(this, W / 2, 420, 'NEW HIGH SCORE!', { size: 64, color: COLORS.yellow }));
    this.items.push(text(this, W / 2, 495, 'ENTER YOUR NAME', { size: 28, color: COLORS.cyan }));
    this.nameT = text(this, W / 2, 590, '', { size: 80, spacing: 14 });
    this.items.push(this.nameT);
    this.items.push(text(this, W / 2, 690, 'KEYBOARD: TYPE + ENTER', { size: 22, font: 'body', color: COLORS.dim, glow: false }));
    this.items.push(text(this, W / 2, 725, 'GAMEPAD: UP/DOWN LETTER   LEFT/RIGHT MOVE   START CONFIRM', { size: 22, font: 'body', color: COLORS.dim, glow: false }));
    const ok = text(this, W / 2, 810, '[  OK  ]', { size: 48, color: COLORS.green });
    ok.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirmName());
    this.items.push(ok);
  }

  handleKey(ev) {
    if (this.state !== 'name') return;
    if (/^[a-z0-9 ]$/i.test(ev.key)) {
      if (this.freshTyping !== false) {
        this.name = [];
        this.freshTyping = false;
      }
      if (this.name.length < NAME_MAX) this.name.push(ev.key.toUpperCase());
      this.cursor = this.name.length - 1;
      audio.sfx('menuMove');
    } else if (ev.key === 'Backspace') {
      this.freshTyping = false;
      this.name.pop();
      this.cursor = Math.max(0, this.name.length - 1);
      audio.sfx('menuMove');
    } else if (ev.key === 'Enter') {
      this.confirmName();
    }
  }

  updateNameEntry() {
    const c = this.controls;
    const gp = this.controls.getPad();
    if (!this.name.length) this.name = ['A'];
    const cycle = (d) => {
      const i = Math.max(0, NAME_CHARS.indexOf(this.name[this.cursor]));
      this.name[this.cursor] = NAME_CHARS[(i + d + NAME_CHARS.length) % NAME_CHARS.length];
      this.freshTyping = false;
      audio.sfx('menuMove');
    };
    if (c.repeat('up')) cycle(1);
    else if (c.repeat('down')) cycle(-1);
    else if (c.repeat('right')) {
      if (this.cursor === this.name.length - 1 && this.name.length < NAME_MAX) this.name.push('A');
      this.cursor = Math.min(this.name.length - 1, this.cursor + 1);
      audio.sfx('menuMove');
    } else if (c.repeat('left')) {
      this.cursor = Math.max(0, this.cursor - 1);
      audio.sfx('menuMove');
    } else if (gp && gp.buttons[9] && gp.buttons[9].pressed && c.pressed('pause')) {
      this.confirmName();
      return;
    }
    const blink = Math.floor(this.time.now / 200) % 2 === 0;
    const shown = this.name.map((ch, i) => (i === this.cursor && blink ? '_' : ch === ' ' ? '.' : ch));
    this.nameT.setText(shown.join(''));
  }

  confirmName() {
    if (this.state !== 'name') return;
    const name = this.name.join('').trim() || 'PLAYER';
    const { score, seed, sector } = this.result;
    const rank = storage.addHighScore({ name, score, seed, sector: this.stageTag });
    storage.setLastName(name);
    audio.sfx('menuSelect');
    this.controls.typing = false;
    this.controls.latch();
    this.startContinue(rank);
  }

  // ------------------------------------------------------------ table + continue
  startContinue(rank) {
    this.clearItems();
    this.state = 'continue';
    storage.getHighScores().forEach((e, i) => {
      const y = 360 + i * 44;
      const hi = i === rank;
      this.items.push(text(this, 640, y, `${String(i + 1).padStart(2, ' ')}.  ${e.name}`, { size: 28, origin: [0, 0.5], color: hi ? COLORS.yellow : COLORS.grey, glow: hi }));
      this.items.push(text(this, 1060, y, pad(e.score), { size: 28, color: hi ? COLORS.yellow : COLORS.cyan, glow: hi }));
      this.items.push(text(this, 1280, y, `S${e.sector}`, { size: 22, font: 'body', origin: [1, 0.5], color: COLORS.dim, glow: false }));
    });
    this.countdown = CONTINUE_SECONDS + 0.999;
    this.contT = text(this, W / 2, 850, '', { size: 56, color: COLORS.orange });
    this.items.push(this.contT);
    this.items.push(text(this, W / 2, 920, `FIRE / CLICK: CONTINUE AT SECTOR ${this.stageTag}`, { size: 26 }));
    this.items.push(text(this, W / 2, 960, '(SCORE RESETS)     ESC / B: TITLE', { size: 22, font: 'body', color: COLORS.dim, glow: false }));
    this.time.delayedCall(250, () => {
      this.input.once('pointerdown', () => this.continueGame());
    });
  }

  continueGame() {
    if (this.state !== 'continue') return;
    this.state = 'leaving';
    audio.stopMusic(0.1);
    const { seed, sector, level, continues } = this.result;
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { seed, sector, level, continues: (continues || 0) + 1 }));
  }

  toTitle() {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    audio.stopMusic(0.1);
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  update(time, delta) {
    this.stars.tilePositionY -= 20 * (delta / 1000);
    this.controls.update(delta);
    if (this.state === 'name') this.updateNameEntry();
    else if (this.state === 'continue') {
      this.countdown -= delta / 1000;
      this.contT.setText('CONTINUE?  ' + Math.max(0, Math.floor(this.countdown)));
      if (this.controls.pressed('fire') || this.controls.pressed('confirm')) this.continueGame();
      else if (this.controls.pressed('back') || this.countdown <= 0) this.toTitle();
    }
  }
}
