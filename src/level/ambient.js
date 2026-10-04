// Seeded ambient life: background space traffic and maintenance drones on the station.
// Purely cosmetic, but generated from the seed so a sector always looks the same.
import { COLS } from '../config.js';

export function generateAmbient(rng, sectorLength, backdrop) {
  const traffic = [];
  for (let d = rng.int(300, 900); d < sectorLength; d += rng.int(650, 1300)) {
    const fromLeft = rng.chance(0.5);
    traffic.push({
      d,
      kind: rng.weighted([
        [3, 'shuttle'],
        [2, 'freighter'],
        [3, 'patrol'],
      ]),
      count: rng.int(1, 5),
      fromLeft,
      y: Math.round(rng.range(0.08, 0.7) * 1000) / 1000,
      angle: Math.round(rng.range(-0.35, 0.35) * 100) / 100,
      speed: rng.int(70, 150),
    });
  }

  const drones = [];
  const { base, rows } = backdrop;
  for (const seg of backdrop.segments) {
    if (seg.type === 'space') continue;
    const n = rng.int(0, 3);
    for (let k = 0; k < n; k++) {
      for (let tries = 0; tries < 10; tries++) {
        const row = rng.int(seg.r0, Math.min(rows - 1, seg.r1));
        const col = rng.int(1, COLS - 2);
        if (!base[row][col]) continue;
        drones.push({ row, col, path: rng.pick(['patrol', 'circle', 'hover']), span: rng.int(1, 3), speed: Math.round(rng.range(0.5, 1.4) * 100) / 100, phase: Math.round(rng.range(0, 6.28) * 100) / 100 });
        break;
      }
    }
  }
  return { traffic, drones };
}
