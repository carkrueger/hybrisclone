// Seeded capital ships / megastructures drifting past behind the station.
// Coordinates: x in screen px (object centre), d = distance in the mega layer's
// own scroll space (scroll * MEGA_PARALLAX) at which the centre sits at the screen bottom.
import { W, H, MEGA_PARALLAX } from '../config.js';
import { hashSeed } from '../core/rng.js';

export const MEGA_KINDS = ['battleship', 'carrier', 'ring', 'dock', 'asteroid', 'hiveship', 'smelter', 'wreck', 'spire'];

export function generateMegaLayer(rng, sectorLength, weights = { battleship: 4, carrier: 3, ring: 2, dock: 2 }) {
  const pool = Object.entries(weights).map(([k, w]) => [w, k]);
  const range = sectorLength * MEGA_PARALLAX + H;
  const out = [];
  let d = rng.int(250, 650);
  let side = rng.chance(0.5) ? -1 : 1;
  let i = 0;
  while (d < range + 500) {
    const kind = rng.weighted(pool);
    const x = side < 0 ? rng.int(-80, 620) : rng.int(W - 620, W + 80);
    out.push({
      kind,
      x,
      d,
      scale: Math.round(rng.range(0.85, 1.12) * 100) / 100,
      flip: rng.chance(0.5),
      seed: hashSeed(kind + ':' + i, rng.seed),
    });
    side = -side;
    d += rng.int(850, 1350);
    i++;
  }
  return out;
}
