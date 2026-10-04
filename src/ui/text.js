// Bitmap-text helpers around the generated 5x7 retro font.

export function text(scene, x, y, str, { tint = 0xffffff, scale = 1, origin = 0.5, depth = 100 } = {}) {
  const t = scene.add.bitmapText(x, y, 'font', String(str)).setScale(scale).setDepth(depth);
  if (Array.isArray(origin)) t.setOrigin(origin[0], origin[1]);
  else t.setOrigin(origin);
  if (tint !== 0xffffff) t.setTint(tint);
  return t;
}

export function pad(n, len = 7) {
  return String(Math.max(0, Math.floor(n))).padStart(len, '0');
}

export function gradientTitle(scene, x, y, str, scale = 3, depth = 100) {
  const t = scene.add.dynamicBitmapText(x, y, 'font', str).setScale(scale).setOrigin(0.5).setDepth(depth);
  t.setTint(0xfff070, 0xfff070, 0xff4020, 0xff4020);
  t.setDisplayCallback((data) => {
    data.y += Math.sin(scene.time.now * 0.004 + data.index * 0.55) * 1.5;
    return data;
  });
  return t;
}

export const COLORS = {
  white: 0xffffff,
  yellow: 0xffe040,
  orange: 0xff9030,
  red: 0xff4040,
  cyan: 0x60e0ff,
  green: 0x60ff80,
  grey: 0x9098b0,
  dim: 0x606880,
  pink: 0xff70c0,
};
