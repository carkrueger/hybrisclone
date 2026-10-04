// Dual-grid autotiling: one tile per grid vertex, chosen from the 4 cells around it.
import { MASK } from './tileIds.js';

/**
 * @param cells top-down 2D array of 0/1
 * @param variants number of painted variants per mask
 * @returns top-down 2D array of size (rows+1) x (cols+1) with tile indices (-1 = empty)
 */
export function dualGridTiles(cells, variants = 4) {
  const rows = cells.length;
  const cols = cells[0].length;
  const at = (r, c) => r >= 0 && r < rows && cells[r][Math.max(0, Math.min(cols - 1, c))] === 1;
  const out = [];
  for (let i = 0; i <= rows; i++) {
    const line = new Array(cols + 1);
    for (let j = 0; j <= cols; j++) {
      const mask =
        (at(i - 1, j - 1) ? MASK.TL : 0) | (at(i - 1, j) ? MASK.TR : 0) | (at(i, j - 1) ? MASK.BL : 0) | (at(i, j) ? MASK.BR : 0);
      if (!mask) {
        line[j] = -1;
        continue;
      }
      const h = Math.imul(i * 73856093 ^ j * 19349663, 0x9e3779b1) >>> 0;
      line[j] = mask + 16 * (h % variants);
    }
    out.push(line);
  }
  return out;
}
