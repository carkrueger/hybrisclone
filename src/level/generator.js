// generateSector(seed, n) -> plain data describing the whole sector.
// Pure and deterministic: identical inputs always give identical output.
import { RNG, normalizeSeed, hashSeed } from '../core/rng.js';
import { H, TILE, SECTOR_LENGTH, SECTOR_TINTS, MID_PARALLAX } from '../config.js';
import { generateBackdrop, generateMidLayer } from './backdrop.js';
import { generateWaves } from './waves.js';
import { generateBoss } from './bossgen.js';
import { generateMegaLayer } from './megastructures.js';
import { generateAmbient } from './ambient.js';

export const DEFAULT_SEED = 'HYBRIS';

export function generateSector(seedInput, sectorIndex) {
  const seed = normalizeSeed(seedInput) || DEFAULT_SEED;
  const root = RNG.fromString(seed);
  const s = root.fork('sector:' + sectorIndex);

  const rows = Math.ceil((SECTOR_LENGTH + H) / TILE) + 2;
  const midRows = Math.ceil((SECTOR_LENGTH * MID_PARALLAX + H) / TILE) + 2;
  const backdrop = generateBackdrop(s.fork('backdrop'), rows, { sector: sectorIndex });
  const mid = generateMidLayer(s.fork('midlayer'), midRows);
  const { waves, turrets } = generateWaves(s.fork('waves'), sectorIndex, backdrop);
  const boss = generateBoss(s.fork('boss'), sectorIndex);
  const mega = generateMegaLayer(s.fork('mega'), SECTOR_LENGTH);
  const ambient = generateAmbient(s.fork('ambient'), SECTOR_LENGTH, backdrop);
  const look = s.fork('look');

  return {
    seed,
    sector: sectorIndex,
    length: SECTOR_LENGTH,
    backdrop,
    mid,
    mega,
    ambient,
    waves,
    turrets,
    boss,
    tint: look.pick(SECTOR_TINTS),
    space: {
      nebula: hashSeed('nebula', look.seed),
      stars: hashSeed('stars', look.seed),
      planet: hashSeed('planet', look.seed),
      planetX: look.range(0.12, 0.88),
    },
    rim: look.pick([0x5ae4ff, 0xff60d0, 0xffb040, 0x80ff9a, 0xa080ff]),
    sun: { x: look.pick([-0.08, 1.08]), y: look.range(-0.1, 0.25), color: look.pick([0xfff0d0, 0xd0e8ff, 0xffd8b0]) },
    music: {
      main: hashSeed('music', s.seed),
      boss: hashSeed('boss-music', s.seed),
    },
  };
}
