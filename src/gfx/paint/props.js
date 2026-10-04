// Big multi-cell station props, painted once at boot (top-down view).
// PROP_ANCHORS lists animated extras relative to the prop's top-left corner.
import { TILE } from '../../config.js';
import { PROPS } from '../../level/tileIds.js';
import { newCanvas, addCanvasTexture, rgba, shade, paintMaterial, glowDot, rivet, roundRect, panelLine } from './canvas.js';

const STEEL = { base: 0x8a92a8, sheen: true };
const DARKM = { base: 0x3a4052 };
const PAINT = { base: 0xc8a040, sheen: true };

const circle = (ctx, x, y, r) => () => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};
const box = (x, y, r) => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });

function hazardRing(ctx, x, y, r0, r1) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r1, 0, Math.PI * 2);
  ctx.arc(x, y, r0, 0, Math.PI * 2, true);
  ctx.clip();
  for (let a = 0; a < 24; a++) {
    ctx.fillStyle = a % 2 ? '#1a1a1a' : '#e0b020';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r1, (a / 24) * Math.PI * 2, ((a + 1) / 24) * Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function crystalShard(ctx, x, y, w, h, rot, light = '#f0ffff', mid = '#70c8f0', dark = '#203a70') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const g = ctx.createLinearGradient(-w, -h, w, 0);
  g.addColorStop(0, light);
  g.addColorStop(0.5, mid);
  g.addColorStop(1, dark);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w / 2, -h * 0.35);
  ctx.lineTo(w / 2, 0);
  ctx.lineTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.35);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,20,40,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

