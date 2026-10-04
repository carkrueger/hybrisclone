// Seeded enemy waves in world pixels. Each wave triggers at a scroll distance `d`
// inside a screen region (one or two of three lanes). The level's roster decides
// which enemy types appear; each type flies one of its own movement patterns.
import { W, H, U, TILE } from '../config.js';
import { ENEMY_DEFS, NO_ELITE } from './enemyDefs.js';

export { ENEMY_DEFS };

const LANE = W / 3;
const HEAVY = new Set(['bomber', 'gunship', 'lavabomber', 'tug', 'prism', 'gatepylon']);
const r = (rng, a, b) => Math.round(rng.int(a, b) * U);

function makeWave(rng, type, pattern, d, region, diff, mirrorOf = null) {
  const def = ENEMY_DEFS[type];
  const { x0, x1 } = region;
  const rw = x1 - x0;
  const p = {};
  let count = rng.int(def.group[0], def.group[1]);
  let interval = 0;
  const margin = 40 * U;
  const xsIn = (n, m = margin) => Array.from({ length: n }, () => rng.int(x0 + m, x1 - m));

  switch (pattern) {
    case 'line':
      p.speed = r(rng, 70, 100);
      interval = Math.round(((HEAVY.has(type) ? 150 : 100) * U * 1000) / p.speed);
      p.x = rng.int(x0 + margin, x1 - margin);
      break;
    case 'sine':
      p.amp = r(rng, 30, 70);
      p.x = rng.int(x0 + p.amp + 20, x1 - p.amp - 20);
      p.freq = rng.range(0.0018, 0.0032);
      p.speed = r(rng, 60, 90);
      interval = Math.round((95 * U * 1000) / p.speed);
      break;
    case 'vform':
      count = count % 2 ? count : count + 1;
      p.spacing = r(rng, 40, 48);
      p.x = rng.int(x0 + p.spacing * 3, x1 - p.spacing * 3);
      p.speed = r(rng, 55, 80);
      break;
    case 'swoop':
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
      interval = rng.int(350, 500);
      p.xs = xsIn(count);
      p.stopY = r(rng, 60, 140);
      break;
    case 'circle':
      interval = type === 'spinner' ? 650 : rng.int(380, 460);
      p.radius = r(rng, 55, 75);
      p.cx = rng.int(x0 + p.radius + 30, x1 - p.radius - 30);
      p.cy = r(rng, 140, 210);
      p.dir = rng.chance(0.5) ? -1 : 1;
      break;
    case 'hover':
      interval = rng.int(500, 900);
      p.xs = Array.from({ length: count }, (_, i) => Math.round(x0 + ((i + 1) * rw) / (count + 1)) + rng.int(-40, 40));
      p.stopY = r(rng, 70, 150);
      p.stay = rng.int(5000, 8000);
      break;
    case 'drift':
      interval = rng.int(500, 900);
      p.xs = xsIn(count);
      p.speed = r(rng, 26, 40);
      break;
    case 'traverse':
      interval = rng.int(900, 1300);
      p.side = rng.chance(0.5) ? -1 : 1;
      p.y = r(rng, 70, 200);
      p.speed = r(rng, 60, 90);
      break;
    case 'orbit':
      interval = rng.int(400, 700);
      p.xs = xsIn(count, 120 * U * 0.6);
      p.cy = r(rng, 110, 210);
      p.radius = r(rng, 35, 60);
      p.stay = rng.int(6000, 9000);
      break;
    case 'tumble':
      interval = rng.int(500, 800);
      p.xs = xsIn(count);
      p.speed = r(rng, 45, 70);
      break;
    case 'zigzag':
      interval = rng.int(500, 700);
      p.xs = xsIn(count, 80 * U * 0.6);
      p.amp = r(rng, 40, 80);
      p.speed = r(rng, 70, 100);
      p.stopY = r(rng, 110, 230);
      break;
    case 'flock':
      interval = 70;
      p.x = rng.int(x0 + margin, x1 - margin);
      p.speed = r(rng, 110, 150);
      break;
    case 'ghost':
      interval = rng.int(900, 1400);
      p.spots = Array.from({ length: count * 3 }, () => [rng.int(x0 + margin, x1 - margin), rng.int(Math.round(H * 0.1), Math.round(H * 0.45))]);
      break;
    case 'gate':
      count = 2;
      p.xL = rng.int(80, 340);
      p.xR = W - rng.int(80, 340);
      p.speed = r(rng, 16, 26);
      break;
    case 'strafe':
      interval = rng.int(600, 900);
      p.xs = Array.from({ length: count }, (_, i) => Math.round(x0 + ((i + 1) * rw) / (count + 1)));
      p.stopY = r(rng, 90, 170);
      p.stay = rng.int(7000, 10000);
      break;
  }

  if (mirrorOf) {
    Object.assign(p, JSON.parse(JSON.stringify(mirrorOf.params)));
    const m = (x) => W - x;
    for (const k of ['x', 'cx', 'x0', 'x2']) if (p[k] !== undefined) p[k] = m(p[k]);
    if (p.side !== undefined) p.side = -p.side;
    if (p.xs) p.xs = p.xs.map(m);
    if (p.spots) p.spots = p.spots.map(([x, y]) => [m(x), y]);
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
    fireDelays: Array.from({ length: count }, () => rng.int(600, 2200)),
    canFire: !(def.fireChance && !rng.chance(def.fireChance + diff.D * 0.08)),
    carrier: -1,
    pod: null,
    elite: -1,
  };
}

