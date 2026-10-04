// Enemy type definitions (pure data, shared by the level generator and the entities).
//  patterns: movement patterns this type can fly (see entities/Enemy.js)
//  group:    [min, max] enemies per wave
//  ai:       special behaviour module (entities/behaviors.js)
//  fire:     generic fire kind for simple enemies
export const ENEMY_DEFS = {
  // ---- basics (re-used and re-tinted by every theme)
  drone: { tex: 'e_drone', hp: 1, r: 26, score: 100, patterns: ['line', 'sine', 'swoop', 'circle', 'vform'], group: [5, 8], fire: { kind: 'aimed', every: 2600 }, fireChance: 0.25 },
  fighter: { tex: 'e_fighter', hp: 2, r: 28, score: 150, patterns: ['line', 'sine', 'vform', 'swoop'], group: [4, 6], fire: { kind: 'aimed', every: 1900 } },
  kamikaze: { tex: 'e_kamikaze', hp: 1, r: 20, score: 120, patterns: ['dive', 'swoop', 'sine'], group: [3, 6], fire: null },
  spinner: { tex: 'e_spinner', hp: 5, r: 28, score: 250, patterns: ['circle', 'hover'], group: [2, 4], fire: { kind: 'ring', n: 6, every: 2800 }, spin: 4 },
  bomber: { tex: 'e_bomber', hp: 16, r: 54, score: 800, patterns: ['hover'], group: [1, 2], fire: { kind: 'fan', n: 3, spread: 0.5, every: 1700 } },
  interceptor: { tex: 'e_interceptor', hp: 2, r: 28, score: 200, patterns: ['sine', 'swoop', 'vform'], group: [3, 6], fire: { kind: 'spread3', every: 1800 } },
  gunship: { tex: 'e_gunship', hp: 11, r: 50, score: 600, patterns: ['hover', 'line'], group: [1, 2], fire: { kind: 'twin', every: 1700 } },
  mine: { tex: 'e_mine', hp: 3, r: 24, score: 150, patterns: ['drift'], group: [3, 5], fire: null, mine: true, spin: 1.2 },
  turret: { tex: 'e_turret', hp: 5, r: 34, score: 300, ground: true, fire: { kind: 'aimed', every: 1900 } },

  // ---- 1 shipyard
  tug: { tex: 'e_tug', hp: 7, r: 44, score: 400, patterns: ['traverse'], group: [1, 2], ai: 'tug' },
  welder: { tex: 'e_welder', hp: 3, r: 26, score: 250, patterns: ['orbit'], group: [2, 3], ai: 'welder' },
  railturret: { tex: 'e_railturret', hp: 7, r: 34, score: 450, ground: true, ai: 'rail' },
  // ---- 2 crystal
  shard: { tex: 'e_shard', hp: 4, r: 30, score: 200, patterns: ['tumble'], group: [3, 5], ai: 'shard', spin: 1.5 },
  shardlet: { tex: 'e_shardlet', hp: 1, r: 16, score: 50, patterns: ['burst'], group: [3, 3], ai: 'shardlet', spin: 5, spawned: true },
  driller: { tex: 'e_driller', hp: 4, r: 28, score: 300, patterns: ['zigzag'], group: [2, 4], ai: 'driller' },
  prism: { tex: 'e_prism', hp: 6, r: 32, score: 400, patterns: ['hover'], group: [1, 2], ai: 'prism', spin: 0.8 },
  // ---- 3 hive
  swarmer: { tex: 'e_swarmer', hp: 1, r: 16, score: 60, patterns: ['flock'], group: [8, 12], ai: 'swarmer' },
  spitter: { tex: 'e_spitter', hp: 4, r: 30, score: 300, patterns: ['sine', 'hover'], group: [2, 3], ai: 'spitter' },
  brood: { tex: 'e_brood', hp: 6, r: 36, score: 400, ground: true, ai: 'brood' },
  // ---- 4 foundry
  lavabomber: { tex: 'e_lavabomber', hp: 10, r: 48, score: 600, patterns: ['traverse'], group: [1, 2], ai: 'lavabomber' },
  flametank: { tex: 'e_flametank', hp: 7, r: 36, score: 450, ground: true, ai: 'flametank' },
  missilepod: { tex: 'e_missilepod', hp: 6, r: 34, score: 450, ground: true, ai: 'missilepod' },
  // ---- 5 graveyard
  ghost: { tex: 'e_ghost', hp: 5, r: 30, score: 400, patterns: ['ghost'], group: [1, 3], ai: 'ghost' },
  claw: { tex: 'e_claw', hp: 5, r: 34, score: 400, patterns: ['swoop'], group: [2, 3], ai: 'claw' },
  sniper: { tex: 'e_sniper', hp: 5, r: 32, score: 450, ground: true, ai: 'sniper' },
  // ---- 6 citadel
  elite: { tex: 'e_elite', hp: 6, r: 30, score: 600, patterns: ['strafe'], group: [1, 3], ai: 'elite' },
  shielddrone: { tex: 'e_shielddrone', hp: 3, r: 24, score: 400, patterns: ['sine', 'line'], group: [1, 2], ai: 'shield' },
  gatepylon: { tex: 'e_gatepylon', hp: 8, r: 34, score: 350, patterns: ['gate'], group: [2, 2], ai: 'gate' },
};

/** spawned-only or fragile minion types never carry power-ups or become elites */
export const NO_ELITE = new Set(['swarmer', 'shardlet', 'mine', 'gatepylon']);
