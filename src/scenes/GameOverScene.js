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
    this.controls = new InputManager(this);
    this.controls.latch();
    this.add.tileSprite(0, 0, W, H, 'nebula').setOrigin(0);
    this.stars = this.add.tileSprite(0, 0, W, H, 'stars_far').setOrigin(0);

    text(this, W / 2, 60, 'GAME OVER', { scale: 3, tint: COLORS.red });
    text(this, W / 2, 96, 'SCORE ' + pad(score), { scale: 2, tint: COLORS.white });
    text(this, W / 2, 116, `REACHED SECTOR ${sector + 1}   SEED ${seed}`, { tint: COLORS.grey });

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
    this.items.push(text(this, W / 2, 170, 'NEW HIGH SCORE!', { scale: 2, tint: COLORS.yellow }));
    this.items.push(text(this, W / 2, 196, 'ENTER YOUR NAME', { tint: COLORS.cyan }));
    this.nameT = text(this, W / 2, 226, '', { scale: 2 });
    this.items.push(this.nameT);
    this.items.push(text(this, W / 2, 262, 'KEYS: TYPE + ENTER', { tint: COLORS.dim }));
    this.items.push(text(this, W / 2, 276, 'PAD: UP/DOWN LETTER  LEFT/RIGHT MOVE', { tint: COLORS.dim }));
    this.items.push(text(this, W / 2, 290, 'START TO CONFIRM', { tint: COLORS.dim }));
    const ok = text(this, W / 2, 316, '[ OK ]', { scale: 2, tint: COLORS.green });
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
    const pad = this.controls.getPad();
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
    } else if (pad && pad.buttons[9] && pad.buttons[9].pressed && c.pressed('pause')) {
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
    const entry = { name, score, seed, sector: sector + 1 };
    const rank = storage.addHighScore(entry);
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
    const list = storage.getHighScores();
    list.forEach((e, i) => {
      const y = 150 + i * 14;
      const tint = i === rank ? COLORS.yellow : COLORS.grey;
      this.items.push(text(this, 30, y, `${String(i + 1).padStart(2, ' ')}. ${e.name.padEnd(8, ' ')}`, { origin: [0, 0.5], tint }));
      this.items.push(text(this, 150, y, pad(e.score), { origin: [0, 0.5], tint: i === rank ? COLORS.yellow : COLORS.cyan }));
      this.items.push(text(this, W - 30, y, `S${e.sector}`, { origin: [1, 0.5], tint: COLORS.dim }));
    });
    this.countdown = CONTINUE_SECONDS + 0.999;
    this.contT = text(this, W / 2, 330, '', { scale: 2, tint: COLORS.orange });
    this.items.push(this.contT);
    this.items.push(text(this, W / 2, 356, `FIRE / CLICK: CONTINUE AT SECTOR ${this.result.sector + 1}`, { tint: COLORS.white }));
    this.items.push(text(this, W / 2, 370, '(SCORE RESETS)   ESC / B: TITLE', { tint: COLORS.dim }));
    this.time.delayedCall(250, () => {
      this.input.once('pointerdown', () => this.continueGame());
    });
  }

  continueGame() {
    if (this.state !== 'continue') return;
    this.state = 'leaving';
    audio.stopMusic(0.1);
    const { seed, sector, continues } = this.result;
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () =>
      this.scene.start('Game', { seed, sector, continues: (continues || 0) + 1 })
    );
  }

  toTitle() {
    if (this.state === 'leaving') return;
    this.state = 'leaving';
    audio.stopMusic(0.1);
    this.cameras.main.fadeOut(300);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Title'));
  }

  update(time, delta) {
    this.stars.tilePositionY -= 10 * (delta / 1000);
    this.controls.update(delta);
    if (this.state === 'name') this.updateNameEntry();
    else if (this.state === 'continue') {
      this.countdown -= delta / 1000;
      this.contT.setText('CONTINUE? ' + Math.max(0, Math.floor(this.countdown)));
      if (this.controls.pressed('fire') || this.controls.pressed('confirm')) this.continueGame();
      else if (this.controls.pressed('back') || this.countdown <= 0) this.toTitle();
    }
  }
}
