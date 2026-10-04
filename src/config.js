// Global tuning constants. The game renders at a native 1920x1080 (16:9).
// U converts the original 480px-tall design units into world pixels.
export const W = 1920;
export const H = 1080;
export const U = H / 480;
export const TILE = 64;
export const COLS = W / TILE;

export const SCROLL_SPEED = 32 * U; // px per second of backdrop scroll
export const SECTOR_LENGTH = 4800 * U; // legacy: full-length stretch
export const LEVEL_LENGTH = 2700 * U; // ~80 s of scrolling before the mid-boss
export const BOSS_LEVEL_LENGTH = 3200 * U; // level 4, before the sector boss
export const MID_PARALLAX = 0.55; // scroll factor of the distant girder layer
export const MEGA_PARALLAX = 0.3; // scroll factor of the capital-ship layer
export const BOSS_SCALE = 3.1; // boss design units -> world px

export const PLAYER_SPEED = 170 * U;
export const PLAYER_MOUSE_SPEED = 300 * U;
export const PLAYER_HIT_RADIUS = 3 * U;
export const START_LIVES = 3;
export const START_BOMBS = 3;
export const MAX_BOMBS = 5;
export const EXTRA_LIFE_EVERY = 50000;
export const RESPAWN_INVULN_MS = 2500;

export const SEED_MAX_LEN = 10;
export const SEED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Per-sector station tints (multiplied onto neutral painted metal).
export const SECTOR_TINTS = [0xc8d4ea, 0xead2c0, 0xc4e6cc, 0xd8c8f0, 0xeee4b8, 0xbce0ee, 0xf0c4c4];

export const DEPTH = {
  nebula: 0,
  farStars: 1,
  planet: 2,
  nearStars: 3,
  mega: 4,
  traffic: 4.6,
  mid: 5,
  stationShadow: 8,
  station: 10,
  raisedShadow: 11,
  raised: 12,
  deco: 13,
  propShadow: 13.2,
  props: 13.5,
  drones: 13.8,
  lights: 14,
  lightmap: 15,
  godrays: 16,
  ground: 20,
  airShadows: 25,
  pickups: 30,
  enemies: 40,
  boss: 45,
  playerBullets: 50,
  player: 60,
  fx: 70,
  enemyBullets: 80,
  overlay: 90,
};

export const QUALITY = {
  low: { bloom: false, vignette: false, particles: 0.45, shadows: false, trails: false, lights: false, lightmap: false, godrays: false, rim: false, ambient: false, dust: false, flames: true, animate: false },
  medium: { bloom: true, vignette: true, particles: 0.75, shadows: true, trails: true, lights: true, lightmap: true, godrays: true, rim: true, ambient: true, dust: false, flames: true, animate: true },
  high: { bloom: true, vignette: true, particles: 1, shadows: true, trails: true, lights: true, lightmap: true, godrays: true, rim: true, ambient: true, dust: true, flames: true, animate: true },
};

export const FONT = {
  display: 'Orbitron, "Arial Black", sans-serif',
  body: '"Exo 2", "Segoe UI", Arial, sans-serif',
};
