// Unique painted silhouettes for the six sector bosses and their special parts.
import { RNG } from '../../core/rng.js';
import { newCanvas, addCanvasTexture, rgba, shade, mirroredPath, polyPath, bounds, paintMaterial, panelLine, rivet, glowDot, glass, roundRect, ValueNoise } from './canvas.js';
import { makeRim, grimePass } from './ships.js';

function canvasFor(w, h) {
  const c = newCanvas(w, h);
  return { ...c, cx: w / 2, cy: h / 2 };
}

function finish(scene, key, c) {
  grimePass(c.ctx, c.c.width, c.c.height, key.length * 131, 0.16);
  makeRim(scene, key, c.c, -1, -1, 5);
  addCanvasTexture(scene, key, c.c);
}

const lit = (ctx, fn) => {
  ctx.globalCompositeOperation = 'lighter';
  fn();
  ctx.globalCompositeOperation = 'source-over';
};

function hazardBand(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let k = -4; k < w / 14 + 4; k++) {
    ctx.fillStyle = k % 2 ? '#1a1a1a' : '#e0b020';
    ctx.beginPath();
    ctx.moveTo(x + k * 14, y);
    ctx.lineTo(x + k * 14 + 14, y);
    ctx.lineTo(x + k * 14 + 14 + h, y + h);
    ctx.lineTo(x + k * 14 + h, y + h);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- crane
function crane(scene, colors) {
  const c = canvasFor(580, 320);
  const { ctx, cx, cy } = c;
  const pts = [[0, -140], [200, -140], [250, -104], [276, 30], [232, 128], [0, 148]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, cy), { x0: cx - 276, y0: cy - 140, x1: cx + 276, y1: cy + 148 }, { base: colors.base, sheen: true }, { rim: 6, outline: 3 });
  const inner = [[0, -100], [160, -100], [196, -70], [210, 30], [180, 100], [0, 112]];
  paintMaterial(ctx, () => mirroredPath(ctx, inner, cx, cy), { x0: cx - 210, y0: cy - 100, x1: cx + 210, y1: cy + 112 }, { base: shade(colors.base, -0.2) }, { rim: 4, outline: 2 });
  hazardBand(ctx, cx - 196, cy - 128, 392, 16);
  hazardBand(ctx, cx - 160, cy + 116, 320, 12);
  for (let y = -80; y < 100; y += 30) panelLine(ctx, cx - 190, cy + y, cx + 190, cy + y, 0.4);
  // cabin
  paintMaterial(ctx, () => roundRect(ctx, cx - 70, cy - 96, 140, 60, 8), { x0: cx - 70, y0: cy - 96, x1: cx + 70, y1: cy - 36 }, { base: 0xd8b040, sheen: true }, { rim: 3 });
  for (let k = 0; k < 6; k++) {
    ctx.fillStyle = '#9fd8ff';
    ctx.fillRect(cx - 60 + k * 21, cy - 84, 14, 14);
  }
  // shoulder mounts
  for (const sx of [-1, 1]) {
    paintMaterial(ctx, () => {
      ctx.beginPath();
      ctx.arc(cx + sx * 216, cy - 56, 30, 0, Math.PI * 2);
    }, { x0: cx + sx * 216 - 30, y0: cy - 86, x1: cx + sx * 216 + 30, y1: cy - 26 }, { base: colors.dark }, { rim: 3 });
    for (let k = 0; k < 6; k++) rivet(ctx, cx + sx * 216 + Math.cos(k) * 22, cy - 56 + Math.sin(k) * 22, 2);
  }
  lit(ctx, () => {
    for (const sx of [-1, 1]) glowDot(ctx, cx + sx * 262, cy + 10, 10, 0xffb030, 0.9);
  });
  finish(scene, 'sb_crane', c);

  // arm: a truss girder with a hook (origin top centre)
  const a = canvasFor(56, 310);
  const g = a.ctx.createLinearGradient(8, 0, 48, 0);
  g.addColorStop(0, '#e0c060');
  g.addColorStop(0.5, '#b08a30');
  g.addColorStop(1, '#5a4410');
  a.ctx.fillStyle = g;
  a.ctx.fillRect(14, 10, 28, 250);
  a.ctx.strokeStyle = 'rgba(30,20,0,0.85)';
  a.ctx.lineWidth = 3;
  for (let y = 16; y < 254; y += 24) {
    a.ctx.beginPath();
    a.ctx.moveTo(16, y);
    a.ctx.lineTo(40, y + 12);
    a.ctx.lineTo(16, y + 24);
    a.ctx.stroke();
  }
  a.ctx.strokeRect(14, 10, 28, 250);
  paintMaterial(a.ctx, () => {
    a.ctx.beginPath();
    a.ctx.arc(28, 280, 18, 0, Math.PI * 2);
  }, { x0: 10, y0: 262, x1: 46, y1: 298 }, { base: 0x8a92a8 }, { rim: 2 });
  a.ctx.strokeStyle = '#2a2e3a';
  a.ctx.lineWidth = 6;
  a.ctx.beginPath();
  a.ctx.arc(28, 292, 12, 0, Math.PI);
  a.ctx.stroke();
  makeRim(scene, 'sb_crane_arm', a.c);
  addCanvasTexture(scene, 'sb_crane_arm', a.c);
}

