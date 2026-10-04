// Seeded random numbers. Level generation must only ever use these streams,
// never Math.random, so that the same seed always produces the same level.

/** cyrb53 string hash (public domain), returns a 53-bit integer. */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function hashSeed(str, salt = 0) {
  return cyrb53(String(str), salt) >>> 0;
}

export function normalizeSeed(str) {
  return String(str ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class RNG {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  static fromString(str) {
    return new RNG(hashSeed(normalizeSeed(str)));
  }

  /** mulberry32 */
  nextU32() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** float in [0, 1) */
  float() {
    return this.nextU32() / 4294967296;
  }

  /** float in [min, max) */
  range(min, max) {
    return min + (max - min) * this.float();
  }

  /** integer in [min, max] inclusive */
  int(min, max) {
    return min + Math.floor(this.float() * (max - min + 1));
  }

  chance(p) {
    return this.float() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.float() * arr.length)];
  }

  /** items: [{w, v}] or [[weight, value]] */
  weighted(items) {
    const norm = items.map((it) => (Array.isArray(it) ? { w: it[0], v: it[1] } : it));
    const total = norm.reduce((s, it) => s + it.w, 0);
    let r = this.float() * total;
    for (const it of norm) {
      r -= it.w;
      if (r < 0) return it.v;
    }
    return norm[norm.length - 1].v;
  }

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Independent sub-stream derived from this stream's *initial* seed and a label.
   * Forking does not consume numbers, so the order of forks never matters.
   */
  fork(label) {
    return new RNG(hashSeed(label, this.seed));
  }
}

export function randomSeedString(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
