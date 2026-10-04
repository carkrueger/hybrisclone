// Painted capital ships / megastructures for the distant parallax layer.
// Each painter returns { w, h, lights, engines, spin } (anchors relative to the
// texture centre) and writes two textures: <key> (hull) and <key>_lit (window
// lights, drawn additively so bloom catches them).
import { RNG } from '../../core/rng.js';
import { newCanvas, addCanvasTexture, rgba, shade, mirroredPath, paintMaterial, panelLine, rivet, glowDot, ValueNoise, roundRect } from './canvas.js';

const STEEL = { base: 0x5a6680, sheen: true };
const DECK = { base: 0x3c4660 };
const ARMOR = { base: 0x707c98, sheen: true };
const DARK = { base: 0x232838 };
const WARM = [0xffd890, 0xffc070, 0xfff0c0];
const COOL = [0x9fd8ff, 0xc0e8ff, 0x80b0ff];

function grime(ctx, w, h, noise, amount = 0.32) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const f = 1 + (noise.fbm(x / 36, y / 36, 3) - 0.5) * amount * 2;
      for (const o of [0, 4, w * 4, w * 4 + 4]) {
        const k = i + o;
        if (k + 2 >= d.length) continue;
        d[k] = Math.min(255, d[k] * f);
        d[k + 1] = Math.min(255, d[k + 1] * f);
        d[k + 2] = Math.min(255, d[k + 2] * f);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** rows of tiny lit windows inside a region; clusters follow a noise field ("occupied decks") */
function windows(lit, rng, noise, inside, x0, x1, y0, y1, { sx = 7, sy = 12, density = 0.55, warm = 0.7 } = {}) {
  for (let y = y0; y < y1; y += sy) {
    for (let x = x0; x < x1; x += sx) {
      if (!inside(x, y)) continue;
      const n = noise.noise(x / 50, y / 70);
      if (n < 0.42 || !rng.chance(density)) continue;
      const pal = rng.chance(warm) ? WARM : COOL;
      lit.fillStyle = rgba(rng.pick(pal), 0.55 + rng.float() * 0.45);
      lit.fillRect(x, y, 3, 2);
    }
  }
}

function setup(key, w, h) {
  const base = newCanvas(w, h);
  const lit = newCanvas(w, h);
  return { base, lit, ctx: base.ctx, l: lit.ctx, w, h, cx: w / 2, cy: h / 2 };
}

function finish(scene, key, c, info) {
  addCanvasTexture(scene, key, c.base.c);
  addCanvasTexture(scene, key + '_lit', c.lit.c);
  // anchors relative to centre
  const rel = (p) => ({ ...p, x: p.x - c.cx, y: p.y - c.cy });
  return { w: c.w, h: c.h, spin: info.spin || 0, lights: (info.lights || []).map(rel), engines: (info.engines || []).map(rel) };
}

function nozzle(ctx, l, x, y, r) {
  paintMaterial(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2);
    },
    { x0: x - r, y0: y - r, x1: x + r, y1: y + r },
    DARK,
    { rim: 2, outline: 2 }
  );
  l.globalCompositeOperation = 'lighter';
  glowDot(l, x, y + r * 0.2, r * 0.9, 0x6ab0ff, 0.9);
  l.globalCompositeOperation = 'source-over';
}

function turret(ctx, x, y, r, aim = -Math.PI / 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aim + Math.PI / 2);
  for (const dx of [-r * 0.35, r * 0.35]) {
    ctx.fillStyle = rgba(0x2a3042);
    ctx.fillRect(dx - r * 0.12, -r * 2, r * 0.24, r * 1.6);
  }
  ctx.restore();
  paintMaterial(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
    },
    { x0: x - r, y0: y - r, x1: x + r, y1: y + r },
    ARMOR,
    { rim: 2, outline: 2 }
  );
}

