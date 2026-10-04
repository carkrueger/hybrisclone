// Painted boss hull built from the seeded profile in level/bossgen.js.
import { BOSS_SCALE } from '../../config.js';
import { newCanvas, addCanvasTexture, rgba, shade, mirroredPath, paintMaterial, panelLine, rivet, glowDot, ValueNoise, roundRect } from './canvas.js';
import { makeRim } from './ships.js';

export const BOSS_PAD = 16;

function outline(profile, h, S, scale = 1, y0 = 0, y1 = h) {
  const pts = [[0, y0 * S]];
  for (let y = y0; y < y1; y += 2) pts.push([profile[y] * S * scale, y * S]);
  pts.push([profile[y1 - 1] * S * scale * 0.7, (y1 - 1) * S]);
  pts.push([0, (y1 - 1) * S + 4]);
  return pts;
}

export function paintBossHull(scene, key, hull, rng) {
  const S = BOSS_SCALE;
  const { w, h, profile, colors } = hull;
  const cw = Math.ceil(w * S + BOSS_PAD * 2);
  const ch = Math.ceil(h * S + BOSS_PAD * 2);
  const { c, ctx } = newCanvas(cw, ch);
  const cx = cw / 2;
  const top = BOSS_PAD;
  const halfW = (w * S) / 2;
  const noise = new ValueNoise(rng.nextU32());

  // engines glow out of the top edge (the boss faces down)
  ctx.globalCompositeOperation = 'lighter';
  const engines = rng.int(2, 4);
  for (let i = 0; i < engines; i++) {
    const ex = ((i + 0.5) / engines - 0.5) * profile[2] * S * 1.4;
    glowDot(ctx, cx + ex, top + 6, 26, colors.glow, 0.7);
  }
  ctx.globalCompositeOperation = 'source-over';

  const outer = outline(profile, h, S);
  const outerPath = () => mirroredPath(ctx, outer, cx, top);
  const grime = () => {
    const img = ctx.getImageData(0, 0, cw, ch);
    for (let y = 0; y < ch; y += 2) {
      for (let x = 0; x < cw; x += 2) {
        const n = noise.fbm(x / 26, y / 26, 3) - 0.5;
        const i = (y * cw + x) * 4;
        if (img.data[i + 3] === 0) continue;
        for (const o of [0, 4, cw * 4, cw * 4 + 4]) {
          const k = i + o;
          if (k + 2 >= img.data.length) continue;
          img.data[k] = Math.max(0, Math.min(255, img.data[k] * (1 + n * 0.35)));
          img.data[k + 1] = Math.max(0, Math.min(255, img.data[k + 1] * (1 + n * 0.35)));
          img.data[k + 2] = Math.max(0, Math.min(255, img.data[k + 2] * (1 + n * 0.35)));
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  paintMaterial(ctx, outerPath, { x0: cx - halfW, y0: top, x1: cx + halfW, y1: top + h * S }, { base: colors.base, sheen: true }, { rim: 6, outline: 3 });
  grime();

  // inner armour plate
  const y0 = Math.floor(h * 0.12);
  const y1 = Math.floor(h * 0.88);
  const inner = outline(profile, h, S, 0.7, y0, y1);
  paintMaterial(ctx, () => mirroredPath(ctx, inner, cx, top), { x0: cx - halfW * 0.7, y0: top + y0 * S, x1: cx + halfW * 0.7, y1: top + y1 * S }, { base: colors.mid, sheen: true }, { rim: 5, outline: 2 });

  // central spine
  const spineW = 7 * S;
  const sg = ctx.createLinearGradient(cx - spineW, 0, cx + spineW, 0);
  sg.addColorStop(0, rgba(shade(colors.dark, 0.2)));
  sg.addColorStop(0.5, rgba(shade(colors.light, 0.1)));
  sg.addColorStop(1, rgba(shade(colors.dark, -0.4)));
  ctx.fillStyle = sg;
  ctx.fillRect(cx - spineW / 2, top + h * S * 0.05, spineW, h * S * 0.9);
  ctx.strokeStyle = 'rgba(5,6,12,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - spineW / 2, top + h * S * 0.05, spineW, h * S * 0.9);

  // horizontal seams across the hull
  for (let y = rng.int(5, 9); y < h - 4; y += rng.int(6, 11)) {
    const half = profile[y] * S * 0.94;
    panelLine(ctx, cx - half, top + y * S, cx - spineW / 2, top + y * S, 0.5);
    panelLine(ctx, cx + spineW / 2, top + y * S, cx + half, top + y * S, 0.5);
  }

  // symmetric greebles, vents and lights
  const decoCount = rng.int(5, 10);
  for (let i = 0; i < decoCount; i++) {
    const dy = rng.int(4, h - 8);
    const maxX = profile[dy] - 6;
    if (maxX < 8) continue;
    const dx = rng.int(6, maxX);
    const kind = rng.int(0, 3);
    const bw = rng.int(4, 9) * S;
    const bh = rng.int(3, 6) * S;
    for (const sx of [-1, 1]) {
      const x = cx + sx * dx * S;
      const y = top + dy * S;
      if (kind === 0) {
        ctx.fillStyle = 'rgba(5,6,12,0.85)';
        ctx.fillRect(x - bw / 2, y, bw, bh);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = rgba(colors.glow, 0.9);
          ctx.fillRect(x - bw / 2 + 3, y + 3 + k * (bh / 3), bw - 6, Math.max(2, bh / 6));
        }
        ctx.globalCompositeOperation = 'lighter';
        glowDot(ctx, x, y + bh / 2, bw * 0.9, colors.glow, 0.5);
        ctx.globalCompositeOperation = 'source-over';
      } else if (kind === 1) {
        paintMaterial(
          ctx,
          () => {
            ctx.beginPath();
            ctx.rect(x - bw / 2, y, bw, bh);
          },
          { x0: x - bw / 2, y0: y, x1: x + bw / 2, y1: y + bh },
          { base: colors.light },
          { rim: 2, outline: 2 }
        );
      } else if (kind === 2) {
        for (let k = 0; k < 4; k++) panelLine(ctx, x - bw / 2, y + k * 5, x + bw / 2, y + k * 5, 0.6);
      } else {
        rivet(ctx, x, y, 3);
        rivet(ctx, x + 10, y, 3);
        rivet(ctx, x, y + 10, 3);
      }
    }
  }
  // rivets along the armour edge
  for (let y = y0 + 2; y < y1 - 2; y += 4) {
    const half = profile[y] * S * 0.7 - 7;
    if (half < 12) continue;
    rivet(ctx, cx - half, top + y * S, 2);
    rivet(ctx, cx + half, top + y * S, 2);
  }

  // running lights at the widest point
  let widest = 0;
  for (let y = 0; y < h; y++) if (profile[y] > profile[widest]) widest = y;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx - profile[widest] * S + 6, top + widest * S, 14, 0xff4040, 0.9);
  glowDot(ctx, cx + profile[widest] * S - 6, top + widest * S, 14, 0x40ff70, 0.9);
  ctx.globalCompositeOperation = 'source-over';

  makeRim(scene, key, c, -1, -1, 5);
  addCanvasTexture(scene, key, c);
  return { width: cw, height: ch, top };
}

/** one sliding armour plate (right-hand side; flipX for the left one) */
export function paintBossPlate(scene, key, w, h, colors) {
  const { c, ctx } = newCanvas(w + 8, h + 8);
  const path = () => roundRect(ctx, 4, 4, w, h, 6);
  paintMaterial(ctx, path, { x0: 4, y0: 4, x1: w + 4, y1: h + 4 }, { base: colors.light, sheen: true }, { rim: 4, outline: 3 });
  ctx.save();
  ctx.beginPath();
  ctx.rect(4, 4, 12, h);
  ctx.clip();
  for (let k = -2; k < h / 8 + 2; k++) {
    ctx.fillStyle = k % 2 ? '#1a1a1a' : '#e0b020';
    ctx.beginPath();
    ctx.moveTo(4, 4 + k * 8);
    ctx.lineTo(16, 4 + k * 8 + 8);
    ctx.lineTo(16, 4 + k * 8 + 16);
    ctx.lineTo(4, 4 + k * 8 + 8);
    ctx.fill();
  }
  ctx.restore();
  for (let y = 14; y < h - 4; y += 16) {
    rivet(ctx, w - 6, y, 2);
    panelLine(ctx, 22, y + 6, w - 12, y + 6, 0.4);
  }
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, w - 10, 12, 6, colors.glow, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  makeRim(scene, key, c);
  addCanvasTexture(scene, key, c);
}
