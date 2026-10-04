import Phaser from 'phaser';
import { W, H } from '../config.js';
import { text, pad, COLORS } from '../ui/text.js';
import { MAX_POWER } from '../entities/weapons.js';

export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.gameScene = this.scene.get('Game');
    this.add.rectangle(0, 0, W, 12, 0x000000, 0.45).setOrigin(0);
    this.add.rectangle(0, H - 13, W, 13, 0x000000, 0.45).setOrigin(0);
    this.scoreT = text(this, 4, 3, '', { origin: [0, 0] });
    this.hiT = text(this, W - 4, 3, '', { origin: [1, 0], tint: COLORS.yellow });
    this.livesT = text(this, 4, H - 10, '', { origin: [0, 0], tint: COLORS.cyan });
    this.bombsT = text(this, 34, H - 10, '', { origin: [0, 0], tint: COLORS.red });
    this.powerT = text(this, 66, H - 10, '', { origin: [0, 0], tint: COLORS.green });
    this.seedT = text(this, W - 4, H - 10, '', { origin: [1, 0], tint: COLORS.grey });
    this.bossBarBg = this.add.rectangle(W / 2, 17, 102, 5, 0x000000, 0.7).setVisible(false);
    this.bossBar = this.add.rectangle(W / 2 - 50, 17, 100, 3, 0xff4040).setOrigin(0, 0.5).setVisible(false);
    this.last = {};
  }

  update() {
    const s = this.gameScene && this.gameScene.hudState;
    if (!s) return;
    const set = (key, value, obj) => {
      if (this.last[key] !== value) {
        this.last[key] = value;
        obj.setText(value);
      }
    };
    set('score', '1UP ' + pad(s.score), this.scoreT);
    set('hi', 'HI ' + pad(s.hi), this.hiT);
    set('lives', '{' + Math.max(0, s.lives), this.livesT);
    set('bombs', '}' + s.bombs, this.bombsT);
    set('power', 'PWR ' + '|'.repeat(s.power + 1) + '.'.repeat(MAX_POWER - s.power), this.powerT);
    set('seed', `${s.seed} S${s.sector}`, this.seedT);
    const showBoss = s.boss >= 0;
    this.bossBar.setVisible(showBoss);
    this.bossBarBg.setVisible(showBoss);
    if (showBoss) this.bossBar.setSize(Math.max(1, Math.round(100 * s.boss)), 3);
  }
}
