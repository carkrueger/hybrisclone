import Phaser from 'phaser';
import { W, H, SEED_MAX_LEN, SEED_CHARS } from '../config.js';
import { InputManager } from '../core/input.js';
import { storage } from '../core/storage.js';
import { normalizeSeed, randomSeedString } from '../core/rng.js';
import { DEFAULT_SEED } from '../level/generator.js';
import { audio } from '../audio/index.js';
import { Menu } from '../ui/menu.js';
import { text, gradientTitle, pad, COLORS } from '../ui/text.js';
import { onTypedKey } from '../ui/typing.js';

const CONTROLS_HELP = [
  ['', 'KEYBOARD'],
  ['MOVE', 'ARROWS / WASD'],
  ['FIRE', 'SPACE / Z  (HOLD)'],
  ['BOMB', 'X / SHIFT'],
  ['PAUSE', 'ESC / P'],
  ['', ''],
  ['', 'MOUSE'],
  ['MOVE', 'SHIP FOLLOWS POINTER'],
  ['FIRE', 'LEFT BUTTON (HOLD)'],
  ['BOMB', 'RIGHT BUTTON'],
  ['', ''],
  ['', 'GAMEPAD'],
  ['MOVE', 'STICK / D-PAD'],
  ['FIRE', 'A / RB / RT'],
  ['BOMB', 'B / LB / LT'],
  ['PAUSE', 'START'],
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.controls = new InputManager(this);
    this.controls.latch();
    this.seed = normalizeSeed(storage.getLastSeed()) || DEFAULT_SEED;
    this.seedTyped = false;
    this.padEdit = false;
    this.padCursor = 0;
    this.panel = null;
    this.starting = false;

    this.nebula = this.add.tileSprite(0, 0, W, H, 'nebula').setOrigin(0);
    this.starsFar = this.add.tileSprite(0, 0, W, H, 'stars_far').setOrigin(0);
    this.starsNear = this.add.tileSprite(0, 0, W, H, 'stars_near').setOrigin(0);

    this.logo = gradientTitle(this, W / 2, 64, 'HYBRISCLONE', 3);
    this.sub = text(this, W / 2, 92, 'SEEDED VERTICAL SHOOT-EM-UP', { tint: COLORS.cyan });
    this.ship = this.add.image(W / 2, 134, 'player').setScale(2);
    this.flame = this.add.image(W / 2, 150, 'flame').setScale(2).setOrigin(0.5, 0);

    const vol = (v) => '|'.repeat(Math.round(v * 10)) + '.'.repeat(10 - Math.round(v * 10));
    const adjust = (which, d) => {
      const v = audio.volumes;
      v[which] = Math.round(Math.max(0, Math.min(1, v[which] + d)) * 10) / 10;
      audio.setVolumes(v.music, v.sfx);
    };
    this.seedItem = {
      label: () => {
        if (this.padEdit) {
          const blink = Math.floor(this.time.now / 200) % 2 === 0;
          const chars = this.seed.split('');
          if (blink) chars[this.padCursor] = '_';
          return 'SEED ' + chars.join('');
        }
        const cursor = this.menu && this.menu.current === this.seedItem && Math.floor(this.time.now / 300) % 2 ? '_' : ' ';
        return 'SEED ' + this.seed + cursor;
      },
      onSelect: () => {
        if (this.controls.device === 'gamepad') this.startPadEdit();
        else this.startGame();
      },
      onClick: () => {},
    };
    this.menu = new Menu(this, W / 2, 196, [
      { label: () => 'START GAME', onSelect: () => this.startGame() },
      this.seedItem,
      {
        label: () => 'RANDOM SEED',
        onSelect: () => {
          this.seed = randomSeedString();
          this.seedTyped = true;
        },
      },
      {
        label: () => 'MUSIC ' + vol(audio.volumes.music),
        onLeft: () => adjust('music', -0.1),
        onRight: () => adjust('music', 0.1),
        onSelect: () => adjust('music', audio.volumes.music >= 1 ? -1 : 0.1),
        onClick: (p, t) => adjust('music', p.worldX < t.x ? -0.1 : 0.1),
      },
      {
        label: () => 'SFX   ' + vol(audio.volumes.sfx),
        onLeft: () => adjust('sfx', -0.1),
        onRight: () => adjust('sfx', 0.1),
        onSelect: () => adjust('sfx', audio.volumes.sfx >= 1 ? -1 : 0.1),
        onClick: (p, t) => {
          adjust('sfx', p.worldX < t.x ? -0.1 : 0.1);
          audio.sfx('pickup');
        },
      },
      { label: () => 'HIGH SCORES', onSelect: () => this.showPanel('scores') },
      { label: () => 'CONTROLS', onSelect: () => this.showPanel('controls') },
    ]);

    this.hint = text(this, W / 2, 316, '', { tint: COLORS.dim });
    this.footer = text(this, W / 2, H - 22, 'SAME SEED = SAME LEVELS', { tint: COLORS.dim });
    text(this, W / 2, H - 10, 'CLICK OR PRESS A KEY FOR SOUND', { tint: COLORS.dim }).setName('soundHint');

    onTypedKey(this, (ev) => this.handleKey(ev));

    audio.playTitle();
    this.cameras.main.fadeIn(300);
  }

  handleKey(ev) {
    if (this.panel || this.starting) return;
    if (this.menu.current !== this.seedItem) return;
    if (/^[a-z0-9]$/i.test(ev.key)) {
      if (!this.seedTyped) {
        this.seed = '';
        this.seedTyped = true;
      }
      if (this.seed.length < SEED_MAX_LEN) this.seed += ev.key.toUpperCase();
      audio.sfx('menuMove');
    } else if (ev.key === 'Backspace') {
      this.seedTyped = true;
      this.seed = this.seed.slice(0, -1);
      audio.sfx('menuMove');
    }
  }

  startPadEdit() {
    this.padEdit = true;
    this.menu.enabled = false;
    if (!this.seed.length) this.seed = 'A';
    this.padCursor = this.seed.length - 1;
  }

  updatePadEdit() {
    const c = this.controls;
    const chars = this.seed.split('');
    const cycle = (d) => {
      const i = SEED_CHARS.indexOf(chars[this.padCursor]);
      chars[this.padCursor] = SEED_CHARS[(i + d + SEED_CHARS.length) % SEED_CHARS.length];
      audio.sfx('menuMove');
    };
    if (c.repeat('up')) cycle(1);
    else if (c.repeat('down')) cycle(-1);
    else if (c.repeat('right')) {
      if (this.padCursor === chars.length - 1 && chars.length < SEED_MAX_LEN) chars.push('A');
      this.padCursor = Math.min(chars.length - 1, this.padCursor + 1);
      audio.sfx('menuMove');
    } else if (c.repeat('left')) {
      this.padCursor = Math.max(0, this.padCursor - 1);
      audio.sfx('menuMove');
    } else if (c.pressed('back') && chars.length > 1) {
      chars.splice(this.padCursor, 1);
      this.padCursor = Math.min(this.padCursor, chars.length - 1);
    } else if (c.pressed('confirm')) {
      this.padEdit = false;
      this.menu.enabled = true;
      audio.sfx('menuSelect');
    }
    this.seed = chars.join('');
  }

  showPanel(kind) {
    this.menu.enabled = false;
    this.menu.setVisible(false);
    const items = [];
    const bg = this.add.rectangle(W / 2, 270, W - 24, 300, 0x000010, 0.85).setStrokeStyle(1, 0x404870);
    items.push(bg);
    if (kind === 'scores') {
      items.push(text(this, W / 2, 132, 'HIGH SCORES', { tint: COLORS.yellow, scale: 2 }));
      storage.getHighScores().forEach((e, i) => {
        const y = 160 + i * 18;
        items.push(text(this, 24, y, `${String(i + 1).padStart(2, ' ')}. ${e.name.padEnd(8, ' ')}`, { origin: [0, 0.5], tint: i === 0 ? COLORS.yellow : COLORS.white }));
        items.push(text(this, 140, y, pad(e.score), { origin: [0, 0.5], tint: COLORS.cyan }));
        items.push(text(this, W - 24, y, `${e.seed} S${e.sector}`, { origin: [1, 0.5], tint: COLORS.dim }));
      });
    } else {
      items.push(text(this, W / 2, 132, 'CONTROLS', { tint: COLORS.yellow, scale: 2 }));
      CONTROLS_HELP.forEach(([a, b], i) => {
        const y = 156 + i * 14;
        if (!a) items.push(text(this, W / 2, y, b, { tint: COLORS.orange }));
        else {
          items.push(text(this, 40, y, a, { origin: [0, 0.5], tint: COLORS.grey }));
          items.push(text(this, 100, y, b, { origin: [0, 0.5] }));
        }
      });
    }
    items.push(text(this, W / 2, 410, 'PRESS FIRE OR CLICK TO RETURN', { tint: COLORS.dim }));
    this.panel = items;
    this.panelOpenedAt = this.time.now;
    this.input.once('pointerdown', () => this.closePanel());
  }

  closePanel() {
    if (!this.panel || this.time.now - this.panelOpenedAt < 150) {
      if (this.panel) this.input.once('pointerdown', () => this.closePanel());
      return;
    }
    this.panel.forEach((o) => o.destroy());
    this.panel = null;
    this.menu.enabled = true;
    this.menu.setVisible(true);
  }

  startGame() {
    if (this.starting) return;
    this.starting = true;
    this.seed = normalizeSeed(this.seed) || DEFAULT_SEED;
    storage.setLastSeed(this.seed);
    audio.unlock();
    audio.stopMusic(0.2);
    audio.sfx('menuSelect');
    this.cameras.main.fadeOut(400);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { seed: this.seed }));
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.nebula.tilePositionY -= 6 * dt;
    this.starsFar.tilePositionY -= 18 * dt;
    this.starsNear.tilePositionY -= 45 * dt;
    this.ship.y = 134 + Math.sin(time * 0.002) * 4;
    this.flame.y = this.ship.y + 16;
    this.flame.setScale(2 * (0.8 + Math.random() * 0.4), 2 * (0.7 + Math.random() * 0.7));

    const soundHint = this.children.getByName('soundHint');
    if (soundHint) soundHint.setVisible(!audio.unlocked);

    this.controls.typing = !this.panel && this.menu.current === this.seedItem;
    this.controls.update(delta);
    if (this.starting) return;

    if (this.panel) {
      if (this.controls.pressed('confirm') || this.controls.pressed('back') || this.controls.pressed('fire')) this.closePanel();
      return;
    }
    if (this.padEdit) {
      this.updatePadEdit();
      this.menu.refresh();
      this.hint.setText('UP/DOWN CHAR  LEFT/RIGHT MOVE  A DONE');
      return;
    }
    this.menu.update(this.controls);
    if (this.menu.current === this.seedItem) {
      this.hint.setText(this.controls.device === 'gamepad' ? 'PRESS A TO EDIT SEED' : 'TYPE A SEED, ENTER TO START');
    } else if (this.menu.current.onLeft) {
      this.hint.setText('LEFT / RIGHT TO ADJUST');
    } else {
      this.hint.setText('');
    }
  }
}
