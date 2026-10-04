// Small painted assets for ambient life: background traffic, maintenance drones, space dust.
import { W, H } from '../../config.js';
import { RNG } from '../../core/rng.js';
import { newCanvas, addCanvasTexture, rgba, mirroredPath, paintMaterial, glowDot, glass } from './canvas.js';

function craft(scene, key, w, h, pts, base, cockpit) {
  const { c, ctx } = newCanvas(w, h);
  const cx = w / 2;
  const cy = h / 2;
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, cy), { x0: 0, y0: 0, x1: w, y1: h }, { base, sheen: true }, { rim: 2, outline: 1.5 });
  if (cockpit) glass(ctx, cx, cy - h * 0.18, 2.5, 4, 0x80d0ff);
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy + h / 2 - 3, 5, 0x80c0ff, 0.9);
  addCanvasTexture(scene, key, c);
}

export function paintAmbient(scene) {
  // traffic craft point "up" (rotated at runtime to their heading)
  craft(scene, 'traffic_shuttle', 26, 36, [[0, -17], [5, -10], [7, 6], [12, 12], [10, 16], [0, 14]], 0xc0c8d8, true);
  craft(scene, 'traffic_patrol', 30, 30, [[0, -14], [3, -6], [13, 6], [12, 12], [4, 8], [0, 12]], 0x7a8aa8, true);
  craft(scene, 'traffic_freighter', 34, 74, [[0, -36], [8, -30], [12, -10], [14, 24], [10, 34], [0, 35]], 0xa08a6a, false);

  // maintenance drone
  const d = newCanvas(28, 28);
  const x = d.ctx;
  x.beginPath();
  x.arc(14, 14, 11, 0, Math.PI * 2);
  x.strokeStyle = 'rgba(200,210,230,0.6)';
  x.lineWidth = 2;
  x.stroke();
  paintMaterial(x, () => {
    x.beginPath();
    x.arc(14, 14, 6, 0, Math.PI * 2);
  }, { x0: 8, y0: 8, x1: 20, y1: 20 }, { base: 0xe0b030, sheen: true }, { rim: 1.5, outline: 1.5 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    x.beginPath();
    x.arc(14 + Math.cos(a) * 10, 14 + Math.sin(a) * 10, 3, 0, Math.PI * 2);
    x.fillStyle = 'rgba(40,46,60,0.9)';
    x.fill();
  }
  addCanvasTexture(scene, 'mdrone', d.c);

  // dust layers (tileable)
  for (const [key, count, rMax, alpha] of [
    ['dust_far', 260, 1.6, 0.35],
    ['dust_near', 70, 3.5, 0.5],
  ]) {
    const rng = new RNG(key.length * 31);
    const { c, ctx } = newCanvas(W, H);
    for (let i = 0; i < count; i++) {
      const px = rng.range(0, W);
      const py = rng.range(0, H);
      const r = rng.range(0.6, rMax);
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.5);
      g.addColorStop(0, rgba(0xd8e4ff, alpha * rng.range(0.4, 1)));
      g.addColorStop(1, rgba(0xd8e4ff, 0));
      ctx.fillStyle = g;
      ctx.fillRect(px - r * 3, py - r * 3, r * 6, r * 6);
    }
    addCanvasTexture(scene, key, c);
  }
}
