// Station tilesets.
//  - base / raised: dual-grid tiles. Index = mask + 16 * variant, where the mask
//    holds the 4 cells around a grid vertex (TL=1, TR=2, BL=4, BR=8). The tile
//    layer is offset by half a tile, so every cell is drawn from 4 quarters.
//    Outer and inner corners get 45deg chamfers, edges get rim light, and
//    downward-facing edges get a visible wall face.
//  - deco: cell-aligned overlays for interior cells.
//  - mid: dark girders for the distant parallax layer.
import { TILE } from '../../config.js';
import { newCanvas, addCanvasTexture, rgba, shade, mix, ValueNoise, glowDot, rivet } from './canvas.js';
import { DECO } from '../../level/tileIds.js';

const T = TILE;
const HALF = T / 2;
const BITS = [1, 2, 4, 8];

function insideFn(mask, chamfer) {
  return (x, y) => {
    x = Math.max(0, Math.min(T - 1, x));
    y = Math.max(0, Math.min(T - 1, y));
    const px = x + 0.5;
    const py = y + 0.5;
    const q = (py < HALF ? 0 : 2) + (px < HALF ? 0 : 1);
    const filled = !!(mask & BITS[q]);
    const h = !!(mask & BITS[q ^ 1]);
    const v = !!(mask & BITS[q ^ 2]);
    const d = Math.abs(px - HALF) + Math.abs(py - HALF);
    if (filled && !h && !v && d < chamfer) return false;
    if (!filled && h && v && d < chamfer) return true;
    return filled;
  };
}

const RING = [];
for (let r = 1; r <= 11; r++) {
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    RING.push([Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r), r]);
  }
}

