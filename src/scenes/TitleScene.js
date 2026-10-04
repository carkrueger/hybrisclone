import Phaser from 'phaser';
import { W, H, SEED_MAX_LEN, SEED_CHARS, DEPTH } from '../config.js';
import { InputManager } from '../core/input.js';
import { storage } from '../core/storage.js';
import { settings } from '../core/settings.js';
import { normalizeSeed, randomSeedString } from '../core/rng.js';
import { DEFAULT_SEED, generateLevel } from '../level/generator.js';
import { ensureThemeTiles } from '../gfx/paint/station.js';
import { StationView } from '../gfx/stationView.js';
import { MegaView } from '../gfx/megaView.js';
import { AmbientView } from '../gfx/ambient.js';
import { applyPost } from '../gfx/post.js';
import { audio } from '../audio/index.js';
import { Menu } from '../ui/menu.js';
import { text, logo, pad, COLORS } from '../ui/text.js';
import { onTypedKey } from '../ui/typing.js';

const CONTROLS_HELP = [
  ['', 'KEYBOARD'],
  ['MOVE', 'ARROWS / WASD'],
  ['FIRE', 'SPACE / Z  (HOLD)'],
  ['BOMB', 'X / SHIFT'],
  ['PAUSE', 'ESC / P'],
  ['', 'MOUSE'],
  ['MOVE', 'SHIP FOLLOWS POINTER'],
  ['FIRE', 'LEFT BUTTON (HOLD)'],
  ['BOMB', 'RIGHT BUTTON'],
  ['', 'GAMEPAD'],
  ['MOVE', 'STICK / D-PAD'],
  ['FIRE', 'A / RB / RT'],
  ['BOMB', 'B / LB / LT'],
  ['PAUSE', 'START'],
];