// ---------------------------------------------------------------- prism
function prism(scene, colors) {
  const c = canvasFor(500, 400);
  const { ctx, cx, cy } = c;
  const facet = (pts, base, ox = 0, oy = 0) => {
    const b = bounds(pts);
    paintMaterial(ctx, () => mirroredPath(ctx, pts, cx + ox, cy + oy), { x0: cx + ox - b.x1, y0: cy + oy + b.y0, x1: cx + ox + b.x1, y1: cy + oy + b.y1 }, { base, sheen: true }, { rim: 4, outline: 2 });
  };
  for (const sx of [-1, 1]) {
    const pts = [[0, -110], [60, -20], [64, 40], [0, 120]];
    ctx.save();
    ctx.translate(cx + sx * 140, cy + 20);
    ctx.rotate(sx * 0.35);
    paintMaterial(ctx, () => mirroredPath(ctx, pts, 0, 0), { x0: -64, y0: -110, x1: 64, y1: 120 }, { base: 0x8a70d0, sheen: true }, { rim: 4, outline: 2 });
    ctx.restore();
  }
  facet([[0, -190], [110, -50], [130, 40], [0, 190]], 0x70b8e8);
  facet([[0, -130], [70, -30], [80, 30], [0, 130]], 0xc0e8ff);
  lit(ctx, () => {
    glowDot(ctx, cx, cy, 90, 0x80f0ff, 0.5);
    for (let k = 0; k < 14; k++) glowDot(ctx, cx + Math.cos(k * 1.7) * 150, cy + Math.sin(k * 2.3) * 120, 6, 0xe0f8ff, 0.8);
  });
  finish(scene, 'sb_prism', c);
}

