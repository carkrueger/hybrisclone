// Seeded end-of-sector boss: hull shape, gun pods, core and attack phases.

const SYL_A = ['ZOR', 'KRA', 'VEX', 'MAL', 'TOR', 'XEN', 'GOR', 'NYX', 'DRA', 'SKA', 'VOR', 'QUA'];
const SYL_B = ['GOTH', 'NOID', 'TRON', 'KAAN', 'MAX', 'VOX', 'RIUS', 'DON', 'THUL', 'ZAR'];

const SCHEMES = [
  { base: 0x707890, light: 0xb8c0d8, mid: 0x98a0b8, dark: 0x3c4058, glow: 0xff4040 },
  { base: 0x6a8a68, light: 0xa8d0a0, mid: 0x88aa80, dark: 0x304830, glow: 0xffe040 },
  { base: 0x8a7050, light: 0xd8b888, mid: 0xa88a60, dark: 0x4a3420, glow: 0x40e0ff },
  { base: 0x7a6090, light: 0xc0a8e0, mid: 0x9880b0, dark: 0x3a2850, glow: 0x60ff80 },
  { base: 0x904848, light: 0xe09898, mid: 0xb06868, dark: 0x4a1c1c, glow: 0xffff80 },
  { base: 0x507888, light: 0x98c8d8, mid: 0x7098a8, dark: 0x203840, glow: 0xff60c0 },
];

const CORE_PATTERNS = ['fan', 'ring', 'spiral', 'aimed3', 'rain', 'wave'];
const GUN_PATTERNS = ['aimed', 'fan3', 'burst'];

export function generateBoss(rng, sector) {
  const name = rng.pick(SYL_A) + rng.pick(SYL_B) + (sector > 0 ? '-' + (sector + 1) : '');
  const half = rng.int(36, 66);
  const w = half * 2 + 1;
  const h = rng.int(52, 84);

  // smooth random profile, tapering to a prow at the bottom
  const keys = [];
  for (let y = 0; y <= h + 8; y += 8) keys.push(rng.int(Math.floor(half * 0.35), half));
  const profile = [];
  for (let y = 0; y < h; y++) {
    const k = Math.floor(y / 8);
    const t = (y % 8) / 8;
    let v = keys[k] * (1 - t) + keys[k + 1] * t;
    const fromBottom = h - 1 - y;
    if (fromBottom < 14) v = Math.min(v, 6 + fromBottom * (half / 14));
    if (y < 4) v = Math.min(v, half * 0.5 + y * 4);
    profile.push(Math.max(8, Math.round(v)));
  }
  const coreY = Math.round(h * rng.range(0.38, 0.55));
  for (let y = coreY - 14; y <= coreY + 14; y++) if (y >= 0 && y < h) profile[y] = Math.max(profile[y], 16);

  const colors = rng.pick(SCHEMES);

  // gun pods in mirrored pairs, kept away from the core and from each other
  const guns = [];
  const pairs = rng.int(1, 2 + Math.min(2, sector));
  let tries = 0;
  while (guns.length < pairs * 2 && tries++ < 200) {
    const y = rng.int(8, h - 16);
    const maxX = profile[y] - 6;
    if (maxX < 12) continue;
    const x = rng.int(12, maxX);
    if (Math.hypot(x, y - coreY) < 20) continue;
    if (guns.some((g) => Math.hypot(g.x - x, g.y - y) < 16)) continue;
    const gun = {
      x,
      y,
      hp: 22 + sector * 10,
      pattern: rng.pick(GUN_PATTERNS),
      every: Math.round(rng.int(1400, 2400) * (1 - 0.06 * Math.min(sector, 6))),
      offset: rng.int(0, 1200),
    };
    guns.push(gun, { ...gun, x: -x, offset: gun.offset + rng.int(100, 500) });
  }

  const phases = [];
  for (let i = 0; i < 3; i++) {
    const pool = rng.shuffle(CORE_PATTERNS);
    phases.push(
      pool.slice(0, i + 1).map((pattern) => ({
        pattern,
        every: Math.round(rng.int(1800, 2800) * (1 - 0.18 * i) * (1 - 0.05 * Math.min(sector, 6))),
        n: rng.int(6, 10) + i * 2 + Math.min(sector, 5),
        offset: rng.int(0, 1000),
      }))
    );
  }

  const move = rng.pick(['sway', 'figure8', 'drift']);
  const moveSpeed = rng.range(0.6, 1.1) + sector * 0.05;
  // sliding armour plates over the core (drawn after the rest so earlier data is unchanged)
  const plates = [];
  const plateCount = rng.int(1, 2);
  for (let k = 0; k < plateCount; k++) {
    plates.push({
      w: rng.int(11, 15),
      h: rng.int(8, 11),
      y: coreY + (plateCount === 1 ? 0 : k ? 6 : -6),
      period: rng.int(3200, 5200),
      phase: Math.round(rng.range(0, 6.28) * 100) / 100,
    });
  }

  return {
    name,
    hull: { w, h, profile, colors },
    plates,
    core: { x: 0, y: coreY, hp: 150 + sector * 75 },
    guns,
    move,
    moveSpeed,
    phases,
    bulletSpeed: Math.min(200, 95 + sector * 12),
    score: 10000 + sector * 5000,
  };
}