// ---------------------------------------------------------------- battleship
function battleship(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(380 * s), Math.round(1320 * s));
  const { ctx, l, w, h, cx } = c;
  const half = w / 2 - 12;
  const top = 10;
  const len = h - 30;
  const keys = [];
  for (let y = 0; y <= len + 120; y += 110) keys.push(rng.range(0.5, 1) * half);
  const prof = (y) => {
    const k = Math.min(keys.length - 2, Math.floor(y / 110));
    const t = (y % 110) / 110;
    let v = keys[k] * (1 - t) + keys[k + 1] * t;
    if (y < len * 0.2) v *= 0.15 + 0.85 * Math.sqrt(y / (len * 0.2));
    if (y > len * 0.9) v = Math.max(v, half * 0.8);
    return Math.max(8, v);
  };
  const pts = [[0, 0]];
  for (let y = 0; y <= len; y += 8) pts.push([prof(y), y]);
  pts.push([0, len]);
  const path = () => mirroredPath(ctx, pts, cx, top);
  paintMaterial(ctx, path, { x0: cx - half, y0: top, x1: cx + half, y1: top + len }, STEEL, { rim: 6, outline: 3 });

  const inner = [[0, len * 0.1]];
  for (let y = len * 0.1; y <= len * 0.86; y += 8) inner.push([prof(y) * 0.7, y]);
  inner.push([0, len * 0.86]);
  paintMaterial(ctx, () => mirroredPath(ctx, inner, cx, top), { x0: cx - half * 0.7, y0: top + len * 0.1, x1: cx + half * 0.7, y1: top + len * 0.86 }, DECK, { rim: 4, outline: 2 });

  for (let y = rng.int(30, 60); y < len - 20; y += rng.int(28, 56)) {
    const hw = prof(y) * 0.95;
    panelLine(ctx, cx - hw, top + y, cx + hw, top + y, 0.45);
  }
  // spine
  const sw = half * 0.14;
  const sg = ctx.createLinearGradient(cx - sw, 0, cx + sw, 0);
  sg.addColorStop(0, rgba(0x8a96b4));
  sg.addColorStop(1, rgba(0x2c3446));
  ctx.fillStyle = sg;
  ctx.fillRect(cx - sw / 2, top + len * 0.12, sw, len * 0.75);

  // turret rows
  for (let y = len * 0.22; y < len * 0.8; y += rng.int(100, 150)) {
    const off = prof(y) * rng.range(0.45, 0.6);
    for (const sx of [-1, 1]) turret(ctx, cx + sx * off, top + y, 11 * s);
  }
  // bridge tower
  const by = top + len * rng.range(0.5, 0.62);
  for (let k = 0; k < 3; k++) {
    const tw = half * (0.55 - k * 0.12);
    const th = 60 * s - k * 12;
    const ty = by - k * 30 * s;
    paintMaterial(ctx, () => roundRect(ctx, cx - tw / 2, ty, tw, th, 6), { x0: cx - tw / 2, y0: ty, x1: cx + tw / 2, y1: ty + th }, ARMOR, { rim: 3, outline: 2 });
    for (let x = cx - tw / 2 + 6; x < cx + tw / 2 - 6; x += 6) {
      l.fillStyle = rgba(rng.pick(WARM), 0.9);
      l.fillRect(x, ty + 8, 3, 3);
    }
  }
  // hangar bays
  const hangars = [];
  for (const fy of [0.34, 0.72]) {
    const y = top + len * fy;
    const hw = prof(len * fy);
    for (const sx of [-1, 1]) {
      const x = cx + sx * (hw - 26 * s);
      ctx.fillStyle = rgba(0x0c0e16);
      ctx.fillRect(x - 12 * s, y - 30 * s, 24 * s, 60 * s);
      l.fillStyle = rgba(0xffb050, 0.5);
      l.fillRect(x - 10 * s, y - 28 * s, 20 * s, 56 * s);
      hangars.push({ x, y: y - 30 * s, color: 0xffa030, rate: 0.004, size: 0.35 });
    }
  }
  grime(ctx, w, h, noise);
  windows(l, rng, noise, (x, y) => Math.abs(x - cx) < prof(y - top) * 0.88 && Math.abs(x - cx) > sw, 0, w, top + len * 0.06, top + len * 0.95);

  // engines at the stern
  const n = rng.int(3, 5);
  const engines = [];
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * ((half * 1.4) / n);
    nozzle(ctx, l, x, top + len - 6, 16 * s);
    engines.push({ x, y: top + len + 4, r: 22 * s });
  }
  let widest = 0;
  for (let y = 0; y < len; y += 8) if (prof(y) > prof(widest)) widest = y;
  const lights = [
    { x: cx, y: top + 6, color: 0xffffff, rate: 0.006, size: 0.6 },
    { x: cx - prof(widest) + 4, y: top + widest, color: 0xff3030, rate: 0.003, size: 0.55 },
    { x: cx + prof(widest) - 4, y: top + widest, color: 0x30ff60, rate: 0.003, size: 0.55 },
    ...hangars,
  ];
  for (let y = len * 0.2; y < len * 0.85; y += 180) lights.push({ x: cx, y: top + y, color: 0xffc040, rate: 0.002, size: 0.4 });
  return finish(scene, key, c, { lights, engines });
}

