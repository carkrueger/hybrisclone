// generateSector(seed, n) -> plain data describing the whole sector.
// Pure and deterministic: identical inputs always give identical output.
import { RNG, normalizeSeed, hashSeed } from '../core/rng.js';
import { H, TILE, SECTOR_LENGTH, SECTOR_TINTS } from '../config.js';
import { generateBackdrop } from './backdrop.js';
import { generateWaves } from './waves.js';
import { generateBoss } from './bossgen.js';

export const DEFAULT_SEED = 'HYBRIS';

export function generateSector(seedInput, sectorIndex) {
  const seed = normalizeSeed(seedInput) || DEFAULT_SEED;
  const root = RNG.fromString(seed);
  const s = root.fork('sector:' + sectorIndex);

  const rows = Math.ceil((SECTOR_LENGTH + H) / TILE) + 2;
  const backdrop = generateBackdrop(s.fork('backdrop'), rows, { sector: sectorIndex });
  const { waves, turrets } = generateWaves(s.fork('waves'), sectorIndex, backdrop);
  const boss = generateBoss(s.fork('boss'), sectorIndex);
  const tint = s.fork('tint').pick(SECTOR_TINTS);

  return {
    seed,
    sector: sectorIndex,
    length: SECTOR_LENGTH,
    backdrop,
    waves,
    turrets,
    boss,
    tint,
    music: {
      main: hashSeed('music', s.seed),
      boss: hashSeed('boss-music', s.seed),
    },
  };
}
