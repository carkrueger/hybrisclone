// Painted HD ships. Player points up, enemies point down. Each ship is drawn
// from mirrored polygons with embossed materials, glass canopies and glows.
import {
  newCanvas, addCanvasTexture, rgba, shade, mirroredPath, polyPath, bounds,
  paintMaterial, glass, glowDot, panelLine, rivet, ValueNoise,
} from './canvas.js';

/** subtle seeded grime over all painted (opaque) pixels */
export function grimePass(ctx, w, h, seed, amount = 0.2) {
  const n = new ValueNoise(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 200) continue;
      const f = 1 + (n.fbm(x / 7, y / 7, 3) - 0.5) * amount * 2;
      d[i] = Math.min(255, d[i] * f);
      d[i + 1] = Math.min(255, d[i + 1] * f);
      d[i + 2] = Math.min(255, d[i + 2] * f);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Rim-light mask: opaque pixels whose neighbour toward the upper-left is
 * transparent. Stored white; tinted per sector at runtime and drawn additively.
 */
export function makeRim(scene, key, canvas, dx = -1, dy = -1, depth = 4) {
  const w = canvas.width;
  const h = canvas.height;
  const src = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const out = newCanvas(w, h);
  const img = out.ctx.createImageData(w, h);
  const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (a(x, y) < 140) continue;
      for (let k = 1; k <= depth; k++) {
        if (a(x + dx * k, y + dy * k) < 40) {
          const i = (y * w + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
          img.data[i + 3] = Math.round(255 * (1 - (k - 1) / depth) * 0.95);
          break;
        }
      }
    }
  }
  out.ctx.putImageData(img, 0, 0);
  addCanvasTexture(scene, key + '_rim', out.c);
}

const MAT = {
  hull: { base: 0xb4bfd4, sheen: true },
  hull2: { base: 0x66728e },
  dark: { base: 0x2c3244 },
  red: { base: 0xc83636 },
  darkred: { base: 0x8a2a2e },
  blue: { base: 0x2f6fe0, sheen: true },
  green: { base: 0x3aa860, sheen: true },
  purple: { base: 0x7c4cc8, sheen: true },
  orange: { base: 0xe08a2a, sheen: true },
  magenta: { base: 0xc8329e, sheen: true },
  gold: { base: 0xcfa648, sheen: true },
  steel: { base: 0x8a94aa },
};

function drawPart(ctx, part, cx, cy) {
  const mat = typeof part.mat === 'string' ? MAT[part.mat] : part.mat;
  if (part.circle) {
    const [x, y, r] = part.circle;
    const xs = part.pair ? [x, -x] : [x];
    for (const px of xs) {
      const path = () => {
        ctx.beginPath();
        ctx.ellipse(cx + px, cy + y, r, part.ry || r, 0, 0, Math.PI * 2);
      };
      paintMaterial(ctx, path, { x0: cx + px - r, y0: cy + y - r, x1: cx + px + r, y1: cy + y + r }, mat);
    }
    return;
  }
  const b = bounds(part.pts);
  if (part.pair) {
    for (const flip of [false, true]) {
      const path = () => polyPath(ctx, part.pts, cx, cy, 1, flip);
      const box = flip
        ? { x0: cx - b.x1, y0: cy + b.y0, x1: cx - b.x0, y1: cy + b.y1 }
        : { x0: cx + b.x0, y0: cy + b.y0, x1: cx + b.x1, y1: cy + b.y1 };
      paintMaterial(ctx, path, box, mat, part.opts);
    }
  } else {
    const path = () => mirroredPath(ctx, part.pts, cx, cy);
    paintMaterial(ctx, path, { x0: cx - b.x1, y0: cy + b.y0, x1: cx + b.x1, y1: cy + b.y1 }, mat, part.opts);
  }
}