// ---------------------------------------------------------------- brood
function brood(scene, colors) {
  const c = canvasFor(540, 420);
  const { ctx, cx, cy } = c;
  const blob = (x, y, rx, ry, base) =>
    paintMaterial(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(cx + x, cy + y, rx, ry, 0, 0, Math.PI * 2);
    }, { x0: cx + x - rx, y0: cy + y - ry, x1: cx + x + rx, y1: cy + y + ry }, { base, sheen: true }, { rim: 5, outline: 2 });
  for (const sx of [-1, 1]) {
    blob(sx * 170, -40, 80, 110, 0x5a3a6a);
    blob(sx * 120, 110, 70, 70, 0x6a4a7a);
  }
  blob(0, 0, 210, 170, 0x7a5a90);
  blob(0, -100, 120, 70, 0x8a68a0);
  const n = new ValueNoise(55);
  ctx.strokeStyle = 'rgba(140,255,150,0.55)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 14; k++) {
    let x = cx + (n.noise(k, 1) - 0.5) * 300;
    let y = cy + (n.noise(k, 2) - 0.5) * 240;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (n.noise(k * 3, s) - 0.5) * 60;
      y += (n.noise(k * 5, s) - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // eye socket
  ctx.beginPath();
  ctx.ellipse(cx, cy + 20, 74, 60, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#12061a';
  ctx.fill();
  lit(ctx, () => {
    for (const [x, y] of [[-150, 60], [150, 60], [-90, -120], [90, -120], [0, 150]]) glowDot(ctx, cx + x, cy + y, 22, 0x80ff90, 0.7);
  });
  finish(scene, 'sb_brood', c);

  const e = canvasFor(130, 110);
  const eg = e.ctx.createRadialGradient(56, 48, 4, 65, 55, 60);
  eg.addColorStop(0, '#fff8c0');
  eg.addColorStop(0.5, '#e0c020');
  eg.addColorStop(1, '#6a3a00');
  e.ctx.beginPath();
  e.ctx.ellipse(65, 55, 60, 50, 0, 0, Math.PI * 2);
  e.ctx.fillStyle = eg;
  e.ctx.fill();
  e.ctx.beginPath();
  e.ctx.ellipse(65, 55, 10, 42, 0, 0, Math.PI * 2);
  e.ctx.fillStyle = '#0a0004';
  e.ctx.fill();
  e.ctx.beginPath();
  e.ctx.ellipse(48, 36, 12, 7, -0.5, 0, Math.PI * 2);
  e.ctx.fillStyle = 'rgba(255,255,255,0.7)';
  e.ctx.fill();
  addCanvasTexture(scene, 'sb_brood_eye', e.c);

  const t = canvasFor(48, 48);
  paintMaterial(t.ctx, () => {
    t.ctx.beginPath();
    t.ctx.arc(24, 24, 20, 0, Math.PI * 2);
  }, { x0: 4, y0: 4, x1: 44, y1: 44 }, { base: 0x8a5aa0, sheen: true }, { rim: 3 });
  for (let k = 0; k < 3; k++) {
    t.ctx.beginPath();
    t.ctx.arc(16 + k * 8, 30, 3, 0, Math.PI * 2);
    t.ctx.fillStyle = '#e0b0f0';
    t.ctx.fill();
  }
  addCanvasTexture(scene, 'sb_tentacle', t.c);
}

// ---------------------------------------------------------------- forge
function forge(scene, colors) {
  const c = canvasFor(580, 340);
  const { ctx, cx, cy } = c;
  const pts = [[0, -150], [236, -150], [272, -116], [272, 100], [206, 152], [0, 162]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, cy), { x0: cx - 272, y0: cy - 150, x1: cx + 272, y1: cy + 162 }, { base: 0x4a403e, sheen: true }, { rim: 6, outline: 3 });
  // glowing seams
  lit(ctx, () => {
    ctx.strokeStyle = 'rgba(255,110,30,0.75)';
    ctx.lineWidth = 3;
    for (let y = -110; y < 140; y += 42) {
      ctx.beginPath();
      ctx.moveTo(cx - 230, cy + y);
      ctx.lineTo(cx + 230, cy + y);
      ctx.stroke();
    }
    for (let x = -200; x <= 200; x += 80) {
      ctx.beginPath();
      ctx.moveTo(cx + x, cy - 120);
      ctx.lineTo(cx + x, cy + 130);
      ctx.stroke();
    }
    glowDot(ctx, cx, cy + 40, 120, 0xff6a20, 0.4);
  });
  for (const sx of [-1, 1]) {
    paintMaterial(ctx, () => roundRect(ctx, cx + sx * 200 - 26, cy - 190 + 40, 52, 70, 6), { x0: cx + sx * 200 - 26, y0: cy - 150, x1: cx + sx * 200 + 26, y1: cy - 80 }, { base: 0x3a3230 }, { rim: 3 });
  }
  finish(scene, 'sb_forge', c);

  const v = canvasFor(96, 66);
  paintMaterial(v.ctx, () => roundRect(v.ctx, 4, 4, 88, 58, 8), { x0: 4, y0: 4, x1: 92, y1: 62 }, { base: 0x5a4a44 }, { rim: 3 });
  for (let k = 0; k < 5; k++) {
    const g = v.ctx.createLinearGradient(0, 12 + k * 9, 0, 18 + k * 9);
    g.addColorStop(0, '#ffe080');
    g.addColorStop(1, '#ff4010');
    v.ctx.fillStyle = g;
    v.ctx.fillRect(14, 12 + k * 9, 68, 5);
  }
  makeRim(scene, 'sb_forge_vent', v.c);
  addCanvasTexture(scene, 'sb_forge_vent', v.c);
}

