import Phaser from 'phaser';
import { W, H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { audio } from './audio/index.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#05060c',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    gamepad: true,
  },
  audio: {
    noAudio: true, // all sound is synthesized by our own WebAudio chip
  },
  scene: [BootScene, TitleScene, GameScene, HudScene, PauseScene, GameOverScene],
});

// handy for debugging from the console
window.__game = game;
window.__audio = audio;
