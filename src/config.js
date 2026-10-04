// Global tuning constants.
export const W = 320;
export const H = 480;
export const TILE = 16;
export const COLS = W / TILE;

export const SCROLL_SPEED = 32;          // px per second of backdrop scroll
export const SECTOR_LENGTH = 4800;       // scroll distance before the boss (~2.5 min)

export const PLAYER_SPEED = 150;         // px/s with keyboard / gamepad
export const PLAYER_MOUSE_SPEED = 260;   // max px/s when following the mouse
export const PLAYER_HIT_RADIUS = 3;
export const START_LIVES = 3;
export const START_BOMBS = 3;
export const MAX_BOMBS = 5;
export const EXTRA_LIFE_EVERY = 50000;
export const RESPAWN_INVULN_MS = 2500;

export const SEED_MAX_LEN = 10;
export const SEED_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Per-sector backdrop tints, cycled by sector index.
export const SECTOR_TINTS = [0x9fb4d0, 0xd0a890, 0x9ad0a0, 0xc0a0d8, 0xd8d090, 0x90c8d8, 0xd89090];

export const DEPTH = {
  stars: 0,
  backdrop: 10,
  ground: 20,
  pickups: 30,
  enemies: 40,
  boss: 45,
  playerBullets: 50,
  player: 60,
  fx: 70,
  enemyBullets: 80,
  overlay: 90,
};
