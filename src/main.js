import Phaser from 'phaser';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';
import '@fontsource/exo-2/latin-500.css';
import '@fontsource/exo-2/latin-700.css';
import { W, H } from './config.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { audio } from './audio/index.js';

async function loadFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 32px Orbitron'),
      document.fonts.load('900 32px Orbitron'),
      document.fonts.load('500 32px "Exo 2"'),
      document.fonts.load('700 32px "Exo 2"'),
    ]);
  } catch {
    // fall back to system fonts
  }
}

loadFonts().then(() => {
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#020308',
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      gamepad: true,
    },
    audio: {
      noAudio: true, // all sound is synthesized by our own WebAudio engine
    },
    scene: [BootScene, TitleScene, GameScene, HudScene, PauseScene, GameOverScene],
  });

  // handy for debugging from the console
  window.__game = game;
  window.__audio = audio;
});
