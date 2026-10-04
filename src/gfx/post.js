// Camera post-processing: bloom + vignette (quality dependent) and an optional CRT look.
import Phaser from 'phaser';
import { settings } from '../core/settings.js';

export function applyPost(scene, camera, preset) {
  const out = {};
  try {
    if (preset.bloom) {
      [out.bloom] = Phaser.Actions.AddEffectBloom(camera, {
        threshold: 0.8,
        blurRadius: 1.6,
        blurSteps: 3,
        blurQuality: 1,
        blendAmount: 0.5,
      });
    }
    if (preset.vignette) out.vignette = camera.filters.external.addVignette(0.5, 0.5, 1.05, 0.4);
    if (settings.crt) out.barrel = camera.filters.external.addBarrel(1.035);
  } catch (err) {
    // filters need WebGL; the game still runs without them
    console.warn('post-processing unavailable', err);
  }
  return out;
}

/** Scanline overlay used by the HUD scene when the CRT option is on. */
export function addScanlines(scene, depth = 1000) {
  if (!settings.crt) return null;
  const key = 'scanlines';
  if (!scene.textures.exists(key)) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 4;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 2, 4, 2);
    scene.textures.addCanvas(key, c);
  }
  const { width, height } = scene.scale;
  return scene.add.tileSprite(0, 0, width, height, key).setOrigin(0).setDepth(depth).setAlpha(0.9);
}
