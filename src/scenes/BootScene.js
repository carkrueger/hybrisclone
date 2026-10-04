import Phaser from 'phaser';
import { W, H, FONT } from '../config.js';
import { makeAllTextures } from '../gfx/index.js';
import { audio } from '../audio/index.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.add
      .text(W / 2, H / 2, 'BUILDING STATION...', { fontFamily: FONT.display, fontSize: '40px', color: '#5ae4ff', fontStyle: '700' })
      .setOrigin(0.5);
    // let the loading text render once before the heavy texture painting
    this.time.delayedCall(30, () => {
      makeAllTextures(this);
      audio.installUnlock();
      audio.prepareTitle();
      this.scene.start('Title');
    });
  }
}