function regionFor(lane, span) {
  const l = Math.min(lane, 3 - span);
  return { x0: l * LANE, x1: (l + span) * LANE };
}

/**
 * opts: { length, roster, diff, theme }
 */
export function generateWaves(rng, { length, roster, diff, theme }, backdrop) {
  const air = roster.filter((t) => ENEMY_DEFS[t] && !ENEMY_DEFS[t].ground && !ENEMY_DEFS[t].spawned);
  const ground = roster.filter((t) => ENEMY_DEFS[t] && ENEMY_DEFS[t].ground);
  const sig = new Set(theme.signature);
  const weights = air.map((t) => [sig.has(t) ? 3 : HEAVY.has(t) ? 1 : 2, t]);

  const waves = [];
  let d = Math.round(150 * U);
  while (d < length - 200 * U) {
    const n = 1 + (rng.chance(diff.extraWaveChance) ? 1 : 0) + (diff.D >= 3 && rng.chance(0.3) ? 1 : 0);
    const lanes = rng.shuffle([0, 1, 2]);
    let first = null;
    for (let k = 0; k < n; k++) {
      const dd = d + (k ? rng.int(0, Math.round(60 * U)) : 0);
      if (k === 1 && first && !HEAVY.has(first.type) && first.pattern !== 'gate' && rng.chance(0.3)) {
        waves.push(makeWave(rng, first.type, first.pattern, dd, regionFor(2 - lanes[0], 1), diff, first));
        continue;
      }
      const type = rng.weighted(weights);
      const pattern = rng.pick(ENEMY_DEFS[type].patterns);
      if (k > 0 && (HEAVY.has(type) || pattern === 'gate')) continue;
      const span = pattern === 'gate' || pattern === 'traverse' ? 3 : rng.chance(0.3) ? 2 : 1;
      const w = makeWave(rng, type, pattern, dd, regionFor(span === 3 ? 0 : lanes[k], span), diff);
      waves.push(w);
      if (!first) first = w;
    }
    d += Math.round(rng.int(170, 300) * U * diff.waveGap);
  }
  waves.sort((a, b) => a.d - b.d);

  // power-up carriers (roughly one in four waves) and elites
  let podCount = 0;
  waves.forEach((w, i) => {
    if (!NO_ELITE.has(w.type) && (i % 4 === 3 || rng.chance(0.05))) {
      w.carrier = w.count - 1;
      podCount++;
      w.pod = podCount % 5 === 0 ? 'B' : rng.chance(0.12) ? 'S' : 'P';
    }
    if (!NO_ELITE.has(w.type) && rng.chance(diff.eliteChance)) w.elite = rng.int(0, w.count - 1);
  });

  const turrets = ground.length
    ? backdrop.turrets.map((t) => ({
        d: t.row * TILE + TILE / 2,
        x: t.col * TILE + TILE / 2,
        raised: t.raised,
        type: rng.pick(ground),
        fireDelay: rng.int(500, 1800),
      }))
    : [];

  return { waves, turrets };
}
