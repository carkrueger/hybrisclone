// Seeded enemy waves in world pixels. Each wave triggers at a scroll distance `d`
// inside a screen region (one or two of three lanes); everything about it
// (pattern, type, count, timing, who carries a power-up) is decided here.
import { W, U, TILE, SECTOR_LENGTH } from '../config.js';

export const ENEMY_DEFS = {
  drone: { tex: 'e_drone', hp: 1, r: 26, score: 100, fire: null },
  fighter: { tex: 'e_fighter', hp: 2, r: 28, score: 150, fire: { kind: 'aimed', every: 1900 } },
  kamikaze: { tex: 'e_kamikaze', hp: 1, r: 20, score: 120, fire: null },
  spinner: { tex: 'e_spinner', hp: 5, r: 28, score: 250, fire: { kind: 'ring', n: 6, every: 2600 }, spin: 4 },
  bomber: { tex: 'e_bomber', hp: 16, r: 54, score: 800, fire: { kind: 'fan', n: 3, spread: 0.5, every: 1500 } },
  interceptor: { tex: 'e_interceptor', hp: 2, r: 28, score: 200, fire: { kind: 'spread3', every: 1700 } },
  gunship: { tex: 'e_gunship', hp: 11, r: 50, score: 600, fire: { kind: 'twin', every: 1500 } },
  mine: { tex: 'e_mine', hp: 3, r: 24, score: 150, fire: null, mine: true, spin: 1.2 },
  turret: { tex: 'e_turret', hp: 5, r: 34, score: 300, fire: { kind: 'aimed', every: 1700 }, ground: true },
};

/** progressive unlocks: [minimum sector, minimum fraction of the sector] */
const UNLOCK = {
  bomber: [0, 0.25],
  interceptor: [0, 0.2],
  gunship: [0, 0.45],
  mine: [0, 0.6],
};
const unlocked = (type, sector, d) => {
  const u = UNLOCK[type];
  return !u || sector > u[0] || d >= SECTOR_LENGTH * u[1];
};

const LANE = W / 3;

const PATTERNS = {
  line: { types: ['drone', 'fighter', 'gunship'], weight: 3 },
  sine: { types: ['drone', 'fighter', 'kamikaze', 'interceptor'], weight: 3 },
  vform: { types: ['fighter', 'drone', 'interceptor'], weight: 2 },
  swoop: { types: ['drone', 'fighter', 'kamikaze', 'interceptor'], weight: 3 },
  dive: { types: ['kamikaze'], weight: 2 },
  circle: { types: ['drone', 'spinner'], weight: 2 },
  hover: { types: ['bomber', 'spinner', 'gunship'], weight: 2 },
  drift: { types: ['mine'], weight: 2 },
};

const r = (rng, a, b) => Math.round(rng.int(a, b) * U);

