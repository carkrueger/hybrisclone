// Seeded space-station backdrop. Pure data: rows are indexed bottom-up
// (row 0 is what is visible at the start of the sector).
import { COLS } from '../config.js';
import { TILES } from './tileIds.js';

const EMPTY = -1;

export function generateBackdrop(rng, rows, { sector = 0 } = {}) {
  const filled = Array.from({ length: rows }, () => new Array(COLS).fill(false));
  const detail = Array.from({ length: rows }, () => new Array(COLS).fill(EMPTY));
  const inRange = (r, c) => r >= 0 && r < rows && c >= 0 && c < COLS;
  const fill = (r, c, v = true) => {
    if (inRange(r, c)) filled[r][c] = v;
  };
  const fillRect = (r0, c0, h, w, v = true) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) fill(r, c, v);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const segments = [];
  const start = 14;
  const end = rows - 36; // leave open space for the boss arena
  let r = start;
  while (r < end) {
    const len = Math.min(rng.int(10, 30), end - r);
    if (len < 6) break;
    const type = rng.weighted([
      [2, 'space'],
      [4, 'hull'],
      [3, 'walls'],
      [2, 'islands'],
      [2, 'spine'],
    ]);
    const r0 = r;
    const r1 = r + len;

    if (type === 'hull') {
      let xl = rng.int(0, 5);
      let xr = rng.int(14, 19);
      for (let i = 0; i < len; i++) {
        if (i % 3 === 0) {
          xl = clamp(xl + rng.int(-1, 1), 0, 7);
          xr = clamp(xr + rng.int(-1, 1), 12, COLS - 1);
        }
        const inset = Math.max(0, 2 - Math.min(i, len - 1 - i));
        for (let c = xl + inset; c <= xr - inset; c++) fill(r0 + i, c);
      }
      if (rng.chance(0.5) && len > 10) {
        const hh = rng.int(2, 4);
        const hw = rng.int(2, 4);
        fillRect(r0 + rng.int(3, len - hh - 3), rng.int(xl + 2, Math.max(xl + 2, xr - hw - 2)), hh, hw, false);
      }
    } else if (type === 'walls') {
      let wl = rng.int(1, 5);
      let wr = rng.int(1, 5);
      for (let i = 0; i < len; i++) {
        if (i % 2 === 0) {
          wl = clamp(wl + rng.int(-1, 1), 1, 7);
          wr = clamp(wr + rng.int(-1, 1), 1, 7);
        }
        for (let c = 0; c < wl; c++) fill(r0 + i, c);
        for (let c = COLS - wr; c < COLS; c++) fill(r0 + i, c);
      }
      if (rng.chance(0.35)) fillRect(r0 + rng.int(2, len - 4), 0, 2, COLS);
    } else if (type === 'islands') {
      const n = rng.int(2, 4);
      for (let i = 0; i < n; i++) {
        const w = rng.int(3, 7);
        const h = rng.int(3, Math.min(8, len));
        fillRect(r0 + rng.int(0, len - h), rng.int(0, COLS - w), h, w);
      }
    } else if (type === 'spine') {
      const half = rng.int(2, 4);
      const mid = COLS / 2;
      fillRect(r0, mid - half, len, half * 2);
      for (let i = rng.int(1, 4); i < len - 2; i += rng.int(4, 7)) {
        const reach = rng.int(2, 8);
        fillRect(r0 + i, mid - half - reach, 2, reach);
        fillRect(r0 + i, mid + half, 2, reach);
      }
    } else {
      const n = rng.int(0, 3);
      for (let i = 0; i < n; i++) {
        const s = rng.int(2, 3);
        fillRect(r0 + rng.int(0, len - s), rng.int(0, COLS - s), s, s);
      }
    }
    segments.push({ type, r0, r1 });
    r = r1 + rng.int(2, 8);
  }

  const f = (rr, cc) => {
    if (cc < 0 || cc >= COLS) return rr >= 0 && rr < rows && filled[rr][Math.max(0, Math.min(COLS - 1, cc))];
    return rr >= 0 && rr < rows && filled[rr][cc];
  };
  const interior = (rr, cc) => f(rr, cc) && f(rr + 1, cc) && f(rr - 1, cc) && f(rr, cc + 1) && f(rr, cc - 1);
  const solid3 = (rr, cc) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!f(rr + dr, cc + dc)) return false;
    return cc > 0 && cc < COLS - 1;
  };

  // pipes along interior rows of hulls / down spines
  for (const seg of segments) {
    if (seg.type === 'hull' && rng.chance(0.6)) {
      const pr = rng.int(seg.r0 + 2, seg.r1 - 3);
      for (let c = 0; c < COLS; c++) if (interior(pr, c)) detail[pr][c] = TILES.PIPE_H;
    }
    if (seg.type === 'spine' && rng.chance(0.7)) {
      for (let rr = seg.r0; rr < seg.r1; rr++) if (interior(rr, COLS / 2)) detail[rr][COLS / 2] = TILES.PIPE_V;
    }
    if ((seg.type === 'hull' || seg.type === 'walls') && rng.chance(0.4)) {
      const hr = seg.r1 - 2;
      for (let c = 0; c < COLS; c++) if (interior(hr, c) && detail[hr][c] === EMPTY) detail[hr][c] = TILES.HAZARD;
    }
  }

  // scattered details
  const detailPool = [
    [6, TILES.RIVETS],
    [3, TILES.VENT],
    [2, TILES.GRATE],
    [2, TILES.LIGHT_RED],
    [2, TILES.LIGHT_CYAN],
    [2, TILES.HATCH],
    [2, TILES.RECESS],
    [1, TILES.FAN],
    [2, TILES.ARMOR],
    [1, TILES.DISH],
    [1, TILES.CRATE],
  ];
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < COLS; c++) {
      if (detail[rr][c] === EMPTY && interior(rr, c) && rng.chance(0.4)) {
        detail[rr][c] = rng.weighted(detailPool);
      }
    }
  }

  // ground-turret mounts
  const turrets = [];
  const turretChance = Math.min(0.5, 0.18 + sector * 0.06);
  let lastRow = -10;
  for (let rr = start + 22; rr < end; rr++) {
    if (rr - lastRow < 5) continue;
    const candidates = [];
    for (let c = 1; c < COLS - 1; c++) {
      if (solid3(rr, c) && detail[rr][c] !== TILES.PIPE_H && detail[rr][c] !== TILES.PIPE_V) candidates.push(c);
    }
    if (candidates.length && rng.chance(turretChance)) {
      const c = rng.pick(candidates);
      detail[rr][c] = TILES.ARMOR;
      turrets.push({ row: rr, col: c });
      lastRow = rr;
    }
  }

  const grid = [];
  for (let rr = 0; rr < rows; rr++) {
    const line = new Array(COLS);
    for (let c = 0; c < COLS; c++) {
      if (!filled[rr][c]) {
        line[c] = EMPTY;
      } else if (detail[rr][c] !== EMPTY) {
        line[c] = detail[rr][c];
      } else {
        const mask = (f(rr + 1, c) ? 0 : 1) | (f(rr, c + 1) ? 0 : 2) | (f(rr - 1, c) ? 0 : 4) | (f(rr, c - 1) ? 0 : 8);
        line[c] = TILES.EDGE + mask;
      }
    }
    grid.push(line);
  }

  return { rows, grid, turrets, segments };
}
