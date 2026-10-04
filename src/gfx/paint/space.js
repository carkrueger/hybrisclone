// Deep-space backdrop: seamless (vertically tileable) nebula, star layers, planets.
import { W, H } from '../../config.js';
import { RNG } from '../../core/rng.js';
import { newCanvas, addCanvasTexture, rgba, shade, mix, ValueNoise, glowDot } from './canvas.js';

const NEBULA_PALETTES = [
  [0x2a1a6e, 0xb02a7a, 0x1a5aa0],
  [0x0e3a5a, 0x1a8a8a, 0x5a2a90],
  [0x4a1020, 0xc0501a, 0x2a1a5a],
  [0x102a40, 0x3a6ad0, 0x9a3ab0],
  [0x1a3a1a, 0x2a9a6a, 0x1a3a7a],
  [0x3a1a4a, 0xd04a8a, 0xe09a3a],
];

const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 1920x1080 nebula, tileable in y. Painted at half resolution and scaled up. */
export function paintNebula(scene, key, seed) {
  const rng = new RNG(seed);
  const pal = rng.pick(NEBULA_PALETTES);
  const hw = W / 2;
  const hh = H / 2;
  const cell = 90; // px per lattice cell at half res => 6 cells tall
  const n1 = new ValueNoise(rng.nextU32(), 0, hh / cell);
  const n2 = new ValueNoise(rng.nextU32(), 0, hh / cell);
  const n3 = new ValueNoise(rng.nextU32(), 0, (hh / cell) * 2);
  const small = newCanvas(hw, hh);
  const img = small.ctx.createImageData(hw, hh);
  const ox = rng.range(0, 100);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const u = x / cell + ox;
      const v = y / cell;
      const a = n1.fbm(u, v, 5);
      const b = n2.fbm(u * 1.3, v, 4);
      const dust = n3.fbm(u * 2, v * 2, 4);
      const dens = smooth(0.42, 0.82, a) * (0.55 + 0.45 * smooth(0.3, 0.7, dust));
      const col = mix(mix(pal[0], pal[1], smooth(0.35, 0.75, b)), pal[2], smooth(0.55, 0.9, a * b * 1.6));
      const bright = dens * 1.05 + smooth(0.72, 0.95, a) * 0.6;
      const i = (y * hw + x) * 4;
      img.data[i] = 2 + ((col >> 16) & 255) * bright;
      img.data[i + 1] = 3 + ((col >> 8) & 255) * bright;
      img.data[i + 2] = 8 + (col & 255) * bright;
      img.data[i + 3] = 255;
    }
  }
  small.ctx.putImageData(img, 0, 0);
  const { c, ctx } = newCanvas(W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small.c, 0, 0, W, H);
  addCanvasTexture(scene, key, c);
}

export function paintStars(scene, key, seed, count, { bright = 1, big = 0.05 } = {}) {
  const rng = new RNG(seed);
  const { c, ctx } = newCanvas(W, H);
  for (let i = 0; i < count; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    const pick = rng.float();
    const col = pick < 0.15 ? 0xa8c8ff : pick < 0.25 ? 0xffe0b0 : pick < 0.3 ? 0xffb0b0 : 0xffffff;
    const b = bright * rng.range(0.35, 1);
    if (rng.float() < big) {
      ctx.globalCompositeOperation = 'lighter';
      glowDot(ctx, x, y, rng.range(5, 10), col, b);
      if (rng.float() < 0.4) {
        ctx.fillStyle = rgba(col, b * 0.5);
        ctx.fillRect(x - 9, y - 0.5, 18, 1);
        ctx.fillRect(x - 0.5, y - 9, 1, 18);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = rgba(col, b);
      const s = rng.range(1, 2.2);
      ctx.beginPath();
      ctx.arc(x, y, s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  addCanvasTexture(scene, key, c);
}

const PLANET_KINDS = [
  { a: 0xd8a070, b: 0x8a4a2a, atm: 0xffc080, ring: true, bands: true },
  { a: 0x6aa8e0, b: 0x1a3a7a, atm: 0x80c8ff, ring: false, bands: false },
  { a: 0xb0b8c0, b: 0x4a4a56, atm: 0xc0d0ff, ring: false, bands: false },
  { a: 0xc070d0, b: 0x3a1a6a, atm: 0xff90ff, ring: true, bands: true },
  { a: 0x80d090, b: 0x1a4a3a, atm: 0xa0ffc0, ring: false, bands: true },
  { a: 0xe06040, b: 0x501810, atm: 0xff9060, ring: true, bands: false },
];

export function paintPlanet(scene, key, seed) {
  const rng = new RNG(seed);
  const kind = rng.pick(PLANET_KINDS);
  const R = rng.int(110, 190);
  const size = R * 3.2;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const tilt = rng.range(-0.5, 0.5);

  const drawRing = (front) => {
    if (!kind.ring) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.beginPath();
    if (front) ctx.rect(-size, 0, size * 2, size);
    else ctx.rect(-size, -size, size * 2, size);
    ctx.clip();
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, R * (1.35 + k * 0.1), R * (0.28 + k * 0.02), 0, 0, Math.PI * 2);
      ctx.lineWidth = rng.range(3, 9);
      ctx.strokeStyle = rgba(shade(kind.a, rng.range(-0.3, 0.3)), rng.range(0.25, 0.55));
      ctx.stroke();
    }
    ctx.restore();
  };

  drawRing(false);
  // atmosphere halo
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
  halo.addColorStop(0, rgba(kind.atm, 0.45));
  halo.addColorStop(1, rgba(kind.atm, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';

  // surface
  const sphere = newCanvas(R * 2, R * 2);
  const img = sphere.ctx.createImageData(R * 2, R * 2);
  const n = new ValueNoise(rng.nextU32());
  const lx = -0.55;
  const ly = -0.6;
  const lz = 0.58;
  for (let y = 0; y < R * 2; y++) {
    for (let x = 0; x < R * 2; x++) {
      const dx = (x - R) / R;
      const dy = (y - R) / R;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const dz = Math.sqrt(1 - d2);
      const u = Math.atan2(dx, dz) * 2.2;
      const v = dy * 3;
      const t = kind.bands ? n.fbm(u * 0.6, v * 3.2 + n.noise(u, v) * 0.8, 4) : n.fbm(u * 1.4, v * 1.4, 5);
      const col = mix(kind.b, kind.a, t);
      const lambert = Math.max(0, dx * lx + dy * ly + dz * lz);
      const l = 0.08 + lambert * 1.05;
      const i = (y * R * 2 + x) * 4;
      img.data[i] = Math.min(255, ((col >> 16) & 255) * l);
      img.data[i + 1] = Math.min(255, ((col >> 8) & 255) * l);
      img.data[i + 2] = Math.min(255, (col & 255) * l);
      img.data[i + 3] = d2 > 0.985 ? 255 * (1 - (d2 - 0.985) / 0.015) : 255;
    }
  }
  sphere.ctx.putImageData(img, 0, 0);
  ctx.drawImage(sphere.c, cx - R, cy - R);
  // rim light
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const rim = ctx.createRadialGradient(cx + R * 0.25, cy + R * 0.3, R * 0.7, cx, cy, R * 1.02);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.85, rgba(kind.atm, 0));
  rim.addColorStop(1, rgba(kind.atm, 0.55));
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  drawRing(true);
  addCanvasTexture(scene, key, c);
}