function makeWave(rng, sector, d, region, mirrorOf = null) {
  const options = Object.entries(PATTERNS).map(([k, v]) => {
    const ok = v.types.some((t) => unlocked(t, sector, d));
    return [ok ? v.weight : 0, k];
  });
  const pattern = mirrorOf ? mirrorOf.pattern : rng.weighted(options);
  const types = PATTERNS[pattern].types.filter((t) => unlocked(t, sector, d));
  const type = mirrorOf ? mirrorOf.type : rng.pick(types);
  const { x0, x1 } = region;
  const rw = x1 - x0;
  const p = {};
  let count = 1;
  let interval = 0;
  const margin = 40 * U;

  switch (pattern) {
    case 'line':
      count = type === 'gunship' ? rng.int(2, 3) : rng.int(4, 6);
      p.speed = r(rng, 70, 100);
      interval = Math.round((type === 'gunship' ? 150 : 100) * U * 1000 / p.speed);
      p.x = rng.int(x0 + margin, x1 - margin);
      break;
    case 'sine':
      count = rng.int(5, 8);
      p.amp = r(rng, 30, 70);
      p.x = rng.int(x0 + p.amp + 20, x1 - p.amp - 20);
      p.freq = rng.range(0.0018, 0.0032);
      p.speed = r(rng, 60, 90);
      interval = Math.round((95 * U * 1000) / p.speed);
      break;
    case 'vform':
      count = rng.pick([5, 7]);
      p.spacing = r(rng, 40, 48);
      p.x = rng.int(x0 + p.spacing * 3, x1 - p.spacing * 3);
      p.speed = r(rng, 55, 80);
      break;
    case 'swoop':
      count = rng.int(5, 8);
      interval = rng.int(340, 440);
      p.side = rng.chance(0.5) ? -1 : 1;
      p.x0 = p.side < 0 ? x0 : x1;
      p.x2 = p.side < 0 ? x1 : x0;
      p.offEdge = p.x0 <= 0 || p.x0 >= W;
      p.x0 += p.side * 40;
      p.y0 = p.offEdge ? r(rng, 10, 120) : -40;
      p.cy = r(rng, 180, 320);
      p.y1 = r(rng, 20, 200);
      p.dur = Math.round(rng.int(2600, 3600) * Math.max(0.8, rw / (320 * U)));
      break;
    case 'dive':
      count = rng.int(3, 5);
      interval = rng.int(350, 500);
      p.xs = Array.from({ length: count }, () => rng.int(x0 + margin, x1 - margin));
      p.stopY = r(rng, 60, 140);
      break;
    case 'circle':
      count = type === 'spinner' ? rng.int(3, 4) : rng.int(6, 8);
      interval = type === 'spinner' ? 650 : rng.int(380, 460);
      p.radius = r(rng, 55, 75);
      p.cx = rng.int(x0 + p.radius + 30, x1 - p.radius - 30);
      p.cy = r(rng, 140, 210);
      p.dir = rng.chance(0.5) ? -1 : 1;
      break;
    case 'hover':
      count = type === 'spinner' ? rng.int(2, 3) : rng.int(1, 2);
      interval = rng.int(500, 900);
      p.xs = Array.from({ length: count }, (_, i) => Math.round(x0 + ((i + 1) * rw) / (count + 1)) + rng.int(-40, 40));
      p.stopY = r(rng, 70, 150);
      p.stay = rng.int(5000, 8000);
      break;
    case 'drift':
      count = rng.int(3, 6);
      interval = rng.int(500, 900);
      p.xs = Array.from({ length: count }, () => rng.int(x0 + margin, x1 - margin));
      p.speed = r(rng, 26, 40);
      break;
  }

  if (mirrorOf) {
    // same formation, mirrored onto the opposite side of the screen
    Object.assign(p, JSON.parse(JSON.stringify(mirrorOf.params)));
    const m = (x) => W - x;
    for (const k of ['x', 'cx', 'x0', 'x2']) if (p[k] !== undefined) p[k] = m(p[k]);
    if (p.side !== undefined) p.side = -p.side;
    if (p.xs) p.xs = p.xs.map(m);
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

function regionFor(lane, span) {
  const l = Math.min(lane, 3 - span);
  return { x0: l * LANE, x1: (l + span) * LANE };
}

export function generateWaves(rng, sector, backdrop) {
  const waves = [];
  const density = 1 - Math.min(0.4, sector * 0.07);
  let d = Math.round(150 * U);
  while (d < SECTOR_LENGTH - 200 * U) {
    const n = 1 + (rng.chance(0.55) ? 1 : 0) + (sector >= 1 && rng.chance(0.25) ? 1 : 0);
    const lanes = rng.shuffle([0, 1, 2]);
    let first = null;
    for (let k = 0; k < n; k++) {
      const dd = d + (k ? rng.int(0, Math.round(60 * U)) : 0);
      if (k === 1 && first && first.pattern !== 'hover' && rng.chance(0.35)) {
        waves.push(makeWave(rng, sector, dd, regionFor(2 - lanes[0], 1), first));
        continue;
      }
      const span = rng.chance(0.3) ? 2 : 1;
      const w = makeWave(rng, sector, dd, regionFor(lanes[k], span));
      if (k > 0 && w.pattern === 'hover') continue;
      waves.push(w);
      if (!first) first = w;
    }
    d += Math.round(rng.int(160, 290) * U * density);
  }
  waves.sort((a, b) => a.d - b.d);

  // power-up carriers: deterministic, roughly one in four waves (never mines)
  let podCount = 0;
  waves.forEach((w, i) => {
    if (w.type !== 'mine' && (i % 4 === 3 || rng.chance(0.05))) {
      w.carrier = w.count - 1;
      podCount++;
      w.pod = podCount % 5 === 0 ? 'B' : rng.chance(0.12) ? 'S' : 'P';
    }
  });

  const turrets = backdrop.turrets.map((t) => ({
    d: t.row * TILE + TILE / 2,
    x: t.col * TILE + TILE / 2,
    raised: t.raised,
    fireDelay: rng.int(300, 1500),
  }));

  return { waves, turrets };
}