const PAINTERS = {
  dome(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    paintMaterial(ctx, circle(ctx, cx, cy, 60), box(cx, cy, 60), DARKM, { rim: 3 });
    for (let a = 0; a < 16; a++) rivet(ctx, cx + Math.cos((a / 16) * Math.PI * 2) * 54, cy + Math.sin((a / 16) * Math.PI * 2) * 54, 2);
    const g = ctx.createRadialGradient(cx - 18, cy - 20, 4, cx, cy, 50);
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(0.25, '#7ad0e8');
    g.addColorStop(0.7, '#1a5a78');
    g.addColorStop(1, '#0a2030');
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,230,255,0.45)';
    ctx.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(k) * 11 + 2, 48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, 48, Math.abs(k) * 11 + 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx - 16, cy - 20, 18, 8, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0a0c14';
    ctx.beginPath();
    ctx.arc(cx, cy, 48, 0, Math.PI * 2);
    ctx.stroke();
  },
  reactor(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const oct = () => {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 92, cy + Math.sin(a) * 92);
      }
      ctx.closePath();
    };
    paintMaterial(ctx, oct, box(cx, cy, 92), STEEL, { rim: 4 });
    hazardRing(ctx, cx, cy, 70, 80);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58);
      ctx.rotate(a);
      paintMaterial(ctx, () => roundRect(ctx, -8, -5, 16, 10, 2), { x0: -8, y0: -5, x1: 8, y1: 5 }, DARKM, { rim: 1.5, outline: 1.5 });
      ctx.restore();
    }
    paintMaterial(ctx, circle(ctx, cx, cy, 46), box(cx, cy, 46), DARKM, { rim: 3 });
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#a0f8ff');
    g.addColorStop(0.7, '#20a8d8');
    g.addColorStop(1, '#063040');
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  },
  hangar(ctx, w, h) {
    paintMaterial(ctx, () => roundRect(ctx, 6, 6, w - 12, h - 12, 8), { x0: 6, y0: 6, x1: w - 6, y1: h - 6 }, DARKM, { rim: 4 });
    for (const [x, dir] of [[18, 1], [w / 2 + 1, -1]]) {
      const dw = w / 2 - 19;
      paintMaterial(ctx, () => {
        ctx.beginPath();
        ctx.rect(x, 18, dw, h - 36);
      }, { x0: x, y0: 18, x1: x + dw, y1: h - 18 }, STEEL, { rim: 3, outline: 2 });
      for (let y = 30; y < h - 30; y += 14) panelLine(ctx, x + 4, y, x + dw - 4, y, 0.35);
      ctx.save();
      ctx.beginPath();
      ctx.rect(dir > 0 ? x + dw - 14 : x, 18, 14, h - 36);
      ctx.clip();
      for (let k = -4; k < 14; k++) {
        ctx.fillStyle = k % 2 ? '#1a1a1a' : '#e0b020';
        ctx.beginPath();
        ctx.moveTo(x - 20, 18 + k * 10);
        ctx.lineTo(x + dw + 20, 18 + k * 10 + 30);
        ctx.lineTo(x + dw + 20, 18 + k * 10 + 40);
        ctx.lineTo(x - 20, 18 + k * 10 + 10);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#0a0c14';
    ctx.fillRect(w / 2 - 1, 18, 2, h - 36);
  },
  pad(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const oct = () => {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
      }
      ctx.closePath();
    };
    paintMaterial(ctx, oct, box(cx, cy, 90), DARKM, { rim: 4 });
    ctx.strokeStyle = '#e0b020';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(240,244,250,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, 74, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#eef2f8';
    ctx.fillRect(cx - 26, cy - 34, 12, 68);
    ctx.fillRect(cx + 14, cy - 34, 12, 68);
    ctx.fillRect(cx - 26, cy - 6, 52, 12);
  },
  tower(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const g = ctx.createRadialGradient(cx - 14, cy - 14, 10, cx, cy, 60);
    g.addColorStop(0, '#d8dce6');
    g.addColorStop(0.7, '#8a90a0');
    g.addColorStop(1, '#3a3e4a');
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0a0c14';
    ctx.stroke();
    const hole = ctx.createRadialGradient(cx + 6, cy + 6, 4, cx, cy, 40);
    hole.addColorStop(0, '#000000');
    hole.addColorStop(0.8, '#14161e');
    hole.addColorStop(1, '#5a606e');
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fillStyle = hole;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let r = 44; r < 56; r += 4) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  spire(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy + 14, 52, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    crystalShard(ctx, cx - 26, cy + 30, 22, 50, -0.45);
    crystalShard(ctx, cx + 28, cy + 34, 20, 44, 0.5);
    crystalShard(ctx, cx, cy + 40, 34, 92, 0.05);
    crystalShard(ctx, cx - 6, cy + 46, 16, 36, -0.9, '#ffffff', '#b0a0ff', '#40307a');
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, cx, cy, 50, 0x80e8ff, 0.4);
    ctx.globalCompositeOperation = 'source-over';
  },
  eggs(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = 'rgba(30,10,40,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 58, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, rx, ry] of [[-22, -12, 22, 28], [20, -16, 20, 26], [0, 18, 24, 30], [-30, 26, 14, 18], [32, 24, 15, 19]]) {
      const g = ctx.createRadialGradient(cx + x - 6, cy + y - 8, 2, cx + x, cy + y, ry);
      g.addColorStop(0, '#fff0ff');
      g.addColorStop(0.55, '#b890c8');
      g.addColorStop(1, '#40204a');
      ctx.beginPath();
      ctx.ellipse(cx + x, cy + y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,255,150,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  },
  smelter(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const oct = () => {
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        ctx[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 90, cy + Math.sin(a) * 90);
      }
      ctx.closePath();
    };
    paintMaterial(ctx, oct, box(cx, cy, 90), { base: 0x4a403c }, { rim: 4 });
    paintMaterial(ctx, circle(ctx, cx, cy, 58), box(cx, cy, 58), { base: 0x6a5a52, sheen: true }, { rim: 4 });
    const g = ctx.createRadialGradient(cx - 6, cy - 6, 4, cx, cy, 42);
    g.addColorStop(0, '#fffad0');
    g.addColorStop(0.35, '#ffb030');
    g.addColorStop(0.8, '#c02808');
    g.addColorStop(1, '#300800');
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      paintMaterial(ctx, () => roundRect(ctx, cx + Math.cos(a) * 74 - 9, cy + Math.sin(a) * 74 - 9, 18, 18, 3), box(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74, 9), DARKM, { rim: 1.5, outline: 1.5 });
    }
  },
  hullpiece(ctx, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + 8, h / 2 + 10, w * 0.46, h * 0.42, 0.1, 0, Math.PI * 2);
    ctx.fill();
    const pts = [[14, 30], [70, 10], [150, 18], [184, 50], [170, 104], [96, 118], [30, 100]];
    const path = () => {
      ctx.beginPath();
      pts.forEach(([x, y], k) => ctx[k ? 'lineTo' : 'moveTo'](x, y));
      ctx.closePath();
    };
    paintMaterial(ctx, path, { x0: 14, y0: 10, x1: 184, y1: 118 }, { base: 0x6a5a48, sheen: true }, { rim: 4 });
    for (let x = 40; x < 170; x += 26) panelLine(ctx, x, 22, x - 10, 108, 0.5);
    for (const [x, y, r] of [[70, 60, 16], [130, 80, 11], [150, 40, 8]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0806';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
  obelisk(ctx, w, h) {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(cx - 40, cy - 30, 96, 100);
    paintMaterial(ctx, () => roundRect(ctx, cx - 50, cy - 50, 100, 100, 10), box(cx, cy, 50), { base: 0xe0e2ea, sheen: true }, { rim: 4 });
    const pyr = () => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 34);
      ctx.lineTo(cx + 34, cy);
      ctx.lineTo(cx, cy + 34);
      ctx.lineTo(cx - 34, cy);
      ctx.closePath();
    };
    paintMaterial(ctx, pyr, box(cx, cy, 34), { base: 0xd8b040, sheen: true }, { rim: 3 });
    ctx.globalCompositeOperation = 'lighter';
    glowDot(ctx, cx, cy, 20, 0xffe080, 0.7);
    ctx.globalCompositeOperation = 'source-over';
  },
  tanks(ctx, w, h) {
    for (const x of [w * 0.28, w * 0.72]) {
      const tw = 46;
      paintMaterial(ctx, () => roundRect(ctx, x - tw / 2, 14, tw, h - 28, tw / 2), { x0: x - tw / 2, y0: 14, x1: x + tw / 2, y1: h - 14 }, PAINT, { rim: 3 });
      ctx.fillStyle = 'rgba(20,20,24,0.65)';
      ctx.fillRect(x - tw / 2 + 2, h * 0.3, tw - 4, 6);
      ctx.fillRect(x - tw / 2 + 2, h * 0.7, tw - 4, 6);
      ctx.font = '700 12px Orbitron, Arial Black, sans-serif';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(x, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(30,24,10,0.7)';
      ctx.fillText('H2-FUEL', 0, 4);
      ctx.restore();
    }
    paintMaterial(ctx, () => {
      ctx.beginPath();
      ctx.rect(w * 0.28, h / 2 - 6, w * 0.44, 12);
    }, { x0: w * 0.28, y0: h / 2 - 6, x1: w * 0.72, y1: h / 2 + 6 }, STEEL, { rim: 2, outline: 2 });
  },
};

