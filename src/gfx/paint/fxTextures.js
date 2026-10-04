// Glowing projectiles and explosion sprites.
import { newCanvas, addCanvasTexture, rgba, shade, glowDot, ValueNoise, roundRect } from './canvas.js';

function capsule(scene, key, w, h, color, core = 0xffffff, horizontal = false) {
  const pad = 14;
  const cw = (horizontal ? h : w) + pad * 2;
  const ch = (horizontal ? w : h) + pad * 2;
  const { c, ctx } = newCanvas(cw, ch);
  const bw = horizontal ? h : w;
  const bh = horizontal ? w : h;
  ctx.shadowColor = rgba(color, 1);
  ctx.shadowBlur = 16;
  roundRect(ctx, pad, pad, bw, bh, Math.min(bw, bh) / 2);
  ctx.fillStyle = rgba(color, 0.95);
  ctx.fill();
  ctx.shadowBlur = 0;
  const inset = Math.min(bw, bh) * 0.28;
  roundRect(ctx, pad + inset, pad + inset, bw - inset * 2, bh - inset * 2, Math.min(bw, bh) / 2 - inset);
  ctx.fillStyle = rgba(core, 1);
  ctx.fill();
  addCanvasTexture(scene, key, c);
}

function orb(scene, key, r, color) {
  const size = r * 4;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cx, size / 2, color, 0.75);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(cx - r * 0.25, cx - r * 0.25, 0, cx, cx, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, rgba(shade(color, 0.6)));
  g.addColorStop(1, rgba(color));
  ctx.beginPath();
  ctx.arc(cx, cx, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  addCanvasTexture(scene, key, c);
}

function missile(scene) {
  const { c, ctx } = newCanvas(26, 52);
  const cx = 13;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, 42, 12, 0xff9030, 0.9);
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(cx, 4);
  ctx.lineTo(cx + 4, 12);
  ctx.lineTo(cx + 4, 34);
  ctx.lineTo(cx + 8, 40);
  ctx.lineTo(cx - 8, 40);
  ctx.lineTo(cx - 4, 34);
  ctx.lineTo(cx - 4, 12);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
  g.addColorStop(0, '#8090a8');
  g.addColorStop(0.5, '#f0f4ff');
  g.addColorStop(1, '#505a70');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#d83030';
  ctx.fillRect(cx - 4, 10, 8, 4);
  addCanvasTexture(scene, 'pb_missile', c);
}

function softTex(scene, key, size, stops) {
  const { c, ctx } = newCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col, a] of stops) g.addColorStop(t, rgba(col, a));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  addCanvasTexture(scene, key, c);
}

function noisyPuff(scene, key, size, seed, inner, outer, alphaScale = 1) {
  const { c, ctx } = newCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const n = new ValueNoise(seed);
  const r0 = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - r0) / r0;
      const dy = (y - r0) / r0;
      const d = Math.sqrt(dx * dx + dy * dy);
      const nv = n.fbm(x / 9, y / 9, 4);
      const f = Math.max(0, 1 - d * (0.75 + nv * 0.6));
      if (f <= 0) continue;
      const t = Math.min(1, f * 1.6);
      const r = ((inner >> 16) & 255) * t + ((outer >> 16) & 255) * (1 - t);
      const g = ((inner >> 8) & 255) * t + ((outer >> 8) & 255) * (1 - t);
      const b = (inner & 255) * t + (outer & 255) * (1 - t);
      const i = (y * size + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = Math.min(255, f * f * 255 * 1.8 * alphaScale);
    }
  }
  ctx.putImageData(img, 0, 0);
  addCanvasTexture(scene, key, c);
}

function ring(scene) {
  const size = 160;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  const g = ctx.createRadialGradient(cx, cx, cx * 0.55, cx, cx, cx);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,230,190,0.15)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.9, 'rgba(255,200,140,0.4)');
  g.addColorStop(1, 'rgba(255,160,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  addCanvasTexture(scene, 'ring', c);
}

function flare(scene) {
  const size = 256;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cx, cx * 0.6, 0xffd0a0, 0.8);
  for (const [w, h, a] of [[size, 6, 0.9], [8, size * 0.6, 0.6]]) {
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, Math.max(w, h) / 2);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(cx, cx);
    ctx.scale(w / Math.max(w, h), h / Math.max(w, h));
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(w, h) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  addCanvasTexture(scene, 'flare', c);
}

function debris(scene) {
  const shapes = [
    [[0, 0], [12, 2], [10, 9], [2, 7]],
    [[0, 3], [7, 0], [14, 5], [6, 10]],
    [[2, 0], [9, 1], [8, 12], [0, 8]],
  ];
  shapes.forEach((pts, i) => {
    const { c, ctx } = newCanvas(18, 16);
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x + 2, y + 2) : ctx.moveTo(x + 2, y + 2)));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 16, 14);
    g.addColorStop(0, '#d0d8e8');
    g.addColorStop(1, '#3a4054');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#ff9040';
    ctx.lineWidth = 1;
    ctx.stroke();
    addCanvasTexture(scene, 'debris' + i, c);
  });
}


