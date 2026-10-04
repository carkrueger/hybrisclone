// generateLevel(seed, sector, level) -> plain data describing one level.
// Pure and deterministic: identical inputs always give identical output.
// A sector has 4 levels (0..3); levels 0-2 end with a mid-boss, level 3 with the sector boss.
import { RNG, normalizeSeed, hashSeed } from '../core/rng.js';
import { H, TILE, LEVEL_LENGTH, BOSS_LEVEL_LENGTH, MID_PARALLAX } from '../config.js';
import { themeFor, rosterFor, LEVELS_PER_SECTOR } from './themes.js';
import { difficulty } from './difficulty.js';
import { generateBackdrop, generateMidLayer } from './backdrop.js';
import { generateWaves } from './waves.js';
import { generateBoss } from './bosses.js';
import { generateMegaLayer } from './megastructures.js';
import { generateAmbient } from './ambient.js';

export const DEFAULT_SEED = 'HYBRIS';
export { LEVELS_PER_SECTOR };

export function generateLevel(seedInput, sector, level) {
  const seed = normalizeSeed(seedInput) || DEFAULT_SEED;
  const root = RNG.fromString(seed);
  const s = root.fork(`level:${sector}:${level}`);
  const theme = themeFor(sector);
  const diff = difficulty(sector, level);
  const isSectorBoss = level === LEVELS_PER_SECTOR - 1;
  const length = isSectorBoss ? BOSS_LEVEL_LENGTH : LEVEL_LENGTH;

  const rows = Math.ceil((length + H) / TILE) + 2;
  const midRows = Math.ceil((length * MID_PARALLAX + H) / TILE) + 2;
  const backdrop = generateBackdrop(s.fork('backdrop'), rows, { theme, D: diff.D });
  const mid = generateMidLayer(s.fork('midlayer'), midRows);
  const roster = rosterFor(sector, level, s.fork('roster'));
  const { waves, turrets } = generateWaves(s.fork('waves'), { length, roster, diff, theme }, backdrop);
  const boss = generateBoss(s.fork('boss'), {
    kind: isSectorBoss ? theme.sectorBoss : theme.midBosses[level],
    mid: !isSectorBoss,
    diff,
    theme,
  });
  const mega = generateMegaLayer(s.fork('mega'), length, theme.mega);
  const ambient = generateAmbient(s.fork('ambient'), length, backdrop);
  const look = s.fork('look');

  return {
    seed,
    sector,
    level,
    round: diff.round,
    theme: theme.id,
    themeName: theme.name,
    diff,
    roster,
    length,
    backdrop,
    mid,
    mega,
    ambient,
    waves,
    turrets,
    boss,
    tint: look.pick(theme.tints),
    space: {
      nebula: hashSeed('nebula', look.seed),
      nebulaPalette: look.pick(theme.nebula),
      stars: hashSeed('stars', look.seed),
      planet: hashSeed('planet', look.seed),
      planetKind: look.pick(theme.planets),
      planetX: look.range(0.12, 0.88),
    },
    rim: look.pick(theme.rims),
    sun: { x: look.pick([-0.08, 1.08]), y: look.range(-0.1, 0.25), color: look.pick(theme.suns) },
    music: {
      main: hashSeed(`music:${theme.id}`, s.seed),
      boss: hashSeed(`boss-music:${theme.id}`, s.seed),
      hints: theme.music,
    },
  };
}
