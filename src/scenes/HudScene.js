import Phaser from 'phaser';
import { W, H } from '../config.js';
import { text, setColor, pad, COLORS } from '../ui/text.js';
import { LADDER, MAX_POWER } from '../entities/weapons.js';
import { addScanlines } from '../gfx/post.js';

const SEG_W = 34;
const SEG_GAP = 6;

export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.gameScene = this.scene.get('Game');
    const g = this.add.graphics();
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0.75, 0, 0);
    g.fillRect(0, 0, W, 90);
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.75, 0.75);
    g.fillRect(0, H - 96, W, 96);

    text(this, 40, 26, 'SCORE', { size: 18, font: 'body', color: COLORS.dim, origin: [0, 0.5], glow: false });
    this.scoreT = text(this, 40, 56, '', { size: 38, origin: [0, 0.5], color: COLORS.white });
    text(this, W - 40, 26, 'HI-SCORE', { size: 18, font: 'body', color: COLORS.dim, origin: [1, 0.5], glow: false });
    this.hiT = text(this, W - 40, 56, '', { size: 38, origin: [1, 0.5], color: COLORS.yellow });
    this.sectorT = text(this, W / 2, 30, '', { size: 30, color: COLORS.cyan });
    this.seedT = text(this, W / 2, 60, '', { size: 18, font: 'body', color: COLORS.grey, glow: false });

    this.lifeIcons = [];
    this.bombIcons = [];
    for (let i = 0; i < 8; i++) this.lifeIcons.push(this.add.image(54 + i * 46, H - 46, 'player').setScale(0.34));
    for (let i = 0; i < 5; i++) this.bombIcons.push(this.add.image(54 + i * 40, H - 46, 'icon_bomb').setScale(1.1));
    this.livesMore = text(this, 0, H - 46, '', { size: 22, origin: [0, 0.5], color: COLORS.cyan });

    const meterW = (MAX_POWER + 1) * (SEG_W + SEG_GAP);
    this.meterX = W / 2 - meterW / 2;
    text(this, this.meterX - 20, H - 52, 'POWER', { size: 20, origin: [1, 0.5], color: COLORS.green });
    this.segs = [];
    for (let i = 0; i <= MAX_POWER; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x40e0ff),
        Phaser.Display.Color.ValueToColor(0xffe040),
        MAX_POWER,
        i
      );
      const c = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      const r = this.add.rectangle(this.meterX + i * (SEG_W + SEG_GAP) + SEG_W / 2, H - 52, SEG_W, 18, c).setStrokeStyle(2, 0x05060c);
      r.onColor = c;
      this.segs.push(r);
    }
    this.weaponT = text(this, W / 2, H - 22, '', { size: 16, font: 'body', color: COLORS.grey, glow: false });
    this.deviceT = text(this, W - 40, H - 46, '', { size: 18, font: 'body', color: COLORS.dim, origin: [1, 0.5], glow: false });

    this.bossName = text(this, W / 2, 112, '', { size: 24, color: COLORS.red }).setVisible(false);
    this.bossBarBg = this.add.rectangle(W / 2, 140, 640, 16, 0x000000, 0.7).setStrokeStyle(2, 0xff4a4a, 0.8).setVisible(false);
    this.bossBar = this.add.rectangle(W / 2 - 316, 140, 632, 10, 0xff4a4a).setOrigin(0, 0.5).setVisible(false);
    addScanlines(this);
    this.last = {};
  }

  update(time) {
    const s = this.gameScene && this.gameScene.hudState;
    if (!s) return;
    const changed = (key, value) => {
      if (this.last[key] === value) return false;
      this.last[key] = value;
      return true;
    };
    if (changed('score', s.score)) this.scoreT.setText(pad(s.score));
    if (changed('hi', s.hi)) this.hiT.setText(pad(s.hi));
    if (changed('sector', s.sector)) this.sectorT.setText(`SECTOR ${s.sector}`);
    if (changed('seed', s.seed)) this.seedT.setText(`SEED  ${s.seed}`);
    if (changed('lives', s.lives) || changed('bombs', s.bombs)) {
      const lives = Math.max(0, s.lives);
      this.lifeIcons.forEach((ic, i) => ic.setVisible(i < Math.min(lives, 5)));
      this.livesMore.setText(lives > 5 ? `+${lives - 5}` : '').setX(54 + 5 * 46 - 18);
      const bx = lives > 5 ? this.livesMore.x + this.livesMore.width + 10 : 54 + Math.min(lives, 5) * 46 + 24;
      this.bombIcons.forEach((ic, i) => ic.setVisible(i < s.bombs).setX(bx + i * 40));
    }
    if (changed('power', s.power)) {
      this.segs.forEach((r, i) => {
        r.setFillStyle(i <= s.power ? r.onColor : 0x1a2030, i <= s.power ? 1 : 0.7);
      });
      const w = LADDER[s.power];
      const parts = [`MAIN ${w.main}`];
      if (w.side) parts.push(`SIDE ${w.side}`);
      if (w.rear) parts.push('REAR');
      if (w.homing) parts.push(`HOMING ${w.homing}`);
      this.weaponT.setText(parts.join('   '));
    }
    if (changed('device', s.device)) this.deviceT.setText({ keyboard: 'KEYBOARD', mouse: 'MOUSE', gamepad: 'GAMEPAD' }[s.device] || '');
    // the top segment shimmers when maxed out
    if (s.power === MAX_POWER) this.segs[MAX_POWER].setAlpha(0.6 + 0.4 * Math.sin(time * 0.01));

    const showBoss = s.boss >= 0;
    this.bossBar.setVisible(showBoss);
    this.bossBarBg.setVisible(showBoss);
    this.bossName.setVisible(showBoss);
    if (showBoss) {
      this.bossBar.setSize(Math.max(1, Math.round(632 * s.boss)), 10);
      if (changed('bossName', s.bossName)) setColor(this.bossName.setText(s.bossName), COLORS.red);
    }
  }
}
