// Shared procedural-painting helpers (canvas 2D).
import { RNG } from '../../core/rng.js';

export function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  return { c, ctx };
}

export function addCanvasTexture(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return key;
}

export const rgba = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

/** f in [-1,1]: negative darkens toward black, positive lightens toward white */
export function shade(c, f) {
  let r = (c >> 16) & 255;
  let g = (c >> 8) & 255;
  let b = c & 255;
  if (f >= 0) {
    r += (255 - r) * f;
    g += (255 - g) * f;
    b += (255 - b) * f;
  } else {
    r *= 1 + f;
    g *= 1 + f;
    b *= 1 + f;
  }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

// ---------------------------------------------------------------- noise
export class ValueNoise {
  /** periodX/periodY (in lattice cells) make the noise tile seamlessly */
  constructor(seed, periodX = 0, periodY = 0) {
    const rng = new RNG(seed);
    this.perm = new Uint16Array(512);
    this.vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      this.perm[i] = i;
      this.vals[i] = rng.float();
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.float() * (i + 1));
      [this.perm[i], this.perm[j]] = [this.perm[j], this.perm[i]];
    }
    for (let i = 0; i < 256; i++) this.perm[i + 256] = this.perm[i];
    this.px = periodX;
    this.py = periodY;
  }

  lattice(ix, iy) {
    if (this.px) ix = ((ix % this.px) + this.px) % this.px;
    if (this.py) iy = ((iy % this.py) + this.py) % this.py;
    return this.vals[this.perm[(this.perm[ix & 255] + iy) & 255]];
  }

  noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.lattice(ix, iy);
    const b = this.lattice(ix + 1, iy);
    const c = this.lattice(ix, iy + 1);
    const d = this.lattice(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  /** fractal sum in [0,1); periods double per octave so tiling is preserved */
  fbm(x, y, octaves = 5, gain = 0.5) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    const px = this.px;
    const py = this.py;
    for (let o = 0; o < octaves; o++) {
      this.px = px * f;
      this.py = py * f;
      sum += amp * this.noise(x * f + o * 17.3, y * f + o * 9.1);
      norm += amp;
      amp *= gain;
      f *= 2;
    }
    this.px = px;
    this.py = py;
    return sum / norm;
  }
}

// ---------------------------------------------------------------- paths
/** Right-half outline (x >= 0) mirrored to a closed symmetric path around (cx, cy). */
export function mirroredPath(ctx, pts, cx, cy, s = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(cx - pts[i][0] * s, cy + pts[i][1] * s);
  ctx.closePath();
}

export function polyPath(ctx, pts, cx = 0, cy = 0, s = 1, flipX = false) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + (flipX ? -x : x) * s;
    const py = cy + y * s;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.closePath();
}

export function bounds(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

// ---------------------------------------------------------------- materials
/**
 * Fill the current path as embossed metal: diagonal light gradient, inner
 * highlight on the upper-left edges, inner shadow on the lower-right, outline.
 * `pathFn` must (re)build the path each time it is called.
 */
export function paintMaterial(ctx, pathFn, box, mat, { outline = 2, rim = 3, noise = null } = {}) {
  const g = ctx.createLinearGradient(box.x0, box.y0, box.x1, box.y1);
  g.addColorStop(0, rgba(shade(mat.base, 0.35)));
  g.addColorStop(0.45, rgba(mat.base));
  g.addColorStop(1, rgba(shade(mat.base, -0.45)));
  pathFn();
  ctx.fillStyle = g;
  ctx.fill();

  if (mat.sheen) {
    pathFn();
    const sg = ctx.createLinearGradient(box.x0, box.y0, box.x1, box.y0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.42, 'rgba(255,255,255,0.18)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.32)');
    sg.addColorStop(0.58, 'rgba(255,255,255,0.12)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fill();
  }

  ctx.save();
  pathFn();
  ctx.clip();
  if (noise) noise();
  ctx.lineJoin = 'round';
  ctx.lineWidth = rim * 2;
  ctx.translate(rim * 0.7, rim * 0.7);
  pathFn();
  ctx.strokeStyle = rgba(0xffffff, mat.glass ? 0.5 : 0.38);
  ctx.stroke();
  ctx.translate(-rim * 1.4, -rim * 1.4);
  pathFn();
  ctx.strokeStyle = rgba(0x000000, 0.45);
  ctx.stroke();
  ctx.restore();

  if (outline) {
    pathFn();
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = rgba(0x05060c, 0.9);
    ctx.stroke();
  }
}

export function glass(ctx, x, y, rx, ry, color = 0x3aa8ff) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, rgba(shade(color, 0.85)));
  g.addColorStop(0.35, rgba(color));
  g.addColorStop(1, rgba(shade(color, -0.75)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(0x05060c, 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.3, y - ry * 0.45, rx * 0.28, ry * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();
  ctx.restore();
}

export function glowDot(ctx, x, y, r, color, intensity = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(0xffffff, intensity));
  g.addColorStop(0.2, rgba(shade(color, 0.5), intensity));
  g.addColorStop(0.5, rgba(color, 0.55 * intensity));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function panelLine(ctx, x0, y0, x1, y1, alpha = 0.55) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(0x000000, alpha);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = rgba(0xffffff, alpha * 0.45);
  ctx.beginPath();
  ctx.moveTo(x0 + 1, y0 + 1);
  ctx.lineTo(x1 + 1, y1 + 1);
  ctx.stroke();
}

export function rivet(ctx, x, y, r = 1.6) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(x + 0.8, y + 0.8, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