// ---------------------------------------------------------------- revenant
function revenant(scene, colors) {
  const rng = new RNG(911);
  const c = canvasFor(560, 380);
  const { ctx, cx, cy } = c;
  const pts = [[0, -180], [60, -160], [150, -90], [260, -40], [250, 30], [170, 90], [120, 170], [0, 185]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, cy), { x0: cx - 260, y0: cy - 180, x1: cx + 260, y1: cy + 185 }, { base: 0x5a6858, sheen: true }, { rim: 6, outline: 3 });
  const inner = [[0, -130], [80, -90], [150, -20], [110, 80], [0, 130]];
  paintMaterial(ctx, () => mirroredPath(ctx, inner, cx, cy), { x0: cx - 150, y0: cy - 130, x1: cx + 150, y1: cy + 130 }, { base: 0x4a5444 }, { rim: 4, outline: 2 });
  // battle damage: holes and burns
  for (let k = 0; k < 9; k++) {
    const x = cx + rng.range(-200, 200);
    const y = cy + rng.range(-120, 140);
    const r = rng.range(10, 30);
    ctx.beginPath();
    for (let s = 0; s < 7; s++) {
      const a = (s / 7) * Math.PI * 2;
      const rr = r * rng.range(0.6, 1.2);
      ctx[s ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,10,6,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,140,60,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  lit(ctx, () => {
    glowDot(ctx, cx, cy, 160, 0x90ffc8, 0.3);
    for (const sx of [-1, 1]) glowDot(ctx, cx + sx * 180, cy - 20, 18, 0xa0ffc0, 0.8);
  });
  finish(scene, 'sb_revenant', c);
}

// ---------------------------------------------------------------- overseer
function overseer(scene, colors) {
  const c = canvasFor(560, 440);
  const { ctx, cx, cy } = c;
  const pts = [[0, -210], [70, -190], [140, -120], [260, -70], [270, 30], [180, 130], [120, 200], [0, 214]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, cy), { x0: cx - 270, y0: cy - 210, x1: cx + 270, y1: cy + 214 }, { base: 0xdadde6, sheen: true }, { rim: 6, outline: 3 });
  const inner = [[0, -160], [90, -110], [180, -40], [150, 80], [0, 160]];
  paintMaterial(ctx, () => mirroredPath(ctx, inner, cx, cy), { x0: cx - 180, y0: cy - 160, x1: cx + 180, y1: cy + 160 }, { base: 0xeeeef4, sheen: true }, { rim: 4, outline: 2 });
  ctx.strokeStyle = '#d0a030';
  for (const r of [70, 96, 120]) {
    ctx.lineWidth = r === 96 ? 6 : 3;
    ctx.beginPath();
    ctx.arc(cx, cy + 10, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#d0a030';
    ctx.beginPath();
    ctx.moveTo(cx + sx * 140, cy - 120);
    ctx.lineTo(cx + sx * 250, cy - 66);
    ctx.lineTo(cx + sx * 240, cy - 50);
    ctx.lineTo(cx + sx * 140, cy - 100);
    ctx.fill();
  }
  lit(ctx, () => {
    for (const sx of [-1, 1]) glowDot(ctx, cx + sx * 255, cy - 20, 14, 0xffe080, 0.9);
    glowDot(ctx, cx, cy - 190, 14, 0x80c0ff, 0.9);
  });
  finish(scene, 'sb_overseer', c);
}

const PAINTERS = { crane, prism, brood, forge, revenant, overseer };

export function paintSectorBoss(scene, kind, colors) {
  if (!scene.textures.exists('sb_' + kind)) PAINTERS[kind](scene, colors);
  return 'sb_' + kind;
}
