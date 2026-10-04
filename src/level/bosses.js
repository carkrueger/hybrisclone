// Seeded boss data. Mid-bosses (levels 1-3) use one of six archetypes; the sector
// boss (level 4) is unique per theme. Stats scale with difficulty; mechanics live
// in entities/bosses/.

const SYL_A = ['ZOR', 'KRA', 'VEX', 'MAL', 'TOR', 'XEN', 'GOR', 'NYX', 'DRA', 'SKA', 'VOR', 'QUA'];
const SYL_B = ['GOTH', 'NOID', 'TRON', 'KAAN', 'MAX', 'VOX', 'RIUS', 'DON', 'THUL', 'ZAR'];

export const MID_ARCHETYPES = ['warden', 'charger', 'carrier', 'lancer', 'bombard', 'twins'];
export const SECTOR_BOSSES = ['crane', 'prism', 'brood', 'forge', 'revenant', 'overseer'];

const MID_TITLES = { warden: 'WARDEN', charger: 'RAM', carrier: 'CARRIER', lancer: 'LANCER', bombard: 'BOMBARD', twins: 'TWINS' };
const SECTOR_TITLES = {
  crane: 'DREADNOUGHT CRANE',
  prism: 'PRISM QUEEN',
  brood: 'BROOD MOTHER',
  forge: 'MAGMA FORGE',
  revenant: 'REVENANT',
  overseer: 'THE OVERSEER',
};

/** smooth random symmetric hull profile (half-width per row, design units) */
export function makeHull(rng, { halfMin, halfMax, hMin, hMax, colors }) {
  const half = rng.int(halfMin, halfMax);
  const w = half * 2 + 1;
  const h = rng.int(hMin, hMax);
  const keys = [];
  for (let y = 0; y <= h + 8; y += 8) keys.push(rng.int(Math.floor(half * 0.4), half));
  const profile = [];
  for (let y = 0; y < h; y++) {
    const k = Math.floor(y / 8);
    const t = (y % 8) / 8;
    let v = keys[k] * (1 - t) + keys[k + 1] * t;
    const fromBottom = h - 1 - y;
    if (fromBottom < 12) v = Math.min(v, 6 + fromBottom * (half / 12));
    if (y < 4) v = Math.min(v, half * 0.5 + y * 4);
    profile.push(Math.max(8, Math.round(v)));
  }
  const coreY = Math.round(h * 0.45);
  for (let y = coreY - 12; y <= coreY + 12; y++) if (y >= 0 && y < h) profile[y] = Math.max(profile[y], 15);
  return { w, h, profile, colors, coreY };
}

/** opts: { kind, mid, diff, theme } */
export function generateBoss(rng, { kind, mid, diff, theme }) {
  const name = mid ? `${rng.pick(SYL_A)}${rng.pick(SYL_B)} ${MID_TITLES[kind]}` : SECTOR_TITLES[kind] + (diff.round ? ` MK ${diff.round + 1}` : '');
  const hull = makeHull(rng, mid ? { halfMin: 26, halfMax: 40, hMin: 34, hMax: 48, colors: theme.bossColors } : { halfMin: 46, halfMax: 64, hMin: 58, hMax: 80, colors: theme.bossColors });
  return {
    kind,
    mid,
    theme: theme.id,
    name,
    hull,
    hp: Math.round((mid ? 90 : 260) * diff.bossHp),
    tempo: diff.bossTempo,
    telegraph: diff.telegraph,
    bulletSpeed: Math.min(210, 100 + diff.D * 8),
    round: diff.round,
    D: diff.D,
    move: rng.pick(['sway', 'figure8', 'drift']),
    moveSpeed: Math.round(rng.range(0.55, 0.95) * 100) / 100,
    variant: rng.int(0, 2),
    seed: rng.nextU32(),
    score: Math.round(mid ? 5000 + diff.D * 1000 : 15000 + diff.D * 3000),
  };
}
