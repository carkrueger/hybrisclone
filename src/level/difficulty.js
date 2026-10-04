// Difficulty model: one scalar D grows through levels and sectors, every tuning
// value is derived from it and capped so the game stays readable.
import { THEMES } from './themes.js';

export function difficulty(sector, level) {
  const round = Math.floor(sector / THEMES.length);
  const D = sector + level * 0.3 + round * 2.5;
  return {
    D: Math.round(D * 100) / 100,
    round,
    hp: 1 + 0.12 * D,
    fireInterval: Math.max(0.5, 1 - 0.05 * D), // multiplier on fire delays
    bulletSpeed: Math.min(1.6, 1 + 0.05 * D),
    waveGap: Math.max(0.55, 1 - 0.05 * D), // multiplier on distance between waves
    extraWaveChance: Math.min(0.7, 0.25 + 0.06 * D),
    eliteChance: level === 3 ? Math.min(0.35, 0.1 + 0.03 * D) : Math.min(0.2, 0.02 * D),
    budget: Math.min(110, Math.round(40 + 8 * D)), // max enemy bullets on screen
    telegraph: Math.max(350, Math.round(900 - 40 * D)), // ms of warning before beams/rams
    bossHp: 1 + 0.18 * D,
    bossTempo: Math.max(0.6, 1 - 0.05 * D), // multiplier on boss pauses
  };
}
