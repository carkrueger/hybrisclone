// Styled text helpers (Orbitron / Exo 2, bundled through @fontsource).
import { FONT } from '../config.js';

export const COLORS = {
  white: 0xffffff,
  yellow: 0xffe14a,
  orange: 0xff9a3a,
  red: 0xff4a4a,
  cyan: 0x5ae4ff,
  green: 0x6aff8a,
  grey: 0xa8b2cc,
  dim: 0x6a7490,
  pink: 0xff70c8,
};

// render text at 2x so it stays sharp when the 1920x1080 canvas is scaled up
const TEXT_RES = Math.max(2, Math.ceil(window.devicePixelRatio || 1));

export const hex = (c) => '#' + c.toString(16).padStart(6, '0');

/**
 * text(scene, x, y, str, opts)
 *   size, color, font ('display' | 'body'), weight, origin (number | [x, y]),
 *   depth, glow (bool | color), stroke (bool), align, spacing
 */
export function text(scene, x, y, str, opts = {}) {
  const {
    size = 28,
    color = COLORS.white,
    font = 'display',
    weight = 700,
    origin = 0.5,
    depth = 100,
    glow = true,
    stroke = true,
    align = 'center',
    spacing = 0,
  } = opts;
  const t = scene.add.text(x, y, String(str), {
    fontFamily: FONT[font] || font,
    fontSize: `${size}px`,
    fontStyle: String(weight),
    color: hex(color),
    align,
    stroke: stroke ? '#05060c' : undefined,
    strokeThickness: stroke ? Math.max(2, Math.round(size / 9)) : 0,
    shadow: glow
      ? { offsetX: 0, offsetY: 0, color: hex(glow === true ? color : glow), blur: Math.round(size / 5), fill: true, stroke: false }
      : { offsetX: 0, offsetY: Math.round(size / 12), color: '#000000', blur: 2, fill: true },
    padding: { x: Math.ceil(size / 3), y: Math.ceil(size / 3) },
    resolution: TEXT_RES,
  });
  if (spacing) t.setLetterSpacing(spacing);
  t.setDepth(depth);
  if (Array.isArray(origin)) t.setOrigin(origin[0], origin[1]);
  else t.setOrigin(origin);
  return t;
}

export function setColor(t, color, glow = true) {
  t.setColor(hex(color));
  if (glow) t.setShadowColor(hex(color));
  return t;
}

export function pad(n, len = 8) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

/** Big logo: per-letter texts with a vertical gradient and a gentle wave. */
export function logo(scene, x, y, str, size = 130, depth = 100) {
  const letters = [];
  const probe = scene.add.text(0, 0, str, { fontFamily: FONT.display, fontSize: `${size}px`, fontStyle: '900' });
  const total = probe.width;
  probe.destroy();
  let cx = x - total / 2;
  for (const ch of str) {
    const t = scene.add.text(cx, y, ch, {
      fontFamily: FONT.display,
      fontSize: `${size}px`,
      fontStyle: '900',
      stroke: '#14060a',
      strokeThickness: Math.round(size / 14),
      shadow: { offsetX: 0, offsetY: 0, color: '#ff6a20', blur: size / 6, fill: true, stroke: true },
      padding: { x: size / 3, y: size / 3 },
      resolution: TEXT_RES,
    });
    const g = t.context.createLinearGradient(0, size * 0.35, 0, size * 1.3);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.35, '#ffd24a');
    g.addColorStop(0.7, '#ff6a20');
    g.addColorStop(1, '#c0202a');
    t.setFill(g);
    t.setOrigin(0, 0.5).setDepth(depth);
    t.baseY = y;
    letters.push(t);
    cx += t.width - (size / 3) * 2;
  }
  return {
    letters,
    update(time) {
      letters.forEach((t, i) => {
        t.y = t.baseY + Math.sin(time * 0.0025 + i * 0.5) * size * 0.05;
      });
    },
    destroy() {
      letters.forEach((t) => t.destroy());
    },
  };
}
