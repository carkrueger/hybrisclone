// Builds every texture in code at boot: no image files are shipped.
import Phaser from 'phaser';
import { PALETTE, SPRITES } from './sprites.js';
import { GLYPHS, FONT_CHARS, FONT_W, FONT_H } from './font.js';
import { W, H, TILE } from '../config.js';
import { TILES } from '../level/tileIds.js';

const hex = (c, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function addCanvasTexture(scene, key, canvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function expandRows(def) {
  let rows = def.rows;
  if (def.mirror === 'h' || def.mirror === 'hv') {
    rows = rows.map((r) => r + r.slice(0, -1).split('').reverse().join(''));
  }
  if (def.mirror === 'hv') {
    rows = rows.concat(rows.slice(0, -1).reverse());
  }
  return rows;
}

export function makePixelTexture(scene, key, def, palette = PALETTE) {
  const rows = expandRows(def);
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const { c, ctx } = newCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if (ch === '.' || ch === ' ') continue;
      const col = palette[ch];
      if (col === undefined) continue;
      ctx.fillStyle = hex(col);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  addCanvasTexture(scene, key, c);
}

function drawGlyph(ctx, ch, x, y, color, scale = 1) {
  const g = GLYPHS[ch];
  if (!g) return;
  ctx.fillStyle = color;
  for (let r = 0; r < 7; r++) {
    for (let b = 0; b < 5; b++) {
      if (g[r] & (1 << (4 - b))) ctx.fillRect(x + b * scale, y + r * scale, scale, scale);
    }
  }
}

function makeFont(scene) {
  const perRow = 16;
  const rows = Math.ceil(FONT_CHARS.length / perRow);
  const { c, ctx } = newCanvas(perRow * FONT_W, rows * FONT_H);
  [...FONT_CHARS].forEach((ch, i) => {
    const x = (i % perRow) * FONT_W;
    const y = Math.floor(i / perRow) * FONT_H;
    drawGlyph(ctx, ch, x + 1, y + 1, 'rgba(10,10,30,1)'); // drop shadow
    drawGlyph(ctx, ch, x, y, '#ffffff');
  });
  addCanvasTexture(scene, 'font', c);
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'font',
    width: FONT_W,
    height: FONT_H,
    chars: FONT_CHARS,
    charsPerRow: perRow,
    offset: { x: 0, y: 0 },
    spacing: { x: 0, y: 0 },
    lineSpacing: 2,
  });
  scene.cache.bitmapFont.add('font', data);
}

// ---------------------------------------------------------------- tiles
const T = {
  base: 0x7078a0,
  light: 0xb8c0d8,
  mid: 0x8890b0,
  dark: 0x3c4058,
  deep: 0x24263a,
  line: 0x14141c,
};

function plate(ctx, ox, oy) {
  ctx.fillStyle = hex(T.base);
  ctx.fillRect(ox, oy, TILE, TILE);
  ctx.fillStyle = hex(T.mid);
  ctx.fillRect(ox, oy, TILE, 1);
  ctx.fillRect(ox, oy, 1, TILE);
  ctx.fillStyle = hex(T.dark, 0.5);
  ctx.fillRect(ox, oy + TILE - 1, TILE, 1);
  ctx.fillRect(ox + TILE - 1, oy, 1, TILE);
}

function rect(ctx, x, y, w, h, col, a = 1) {
  ctx.fillStyle = hex(col, a);
  ctx.fillRect(x, y, w, h);
}

function bevelBox(ctx, x, y, w, h, fill, light, dark) {
  rect(ctx, x, y, w, h, fill);
  rect(ctx, x, y, w, 1, light);
  rect(ctx, x, y, 1, h, light);
  rect(ctx, x, y + h - 1, w, 1, dark);
  rect(ctx, x + w - 1, y, 1, h, dark);
}

function circle(ctx, cx, cy, r, col) {
  ctx.fillStyle = hex(col);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r + r * 0.6) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}