function paintShip(scene, key, def) {
  const { c, ctx } = newCanvas(def.w, def.h);
  const cx = def.w / 2;
  const cy = def.h / 2;
  for (const p of def.parts) drawPart(ctx, p, cx, cy);
  if (def.details) def.details(ctx, cx, cy);
  grimePass(ctx, def.w, def.h, key.length * 977 + def.w, def.grime ?? 0.18);
  for (const g of def.glass || []) glass(ctx, cx + g[0], cy + g[1], g[2], g[3], g[4]);
  if (def.decal) {
    const dcl = def.decal;
    ctx.font = `900 ${dcl.size}px Orbitron, Arial Black, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = dcl.color || 'rgba(20,24,36,0.75)';
    for (const sx of dcl.pair ? [-1, 1] : [1]) ctx.fillText(dcl.text, cx + sx * dcl.x, cy + dcl.y);
  }
  makeRim(scene, key, c);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of def.lights || []) {
    const xs = l.pair ? [l.x, -l.x] : [l.x];
    for (const x of xs) glowDot(ctx, cx + x, cy + l.y, l.r, l.color, l.i ?? 0.9);
  }
  ctx.globalCompositeOperation = 'source-over';
  addCanvasTexture(scene, key, c);

  if (def.glowTex) {
    const gl = newCanvas(def.w, def.h);
    gl.ctx.globalCompositeOperation = 'lighter';
    for (const l of def.lights || []) {
      const xs = l.pair ? [l.x, -l.x] : [l.x];
      for (const x of xs) glowDot(gl.ctx, cx + x, cy + l.y, l.r * 2.2, l.color, 0.8);
    }
    addCanvasTexture(scene, key + '_glow', gl.c);
  }
}

const SHIPS = {
  player: {
    w: 124,
    h: 132,
    glowTex: true,
    decal: { text: '07', x: 38, y: 34, size: 8, pair: true },
    parts: [
      { pair: true, pts: [[10, -2], [34, 14], [56, 36], [58, 48], [42, 50], [14, 40]], mat: 'hull2' },
      { pair: true, pts: [[34, 18], [54, 40], [50, 44], [30, 25]], mat: 'red' },
      { pair: true, pts: [[6, 28], [18, 28], [20, 56], [4, 56]], mat: 'dark' },
      { pts: [[0, -62], [7, -48], [11, -22], [14, 12], [12, 42], [6, 52], [0, 52]], mat: 'hull' },
      { pair: true, pts: [[9, -32], [23, -19], [23, -12], [11, -15]], mat: 'hull2' },
      { pair: true, pts: [[13, 6], [22, 2], [24, 20], [14, 24]], mat: 'blue' },
    ],
    glass: [[0, -22, 6, 14, 0x48b4ff]],
    details: (ctx, cx, cy) => {
      panelLine(ctx, cx - 11, cy + 8, cx + 11, cy + 8);
      panelLine(ctx, cx, cy + 14, cx, cy + 46);
      panelLine(ctx, cx - 9, cy - 4, cx - 12, cy + 30, 0.35);
      panelLine(ctx, cx + 9, cy - 4, cx + 12, cy + 30, 0.35);
      for (const s of [-1, 1]) {
        rivet(ctx, cx + s * 40, cy + 40);
        rivet(ctx, cx + s * 24, cy + 30);
        rivet(ctx, cx + s * 7, cy + 30);
      }
    },
    lights: [
      { x: 12, y: 58, r: 9, color: 0x60d8ff, pair: true },
      { x: 55, y: 46, r: 5, color: 0xff4040 },
      { x: -55, y: 46, r: 5, color: 0x40ff70 },
    ],
  },
  e_drone: {
    w: 76,
    h: 76,
    parts: [
      { circle: [0, 0, 32], mat: 'hull2' },
      { circle: [0, 0, 23], mat: 'purple' },
      { circle: [27, 6, 7], pair: true, mat: 'dark' },
    ],
    glass: [[0, 3, 10, 10, 0xff3a3a]],
    details: (ctx, cx, cy) => {
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4 + 0.2;
        panelLine(ctx, cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 24, cx + Math.cos(ang) * 31, cy + Math.sin(ang) * 31, 0.5);
      }
    },
    lights: [
      { x: 0, y: 3, r: 12, color: 0xff3030, i: 0.6 },
      { x: 27, y: 10, r: 6, color: 0xff9a30, pair: true },
    ],
  },
  e_fighter: {
    w: 88,
    h: 96,
    parts: [
      { pair: true, pts: [[8, -6], [38, -28], [42, -42], [31, -44], [10, -26]], mat: 'green' },
      { pair: true, pts: [[6, -32], [15, -46], [8, -46]], mat: 'dark' },
      { pts: [[0, 46], [7, 32], [11, 0], [10, -32], [6, -44], [0, -46]], mat: 'hull' },
      { pair: true, pts: [[12, 2], [17, 2], [17, 28], [12, 28]], mat: 'dark' },
    ],
    glass: [[0, 12, 5, 11, 0x60ffa0]],
    details: (ctx, cx, cy) => {
      panelLine(ctx, cx - 9, cy - 10, cx + 9, cy - 10);
      panelLine(ctx, cx + 20, cy - 14, cx + 34, cy - 30, 0.4);
      panelLine(ctx, cx - 20, cy - 14, cx - 34, cy - 30, 0.4);
    },
    lights: [
      { x: 5, y: -46, r: 8, color: 0xff9a30, pair: true },
      { x: 14, y: 30, r: 5, color: 0xffe080, pair: true },
    ],
  },
  e_kamikaze: {
    w: 60,
    h: 68,
    parts: [
      { pts: [[0, 32], [24, -18], [13, -11], [7, -28], [0, -24]], mat: 'magenta' },
      { pts: [[0, 18], [9, -6], [0, -12]], mat: 'dark' },
    ],
    glass: [[0, -1, 5, 7, 0xff7ad0]],
    lights: [
      { x: 0, y: -26, r: 10, color: 0xff60c0 },
      { x: 20, y: -16, r: 4, color: 0xffffff, pair: true },
    ],
  },
  e_bomber: {
    w: 172,
    h: 140,
    glowTex: true,
    decal: { text: 'B12', x: 46, y: 6, size: 10, pair: true, color: 'rgba(240,230,220,0.6)' },
    parts: [
      { pair: true, pts: [[22, -32], [76, -14], [82, 8], [62, 26], [26, 24]], mat: 'hull2' },
      { pair: true, pts: [[60, -2], [80, 4], [64, 20]], mat: 'darkred' },
      { circle: [52, -8, 14], ry: 18, pair: true, mat: 'dark' },
      { pts: [[0, 66], [16, 56], [27, 12], [27, -42], [17, -60], [0, -64]], mat: 'darkred' },
      { pts: [[0, 44], [14, 34], [18, 0], [15, -38], [0, -44]], mat: 'hull' },
      { pair: true, pts: [[18, 46], [26, 46], [26, 62], [18, 62]], mat: 'dark' },
    ],
    glass: [[0, 18, 7, 12, 0xffb040]],
    details: (ctx, cx, cy) => {
      panelLine(ctx, cx - 14, cy - 10, cx + 14, cy - 10);
      panelLine(ctx, cx - 16, cy + 30, cx + 16, cy + 30);
      for (const s of [-1, 1]) {
        panelLine(ctx, cx + s * 30, cy - 20, cx + s * 70, cy - 6, 0.4);
        rivet(ctx, cx + s * 36, cy + 14);
        rivet(ctx, cx + s * 48, cy + 18);
        rivet(ctx, cx + s * 22, cy - 50);
      }
    },
    lights: [
      { x: 52, y: -26, r: 13, color: 0xff8a30, pair: true },
      { x: 22, y: 62, r: 7, color: 0xff3030, pair: true },
      { x: 78, y: 6, r: 5, color: 0xffe080, pair: true },
    ],
  },
  e_turret: {
    w: 92,
    h: 92,
    parts: [
      { pts: [[0, -42], [18, -42], [42, -18], [42, 18], [18, 42], [0, 42]], mat: 'dark' },
      { circle: [0, 0, 31], mat: 'steel' },
      { circle: [0, 0, 18], mat: 'darkred' },
    ],
    details: (ctx, cx, cy) => {
      for (let a = 0; a < 8; a++) {
        const ang = (a * Math.PI) / 4 + Math.PI / 8;
        rivet(ctx, cx + Math.cos(ang) * 37, cy + Math.sin(ang) * 37, 2);
      }
    },
    lights: [{ x: 0, y: 0, r: 9, color: 0xff4040, i: 0.7 }],
  },
  e_barrel: {
    w: 34,
    h: 80,
    parts: [
      { pair: true, pts: [[3, -36], [10, -36], [10, 14], [3, 14]], mat: 'hull' },
      { pts: [[0, 8], [14, 8], [14, 30], [0, 34]], mat: 'hull2' },
      { pair: true, pts: [[2, -38], [11, -38], [11, -30], [2, -30]], mat: 'dark' },
    ],
  },
  e_interceptor: {
    w: 100,
    h: 100,
    decal: { text: '4', x: 22, y: -8, size: 9, pair: true, color: 'rgba(255,240,240,0.7)' },
    parts: [
      { pair: true, pts: [[6, -4], [42, -28], [46, -22], [20, 10], [8, 16]], mat: 'red' },
      { pair: true, pts: [[30, -22], [40, -40], [45, -38], [39, -20]], mat: 'dark' },
      { pts: [[0, 46], [6, 32], [9, 4], [8, -30], [4, -42], [0, -44]], mat: 'hull' },
      { pair: true, pts: [[9, 18], [13, 18], [13, 36], [9, 36]], mat: 'dark' },
    ],
    glass: [[0, 10, 4, 10, 0xff7070]],
    details: (ctx, cx, cy) => {
      panelLine(ctx, cx - 7, cy - 12, cx + 7, cy - 12);
      panelLine(ctx, cx + 14, cy - 6, cx + 36, cy - 22, 0.4);
      panelLine(ctx, cx - 14, cy - 6, cx - 36, cy - 22, 0.4);
    },
    lights: [
      { x: 44, y: -24, r: 5, color: 0xff4040, pair: true },
      { x: 11, y: 38, r: 4, color: 0xffe080, pair: true },
    ],
  },
  e_gunship: {
    w: 140,
    h: 132,
    glowTex: true,
    decal: { text: 'G-21', x: 0, y: -2, size: 10 },
    parts: [
      { pair: true, pts: [[22, -42], [56, -36], [62, 18], [46, 34], [24, 30]], mat: 'hull2' },
      { pair: true, pts: [[34, 22], [43, 22], [43, 58], [34, 58]], mat: 'dark' },
      { pair: true, pts: [[32, 56], [45, 56], [45, 63], [32, 63]], mat: 'steel' },
      { pts: [[0, 60], [18, 48], [24, 0], [22, -46], [12, -60], [0, -62]], mat: 'steel' },
      { pts: [[0, 38], [14, 28], [16, -20], [10, -38], [0, -42]], mat: 'blue' },
      { pair: true, pts: [[50, -30], [58, -30], [58, 10], [50, 10]], mat: 'dark' },
    ],
    glass: [[0, 24, 6, 10, 0x60d0ff]],
    details: (ctx, cx, cy) => {
      panelLine(ctx, cx - 20, cy - 30, cx + 20, cy - 30);
      panelLine(ctx, cx - 22, cy + 12, cx + 22, cy + 12);
      for (const sx of [-1, 1]) {
        panelLine(ctx, cx + sx * 26, cy - 34, cx + sx * 56, cy - 28, 0.4);
        rivet(ctx, cx + sx * 30, cy + 22);
        rivet(ctx, cx + sx * 52, cy - 20);
        rivet(ctx, cx + sx * 40, cy + 10);
      }
    },
    lights: [
      { x: 14, y: -60, r: 11, color: 0xff8a30, pair: true },
      { x: 60, y: 0, r: 5, color: 0xffe080, pair: true },
      { x: 38, y: 62, r: 6, color: 0xff3030, pair: true },
    ],
  },
  boss_gun: {
    w: 76,
    h: 84,
    parts: [
      { pair: true, pts: [[6, 10], [13, 10], [13, 40], [6, 40]], mat: 'hull' },
      { circle: [0, 0, 30], mat: 'steel' },
      { circle: [0, 0, 19], mat: 'dark' },
      { pair: true, pts: [[5, 36], [14, 36], [14, 42], [5, 42]], mat: 'dark' },
    ],
    lights: [{ x: 0, y: 0, r: 12, color: 0xff5030, i: 0.85 }],
  },
};

function paintSpinner(scene) {
  const size = 84;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const blade = [[0, -9], [22, -11], [38, -4], [40, 5], [18, 9], [0, 9]];
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2;
    const pts = blade.map(([x, y]) => [x * Math.cos(ang) - y * Math.sin(ang), x * Math.sin(ang) + y * Math.cos(ang)]);
    const b = bounds(pts);
    paintMaterial(ctx, () => polyPath(ctx, pts, cx, cy), { x0: cx + b.x0, y0: cy + b.y0, x1: cx + b.x1, y1: cy + b.y1 }, MAT.orange);
  }
  paintMaterial(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    },
    { x0: cx - 16, y0: cy - 16, x1: cx + 16, y1: cy + 16 },
    MAT.hull2
  );
  glass(ctx, cx, cy, 9, 9, 0xffd040);
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy, 16, 0xffc030, 0.6);
  for (let k = 0; k < 4; k++) {
    const ang = (k * Math.PI) / 2;
    glowDot(ctx, cx + Math.cos(ang) * 38, cy + Math.sin(ang) * 38, 6, 0xffe080, 0.9);
  }
  makeRim(scene, 'e_spinner', c);
  addCanvasTexture(scene, 'e_spinner', c);
}

function paintBossCore(scene) {
  const size = 104;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  paintMaterial(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    },
    { x0: cx - 46, y0: cy - 46, x1: cx + 46, y1: cy + 46 },
    MAT.steel
  );
  for (let a = 0; a < 12; a++) {
    const ang = (a * Math.PI) / 6;
    rivet(ctx, cx + Math.cos(ang) * 41, cy + Math.sin(ang) * 41, 2);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 33, 0, Math.PI * 2);
  ctx.fillStyle = rgba(0x12060a);
  ctx.fill();
  const g = ctx.createRadialGradient(cx - 8, cy - 10, 2, cx, cy, 31);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.18, '#ffd0d8');
  g.addColorStop(0.45, '#ff3a5a');
  g.addColorStop(0.8, '#801030');
  g.addColorStop(1, '#300010');
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  makeRim(scene, 'boss_core', c);
  addCanvasTexture(scene, 'boss_core', c);

  const gl = newCanvas(size * 2, size * 2);
  gl.ctx.globalCompositeOperation = 'lighter';
  glowDot(gl.ctx, size, size, size, 0xff3060, 0.9);
  addCanvasTexture(scene, 'boss_core_glow', gl.c);
}

function paintPod(scene, key, letter, color) {
  const size = 60;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, cx, cy, 30, color, 0.6);
  ctx.globalCompositeOperation = 'source-over';
  const path = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 20, 0, 0, Math.PI * 2);
  };
  paintMaterial(ctx, path, { x0: cx - 18, y0: cy - 20, x1: cx + 18, y1: cy + 20 }, { base: color, sheen: true }, { rim: 3 });
  ctx.font = '900 22px Orbitron, Arial Black, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(letter, cx + 1.5, cy + 2.5);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(letter, cx, cy + 1);
  addCanvasTexture(scene, key, c);
}

function paintMine(scene) {
  const size = 72;
  const { c, ctx } = newCanvas(size, size);
  const cx = size / 2;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const pts = [[0, -5], [32, 0], [0, 5]].map(([x, y]) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]);
    const b = bounds(pts);
    paintMaterial(ctx, () => polyPath(ctx, pts, cx, cx), { x0: cx + b.x0, y0: cx + b.y0, x1: cx + b.x1, y1: cx + b.y1 }, MAT.steel, { rim: 1.5, outline: 1.5 });
  }
  paintMaterial(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cx, 20, 0, Math.PI * 2);
  }, { x0: cx - 20, y0: cx - 20, x1: cx + 20, y1: cx + 20 }, MAT.darkred);
  for (let k = 0; k < 6; k++) rivet(ctx, cx + Math.cos(k) * 14, cx + Math.sin(k) * 14, 1.8);
  glass(ctx, cx, cx, 7, 7, 0xff3030);
  makeRim(scene, 'e_mine', c);
  addCanvasTexture(scene, 'e_mine', c);
}

/** engine anchors (relative to the sprite centre); dir 1 = exhaust down, -1 = up */
export const SHIP_ENGINES = {
  player: { tex: 'flame_blue', dir: 1, scale: 0.9, at: [[-12, 58], [12, 58]] },
  e_fighter: { tex: 'flame_orange', dir: -1, scale: 0.6, at: [[-5, -46], [5, -46]] },
  e_kamikaze: { tex: 'flame_orange', dir: -1, scale: 0.8, at: [[0, -27]] },
  e_bomber: { tex: 'flame_orange', dir: -1, scale: 1.1, at: [[-52, -30], [52, -30]] },
  e_interceptor: { tex: 'flame_blue', dir: -1, scale: 0.6, at: [[-4, -44], [4, -44]] },
  e_gunship: { tex: 'flame_orange', dir: -1, scale: 1, at: [[-14, -62], [14, -62]] },
};

export function paintShips(scene) {
  for (const [key, def] of Object.entries(SHIPS)) paintShip(scene, key, def);
  paintSpinner(scene);
  paintMine(scene);
  paintBossCore(scene);
  paintPod(scene, 'pod_P', 'P', 0x2f7cf0);
  paintPod(scene, 'pod_B', 'B', 0xe03838);
  paintPod(scene, 'pod_S', 'S', 0xe0a828);
}

export { MAT, shade };
