// Seeded enemy waves. Each wave triggers at a scroll distance `d`; everything
// about it (pattern, type, count, timing, who carries a power-up) is decided here.
import { W, TILE, SECTOR_LENGTH } from '../config.js';

export const ENEMY_DEFS = {
  drone: { tex: 'e_drone', hp: 1, r: 6, score: 100, fire: null },
  fighter: { tex: 'e_fighter', hp: 2, r: 6, score: 150, fire: { kind: 'aimed', every: 1900 } },
  kamikaze: { tex: 'e_kamikaze', hp: 1, r: 4, score: 120, fire: null },
  spinner: { tex: 'e_spinner', hp: 5, r: 6, score: 250, fire: { kind: 'ring', n: 6, every: 2600 }, spin: 4 },
  bomber: { tex: 'e_bomber', hp: 16, r: 10, score: 800, fire: { kind: 'fan', n: 3, spread: 0.5, every: 1500 } },
  turret: { tex: 'e_turret', hp: 5, r: 7, score: 300, fire: { kind: 'aimed', every: 1700 }, ground: true },
};

const PATTERNS = {
  line: { types: ['drone', 'fighter'], weight: 3 },
  sine: { types: ['drone', 'fighter', 'kamikaze'], weight: 3 },
  vform: { types: ['fighter', 'drone'], weight: 2 },
  swoop: { types: ['drone', 'fighter', 'kamikaze'], weight: 3 },
  dive: { types: ['kamikaze'], weight: 2 },
  circle: { types: ['drone', 'spinner'], weight: 2 },
  hover: { types: ['bomber', 'spinner'], weight: 2 },
};

function makeWave(rng, sector, d, mirrorOf = null) {
  const pattern = mirrorOf
    ? mirrorOf.pattern
    : rng.weighted(Object.entries(PATTERNS).map(([k, v]) => [k === 'hover' && sector === 0 && d < SECTOR_LENGTH * 0.25 ? 0 : v.weight, k]));
  const type = mirrorOf ? mirrorOf.type : rng.pick(PATTERNS[pattern].types);
  const p = {};
  let count = 1;
  let interval = 0;

  switch (pattern) {
    case 'line':
      count = rng.int(4, 6);
      interval = rng.int(300, 420);
      p.x = rng.int(40, W - 40);
      p.speed = rng.int(70, 100);
      break;
    case 'sine':
      count = rng.int(5, 8);
      interval = rng.int(240, 320);
      p.x = rng.int(70, W - 70);
      p.amp = rng.int(30, 70);
      p.freq = rng.range(0.0018, 0.0032);
      p.speed = rng.int(60, 90);
      break;
    case 'vform':
      count = rng.pick([5, 7]);
      interval = 0;
      p.x = rng.int(70, W - 70);
      p.spacing = rng.int(16, 22);
      p.speed = rng.int(55, 80);
      break;
    case 'swoop':
      count = rng.int(5, 8);
      interval = rng.int(180, 260);
      p.side = rng.chance(0.5) ? -1 : 1;
      p.y0 = rng.int(10, 120);
      p.cy = rng.int(180, 320);
      p.y1 = rng.int(20, 200);
      p.dur = rng.int(2600, 3600);
      break;
    case 'dive':
      count = rng.int(3, 5);
      interval = rng.int(350, 500);
      p.xs = Array.from({ length: count }, () => rng.int(30, W - 30));
      p.stopY = rng.int(60, 140);
      break;
    case 'circle':
      count = type === 'spinner' ? rng.int(3, 4) : rng.int(6, 8);
      interval = type === 'spinner' ? 450 : rng.int(220, 280);
      p.cx = rng.int(100, W - 100);
      p.cy = rng.int(140, 210);
      p.radius = rng.int(50, 75);
      p.dir = rng.chance(0.5) ? -1 : 1;
      break;
    case 'hover':
      count = type === 'bomber' ? rng.int(1, 2) : rng.int(2, 3);
      interval = rng.int(500, 900);
      p.xs = Array.from({ length: count }, (_, i) => Math.round(((i + 1) * W) / (count + 1)) + rng.int(-20, 20));
      p.stopY = rng.int(70, 150);
      p.stay = rng.int(5000, 8000);
      break;
  }

  if (mirrorOf) {
    Object.assign(p, mirrorOf.params);
    if (p.x !== undefined) p.x = W - p.x;
    if (p.cx !== undefined) p.cx = W - p.cx;
    if (p.side !== undefined) p.side = -p.side;
    if (p.xs) p.xs = p.xs.map((x) => W - x);
    if (p.dir !== undefined) p.dir = -p.dir;
    count = mirrorOf.count;
    interval = mirrorOf.interval;
  }

  return {
    d,
    pattern,
    type,
    count,
    interval,
    params: p,
    fireDelays: Array.from({ length: count }, () => rng.int(500, 2200)),
    canFire: type !== 'drone' || sector >= 2 || rng.chance(0.15),
    carrier: -1,
    pod: null,
  };
}

export function generateWaves(rng, sector, backdrop) {
  const waves = [];
  const density = 1 - Math.min(0.4, sector * 0.07);
  let d = 280;
  while (d < SECTOR_LENGTH - 200) {
    const wave = makeWave(rng, sector, d);
    waves.push(wave);
    if (rng.chance(Math.min(0.45, 0.15 + sector * 0.05)) && wave.pattern !== 'hover') {
      waves.push(makeWave(rng, sector, d + rng.int(0, 40), wave));
    }
    d += Math.round(rng.int(160, 290) * density);
  }

  // power-up carriers: deterministic, roughly one in three waves
  let podCount = 0;
  waves.forEach((w, i) => {
    if (i % 3 === 2 || rng.chance(0.08)) {
      w.carrier = w.count - 1;
      podCount++;
      w.pod = podCount % 5 === 0 ? 'B' : rng.chance(0.12) ? 'S' : 'P';
    }
  });

  const turrets = backdrop.turrets.map((t) => ({
    d: t.row * TILE + TILE / 2,
    x: t.col * TILE + TILE / 2,
    fireDelay: rng.int(300, 1500),
  }));

  return { waves, turrets };
}