function makeTileset(scene) {
  const cols = 16;
  const { c, ctx } = newCanvas(cols * TILE, 2 * TILE);
  const at = (i) => [(i % cols) * TILE, Math.floor(i / cols) * TILE];

  for (let m = 0; m < 16; m++) {
    const [x, y] = at(m);
    plate(ctx, x, y);
    if (m & 1) {
      rect(ctx, x, y, TILE, 1, T.line);
      rect(ctx, x, y + 1, TILE, 1, T.light);
    }
    if (m & 8) {
      rect(ctx, x, y, 1, TILE, T.line);
      rect(ctx, x + 1, y, 1, TILE, T.light);
    }
    if (m & 4) {
      rect(ctx, x, y + TILE - 1, TILE, 1, T.line);
      rect(ctx, x, y + TILE - 3, TILE, 2, T.dark);
    }
    if (m & 2) {
      rect(ctx, x + TILE - 1, y, 1, TILE, T.line);
      rect(ctx, x + TILE - 3, y, 2, TILE, T.dark);
    }
    if (m & 1 && m & 8) rect(ctx, x + 1, y + 1, 1, 1, T.line);
  }

  const draw = {
    [TILES.RIVETS]: (x, y) => {
      for (const [px, py] of [[3, 3], [12, 3], [3, 12], [12, 12]]) {
        rect(ctx, x + px, y + py, 1, 1, T.light);
        rect(ctx, x + px + 1, y + py + 1, 1, 1, T.dark);
      }
      rect(ctx, x + 6, y + 7, 4, 1, T.dark);
    },
    [TILES.VENT]: (x, y) => {
      rect(ctx, x + 2, y + 2, 12, 12, T.deep);
      for (let i = 0; i < 4; i++) rect(ctx, x + 3, y + 3 + i * 3, 10, 1, T.mid);
    },
    [TILES.GRATE]: (x, y) => {
      rect(ctx, x + 1, y + 1, 14, 14, T.deep);
      for (let i = 0; i < 4; i++) {
        rect(ctx, x + 1 + i * 4, y + 1, 1, 14, T.dark);
        rect(ctx, x + 1, y + 1 + i * 4, 14, 1, T.dark);
      }
    },
    [TILES.LIGHT_RED]: (x, y) => {
      bevelBox(ctx, x + 4, y + 4, 8, 8, T.deep, T.dark, T.light);
      rect(ctx, x + 6, y + 6, 4, 4, 0xe02020);
      rect(ctx, x + 6, y + 6, 2, 2, 0xffa0a0);
    },
    [TILES.LIGHT_CYAN]: (x, y) => {
      bevelBox(ctx, x + 4, y + 4, 8, 8, T.deep, T.dark, T.light);
      rect(ctx, x + 6, y + 6, 4, 4, 0x20d0e0);
      rect(ctx, x + 6, y + 6, 2, 2, 0xc0ffff);
    },
    [TILES.PIPE_H]: (x, y) => {
      rect(ctx, x, y + 5, TILE, 6, T.dark);
      rect(ctx, x, y + 6, TILE, 2, T.light);
      rect(ctx, x, y + 10, TILE, 1, T.line);
      rect(ctx, x + 7, y + 4, 3, 8, T.mid);
      rect(ctx, x + 7, y + 4, 1, 8, T.light);
    },
    [TILES.PIPE_V]: (x, y) => {
      rect(ctx, x + 5, y, 6, TILE, T.dark);
      rect(ctx, x + 6, y, 2, TILE, T.light);
      rect(ctx, x + 10, y, 1, TILE, T.line);
      rect(ctx, x + 4, y + 7, 8, 3, T.mid);
      rect(ctx, x + 4, y + 7, 8, 1, T.light);
    },
    [TILES.HATCH]: (x, y) => {
      circle(ctx, x + 8, y + 8, 6, T.line);
      circle(ctx, x + 8, y + 8, 5, T.dark);
      circle(ctx, x + 8, y + 8, 4, T.mid);
      rect(ctx, x + 4, y + 8, 9, 1, T.dark);
      rect(ctx, x + 8, y + 4, 1, 9, T.dark);
    },
    [TILES.RECESS]: (x, y) => {
      bevelBox(ctx, x + 2, y + 2, 12, 12, T.deep, T.line, T.light);
      rect(ctx, x + 4, y + 4, 8, 1, T.dark);
    },
    [TILES.HAZARD]: (x, y) => {
      for (let i = 0; i < TILE; i++) {
        for (let j = 0; j < TILE; j++) {
          const on = Math.floor((i + j) / 4) % 2 === 0;
          rect(ctx, x + i, y + j, 1, 1, on ? 0xd8b020 : 0x202020);
        }
      }
      rect(ctx, x, y, TILE, 1, T.line);
      rect(ctx, x, y + TILE - 1, TILE, 1, T.line);
    },
    [TILES.FAN]: (x, y) => {
      circle(ctx, x + 8, y + 8, 7, T.line);
      circle(ctx, x + 8, y + 8, 6, T.deep);
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2 + 0.4;
        for (let r = 1; r < 6; r++) {
          rect(ctx, x + 8 + Math.round(Math.cos(ang) * r), y + 8 + Math.round(Math.sin(ang) * r), 1, 1, T.mid);
        }
      }
      circle(ctx, x + 8, y + 8, 1, T.light);
    },
    [TILES.ARMOR]: (x, y) => {
      bevelBox(ctx, x + 1, y + 1, 14, 14, T.mid, T.light, T.dark);
      bevelBox(ctx, x + 4, y + 4, 8, 8, T.base, T.light, T.dark);
    },
    [TILES.DISH]: (x, y) => {
      circle(ctx, x + 8, y + 8, 6, T.dark);
      circle(ctx, x + 7, y + 7, 5, T.light);
      circle(ctx, x + 7, y + 7, 3, T.mid);
      rect(ctx, x + 7, y + 7, 2, 2, T.line);
    },
    [TILES.CRATE]: (x, y) => {
      bevelBox(ctx, x + 2, y + 2, 12, 12, 0x8a6a3a, 0xc09a60, 0x4a3418);
      rect(ctx, x + 2, y + 7, 12, 1, 0x4a3418);
      rect(ctx, x + 7, y + 2, 1, 12, 0x4a3418);
    },
  };
  for (const [idx, fn] of Object.entries(draw)) {
    const [x, y] = at(Number(idx));
    plate(ctx, x, y);
    fn(x, y);
  }
  addCanvasTexture(scene, 'tiles', c);
}