const UI = 200; // UI depth, above the backdrop

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
    const preset = settings.preset;

    // backdrop: nebula, stars, planet and a looping station flyby
    this.nebula = this.add.tileSprite(0, 0, W, H, 'nebula_title').setOrigin(0).setDepth(DEPTH.nebula);
    this.starsFar = this.add.tileSprite(0, 0, W, H, 'stars_far').setOrigin(0).setDepth(DEPTH.farStars);
    this.add.image(W * 0.16, H * 0.3, 'planet_title').setDepth(DEPTH.planet);
    this.starsNear = this.add.tileSprite(0, 0, W, H, 'stars_near').setOrigin(0).setDepth(DEPTH.nearStars);
    this.flyLevel = generateLevel('TITLE', 0, 0);
    ensureThemeTiles(this, this.flyLevel.theme);
    this.station = new StationView(this, this.flyLevel, preset);
    this.flyScroll = 900;
    this.ambient = new AmbientView(this, this.flyLevel, this.station, preset);
    this.megaView = new MegaView(this, [{ kind: 'battleship', x: W * 0.62, d: 620, scale: 1.05, flip: false, seed: 4711 }, { kind: 'ring', x: W * 0.12, d: 1900, scale: 0.9, flip: false, seed: 815 }], { tint: this.flyLevel.tint, preset, prefix: 'mega_title' });
    this.add.rectangle(0, 0, W, H, 0x02030a, 0.3).setOrigin(0).setDepth(DEPTH.overlay - 1);

    this.ship = this.add.image(W * 0.8, H * 0.62, 'player').setScale(1.6).setDepth(DEPTH.player);
    this.shipGlow = this.add.image(this.ship.x, this.ship.y, 'player_glow').setScale(1.6).setDepth(DEPTH.player + 1).setBlendMode(Phaser.BlendModes.ADD);
    this.add
      .particles(0, 0, 'spark', {
        speed: { min: 140, max: 260 },
        angle: { min: 82, max: 98 },
        lifespan: { min: 200, max: 420 },
        scale: { start: 2.6, end: 0 },
        alpha: { start: 0.85, end: 0 },
        color: [0xffffff, 0x80e0ff, 0x2080ff],
        blendMode: Phaser.BlendModes.ADD,
        frequency: 12,
        quantity: 2,
        follow: this.ship,
        followOffset: { x: 0, y: 90 },
      })
      .setDepth(DEPTH.player - 1);

    this.logo = logo(this, W / 2, 170, 'HYBRISCLONE', 140, UI);
    text(this, W / 2, 275, "A SEEDED VERTICAL SHOOT-'EM-UP", { size: 26, color: COLORS.cyan, depth: UI, spacing: 6 });

    const vol = (v) => '|'.repeat(Math.round(v * 10)).padEnd(10, '.');
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
          return 'SEED  ' + chars.join('');
        }
        const cursor = this.menu && this.menu.current === this.seedItem && Math.floor(this.time.now / 300) % 2 ? '_' : ' ';
        return 'SEED  ' + this.seed + cursor;
      },
      onSelect: () => {
        if (this.controls.device === 'gamepad') this.startPadEdit();
        else this.startGame();
      },
      onClick: () => {},
    };
    const restartNote = () => this.flash('APPLIES ON NEXT START');
    this.menu = new Menu(
      this,
      W / 2,
      370,
      [
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
          label: () => 'MUSIC   ' + vol(audio.volumes.music),
          onLeft: () => adjust('music', -0.1),
          onRight: () => adjust('music', 0.1),
          onSelect: () => adjust('music', audio.volumes.music >= 1 ? -1 : 0.1),
          onClick: (p, t) => adjust('music', p.worldX < t.x ? -0.1 : 0.1),
        },
        {
          label: () => 'SFX     ' + vol(audio.volumes.sfx),
          onLeft: () => adjust('sfx', -0.1),
          onRight: () => adjust('sfx', 0.1),
          onSelect: () => adjust('sfx', audio.volumes.sfx >= 1 ? -1 : 0.1),
          onClick: (p, t) => {
            adjust('sfx', p.worldX < t.x ? -0.1 : 0.1);
            audio.sfx('pickup');
          },
        },
        {
          label: () => 'QUALITY  ' + settings.quality.toUpperCase(),
          onLeft: () => (settings.cycleQuality(-1), restartNote()),
          onRight: () => (settings.cycleQuality(1), restartNote()),
          onSelect: () => (settings.cycleQuality(1), restartNote()),
        },
        {
          label: () => 'CRT FILTER  ' + (settings.crt ? 'ON' : 'OFF'),
          onLeft: () => (settings.crt = !settings.crt),
          onRight: () => (settings.crt = !settings.crt),
          onSelect: () => (settings.crt = !settings.crt),
        },
        { label: () => 'HIGH SCORES', onSelect: () => this.showPanel('scores') },
        { label: () => 'CONTROLS', onSelect: () => this.showPanel('controls') },
      ],
      { depth: UI }
    );

    // dark glass panel behind the menu and a footer band keep the text readable over the flyby
    const panel = this.add.graphics().setDepth(UI - 2);
    panel.fillStyle(0x03050c, 0.62);
    panel.fillRoundedRect(W / 2 - 440, 330, 880, 560, 18);
    panel.lineStyle(2, 0x5ae4ff, 0.25);
    panel.strokeRoundedRect(W / 2 - 440, 330, 880, 560, 18);
    panel.fillStyle(0x03050c, 0.7);
    panel.fillRect(0, H - 96, W, 96);
    this.hint = text(this, W / 2, 925, '', { size: 22, font: 'body', color: COLORS.grey, depth: UI, glow: false });
    text(this, W / 2, H - 70, 'SAME SEED  =  SAME STATION, SAME WAVES, SAME MUSIC', { size: 20, font: 'body', color: COLORS.dim, depth: UI, glow: false });
    this.soundHint = text(this, W / 2, H - 38, 'CLICK OR PRESS A KEY TO ENABLE SOUND', { size: 20, font: 'body', color: COLORS.orange, depth: UI, glow: false });
    this.composing = text(this, W - 40, 40, 'COMPOSING MUSIC...', { size: 20, color: COLORS.cyan, origin: [1, 0.5], depth: UI });
    this.note = text(this, W / 2, 970, '', { size: 22, color: COLORS.orange, depth: UI });

    onTypedKey(this, (ev) => this.handleKey(ev));
    applyPost(this, this.cameras.main, preset);
    audio.playTitle();
    this.cameras.main.fadeIn(400);
  }

  flash(str) {
    this.note.setText(str).setAlpha(1);
    this.tweens.killTweensOf(this.note);
    this.tweens.add({ targets: this.note, alpha: 0, delay: 1400, duration: 400 });
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
    const bg = this.add.rectangle(W / 2, 600, 1100, 720, 0x04060e, 0.9).setStrokeStyle(2, 0x5ae4ff, 0.6).setDepth(UI);
    items.push(bg);
    if (kind === 'scores') {
      items.push(text(this, W / 2, 300, 'HIGH SCORES', { size: 52, color: COLORS.yellow, depth: UI + 1 }));
      storage.getHighScores().forEach((e, i) => {
        const y = 380 + i * 50;
        const color = i === 0 ? COLORS.yellow : COLORS.white;
        items.push(text(this, 600, y, `${String(i + 1).padStart(2, ' ')}.  ${e.name}`, { size: 30, origin: [0, 0.5], color, depth: UI + 1, glow: i === 0 }));
        items.push(text(this, 1040, y, pad(e.score), { size: 30, origin: [0.5, 0.5], color: COLORS.cyan, depth: UI + 1, glow: false }));
        items.push(text(this, 1320, y, `${e.seed}  S${e.sector}`, { size: 22, font: 'body', origin: [1, 0.5], color: COLORS.dim, depth: UI + 1, glow: false }));
      });
    } else {
      items.push(text(this, W / 2, 300, 'CONTROLS', { size: 52, color: COLORS.yellow, depth: UI + 1 }));
      CONTROLS_HELP.forEach(([a, b], i) => {
        const y = 370 + i * 36;
        if (!a) items.push(text(this, W / 2, y, b, { size: 26, color: COLORS.orange, depth: UI + 1 }));
        else {
          items.push(text(this, 720, y, a, { size: 22, origin: [0, 0.5], color: COLORS.grey, depth: UI + 1, glow: false }));
          items.push(text(this, 880, y, b, { size: 24, font: 'body', origin: [0, 0.5], depth: UI + 1, glow: false }));
        }
      });
    }
    items.push(text(this, W / 2, 930, 'PRESS FIRE OR CLICK TO RETURN', { size: 22, font: 'body', color: COLORS.dim, depth: UI + 1, glow: false }));
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
    audio.stopMusic(0.3);
    audio.sfx('menuSelect');
    this.cameras.main.fadeOut(450);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { seed: this.seed }));
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.nebula.tilePositionY -= 8 * dt;
    this.starsFar.tilePositionY -= 20 * dt;
    this.starsNear.tilePositionY -= 50 * dt;
    this.flyScroll += 70 * dt;
    if (this.flyScroll > this.station.mapHeight - H - 200) {
      this.flyScroll = 900;
      this.ambient.tIdx = 0;
    }
    this.station.update(this.flyScroll, time, dt);
    this.megaView.update(this.flyScroll, time, dt);
    this.ambient.update(this.flyScroll, time, dt);
    this.ship.x = W * 0.8 + Math.sin(time * 0.0007) * 60;
    this.ship.y = H * 0.62 + Math.sin(time * 0.0013) * 24;
    this.ship.rotation = Math.cos(time * 0.0007) * 0.08;
    this.shipGlow.setPosition(this.ship.x, this.ship.y).setRotation(this.ship.rotation);
    this.logo.update(time);

    this.soundHint.setVisible(!audio.unlocked);
    this.composing.setVisible(audio.isComposing());
    this.composing.setAlpha(0.5 + 0.5 * Math.sin(time * 0.006));

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
      this.hint.setText('UP/DOWN  CHANGE CHARACTER     LEFT/RIGHT  MOVE     A  DONE');
      return;
    }
    this.menu.update(this.controls);
    const cur = this.menu.current;
    if (cur === this.seedItem) {
      this.hint.setText(this.controls.device === 'gamepad' ? 'PRESS A TO EDIT THE SEED' : 'TYPE A SEED  -  ENTER TO START');
    } else if (cur.onLeft) {
      this.hint.setText('LEFT / RIGHT TO ADJUST');
    } else {
      this.hint.setText('');
    }
  }
}
