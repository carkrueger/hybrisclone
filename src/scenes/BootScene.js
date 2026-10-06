import Phaser from 'phaser';
import { W, H, FONT } from '../config.js';
import { makeAllTextures } from '../gfx/index.js';
import { audio } from '../audio/index.js';

/**
 * Phaser 4's WebGL ADD is (ONE, DST_ALPHA) for colour and alpha, so every
 * additive sprite squares the framebuffer alpha under its whole quad. Over
 * anything not fully opaque that shows up as a dark rectangle (e.g. behind
 * the player's glow/rim/flame sprites). Make ADD a plain additive blend.
 */
function fixAddBlend(renderer) {
  const gl = renderer && renderer.gl;
  if (!gl) return;
  renderer.blendModes[Phaser.BlendModes.ADD].func = [gl.ONE, gl.ONE, gl.ONE, gl.ONE];
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    fixAddBlend(this.sys.renderer);
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
