// Seeded space-station backdrop. Pure data; rows are indexed bottom-up
// (row 0 is what is visible at the start of the sector).
import { COLS } from '../config.js';
import { DECO, MID, PROPS } from './tileIds.js';

const EMPTY = -1;
const grid = (rows, cols, v) => Array.from({ length: rows }, () => new Array(cols).fill(v));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function generateBackdrop(rng, rows, { sector = 0 } = {}) {
  const base = grid(rows, COLS, 0);
  const raised = grid(rows, COLS, 0);
  const deco = grid(rows, COLS, EMPTY);
  const inRange = (r, c) => r >= 0 && r < rows && c >= 0 && c < COLS;
  const fillRect = (g, r0, c0, h, w, v = 1) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (inRange(r, c)) g[r][c] = v;
  };
  const hullBlock = (r0, len, xl, xr, lo, hi) => {
    for (let i = 0; i < len; i++) {
      if (i % 3 === 0) {
        xl = clamp(xl + rng.int(-1, 1), lo[0], lo[1]);
        xr = clamp(xr + rng.int(-1, 1), hi[0], hi[1]);
      }
      const inset = Math.max(0, 2 - Math.min(i, len - 1 - i));
      for (let c = xl + inset; c <= xr - inset; c++) if (inRange(r0 + i, c)) base[r0 + i][c] = 1;
    }
  };

  const segments = [];
  const start = 8;
  const end = rows - 20; // open space for the boss arena
  let r = start;
  while (r < end) {
    const len = Math.min(rng.int(7, 18), end - r);
    if (len < 5) break;
    const type = rng.weighted([
      [2, 'space'],
      [4, 'hull'],
      [3, 'walls'],
      [2, 'islands'],
      [2, 'spine'],
      [3, 'twin'],
    ]);
    const r0 = r;
    const r1 = r + len;

    if (type === 'hull') {
      hullBlock(r0, len, rng.int(0, 8), rng.int(21, COLS - 1), [0, 11], [18, COLS - 1]);
      if (rng.chance(0.5) && len > 8) {
        const hh = rng.int(2, 4);
        const hw = rng.int(2, 5);
        fillRect(base, r0 + rng.int(3, len - hh - 3), rng.int(6, COLS - hw - 6), hh, hw, 0);
      }
    } else if (type === 'twin') {
      const gap = rng.int(3, 7);
      const mid = rng.int(12, 17);
      hullBlock(r0, len, rng.int(0, 4), mid - Math.ceil(gap / 2), [0, 6], [mid - gap, mid - 2]);
      hullBlock(r0 + rng.int(0, 3), len - 2, mid + Math.ceil(gap / 2), rng.int(25, COLS - 1), [mid + 2, mid + gap], [23, COLS - 1]);
    } else if (type === 'walls') {
      let wl = rng.int(2, 7);
      let wr = rng.int(2, 7);
      for (let i = 0; i < len; i++) {
        if (i % 2 === 0) {
          wl = clamp(wl + rng.int(-1, 1), 1, 10);
          wr = clamp(wr + rng.int(-1, 1), 1, 10);
        }
        for (let c = 0; c < wl; c++) base[r0 + i][c] = 1;
        for (let c = COLS - wr; c < COLS; c++) base[r0 + i][c] = 1;
      }
      if (rng.chance(0.4)) fillRect(base, r0 + rng.int(2, len - 4), 0, 2, COLS);
    } else if (type === 'islands') {
      const n = rng.int(3, 6);
      for (let i = 0; i < n; i++) {
        const w = rng.int(3, 8);
        const h = rng.int(3, Math.min(9, len));
        fillRect(base, r0 + rng.int(0, len - h), rng.int(0, COLS - w), h, w);
      }
    } else if (type === 'spine') {
      const half = rng.int(2, 4);
      const mid = COLS / 2;
      fillRect(base, r0, mid - half, len, half * 2);
      for (let i = rng.int(1, 3); i < len - 2; i += rng.int(3, 6)) {
        const reach = rng.int(3, 11);
        fillRect(base, r0 + i, mid - half - reach, 2, reach);
        fillRect(base, r0 + i, mid + half, 2, reach);
      }
    } else {
      const n = rng.int(0, 4);
      for (let i = 0; i < n; i++) {
        const s = rng.int(2, 3);
        fillRect(base, r0 + rng.int(0, len - s), rng.int(0, COLS - s), s, s);
      }
    }
    segments.push({ type, r0, r1 });
    r = r1 + rng.int(2, 6);
  }

  const f = (rr, cc) => rr >= 0 && rr < rows && base[rr][clamp(cc, 0, COLS - 1)] === 1;
  const solid = (rr, cc, k) => {
    for (let dr = -k; dr <= k; dr++) for (let dc = -k; dc <= k; dc++) if (!f(rr + dr, cc + dc)) return false;
    return true;
  };

  // raised plateaus: rectangles clipped to the 2-cell erosion of the base
  for (const seg of segments) {
    if (!['hull', 'twin', 'spine', 'walls'].includes(seg.type) || !rng.chance(0.75)) continue;
    const n = rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const h = rng.int(3, 8);
      const w = rng.int(3, 9);
      const rr0 = rng.int(seg.r0, Math.max(seg.r0, seg.r1 - h));
      const cc0 = rng.int(0, COLS - w);
      for (let rr = rr0; rr < rr0 + h; rr++) {
        for (let cc = cc0; cc < cc0 + w; cc++) if (inRange(rr, cc) && solid(rr, cc, 2)) raised[rr][cc] = 1;
      }
    }
  }
  const isRaised = (rr, cc) => rr >= 0 && rr < rows && cc >= 0 && cc < COLS && raised[rr][cc] === 1;
  const nearRaised = (rr, cc) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (isRaised(rr + dr, cc + dc)) return true;
    return false;
  };
  const raisedInterior = (rr, cc) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!isRaised(rr + dr, cc + dc)) return false;
    return true;
  };
  const decoOk = (rr, cc) => solid(rr, cc, 1) && !nearRaised(rr, cc) && deco[rr][cc] === EMPTY;

  // pipes and hazard strips
  for (const seg of segments) {
    if ((seg.type === 'hull' || seg.type === 'twin') && rng.chance(0.65)) {
      const pr = rng.int(seg.r0 + 2, seg.r1 - 3);
      for (let c = 0; c < COLS; c++) if (decoOk(pr, c)) deco[pr][c] = DECO.PIPE_H;
    }
    if (seg.type === 'spine' && rng.chance(0.7)) {
      for (let rr = seg.r0; rr < seg.r1; rr++) if (decoOk(rr, COLS / 2)) deco[rr][COLS / 2] = DECO.PIPE_V;
    }
    if ((seg.type === 'hull' || seg.type === 'walls') && rng.chance(0.45)) {
      const hr = seg.r1 - 2;
      for (let c = 0; c < COLS; c++) if (decoOk(hr, c)) deco[hr][c] = DECO.HAZARD;
    }
  }

  // big multi-cell props: footprint + 1-cell margin must be plain base plating
  const occupied = grid(rows, COLS, 0);
  const props = [];
  const propPool = [
    [3, 'dome'],
    [2, 'reactor'],
    [2, 'hangar'],
    [2, 'pad'],
    [3, 'tower'],
    [3, 'tanks'],
  ];
  const fits = (r0, c0, w, h) => {
    for (let rr = r0 - 1; rr <= r0 + h; rr++) {
      for (let cc = c0 - 1; cc <= c0 + w; cc++) {
        if (cc < 0 || cc >= COLS || !f(rr, cc) || isRaised(rr, cc) || occupied[rr][cc]) return false;
        if (rr >= r0 && rr < r0 + h && cc >= c0 && cc < c0 + w && deco[rr][cc] !== EMPTY) return false;
      }
    }
    for (let rr = r0 - 1; rr <= r0 + h; rr++) for (let cc = c0 - 2; cc <= c0 + w + 1; cc++) if (isRaised(rr, cc)) return false;
    return true;
  };
  for (const seg of segments) {
    if (!['hull', 'twin', 'spine', 'walls'].includes(seg.type)) continue;
    const want = rng.int(1, 3);
    for (let k = 0; k < want; k++) {
      const type = rng.weighted(propPool);
      const [w, h] = PROPS[type];
      for (let tries = 0; tries < 14; tries++) {
        const r0 = rng.int(seg.r0, Math.max(seg.r0, seg.r1 - h));
        const c0 = rng.int(1, COLS - w - 1);
        if (!fits(r0, c0, w, h)) continue;
        for (let rr = r0 - 1; rr <= r0 + h; rr++) for (let cc = c0 - 1; cc <= c0 + w; cc++) occupied[rr][cc] = 1;
        props.push({ type, row: r0, col: c0, w, h });
        break;
      }
    }
  }

  const groundPool = [
    [5, DECO.VENT],
    [3, DECO.GRATE],
    [3, DECO.HATCH],
    [2, DECO.LIGHT_RED],
    [2, DECO.LIGHT_CYAN],
    [1, DECO.LIGHT_AMBER],
    [2, DECO.FAN],
    [1, DECO.DISH],
    [2, DECO.CRATE],
    [2, DECO.SOLAR],
    [3, DECO.GREEBLE],
    [1, DECO.PAD],
    [2, DECO.WINDOWS],
    [1, DECO.VENT_GLOW],
    [2, DECO.CONDUIT],
    [2, DECO.HEX],
    [2, DECO.TERMINAL],
    [1, DECO.CHEVRON],
  ];
  const raisedPool = [
    [3, DECO.VENT],
    [2, DECO.LIGHT_RED],
    [2, DECO.LIGHT_CYAN],
    [2, DECO.FAN],
    [2, DECO.GREEBLE],
    [1, DECO.HATCH],
    [2, DECO.HEX],
    [1, DECO.VENT_GLOW],
    [1, DECO.WINDOWS],
  ];
  for (let rr = 0; rr < rows; rr++) {
    for (let c = 0; c < COLS; c++) {
      if (deco[rr][c] !== EMPTY || occupied[rr][c]) continue;
      if (raisedInterior(rr, c)) {
        if (rng.chance(0.3)) deco[rr][c] = rng.weighted(raisedPool);
      } else if (decoOk(rr, c) && rng.chance(0.3)) {
        deco[rr][c] = rng.weighted(groundPool);
      }
    }
  }

  // ground-turret mounts
  const turrets = [];
  const turretChance = Math.min(0.6, 0.25 + sector * 0.06);
  let lastRow = -10;
  for (let rr = start + 14; rr < end; rr++) {
    if (rr - lastRow < 4) continue;
    const candidates = [];
    for (let c = 1; c < COLS - 1; c++) {
      const ok = !occupied[rr][c] && (raisedInterior(rr, c) || (decoOk(rr, c) && !isRaised(rr, c)));
      if (ok && deco[rr][c] !== DECO.PIPE_H && deco[rr][c] !== DECO.PIPE_V) candidates.push(c);
    }
    if (candidates.length && rng.chance(turretChance)) {
      const picks = [rng.pick(candidates)];
      if (candidates.length > 6 && rng.chance(0.35)) {
        const far = candidates.filter((c) => Math.abs(c - picks[0]) > 6);
        if (far.length) picks.push(rng.pick(far));
      }
      for (const c of picks) {
        deco[rr][c] = DECO.ARMOR;
        turrets.push({ row: rr, col: c, raised: isRaised(rr, c) });
      }
      lastRow = rr;
    }
  }

  return { rows, base, raised, deco, turrets, props, segments };
}

