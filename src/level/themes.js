// The six sector themes. Each sector has 4 levels; after sector 6 the themes
// loop ("round 2+") with higher difficulty and guest enemies from other themes.
// Pure data: graphics, rosters, bosses and music hints per theme.

export const THEMES = [
  {
    id: 'shipyard',
    name: 'ORBITAL SHIPYARD',
    tints: [0xd0dcf0, 0xdce2ee, 0xc8d6ee],
    rims: [0x5ae4ff, 0x80c8ff],
    suns: [0xfff0d0, 0xd0e8ff],
    nebula: [0, 3],
    planets: [0, 1, 2],
    plates: 'panels',
    segWeights: { space: 2, hull: 4, walls: 3, islands: 2, spine: 2, twin: 3 },
    deco: { VENT: 5, GRATE: 3, HATCH: 3, LIGHT_RED: 2, LIGHT_CYAN: 2, LIGHT_AMBER: 1, FAN: 2, DISH: 1, CRATE: 2, SOLAR: 2, GREEBLE: 3, PAD: 1, WINDOWS: 2, CONDUIT: 2, TERMINAL: 2, CHEVRON: 1 },
    props: { dome: 3, reactor: 2, hangar: 3, pad: 3, tower: 2, tanks: 3 },
    mega: { battleship: 4, carrier: 3, ring: 1, dock: 3 },
    ambient: { traffic: true, particles: 'sparks' },
    bullet: 'eb_orb',
    midTint: 0xffffff,
    basics: ['drone', 'fighter', 'kamikaze', 'bomber'],
    signature: ['tug', 'welder', 'railturret'],
    ground: ['turret'],
    midBosses: ['warden', 'carrier', 'charger'],
    sectorBoss: 'crane',
    bossColors: { base: 0x707890, light: 0xb8c0d8, mid: 0x98a0b8, dark: 0x3c4058, glow: 0xffb030 },
    music: { scales: ['aeolian', 'dorian'], bpm: [132, 144], leads: ['supersaw', 'pulse'], basses: ['acid', 'bass'] },
  },
  {
    id: 'crystal',
    name: 'CRYSTAL MINES',
    tints: [0xc8e8ff, 0xd8f0ff, 0xbce0f8],
    rims: [0x80f0ff, 0xb0a0ff],
    suns: [0xd0f0ff, 0xe8e0ff],
    nebula: [1, 3],
    planets: [1, 2],
    plates: 'rock',
    segWeights: { space: 3, hull: 2, walls: 3, islands: 5, spine: 1, twin: 2 },
    deco: { CRYSTAL: 6, ICE_VENT: 3, LIGHT_CYAN: 2, GRATE: 1, CRATE: 1, GREEBLE: 1, HEX: 2, DISH: 1 },
    props: { spire: 5, tanks: 1, dome: 2, tower: 1 },
    mega: { asteroid: 6, ring: 1, dock: 1 },
    ambient: { traffic: false, particles: 'glitter' },
    bullet: 'eb_shard',
    basics: ['drone', 'interceptor', 'fighter', 'spinner'],
    signature: ['shard', 'driller', 'prism'],
    ground: ['turret'],
    midBosses: ['lancer', 'warden', 'charger'],
    sectorBoss: 'prism',
    bossColors: { base: 0x6a8ab0, light: 0xc0e8ff, mid: 0x90b0d0, dark: 0x2a3a58, glow: 0x80f0ff },
    music: { scales: ['dorian', 'ionian'], bpm: [126, 138], leads: ['pulse', 'supersaw'], basses: ['bass'] },
  },
  {
    id: 'hive',
    name: 'ALIEN HIVE',
    tints: [0xe8d0f0, 0xd8f0d8, 0xf0d8e8],
    rims: [0x80ff90, 0xff60d0],
    suns: [0xd0ffc0, 0xffc0f0],
    nebula: [4, 5],
    planets: [4, 3],
    plates: 'organic',
    segWeights: { space: 2, hull: 3, walls: 2, islands: 4, spine: 3, twin: 2 },
    deco: { EGG: 4, VEIN: 5, ACID: 3, SPORE: 3, HEX: 2, VENT_GLOW: 1 },
    props: { eggs: 5, dome: 2, tower: 2 },
    mega: { hiveship: 6, asteroid: 2 },
    ambient: { traffic: false, particles: 'spores' },
    bullet: 'eb_acid',
    basics: ['kamikaze', 'drone', 'spinner', 'mine'],
    signature: ['swarmer', 'spitter', 'brood'],
    ground: [],
    midBosses: ['carrier', 'bombard', 'twins'],
    sectorBoss: 'brood',
    bossColors: { base: 0x6a4a7a, light: 0xb090c8, mid: 0x8a6aa0, dark: 0x2a1a38, glow: 0x80ff90 },
    music: { scales: ['phrygian', 'harmonic'], bpm: [120, 134], leads: ['pulse'], basses: ['acid'] },
  },
  {
    id: 'foundry',
    name: 'VOLCANIC FOUNDRY',
    tints: [0xf0d8c8, 0xe8d0c0, 0xf0e0d0],
    rims: [0xffa040, 0xff6040],
    suns: [0xffc080, 0xff9060],
    nebula: [2, 5],
    planets: [5, 0],
    plates: 'foundry',
    segWeights: { space: 1, hull: 5, walls: 3, islands: 2, spine: 2, twin: 3 },
    deco: { LAVA: 4, CRUCIBLE: 2, VENT_GLOW: 4, GRATE: 3, CONDUIT: 2, HAZARD: 1, CHEVRON: 2, LIGHT_AMBER: 2 },
    props: { smelter: 4, tower: 3, tanks: 3, reactor: 1 },
    mega: { smelter: 5, carrier: 1, dock: 2 },
    ambient: { traffic: true, particles: 'embers' },
    bullet: 'eb_ember',
    basics: ['bomber', 'gunship', 'fighter', 'interceptor'],
    signature: ['lavabomber', 'flametank', 'missilepod'],
    ground: ['turret'],
    midBosses: ['bombard', 'warden', 'lancer'],
    sectorBoss: 'forge',
    bossColors: { base: 0x5a4a48, light: 0xa08070, mid: 0x7a6058, dark: 0x2a1c1a, glow: 0xff7020 },
    music: { scales: ['harmonic', 'aeolian'], bpm: [140, 152], leads: ['supersaw'], basses: ['acid', 'bass'] },
  },
  {
    id: 'graveyard',
    name: 'FLEET GRAVEYARD',
    tints: [0xc8d0c0, 0xd0ccc0, 0xc0ccc8],
    rims: [0xa0ffc0, 0x80e0d0],
    suns: [0xd8f0d0, 0xc8d8e0],
    nebula: [1, 0],
    planets: [2],
    plates: 'rust',
    segWeights: { space: 4, hull: 2, walls: 2, islands: 5, spine: 1, twin: 2 },
    deco: { DEBRIS: 5, BROKEN_PIPE: 3, GRATE: 2, HATCH: 2, CRATE: 2, VENT: 2, LIGHT_RED: 1, CONDUIT: 2 },
    props: { hullpiece: 5, tanks: 2, tower: 1 },
    mega: { wreck: 6, dock: 1 },
    ambient: { traffic: false, particles: 'debris' },
    bullet: 'eb_ghost',
    basics: ['mine', 'fighter', 'drone', 'gunship'],
    signature: ['ghost', 'claw', 'sniper'],
    ground: ['turret'],
    midBosses: ['twins', 'charger', 'carrier'],
    sectorBoss: 'revenant',
    bossColors: { base: 0x5a6458, light: 0xa0b098, mid: 0x7a8474, dark: 0x262c24, glow: 0xa0ffc0 },
    music: { scales: ['aeolian', 'phrygian'], bpm: [112, 124], leads: ['pulse'], basses: ['bass'] },
  },
  {
    id: 'citadel',
    name: 'CAPITAL CITADEL',
    tints: [0xf0f0f4, 0xf4f0e8, 0xeef2f8],
    rims: [0xffd060, 0x80c0ff],
    suns: [0xfff8e0, 0xffffff],
    nebula: [3, 0],
    planets: [1, 0],
    plates: 'polished',
    segWeights: { space: 1, hull: 4, walls: 3, islands: 2, spine: 3, twin: 4 },
    deco: { EMBLEM: 3, LIGHT_PANEL: 4, WINDOWS: 3, PAD: 2, SOLAR: 2, CHEVRON: 2, LIGHT_CYAN: 2, HEX: 2 },
    props: { obelisk: 4, dome: 3, pad: 3, reactor: 2 },
    mega: { spire: 4, battleship: 3, ring: 2 },
    ambient: { traffic: true, particles: 'sparks' },
    bullet: 'eb_gold',
    basics: ['interceptor', 'gunship', 'spinner', 'fighter'],
    signature: ['elite', 'shielddrone', 'gatepylon'],
    ground: ['turret'],
    midBosses: ['lancer', 'twins', 'warden'],
    sectorBoss: 'overseer',
    bossColors: { base: 0xc8ccd8, light: 0xffffff, mid: 0xe0e4ee, dark: 0x6a6e80, glow: 0xffd060 },
    music: { scales: ['mixolydian', 'ionian'], bpm: [136, 148], leads: ['supersaw'], basses: ['bass'] },
  },
];

export const LEVELS_PER_SECTOR = 4;

export function themeFor(sector) {
  return THEMES[((sector % THEMES.length) + THEMES.length) % THEMES.length];
}

/**
 * Enemy types available in a level: the roster grows through the 4 levels,
 * and from round 2 on a couple of guests from other themes join in.
 */
export function rosterFor(sector, level, rng) {
  const t = themeFor(sector);
  const round = Math.floor(sector / THEMES.length);
  const basics = t.basics.slice(0, Math.min(t.basics.length, 2 + level));
  const sig = t.signature.slice(0, Math.min(3, level + 1));
  const roster = [...new Set([...basics, ...sig, ...t.ground])];
  if (round > 0 && rng) {
    const others = THEMES.filter((o) => o !== t).flatMap((o) => o.signature);
    for (let i = 0; i < Math.min(3, round + 1); i++) roster.push(rng.pick(others));
  }
  return [...new Set(roster)];
}
