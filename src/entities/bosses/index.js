import { MID_BOSSES } from './mid.js';
import { SECTOR_BOSS_CLASSES } from './sector.js';

export function createBoss(scene, data) {
  const Cls = (data.mid ? MID_BOSSES : SECTOR_BOSS_CLASSES)[data.kind];
  return new Cls(scene, data);
}