/** Distant girder layer, generated from its own stream. */
export function generateMidLayer(rng, rows) {
  const mid = grid(rows, COLS, EMPTY);
  let r = rng.int(0, 4);
  while (r < rows - 4) {
    const len = rng.int(5, 14);
    let c = rng.int(-4, 3);
    while (c < COLS) {
      const w = rng.int(4, 12);
      if (rng.chance(0.55)) {
        const r0 = r + rng.int(0, 2);
        const r1 = Math.min(rows - 1, r0 + len - 1);
        const c0 = c;
        const c1 = c + w - 1;
        const fill = rng.weighted([[3, MID.X], [2, MID.PANEL], [2, MID.DIAG], [3, EMPTY]]);
        for (let rr = r0; rr <= r1; rr++) {
          for (let cc = c0; cc <= c1; cc++) {
            if (cc < 0 || cc >= COLS) continue;
            const edgeR = rr === r0 || rr === r1;
            const edgeC = cc === c0 || cc === c1;
            if (edgeR && edgeC) mid[rr][cc] = MID.JUNCTION;
            else if (edgeR) mid[rr][cc] = MID.H;
            else if (edgeC) mid[rr][cc] = MID.V;
            else if (fill !== EMPTY && rng.chance(0.5)) mid[rr][cc] = fill;
          }
        }
      }
      c += w + rng.int(1, 5);
    }
    r += len + rng.int(2, 7);
  }
  return mid;
}