// ---------------------------------------------------------------- misc
function makeSoftCircle(scene, key, size, inner = 1, outer = 0, color = 0xffffff) {
  const { c, ctx } = newCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, hex(color, inner));
  g.addColorStop(0.5, hex(color, inner * 0.7));
  g.addColorStop(1, hex(color, outer));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  addCanvasTexture(scene, key, c);
}

function makePixelCircle(scene, key, r, colors) {
  const size = r * 2 + 1;
  const { c, ctx } = newCanvas(size, size);
  colors.forEach((col, i) => circle(ctx, r, r, r - i, col));
  addCanvasTexture(scene, key, c);
}

function makeStars(scene, key, count, bright, big) {
  const { c, ctx } = newCanvas(W, H);
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * W);
    const y = Math.floor(Math.random() * H);
    const b = bright * (0.5 + Math.random() * 0.5);
    const tintPick = Math.random();
    const col = tintPick < 0.15 ? 0xa0c0ff : tintPick < 0.25 ? 0xffe0a0 : 0xffffff;
    ctx.fillStyle = hex(col, b);
    const s = Math.random() < big ? 2 : 1;
    ctx.fillRect(x, y, s, s);
  }
  addCanvasTexture(scene, key, c);
}

function makeNebula(scene) {
  const { c, ctx } = newCanvas(W, H);
  const cols = [0x3020a0, 0x802070, 0x105080, 0x203060];
  for (let i = 0; i < 7; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = 60 + Math.random() * 120;
    const col = cols[i % cols.length];
    for (const dy of [-H, 0, H]) {
      const g = ctx.createRadialGradient(x, y + dy, 0, x, y + dy, r);
      g.addColorStop(0, hex(col, 0.22));
      g.addColorStop(1, hex(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  addCanvasTexture(scene, 'nebula', c);
}

function makePod(scene, key, letter, body, light, dark) {
  const { c, ctx } = newCanvas(14, 14);
  rect(ctx, 2, 0, 10, 14, 0x101018);
  rect(ctx, 0, 2, 14, 10, 0x101018);
  rect(ctx, 1, 1, 12, 12, 0x101018);
  rect(ctx, 2, 1, 10, 12, body);
  rect(ctx, 1, 2, 12, 10, body);
  rect(ctx, 2, 1, 10, 2, light);
  rect(ctx, 1, 2, 2, 8, light);
  rect(ctx, 2, 11, 10, 1, dark);
  rect(ctx, 11, 3, 1, 8, dark);
  drawGlyph(ctx, letter, 5, 4, 'rgba(0,0,0,0.6)');
  drawGlyph(ctx, letter, 4, 3, '#ffffff');
  addCanvasTexture(scene, key, c);
}

function makeBossGun(scene) {
  makePixelTexture(scene, 'boss_gun', {
    mirror: 'h',
    rows: [
      '..kkkk',
      '.kdggl',
      'kdglll',
      'kdgllw',
      'kdggll',
      'kddggl',
      '.kdddg',
      '..kkdk',
      '...kdl',
      '...kdl',
      '...kdl',
      '...kkk',
    ],
  });
}

export function makeAllTextures(scene) {
  makeFont(scene);
  for (const [key, def] of Object.entries(SPRITES)) makePixelTexture(scene, key, def);
  makeTileset(scene);
  makeStars(scene, 'stars_far', 140, 0.55, 0);
  makeStars(scene, 'stars_near', 50, 1, 0.25);
  makeNebula(scene);
  makeSoftCircle(scene, 'flash', 32, 1, 0);
  makeSoftCircle(scene, 'smoke', 12, 0.6, 0, 0xc0c0c0);
  makePixelCircle(scene, 'dot', 2, [0xffffff]);
  makePixelCircle(scene, 'ebullet2', 4, [0x601000, 0xf06010, 0xffb040, 0xfff0a0]);
  makePixelCircle(scene, 'boss_core', 11, [0x101018, 0x601030, 0xc02040, 0xf04050, 0xff7070, 0xffa0a0, 0xffe0e0]);
  makeBossGun(scene);
  makePod(scene, 'pod_P', 'P', 0x3070e0, 0x80c0ff, 0x183880);
  makePod(scene, 'pod_B', 'B', 0xd03030, 0xff8080, 0x701010);
  makePod(scene, 'pod_S', 'S', 0xd0a020, 0xfff080, 0x705010);
  const { c, ctx } = newCanvas(2, 2);
  rect(ctx, 0, 0, 2, 2, 0xffffff);
  addCanvasTexture(scene, 'spark', c);
  const px = newCanvas(4, 4);
  rect(px.ctx, 0, 0, 4, 4, 0xffffff);
  addCanvasTexture(scene, 'px', px.c);
}

// ---------------------------------------------------------------- boss hull
/**
 * Draws a symmetric boss hull from seeded profile data (see level/bossgen.js).
 * Uses only the provided rng so the same seed always draws the same boss.
 */
export function makeBossHullTexture(scene, key, hull, rng) {
  const { w, h, profile, colors } = hull;
  const { c, ctx } = newCanvas(w, h);
  const cx = (w - 1) / 2;
  const filled = (x, y) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    return Math.abs(x - cx) <= profile[y];
  };
  const img = ctx.createImageData(w, h);
  const put = (x, y, col) => {
    const i = (y * w + x) * 4;
    img.data[i] = (col >> 16) & 255;
    img.data[i + 1] = (col >> 8) & 255;
    img.data[i + 2] = col & 255;
    img.data[i + 3] = 255;
  };
  const seamY = new Set();
  for (let y = rng.int(5, 9); y < h; y += rng.int(6, 11)) seamY.add(y);
  const seamX = rng.int(4, 8);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!filled(x, y)) continue;
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
      let col = colors.base;
      if (edge) col = 0x101018;
      else if (!filled(x, y - 2) || !filled(x - 2, y)) col = colors.light;
      else if (!filled(x, y + 2) || !filled(x + 2, y)) col = colors.dark;
      else if (seamY.has(y) || Math.abs(Math.round(x - cx)) % (seamX * 2) === seamX) col = colors.dark;
      else if (Math.abs(x - cx) < 3) col = colors.mid;
      put(x, y, col);
    }
  }
  ctx.putImageData(img, 0, 0);
  // symmetric decorations
  const decoCount = rng.int(3, 7);
  for (let i = 0; i < decoCount; i++) {
    const dx = rng.int(4, Math.max(5, Math.floor(w / 2) - 6));
    const dy = rng.int(4, h - 8);
    const kind = rng.int(0, 2);
    for (const sx of [-1, 1]) {
      const x = Math.round(cx + sx * dx);
      if (!filled(x - 3, dy) || !filled(x + 3, dy) || !filled(x, dy + 4)) continue;
      if (kind === 0) {
        rect(ctx, x - 2, dy, 5, 4, 0x101018);
        rect(ctx, x - 1, dy + 1, 3, 2, colors.glow);
      } else if (kind === 1) {
        for (let k = 0; k < 3; k++) rect(ctx, x - 2, dy + k * 2, 5, 1, colors.dark);
      } else {
        rect(ctx, x - 1, dy, 3, 3, colors.light);
        rect(ctx, x, dy + 1, 1, 1, 0x101018);
      }
    }
  }
  addCanvasTexture(scene, key, c);
}
