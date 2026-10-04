import Phaser from 'phaser';
import { makeAllTextures } from '../gfx/textures.js';
import { audio } from '../audio/index.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    makeAllTextures(this);
    audio.installUnlock();
    this.scene.start('Title');
  }
}