export const PROP_ANCHORS = {
  dome: { glows: [{ x: 64, y: 8, color: 0xff4040, mode: 'blink', scale: 0.3 }] },
  reactor: { glows: [{ x: 96, y: 96, color: 0x60e8ff, mode: 'pulse', scale: 1.5 }] },
  hangar: {
    glows: [
      { x: 14, y: 12, color: 0xffb030, mode: 'blink', scale: 0.35 },
      { x: 178, y: 12, color: 0xffb030, mode: 'blink', scale: 0.35, phase: 1.5 },
      { x: 14, y: 116, color: 0xffb030, mode: 'blink', scale: 0.35, phase: 0.8 },
      { x: 178, y: 116, color: 0xffb030, mode: 'blink', scale: 0.35, phase: 2.2 },
    ],
  },
  pad: {
    glows: Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      return { x: 96 + Math.cos(a) * 80, y: 96 + Math.sin(a) * 80, color: 0x60c0ff, mode: 'chase', scale: 0.32, phase: k * 0.8 };
    }),
  },
  tower: { glows: [], steam: [{ x: 64, y: 64 }] },
  tanks: { glows: [{ x: 64, y: 10, color: 0xff3030, mode: 'blink', scale: 0.3 }] },
  spire: { glows: [{ x: 64, y: 60, color: 0x80e8ff, mode: 'pulse', scale: 0.9 }] },
  eggs: { glows: [{ x: 64, y: 70, color: 0x80ff90, mode: 'pulse', scale: 0.8 }] },
  smelter: { glows: [{ x: 96, y: 96, color: 0xff8a30, mode: 'pulse', scale: 1.6 }], steam: [{ x: 96, y: 96 }] },
  hullpiece: { glows: [{ x: 70, y: 60, color: 0xff7030, mode: 'blink', scale: 0.4 }] },
  obelisk: { glows: [{ x: 64, y: 64, color: 0xffe080, mode: 'pulse', scale: 0.9 }] },
};

export function paintProps(scene) {
  for (const [type, [cw, ch]] of Object.entries(PROPS)) {
    const w = cw * TILE;
    const h = ch * TILE;
    const { c, ctx } = newCanvas(w, h);
    PAINTERS[type](ctx, w, h);
    addCanvasTexture(scene, 'prop_' + type, c);
  }
}

export { rgba, shade, glowDot };