/** exhaust plume, hot end at the top, fading downwards (origin should be 0.5, 0) */
function plume(scene, key, w, h, core, mid, outer) {
  const { c, ctx } = newCanvas(w, h);
  const cx = w / 2;
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const hw = (w / 2) * (1 - t * 0.85) * (0.6 + 0.4 * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5));
    const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
    const a = Math.pow(1 - t, 1.6);
    const col = t < 0.25 ? core : t < 0.6 ? mid : outer;
    g.addColorStop(0, rgba(outer, 0));
    g.addColorStop(0.5, rgba(col, a));
    g.addColorStop(1, rgba(outer, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - hw, y, hw * 2, 1);
  }
  addCanvasTexture(scene, key, c);
}

function godray(scene) {
  const w = 256;
  const h = 1024;
  const { c, ctx } = newCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const hw = (w / 2) * (0.25 + 0.75 * t);
    const a = Math.pow(1 - t, 1.3) * Math.min(1, t * 8);
    const g = ctx.createLinearGradient(w / 2 - hw, 0, w / 2 + hw, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, rgba(0xffffff, a));
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(w / 2 - hw, y, hw * 2, 1);
  }
  addCanvasTexture(scene, 'godray', c);
}

function flareShapes(scene) {
  const ring = newCanvas(128, 128);
  const g = ring.ctx.createRadialGradient(64, 64, 40, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ring.ctx.fillStyle = g;
  ring.ctx.fillRect(0, 0, 128, 128);
  addCanvasTexture(scene, 'flare_ring', ring.c);
  const hex = newCanvas(96, 96);
  const h = hex.ctx;
  h.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    h[k ? 'lineTo' : 'moveTo'](48 + Math.cos(a) * 44, 48 + Math.sin(a) * 44);
  }
  h.closePath();
  const hg = h.createRadialGradient(48, 48, 4, 48, 48, 46);
  hg.addColorStop(0, 'rgba(255,255,255,0.35)');
  hg.addColorStop(1, 'rgba(255,255,255,0.08)');
  h.fillStyle = hg;
  h.fill();
  addCanvasTexture(scene, 'flare_hex', hex.c);
}

export function paintFx(scene) {
  capsule(scene, 'pb_main', 10, 40, 0xffb020, 0xffffe0);
  plume(scene, 'plume', 48, 220, 0xffffff, 0x9ad0ff, 0x3a70ff);
  plume(scene, 'flame_blue', 26, 80, 0xffffff, 0x80d8ff, 0x2a60ff);
  plume(scene, 'flame_orange', 26, 80, 0xffffe0, 0xffb040, 0xff3010);
  capsule(scene, 'pb_spread', 9, 28, 0x30d8ff, 0xe8ffff);
  capsule(scene, 'pb_side', 9, 34, 0x5a8cff, 0xe0ecff, true);
  missile(scene);
  orb(scene, 'eb_orb', 8, 0xff40b0);
  orb(scene, 'eb_big', 11, 0xff8a20);
  softTex(scene, 'glow', 128, [[0, 0xffffff, 1], [0.25, 0xffffff, 0.55], [0.6, 0xffffff, 0.15], [1, 0xffffff, 0]]);
  softTex(scene, 'spark', 16, [[0, 0xffffff, 1], [0.4, 0xffffff, 0.8], [1, 0xffffff, 0]]);
  noisyPuff(scene, 'fire0', 96, 11, 0xfff4c0, 0xff4010);
  noisyPuff(scene, 'fire1', 96, 23, 0xffe090, 0xd02008);
  noisyPuff(scene, 'smoke', 96, 37, 0x9a9aa8, 0x2a2a34, 0.7);
  ring(scene);
  flare(scene);
  godray(scene);
  flareShapes(scene);
  debris(scene);
  const px = newCanvas(4, 4);
  px.ctx.fillStyle = '#fff';
  px.ctx.fillRect(0, 0, 4, 4);
  addCanvasTexture(scene, 'px', px.c);

  const bomb = newCanvas(34, 34);
  bomb.ctx.globalCompositeOperation = 'lighter';
  glowDot(bomb.ctx, 17, 17, 17, 0xff4040, 0.6);
  bomb.ctx.globalCompositeOperation = 'source-over';
  bomb.ctx.beginPath();
  bomb.ctx.arc(17, 19, 9, 0, Math.PI * 2);
  bomb.ctx.fillStyle = '#e83a3a';
  bomb.ctx.fill();
  bomb.ctx.fillStyle = '#fff';
  bomb.ctx.fillRect(15, 6, 4, 6);
  addCanvasTexture(scene, 'icon_bomb', bomb.c);
}