function paintPlateTiles(scene, key, style) {
  const variants = 4;
  const { c, ctx } = newCanvas(16 * T, variants * T);
  const img = ctx.createImageData(16 * T, variants * T);
  const noise = new ValueNoise(style.seed);
  const L = [-0.6, -0.8];
  const put = (gx, gy, col, a = 255) => {
    const i = (gy * 16 * T + gx) * 4;
    img.data[i] = (col >> 16) & 255;
    img.data[i + 1] = (col >> 8) & 255;
    img.data[i + 2] = col & 255;
    img.data[i + 3] = a;
  };
  for (let v = 0; v < variants; v++) {
    for (let mask = 0; mask < 16; mask++) {
      const insideRaw = insideFn(mask, style.chamfer);
      // precomputed padded inside-mask (lookups are hot)
      const P = 18;
      const PW = T + P * 2;
      const grid = new Uint8Array(PW * PW);
      for (let yy = -P; yy < T + P; yy++) for (let xx = -P; xx < T + P; xx++) grid[(yy + P) * PW + xx + P] = insideRaw(xx, yy) ? 1 : 0;
      const inside = (xx, yy) => grid[(yy + P) * PW + xx + P] === 1;
      const ox = mask * T;
      const oy = v * T;
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const gx = ox + x;
          const gy = oy + y;
          if (inside(x, y)) {
            // distance & direction to the nearest outside pixel
            let best = 99;
            let nx = 0;
            let ny = 0;
            for (const [dx, dy, r] of RING) {
              if (r >= best) break;
              const xx = x + dx;
              const yy = y + dy;
              if (!inside(xx, yy)) {
                best = r;
                nx = dx / r;
                ny = dy / r;
              }
            }
            // base metal with grime
            const ns = style.noiseScale || 11;
            const gn = noise.fbm((x + v * 61) / ns, (y + mask * 7) / ns, 3);
            // per-panel diagonal gradient (cell-local coordinates)
            const cxl = (x + HALF) % T;
            const cyl = (y + HALF) % T;
            const grad = (0.5 - (cxl + cyl) / (2 * T)) * style.panelGrad;
            let col = shade(style.base, (gn - 0.5) * style.grime + grad);
            // theme surface patterns
            if (style.pattern === 'organic') {
              const vn = noise.noise((x + v * 31) / 9, (y + mask * 13) / 9);
              if (Math.abs(vn - 0.5) < 0.035) col = mix(col, style.vein, 0.75);
              else if (Math.abs(vn - 0.5) < 0.07) col = shade(col, -0.18);
            } else if (style.pattern === 'rust') {
              const dn = noise.noise((x + v * 17) / 5, (y + mask * 11) / 5);
              if (dn > 0.84) col = shade(col, -0.5);
              else if (dn < 0.14) col = mix(col, 0xb05a20, 0.55);
            } else if (style.pattern === 'rock') {
              if (noise.noise(x / 2.5 + v * 9, y / 2.5 + mask * 5) > 0.9) col = mix(col, 0xd0f4ff, 0.7);
            } else if (style.pattern === 'foundry') {
              if (x % 6 === 0 || y % 6 === 0) col = shade(col, -0.22);
            }
            // cell seams along the tile centre lines
            if (style.seams !== false) {
              if (x === HALF - 1 || y === HALF - 1) col = style.seamGlow ? mix(col, style.seamGlow, 0.9) : shade(col, -0.45);
              else if (x === HALF || y === HALF) col = style.seamGlow ? mix(col, style.seamGlow, 0.5) : shade(col, 0.35);
            }
            // inner plate bevel, plateInset px in from the cell edges
            const ix = Math.abs(x + 0.5 - HALF);
            const iy = Math.abs(y + 0.5 - HALF);
            if (style.plateInset) {
              const pin = style.plateInset;
              if ((ix > pin - 1 && ix < pin + 0.5 && iy > pin - 1) || (iy > pin - 1 && iy < pin + 0.5 && ix > pin - 1)) {
                const lightSide = (x < HALF ? 1 : -1) * L[0] + (y < HALF ? 1 : -1) * L[1];
                col = shade(col, lightSide > 0 ? 0.2 : -0.24);
              }
            }
            if (style.stripes && (y + v * 3) % style.stripes === 0) col = shade(col, -0.1);
            // rivets near cell corners (the tile centre)
            if (style.rivets !== false) for (const [rx, ry] of [[HALF - 6, HALF - 6], [HALF + 5, HALF - 6], [HALF - 6, HALF + 5], [HALF + 5, HALF + 5]]) {
              const dd = (x - rx) ** 2 + (y - ry) ** 2;
              if (dd <= 2) col = shade(col, (x - rx) + (y - ry) < 0 ? 0.55 : -0.35);
            }
            // rim light / outline
            if (best <= 1.5) col = 0x0a0c14;
            else if (best < style.rim) {
              const k = (style.rim - best) / (style.rim - 1.5);
              const facing = -(nx * L[0] + ny * L[1]); // >0: edge faces the light
              col = shade(col, Math.max(-0.6, Math.min(0.6, facing * k * 0.7)));
            } else if (style.trim && best >= style.rim + 1 && best < style.rim + 4) {
              col = mix(col, style.trim, 0.85);
            }
            put(gx, gy, col);
          } else {
            // wall face below downward-facing edges
            let wall = 0;
            for (let k = 1; k <= style.wall; k++) {
              if (inside(x, y - k)) {
                wall = k;
                break;
              }
            }
            if (wall) {
              const t = wall / style.wall;
              let col = shade(style.wallColor, -0.55 * t);
              if (wall === 1) col = 0x0a0c14;
              if (style.wallRibs && x % style.wallRibs === 0) col = shade(col, -0.3);
              put(gx, gy, col, wall === style.wall ? 200 : 255);
            }
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  addCanvasTexture(scene, key, c);
}

// ---------------------------------------------------------------- deco
function bevel(ctx, x, y, w, h, fill, inset = false) {
  ctx.fillStyle = rgba(fill);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = rgba(inset ? 0x000000 : 0xffffff, inset ? 0.45 : 0.35);
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = rgba(inset ? 0xffffff : 0x000000, inset ? 0.25 : 0.45);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
}

function circleBevel(ctx, cx, cy, r, fill) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, rgba(shade(fill, 0.4)));
  g.addColorStop(1, rgba(shade(fill, -0.5)));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(8,10,16,0.9)';
  ctx.stroke();
}

const DECO_PAINT = {
  [DECO.VENT]: (ctx) => {
    bevel(ctx, 10, 10, 44, 44, 0x1c2030, true);
    for (let i = 0; i < 6; i++) bevel(ctx, 13, 14 + i * 6.5, 38, 3, 0x6a7288);
  },
  [DECO.GRATE]: (ctx) => {
    bevel(ctx, 6, 6, 52, 52, 0x141824, true);
    ctx.strokeStyle = 'rgba(120,130,160,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 8, 8);
      ctx.lineTo(8 + i * 8, 56);
      ctx.moveTo(8, 8 + i * 8);
      ctx.lineTo(56, 8 + i * 8);
      ctx.stroke();
    }
  },
  [DECO.HATCH]: (ctx) => {
    circleBevel(ctx, 32, 32, 24, 0x5a6278);
    circleBevel(ctx, 32, 32, 18, 0x8a92a8);
    ctx.fillStyle = 'rgba(10,12,20,0.7)';
    ctx.fillRect(14, 31, 36, 3);
    ctx.fillRect(31, 14, 3, 36);
    for (let a = 0; a < 8; a++) rivet(ctx, 32 + Math.cos((a * Math.PI) / 4) * 21, 32 + Math.sin((a * Math.PI) / 4) * 21, 1.5);
  },
  [DECO.LIGHT_RED]: (ctx) => lightSocket(ctx, 0xff3030),
  [DECO.LIGHT_CYAN]: (ctx) => lightSocket(ctx, 0x30e0ff),
  [DECO.LIGHT_AMBER]: (ctx) => lightSocket(ctx, 0xffb030),
  [DECO.PIPE_H]: (ctx) => {
    const g = ctx.createLinearGradient(0, 20, 0, 44);
    g.addColorStop(0, '#2a2e3a');
    g.addColorStop(0.3, '#dfe6f2');
    g.addColorStop(0.6, '#7a8298');
    g.addColorStop(1, '#1a1c26');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 26, 64, 22);
    ctx.fillStyle = g;
    ctx.fillRect(0, 20, 64, 24);
    bevel(ctx, 26, 16, 12, 32, 0x8a92a8);
  },
  [DECO.PIPE_V]: (ctx) => {
    const g = ctx.createLinearGradient(20, 0, 44, 0);
    g.addColorStop(0, '#2a2e3a');
    g.addColorStop(0.3, '#dfe6f2');
    g.addColorStop(0.6, '#7a8298');
    g.addColorStop(1, '#1a1c26');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(26, 0, 22, 64);
    ctx.fillStyle = g;
    ctx.fillRect(20, 0, 24, 64);
    bevel(ctx, 16, 26, 32, 12, 0x8a92a8);
  },
  [DECO.FAN]: (ctx) => {
    // housing only; the rotor is an animated sprite (fan_rotor)
    circleBevel(ctx, 32, 32, 27, 0x3a4052);
    ctx.beginPath();
    ctx.arc(32, 32, 23, 0, Math.PI * 2);
    ctx.fillStyle = '#07080e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,130,160,0.5)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(32, 9);
      ctx.lineTo(32, 55);
      ctx.moveTo(9, 32);
      ctx.lineTo(55, 32);
      ctx.stroke();
    }
  },
  [DECO.DISH]: (ctx) => {
    // mount only; the dish head is an animated sprite (dish_head)
    circleBevel(ctx, 32, 32, 16, 0x4a5064);
    circleBevel(ctx, 32, 32, 8, 0x8a92a8);
    for (let a = 0; a < 6; a++) rivet(ctx, 32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, 1.4);
  },
  [DECO.CRATE]: (ctx) => {
    for (const [x, y] of [[8, 8], [34, 12], [12, 34]]) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 4, y + 4, 22, 22);
      bevel(ctx, x, y, 22, 22, 0x9a7440);
      ctx.strokeStyle = 'rgba(40,24,8,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + 20, y + 20);
      ctx.moveTo(x + 20, y + 2);
      ctx.lineTo(x + 2, y + 20);
      ctx.stroke();
    }
  },
  [DECO.HAZARD]: (ctx) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 18, 64, 28);
    ctx.clip();
    for (let i = -4; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#1a1a1a' : '#e0b020';
      ctx.beginPath();
      ctx.moveTo(i * 10, 18);
      ctx.lineTo(i * 10 + 10, 18);
      ctx.lineTo(i * 10 + 38, 46);
      ctx.lineTo(i * 10 + 28, 46);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 18, 64, 2);
    ctx.fillRect(0, 44, 64, 2);
  },
  [DECO.ARMOR]: (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 10, 50, 50);
    bevel(ctx, 4, 4, 52, 52, 0x8a92a8);
    bevel(ctx, 14, 14, 32, 32, 0x6a7288, true);
    for (const [x, y] of [[9, 9], [51, 9], [9, 51], [51, 51]]) rivet(ctx, x, y, 2);
  },
  [DECO.SOLAR]: (ctx) => {
    bevel(ctx, 4, 4, 56, 56, 0x1a2a6a);
    ctx.strokeStyle = 'rgba(120,170,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 9.3, 6);
      ctx.lineTo(4 + i * 9.3, 58);
      ctx.moveTo(6, 4 + i * 9.3);
      ctx.lineTo(58, 4 + i * 9.3);
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(4, 4, 60, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(4, 4, 56, 56);
  },
  [DECO.GREEBLE]: (ctx) => {
    bevel(ctx, 6, 8, 20, 14, 0x7a8298);
    bevel(ctx, 30, 6, 26, 10, 0x5a6278);
    bevel(ctx, 34, 22, 20, 30, 0x8a92a8);
    bevel(ctx, 8, 28, 22, 26, 0x4a5064, true);
    ctx.fillStyle = '#ffb030';
    ctx.fillRect(40, 26, 6, 3);
    rivet(ctx, 12, 40);
    rivet(ctx, 22, 46);
  },
  [DECO.PAD]: (ctx) => {
    circleBevel(ctx, 32, 32, 28, 0x3a4052);
    ctx.beginPath();
    ctx.arc(32, 32, 22, 0, Math.PI * 2);
    ctx.strokeStyle = '#e0b020';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#e8ecf4';
    ctx.fillRect(22, 20, 5, 24);
    ctx.fillRect(37, 20, 5, 24);
    ctx.fillRect(22, 30, 20, 5);
  },
  [DECO.WINDOWS]: (ctx) => {
    bevel(ctx, 2, 18, 60, 28, 0x0c0e16, true);
    const cols = ['#ffd890', '#9fd8ff', '#ffe8b0', '#ffd890', '#2a3040'];
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = cols[(k * 3) % 5];
      ctx.fillRect(6 + k * 11.5, 23, 8, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(6 + k * 11.5, 23, 8, 3);
    }
  },
  [DECO.VENT_GLOW]: (ctx) => {
    bevel(ctx, 8, 8, 48, 48, 0x1a0c08, true);
    for (let i = 0; i < 5; i++) {
      const g = ctx.createLinearGradient(0, 12 + i * 8, 0, 18 + i * 8);
      g.addColorStop(0, '#ffe080');
      g.addColorStop(1, '#ff4010');
      ctx.fillStyle = g;
      ctx.fillRect(12, 12 + i * 8, 40, 5);
    }
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 32, 32, 26, 0xff6a20, 0.45);
    ctx.globalCompositeOperation = 'source-over';
  },
  [DECO.CONDUIT]: (ctx) => {
    const cols = [0x8a2a2a, 0x2a5aa0, 0xc0a030, 0x3a4052];
    cols.forEach((c, i) => {
      const y = 14 + i * 10;
      const g = ctx.createLinearGradient(0, y, 0, y + 8);
      g.addColorStop(0, rgba(shade(c, 0.5)));
      g.addColorStop(1, rgba(shade(c, -0.5)));
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y + 3, 64, 8);
      ctx.fillStyle = g;
      ctx.fillRect(0, y, 64, 8);
    });
    for (const x of [10, 44]) bevel(ctx, x, 10, 8, 46, 0x6a7288);
  },
  [DECO.HEX]: (ctx) => {
    const r = 9;
    for (let row = -1; row < 5; row++) {
      for (let col = -1; col < 5; col++) {
        const x = col * r * 1.75 + (row % 2 ? r * 0.87 : 0);
        const y = row * r * 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = x + Math.cos(a) * (r - 1);
          const py = y + Math.sin(a) * (r - 1);
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
        g.addColorStop(0, '#b0b8cc');
        g.addColorStop(1, '#4a5064');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,10,16,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  },
  [DECO.TERMINAL]: (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(12, 14, 46, 42);
    bevel(ctx, 8, 10, 46, 42, 0x4a5064);
    bevel(ctx, 13, 15, 16, 12, 0x06200e, true);
    bevel(ctx, 33, 15, 16, 12, 0x061a22, true);
    ctx.fillStyle = '#40ff80';
    for (let k = 0; k < 3; k++) ctx.fillRect(15, 17 + k * 3, 6 + ((k * 5) % 9), 1);
    ctx.fillStyle = '#40d8ff';
    ctx.fillRect(35, 19, 12, 5);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = ['#ff4040', '#ffd040', '#40ff80'][k % 3];
      ctx.fillRect(14 + k * 6, 34, 4, 4);
    }
    bevel(ctx, 14, 42, 34, 6, 0x2a3040, true);
  },
  [DECO.CHEVRON]: (ctx) => {
    bevel(ctx, 0, 14, 64, 36, 0x16181e, true);
    ctx.fillStyle = '#e0a020';
    for (let k = 0; k < 3; k++) {
      const x = 6 + k * 20;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + 8, 20);
      ctx.lineTo(x + 18, 32);
      ctx.lineTo(x + 8, 44);
      ctx.lineTo(x, 44);
      ctx.lineTo(x + 10, 32);
      ctx.closePath();
      ctx.fill();
    }
  },
  // ---------------- theme decorations
  [DECO.CRYSTAL]: (ctx) => {
    const shards = [[22, 40, 10, 30, -0.3], [36, 44, 12, 36, 0.15], [46, 46, 8, 22, 0.5], [30, 50, 7, 18, -0.7]];
    for (const [x, y, w, h, rot] of shards) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-w, -h, w, 0);
      g.addColorStop(0, '#f0ffff');
      g.addColorStop(0.5, '#70d0f8');
      g.addColorStop(1, '#2a5a90');
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(w / 2, -h * 0.4);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(-w / 2, 0);
      ctx.lineTo(-w / 2, -h * 0.4);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,20,40,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 34, 34, 22, 0x80e8ff, 0.45);
    ctx.globalCompositeOperation = 'source-over';
  },
  [DECO.ICE_VENT]: (ctx) => {
    circleBevel(ctx, 32, 32, 24, 0x5a7090);
    ctx.beginPath();
    ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#0a1a2a';
    ctx.fill();
    for (let a = 0; a < 12; a++) {
      ctx.fillStyle = 'rgba(220,250,255,0.85)';
      ctx.fillRect(32 + Math.cos(a / 1.9) * 21 - 1.5, 32 + Math.sin(a / 1.9) * 21 - 1.5, 3, 3);
    }
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 32, 32, 16, 0x80f0ff, 0.7);
    ctx.globalCompositeOperation = 'source-over';
  },
  [DECO.EGG]: (ctx) => {
    for (const [x, y, rx, ry] of [[24, 34, 13, 17], [42, 28, 11, 15], [40, 46, 9, 12]]) {
      const g = ctx.createRadialGradient(x - 4, y - 6, 2, x, y, ry);
      g.addColorStop(0, '#f8e8ff');
      g.addColorStop(0.6, '#b090c0');
      g.addColorStop(1, '#4a2a5a');
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,255,140,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - rx * 0.5, y - ry * 0.3);
      ctx.quadraticCurveTo(x, y + 2, x + rx * 0.4, y + ry * 0.5);
      ctx.stroke();
    }
  },
  [DECO.VEIN]: (ctx) => {
    ctx.lineCap = 'round';
    for (const [w, c] of [[14, 'rgba(40,20,50,0.9)'], [9, '#7a4a8a'], [4, '#90ff90']]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.bezierCurveTo(18, 14, 40, 50, 64, 32);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 32, 32, 20, 0x80ff90, 0.35);
    ctx.globalCompositeOperation = 'source-over';
  },
  [DECO.ACID]: (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 26);
    g.addColorStop(0, '#e0ff90');
    g.addColorStop(0.5, '#60d020');
    g.addColorStop(1, 'rgba(30,80,10,0.0)');
    ctx.beginPath();
    ctx.ellipse(32, 34, 26, 20, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(24, 28, 6, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  [DECO.LAVA]: (ctx) => {
    ctx.fillStyle = '#1a0c08';
    ctx.fillRect(0, 16, 64, 32);
    const g = ctx.createLinearGradient(0, 20, 0, 44);
    g.addColorStop(0, '#ff4010');
    g.addColorStop(0.5, '#ffe080');
    g.addColorStop(1, '#ff4010');
    ctx.fillStyle = g;
    ctx.fillRect(0, 22, 64, 20);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = 'rgba(40,16,8,0.85)';
      ctx.beginPath();
      ctx.ellipse(6 + k * 11, 32 + ((k * 7) % 5) - 2, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, 32, 32, 30, 0xff6a20, 0.45);
    ctx.globalCompositeOperation = 'source-over';
  },
  [DECO.CRUCIBLE]: (ctx) => {
    circleBevel(ctx, 32, 32, 26, 0x4a3a34);
    const g = ctx.createRadialGradient(30, 30, 2, 32, 32, 18);
    g.addColorStop(0, '#fff8c0');
    g.addColorStop(0.5, '#ff9020');
    g.addColorStop(1, '#801808');
    ctx.beginPath();
    ctx.arc(32, 32, 18, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  },
  [DECO.DEBRIS]: (ctx) => {
    ctx.fillStyle = 'rgba(20,14,10,0.55)';
    ctx.beginPath();
    ctx.ellipse(32, 34, 26, 18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, w, h, r] of [[18, 26, 18, 9, 0.4], [38, 34, 16, 11, -0.6], [28, 44, 12, 7, 1.1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(r);
      bevel(ctx, -w / 2, -h / 2, w, h, 0x8a7058);
      ctx.restore();
    }
  },
  [DECO.BROKEN_PIPE]: (ctx) => {
    const g = ctx.createLinearGradient(0, 22, 0, 42);
    g.addColorStop(0, '#3a2a20');
    g.addColorStop(0.3, '#c8a888');
    g.addColorStop(1, '#2a1a10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 22, 34, 20);
    ctx.beginPath();
    ctx.moveTo(34, 22);
    ctx.lineTo(40, 26);
    ctx.lineTo(36, 32);
    ctx.lineTo(42, 38);
    ctx.lineTo(34, 42);
    ctx.fill();
    ctx.fillStyle = '#0a0806';
    ctx.beginPath();
    ctx.ellipse(37, 32, 3, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,140,120,0.6)';
    ctx.fillRect(46, 30, 8, 4);
    ctx.fillRect(52, 40, 6, 3);
  },
  [DECO.EMBLEM]: (ctx) => {
    circleBevel(ctx, 32, 32, 26, 0xd8b040);
    circleBevel(ctx, 32, 32, 20, 0xf0f0f4);
    ctx.fillStyle = '#c89a28';
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 7 : 16;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      ctx[k ? 'lineTo' : 'moveTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  },
  [DECO.LIGHT_PANEL]: (ctx) => {
    bevel(ctx, 8, 8, 48, 48, 0xd8dce6);
    const g = ctx.createLinearGradient(12, 12, 52, 52);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d8e8ff');
    ctx.fillStyle = g;
    ctx.fillRect(13, 13, 38, 38);
    ctx.strokeStyle = 'rgba(200,160,60,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(13, 13, 38, 38);
  },
  [DECO.SPORE]: (ctx) => {
    for (const [x, y, r] of [[22, 24, 8], [40, 22, 6], [34, 40, 9], [18, 44, 5], [48, 42, 5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#3a6a3a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#b0ff90';
      ctx.fill();
    }
  },
};

function lightSocket(ctx, color) {
  bevel(ctx, 18, 18, 28, 28, 0x1c2030, true);
  ctx.beginPath();
  ctx.arc(32, 32, 8, 0, Math.PI * 2);
  ctx.fillStyle = rgba(color);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  glowDot(ctx, 32, 32, 14, color, 0.6);
  ctx.globalCompositeOperation = 'source-over';
}

function paintDeco(scene) {
  const n = Object.keys(DECO_PAINT).length;
  const { c, ctx } = newCanvas(n * T, T);
  for (const [idx, fn] of Object.entries(DECO_PAINT)) {
    ctx.save();
    ctx.translate(Number(idx) * T, 0);
    ctx.beginPath();
    ctx.rect(0, 0, T, T);
    ctx.clip();
    fn(ctx);
    ctx.restore();
  }
  addCanvasTexture(scene, 'deco', c);
}

// ---------------------------------------------------------------- mid layer
function paintMid(scene) {
  const { c, ctx } = newCanvas(6 * T, T);
  const metal = 0x3a4866;
  const beamV = (x0) => {
    const g = ctx.createLinearGradient(x0 + 22, 0, x0 + 42, 0);
    g.addColorStop(0, rgba(shade(metal, 0.3)));
    g.addColorStop(1, rgba(shade(metal, -0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(x0 + 22, 0, 20, T);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let y = 4; y < T; y += 16) ctx.fillRect(x0 + 26, y, 12, 8);
  };
  const beamH = (x0) => {
    const g = ctx.createLinearGradient(0, 22, 0, 42);
    g.addColorStop(0, rgba(shade(metal, 0.3)));
    g.addColorStop(1, rgba(shade(metal, -0.5)));
    ctx.fillStyle = g;
    ctx.fillRect(x0, 22, T, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let x = 4; x < T; x += 16) ctx.fillRect(x0 + x, 26, 8, 12);
  };
  beamV(0);
  beamH(T);
  beamV(2 * T);
  beamH(2 * T);
  ctx.fillStyle = rgba(shade(metal, 0.15));
  ctx.fillRect(2 * T + 16, 16, 32, 32);
  // X brace
  ctx.strokeStyle = rgba(metal);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(3 * T, 0);
  ctx.lineTo(4 * T, T);
  ctx.moveTo(4 * T, 0);
  ctx.lineTo(3 * T, T);
  ctx.stroke();
  // window panel
  ctx.fillStyle = rgba(shade(metal, -0.3));
  ctx.fillRect(4 * T + 4, 4, T - 8, T - 8);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 3 ? 'rgba(255,210,120,0.75)' : 'rgba(120,200,255,0.6)';
      ctx.fillRect(4 * T + 12 + i * 16, 16 + j * 20, 8, 10);
    }
  }
  // diagonal brace
  ctx.strokeStyle = rgba(shade(metal, 0.1));
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(5 * T, T);
  ctx.lineTo(6 * T, 0);
  ctx.stroke();
  addCanvasTexture(scene, 'midtiles', c);
}

function paintRotors(scene) {
  const fan = newCanvas(48, 48);
  const f = fan.ctx;
  for (let a = 0; a < 6; a++) {
    f.save();
    f.translate(24, 24);
    f.rotate((a * Math.PI) / 3);
    f.beginPath();
    f.ellipse(11, 0, 11, 4.5, 0.45, 0, Math.PI * 2);
    const g = f.createLinearGradient(0, -5, 0, 5);
    g.addColorStop(0, '#c8d0e0');
    g.addColorStop(1, '#4a5064');
    f.fillStyle = g;
    f.fill();
    f.restore();
  }
  f.beginPath();
  f.arc(24, 24, 5, 0, Math.PI * 2);
  f.fillStyle = '#d8e0ec';
  f.fill();
  addCanvasTexture(scene, 'fan_rotor', fan.c);

  const dish = newCanvas(64, 64);
  const d = dish.ctx;
  d.fillStyle = 'rgba(0,0,0,0.35)';
  d.beginPath();
  d.ellipse(36, 38, 24, 22, 0, 0, Math.PI * 2);
  d.fill();
  const g = d.createRadialGradient(24, 24, 2, 32, 32, 26);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#b0b8cc');
  g.addColorStop(1, '#4a5064');
  d.beginPath();
  d.arc(32, 32, 24, 0, Math.PI * 2);
  d.fillStyle = g;
  d.fill();
  d.strokeStyle = '#0c0e16';
  d.lineWidth = 2;
  d.stroke();
  d.strokeStyle = 'rgba(40,46,60,0.6)';
  d.lineWidth = 1;
  for (const r of [8, 16]) {
    d.beginPath();
    d.arc(32, 32, r, 0, Math.PI * 2);
    d.stroke();
  }
  d.strokeStyle = '#1a1e28';
  d.lineWidth = 2.5;
  d.beginPath();
  d.moveTo(32, 32);
  d.lineTo(32, 6);
  d.stroke();
  d.beginPath();
  d.arc(32, 6, 3.5, 0, Math.PI * 2);
  d.fillStyle = '#ff6040';
  d.fill();
  addCanvasTexture(scene, 'dish_head', dish.c);
}

const PANELS_PLATES = { seed: 101, base: 0x7a8296, wallColor: 0x3e4456, grime: 0.26, panelGrad: 0.32, chamfer: 22, rim: 6, wall: 10, plateInset: 7, wallRibs: 8 };
const PANELS_RAISED = { seed: 202, base: 0x9aa2b6, wallColor: 0x4a5064, grime: 0.18, panelGrad: 0.22, chamfer: 18, rim: 7, wall: 16, stripes: 6, trim: 0xffb030, wallRibs: 6 };

export const PLATE_STYLES = {
  shipyard: [PANELS_PLATES, PANELS_RAISED],
  crystal: [
    { seed: 303, pattern: 'rock', base: 0x6a7894, wallColor: 0x24304a, grime: 0.7, noiseScale: 18, panelGrad: 0.12, chamfer: 27, rim: 7, wall: 12, seams: false, rivets: false },
    { seed: 304, pattern: 'rock', base: 0x90a8c8, wallColor: 0x3a5070, grime: 0.55, noiseScale: 14, panelGrad: 0.1, chamfer: 25, rim: 8, wall: 18, seams: false, rivets: false, trim: 0xa0f0ff },
  ],
  hive: [
    { seed: 404, pattern: 'organic', base: 0x6a4a7a, vein: 0x80ff90, wallColor: 0x2a1a38, grime: 0.35, noiseScale: 14, panelGrad: 0.18, chamfer: 30, rim: 8, wall: 12, seams: false, rivets: false },
    { seed: 405, pattern: 'organic', base: 0x8a68a0, vein: 0xb0ffb0, wallColor: 0x3a2a48, grime: 0.3, noiseScale: 12, panelGrad: 0.16, chamfer: 29, rim: 8, wall: 18, seams: false, rivets: false, trim: 0x90ff90 },
  ],
  foundry: [
    { seed: 505, pattern: 'foundry', base: 0x4e4644, wallColor: 0x241c1a, grime: 0.3, panelGrad: 0.22, chamfer: 20, rim: 6, wall: 10, plateInset: 7, seamGlow: 0xff6a20, wallRibs: 6 },
    { seed: 506, pattern: 'foundry', base: 0x645a56, wallColor: 0x342824, grime: 0.24, panelGrad: 0.2, chamfer: 18, rim: 7, wall: 16, stripes: 6, seamGlow: 0xff8a30, trim: 0xff7020, wallRibs: 6 },
  ],
  graveyard: [
    { seed: 606, pattern: 'rust', base: 0x7a6450, wallColor: 0x3a2a1e, grime: 0.5, panelGrad: 0.25, chamfer: 22, rim: 6, wall: 10, plateInset: 7, wallRibs: 8 },
    { seed: 607, pattern: 'rust', base: 0x8a7460, wallColor: 0x4a3828, grime: 0.45, panelGrad: 0.2, chamfer: 18, rim: 7, wall: 16, stripes: 6, trim: 0xb0a040, wallRibs: 6 },
  ],
  citadel: [
    { seed: 707, base: 0xa4a8b6, wallColor: 0x6a7080, grime: 0.06, panelGrad: 0.24, chamfer: 22, rim: 6, wall: 10, plateInset: 7, seamGlow: 0xd0a030, wallRibs: 8 },
    { seed: 708, base: 0xc0c4d0, wallColor: 0x7a8090, grime: 0.05, panelGrad: 0.18, chamfer: 18, rim: 7, wall: 16, seamGlow: 0xe0b040, trim: 0xe0b040, wallRibs: 6 },
  ],
};

/** paint (once) the plate and raised tilesets of a theme: plates_<id>, raised_<id> */
export function ensureThemeTiles(scene, themeId) {
  const [plates, raised] = PLATE_STYLES[themeId] || PLATE_STYLES.shipyard;
  if (!scene.textures.exists('plates_' + themeId)) paintPlateTiles(scene, 'plates_' + themeId, plates);
  if (!scene.textures.exists('raised_' + themeId)) paintPlateTiles(scene, 'raised_' + themeId, raised);
}

export function paintStation(scene) {
  paintRotors(scene);
  ensureThemeTiles(scene, 'shipyard');
  paintDeco(scene);
  paintMid(scene);
}