// ---------------------------------------------------------------- carrier
function carrier(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(580 * s), Math.round(1040 * s));
  const { ctx, l, w, h, cx } = c;
  const hw = w / 2 - 12;
  const len = h - 30;
  const top = 10;
  const pts = [[0, 0], [hw * 0.55, len * 0.05], [hw * 0.9, len * 0.18], [hw, len * 0.3], [hw, len * 0.86], [hw * 0.8, len], [0, len]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, top), { x0: cx - hw, y0: top, x1: cx + hw, y1: top + len }, STEEL, { rim: 6, outline: 3 });
  // flight deck
  const dx0 = cx - hw * 0.62;
  const dw = hw * 0.95;
  const dy0 = top + len * 0.08;
  const dh = len * 0.86;
  paintMaterial(ctx, () => roundRect(ctx, dx0, dy0, dw, dh, 10), { x0: dx0, y0: dy0, x1: dx0 + dw, y1: dy0 + dh }, DECK, { rim: 3, outline: 2 });
  ctx.setLineDash([22 * s, 18 * s]);
  ctx.strokeStyle = 'rgba(230,236,250,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(dx0 + dw / 2, dy0 + 40);
  ctx.lineTo(dx0 + dw / 2, dy0 + dh - 40);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(230,236,250,0.5)';
  for (let k = 0; k < 6; k++) ctx.fillRect(dx0 + dw / 2 - 40 + k * 14, dy0 + dh - 70, 8, 40);
  ctx.font = `900 ${Math.round(40 * s)}px Orbitron, Arial Black, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(rng.int(10, 36)), dx0 + dw / 2, dy0 + dh - 90);
  // island superstructure
  const ix = cx + hw * 0.62;
  for (let k = 0; k < 3; k++) {
    const iw = 60 * s - k * 12;
    const ih = 180 * s - k * 40;
    const iy = top + len * 0.42 + k * 20;
    paintMaterial(ctx, () => roundRect(ctx, ix - iw / 2, iy, iw, ih, 5), { x0: ix - iw / 2, y0: iy, x1: ix + iw / 2, y1: iy + ih }, ARMOR, { rim: 3, outline: 2 });
  }
  for (let y = top + len * 0.43; y < top + len * 0.6; y += 8) {
    l.fillStyle = rgba(rng.pick(COOL), 0.85);
    l.fillRect(ix - 20 * s, y, 40 * s, 2);
  }
  grime(ctx, w, h, noise);
  const outsideDeck = (x, y) => (x < dx0 - 6 || x > dx0 + dw + 6) && Math.abs(x - cx) < hw * 0.92 && y > top + len * 0.2 && !(Math.abs(x - ix) < 34 * s);
  windows(l, rng, noise, outsideDeck, 0, w, top + len * 0.2, top + len * 0.97, { sx: 6, sy: 10, density: 0.6, warm: 0.5 });

  const lights = [];
  for (let y = dy0 + 30; y < dy0 + dh - 20; y += 56 * s) {
    const k = lights.length;
    lights.push({ x: dx0 + 6, y, color: 0x60c0ff, rate: 0.004, phase: k * 0.5, size: 0.3 });
    lights.push({ x: dx0 + dw - 6, y, color: 0x60c0ff, rate: 0.004, phase: k * 0.5, size: 0.3 });
  }
  lights.push({ x: ix, y: top + len * 0.42, color: 0xff4040, rate: 0.005, size: 0.6 });
  const engines = [];
  for (let i = 0; i < 4; i++) {
    const x = cx + (i - 1.5) * hw * 0.42;
    nozzle(ctx, l, x, top + len - 8, 18 * s);
    engines.push({ x, y: top + len + 4, r: 24 * s });
  }
  return finish(scene, key, c, { lights, engines });
}

// ---------------------------------------------------------------- ring station
function ring(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const size = Math.round(880 * s);
  const c = setup(key, size, size);
  const { ctx, l, cx, cy } = c;
  const R = size / 2 - 30;
  const T = 70 * s;
  // spokes
  const spokes = rng.pick([4, 6, 8]);
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    paintMaterial(ctx, () => {
      ctx.beginPath();
      ctx.rect(70 * s, -12 * s, R - T / 2 - 70 * s, 24 * s);
    }, { x0: 70 * s, y0: -12 * s, x1: R, y1: 12 * s }, DECK, { rim: 2, outline: 2 });
    ctx.restore();
  }
  // ring annulus
  const annulus = () => {
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.arc(cx, cy, R - T, 0, Math.PI * 2, true);
  };
  paintMaterial(ctx, annulus, { x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R }, STEEL, { rim: 5, outline: 3 });
  // modules around the ring
  const mods = rng.int(18, 30);
  for (let k = 0; k < mods; k++) {
    const a = (k / mods) * Math.PI * 2;
    const r = R - T / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a);
    const mw = T * 0.7;
    const mh = rng.range(16, 34) * s;
    paintMaterial(ctx, () => roundRect(ctx, -mw / 2, -mh / 2, mw, mh, 4), { x0: -mw / 2, y0: -mh / 2, x1: mw / 2, y1: mh / 2 }, k % 3 ? ARMOR : DECK, { rim: 2, outline: 1.5 });
    ctx.restore();
  }
  // hub
  paintMaterial(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 80 * s, 0, Math.PI * 2);
  }, { x0: cx - 80 * s, y0: cy - 80 * s, x1: cx + 80 * s, y1: cy + 80 * s }, ARMOR, { rim: 5, outline: 3 });
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    rivet(ctx, cx + Math.cos(a) * 62 * s, cy + Math.sin(a) * 62 * s, 3);
  }
  paintMaterial(ctx, () => {
    ctx.beginPath();
    ctx.arc(cx, cy, 34 * s, 0, Math.PI * 2);
  }, { x0: cx - 34 * s, y0: cy - 34 * s, x1: cx + 34 * s, y1: cy + 34 * s }, DARK, { rim: 3, outline: 2 });
  l.globalCompositeOperation = 'lighter';
  glowDot(l, cx, cy, 40 * s, 0x60c0ff, 0.6);
  l.globalCompositeOperation = 'source-over';
  grime(ctx, size, size, noise, 0.25);
  // windows along the ring
  for (let row = 0; row < 3; row++) {
    const r = R - T * (0.25 + row * 0.25);
    const steps = Math.floor((2 * Math.PI * r) / 7);
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      if (noise.noise(k / 18, row * 3) < 0.45 || !rng.chance(0.6)) continue;
      l.fillStyle = rgba(rng.pick(rng.chance(0.6) ? WARM : COOL), 0.8);
      l.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 2);
    }
  }
  const lights = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    lights.push({ x: cx + Math.cos(a) * (R + 2), y: cy + Math.sin(a) * (R + 2), color: k % 2 ? 0xff4040 : 0xffffff, rate: 0.003, phase: k, size: 0.45 });
  }
  return finish(scene, key, c, { lights, engines: [], spin: rng.range(0.015, 0.035) * (rng.chance(0.5) ? 1 : -1) });
}

// ---------------------------------------------------------------- dry dock
function beam(ctx, x0, y0, x1, y1, wd) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  const g = ctx.createLinearGradient(0, -wd / 2, 0, wd / 2);
  g.addColorStop(0, '#7a86a4');
  g.addColorStop(1, '#262c3c');
  ctx.fillStyle = g;
  ctx.fillRect(0, -wd / 2, len, wd);
  ctx.strokeStyle = 'rgba(10,12,20,0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0, -wd / 2, len, wd);
  ctx.strokeStyle = 'rgba(20,24,34,0.7)';
  for (let x = 0; x < len; x += wd * 1.4) {
    ctx.beginPath();
    ctx.moveTo(x, -wd / 2);
    ctx.lineTo(x + wd * 0.7, wd / 2);
    ctx.lineTo(x + wd * 1.4, -wd / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function dock(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(640 * s), Math.round(1160 * s));
  const { ctx, l, w, h, cx } = c;
  const fx0 = 20;
  const fx1 = w - 20;
  const fy0 = 20;
  const fy1 = h - 20;
  const bw = 22 * s;
  // the ship under construction
  const half = (fx1 - fx0) * 0.3;
  const len = (fy1 - fy0) * 0.86;
  const top = fy0 + (fy1 - fy0) * 0.07;
  const prof = (y) => {
    let v = half * (0.7 + 0.3 * Math.sin((y / len) * Math.PI));
    if (y < len * 0.2) v *= 0.2 + 0.8 * (y / (len * 0.2));
    return v;
  };
  const built = len * rng.range(0.45, 0.7);
  const pts = [[0, 0]];
  for (let y = 0; y <= built; y += 8) pts.push([prof(y), y]);
  pts.push([0, built]);
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, top), { x0: cx - half, y0: top, x1: cx + half, y1: top + built }, STEEL, { rim: 5, outline: 3 });
  // exposed ribs below the plating
  ctx.strokeStyle = 'rgba(120,134,164,0.95)';
  ctx.lineWidth = 5 * s;
  for (let y = built + 16; y < len; y += 34 * s) {
    ctx.beginPath();
    ctx.ellipse(cx, top + y, prof(y), 12 * s, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(cx, top + built);
  ctx.lineTo(cx, top + len);
  ctx.stroke();
  // frame
  for (const x of [fx0, fx1]) beam(ctx, x, fy0, x, fy1, bw);
  for (let y = fy0; y <= fy1; y += (fy1 - fy0) / rng.int(4, 6)) beam(ctx, fx0, y, fx1, y, bw * 0.8);
  // crane arms
  const cranes = [];
  for (let k = 0; k < rng.int(2, 3); k++) {
    const y = fy0 + rng.range(0.15, 0.85) * (fy1 - fy0);
    const fromLeft = k % 2 === 0;
    const x0 = fromLeft ? fx0 : fx1;
    const x1 = cx + (fromLeft ? -1 : 1) * half * 0.6;
    beam(ctx, x0, y, x1, y + 20 * s, bw * 0.6);
    cranes.push({ x: x1, y: y + 20 * s, color: 0xffb030, rate: 0.008, size: 0.5 });
  }
  grime(ctx, w, h, noise);
  windows(l, rng, noise, (x, y) => Math.abs(x - cx) < prof(y - top) * 0.85 && y < top + built, cx - half, cx + half, top + 20, top + built, { density: 0.35 });
  const lights = [...cranes];
  for (const x of [fx0, fx1]) for (let y = fy0; y <= fy1; y += (fy1 - fy0) / 5) lights.push({ x, y, color: 0xffb030, rate: 0.0025, phase: y, size: 0.4 });
  return finish(scene, key, c, { lights, engines: [] });
}


// ---------------------------------------------------------------- asteroid (crystal mines)
function asteroid(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const size = Math.round(rng.range(380, 620) * s);
  const c = setup(key, size, size);
  const { ctx, l, cx, cy } = c;
  const R = size / 2 - 20;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / R;
      const dy = (y - cy) / R;
      const a = Math.atan2(dy, dx);
      const edge = 0.82 + noise.fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2 + 5, 3) * 0.3;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > edge) continue;
      const n = noise.fbm(x / 40, y / 40, 4);
      const light = Math.max(0.15, 1 - (dx + dy + 1) * 0.35) * (0.6 + n * 0.7) * (d > edge - 0.04 ? 0.5 : 1);
      const crater = noise.noise(x / 22 + 9, y / 22 + 3) > 0.78 ? 0.6 : 1;
      const i = (y * size + x) * 4;
      img.data[i] = 80 * light * crater;
      img.data[i + 1] = 90 * light * crater;
      img.data[i + 2] = 110 * light * crater;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // crystal veins (lit layer)
  const lights = [];
  for (let k = 0; k < rng.int(5, 10); k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(0, R * 0.6);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    l.globalCompositeOperation = 'lighter';
    glowDot(l, x, y, rng.range(10, 26), rng.pick([0x80e8ff, 0xb090ff]), 0.7);
    if (k % 2) lights.push({ x, y, color: 0x80e8ff, rate: 0.002, size: 0.4 });
  }
  return finish(scene, key, c, { lights, engines: [], spin: rng.range(0.01, 0.03) * (rng.chance(0.5) ? 1 : -1) });
}

// ---------------------------------------------------------------- hive ship (organic)
function hiveship(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(460 * s), Math.round(1100 * s));
  const { ctx, l, w, h, cx } = c;
  const segs = rng.int(5, 8);
  const lights = [];
  for (let k = segs - 1; k >= 0; k--) {
    const y = 60 + (k / segs) * (h - 160);
    const rx = (w / 2 - 30) * (0.55 + 0.45 * Math.sin((k / segs) * Math.PI));
    const ry = (h / segs) * 0.75;
    paintMaterial(ctx, () => {
      ctx.beginPath();
      ctx.ellipse(cx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    }, { x0: cx - rx, y0: y, x1: cx + rx, y1: y + ry * 2 }, { base: k % 2 ? 0x5a3a6a : 0x6a4a7a, sheen: true }, { rim: 5, outline: 2 });
    for (const sx of [-1, 1]) {
      l.globalCompositeOperation = 'lighter';
      glowDot(l, cx + sx * rx * 0.6, y + ry, 14, 0x80ff90, 0.8);
      lights.push({ x: cx + sx * rx * 0.6, y: y + ry, color: 0x80ff90, rate: 0.0015, size: 0.45, phase: k });
    }
  }
  grime(ctx, w, h, noise, 0.4);
  return finish(scene, key, c, { lights, engines: [] });
}

// ---------------------------------------------------------------- smelter tower (foundry)
function smelter(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(520 * s), Math.round(900 * s));
  const { ctx, l, w, h, cx } = c;
  const body = [[0, 20], [w * 0.3, 20], [w * 0.42, 120], [w * 0.46, h - 120], [w * 0.36, h - 30], [0, h - 20]];
  paintMaterial(ctx, () => mirroredPath(ctx, body, cx, 0), { x0: 0, y0: 0, x1: w, y1: h }, { base: 0x4a403c, sheen: true }, { rim: 6, outline: 3 });
  const lights = [];
  for (let y = 120; y < h - 120; y += rng.int(60, 110)) {
    l.globalCompositeOperation = 'lighter';
    l.fillStyle = 'rgba(255,110,30,0.85)';
    l.fillRect(cx - w * 0.36, y, w * 0.72, 4);
    glowDot(l, cx, y, 50, 0xff6a20, 0.35);
  }
  for (const sx of [-1, 1]) {
    paintMaterial(ctx, () => roundRect(ctx, cx + sx * w * 0.2 - 30, 0, 60, 120, 8), { x0: cx + sx * w * 0.2 - 30, y0: 0, x1: cx + sx * w * 0.2 + 30, y1: 120 }, { base: 0x3a3230 }, { rim: 3 });
    lights.push({ x: cx + sx * w * 0.2, y: 8, color: 0xff7020, rate: 0.003, size: 0.8 });
  }
  grime(ctx, w, h, noise, 0.35);
  windows(l, rng, noise, (x, y) => Math.abs(x - cx) < w * 0.3, 0, w, 140, h - 140, { warm: 1, density: 0.4 });
  return finish(scene, key, c, { lights, engines: [] });
}

// ---------------------------------------------------------------- wreck (graveyard)
function wreck(scene, key, obj) {
  const info = battleship(scene, key, { ...obj, kind: 'battleship' });
  // punch holes, burn marks and a broken stern into the painted hull
  const tex = scene.textures.get(key).getSourceImage();
  const ctx = tex.getContext('2d');
  const rng = new RNG(obj.seed ^ 0x5a5a);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(0, tex.height * rng.range(0.7, 0.85), tex.width, tex.height);
  for (let k = 0; k < 8; k++) {
    ctx.beginPath();
    ctx.arc(rng.range(0, tex.width), rng.range(0, tex.height * 0.75), rng.range(10, 36), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(40,60,40,0.35)';
  ctx.fillRect(0, 0, tex.width, tex.height);
  ctx.globalCompositeOperation = 'source-over';
  scene.textures.get(key).refresh();
  const lit = scene.textures.get(key + '_lit').getSourceImage().getContext('2d');
  lit.clearRect(0, tex.height * 0.6, tex.width, tex.height);
  const fires = [];
  for (let k = 0; k < 4; k++) {
    const x = rng.range(tex.width * 0.25, tex.width * 0.75) - tex.width / 2;
    const y = rng.range(tex.height * 0.1, tex.height * 0.65) - tex.height / 2;
    fires.push({ x, y, color: 0xff7030, rate: 0.009, size: 0.5, phase: k });
  }
  scene.textures.get(key + '_lit').refresh();
  return { ...info, engines: [], lights: fires.concat(info.lights.filter((l) => l.y < tex.height * 0.1)) };
}

// ---------------------------------------------------------------- spire (citadel)
function spire(scene, key, obj) {
  const rng = new RNG(obj.seed);
  const noise = new ValueNoise(rng.nextU32());
  const s = obj.scale;
  const c = setup(key, Math.round(420 * s), Math.round(1250 * s));
  const { ctx, l, w, h, cx } = c;
  const pts = [[0, 10], [w * 0.08, 160], [w * 0.3, 420], [w * 0.45, 700], [w * 0.3, h - 160], [w * 0.12, h - 20], [0, h - 10]];
  paintMaterial(ctx, () => mirroredPath(ctx, pts, cx, 0), { x0: 0, y0: 0, x1: w, y1: h }, { base: 0xc8ccd8, sheen: true }, { rim: 6, outline: 3 });
  ctx.strokeStyle = '#c89a28';
  ctx.lineWidth = 4;
  for (let y = 300; y < h - 200; y += 120) {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.36, y);
    ctx.lineTo(cx + w * 0.36, y);
    ctx.stroke();
  }
  grime(ctx, w, h, noise, 0.08);
  windows(l, rng, noise, (x, y) => Math.abs(x - cx) < w * 0.25, 0, w, 200, h - 200, { warm: 0.4, density: 0.7 });
  const lights = [{ x: cx, y: 12, color: 0xffffff, rate: 0.005, size: 0.7 }];
  for (let y = 300; y < h - 200; y += 240) for (const sx of [-1, 1]) lights.push({ x: cx + sx * w * 0.3, y, color: 0xffd060, rate: 0.003, size: 0.4, phase: y });
  return finish(scene, key, c, { lights, engines: [{ x: cx, y: h - 8, r: 30 }] });
}

const PAINTERS = { battleship, carrier, ring, dock, asteroid, hiveship, smelter, wreck, spire };

export function paintMega(scene, key, obj) {
  return PAINTERS[obj.kind](scene, key, obj);
}

export { shade };
