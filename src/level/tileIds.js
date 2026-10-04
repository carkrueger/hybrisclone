// Tile indices shared by the painters (gfx/paint/station.js) and the backdrop generator.

// cell-aligned decoration overlays (deco tileset)
export const DECO = {
  VENT: 0,
  GRATE: 1,
  HATCH: 2,
  LIGHT_RED: 3,
  LIGHT_CYAN: 4,
  LIGHT_AMBER: 5,
  PIPE_H: 6,
  PIPE_V: 7,
  FAN: 8,
  DISH: 9,
  CRATE: 10,
  HAZARD: 11,
  ARMOR: 12,
  SOLAR: 13,
  GREEBLE: 14,
  PAD: 15,
  WINDOWS: 16,
  VENT_GLOW: 17,
  CONDUIT: 18,
  HEX: 19,
  TERMINAL: 20,
  CHEVRON: 21,
  // theme decorations
  CRYSTAL: 22,
  ICE_VENT: 23,
  EGG: 24,
  VEIN: 25,
  ACID: 26,
  LAVA: 27,
  CRUCIBLE: 28,
  DEBRIS: 29,
  BROKEN_PIPE: 30,
  EMBLEM: 31,
  LIGHT_PANEL: 32,
  SPORE: 33,
};

export const LIGHT_TILES = {
  [DECO.LIGHT_RED]: 0xff3030,
  [DECO.LIGHT_CYAN]: 0x30e0ff,
  [DECO.LIGHT_AMBER]: 0xffb030,
  [DECO.VENT_GLOW]: 0xff6a20,
  [DECO.ICE_VENT]: 0x80f0ff,
  [DECO.LAVA]: 0xff6a20,
  [DECO.CRUCIBLE]: 0xff9030,
  [DECO.LIGHT_PANEL]: 0xfff4d8,
  [DECO.SPORE]: 0x80ff90,
  [DECO.ACID]: 0x90ff50,
  [DECO.CRYSTAL]: 0x80e8ff,
};

// big multi-cell station props: footprint in cells [w, h]
export const PROPS = {
  dome: [2, 2],
  reactor: [3, 3],
  hangar: [3, 2],
  pad: [3, 3],
  tower: [2, 2],
  tanks: [2, 3],
  spire: [2, 2],
  eggs: [2, 2],
  smelter: [3, 3],
  hullpiece: [3, 2],
  obelisk: [2, 2],
};

// distant girder layer (midtiles tileset)
export const MID = {
  V: 0,
  H: 1,
  JUNCTION: 2,
  X: 3,
  PANEL: 4,
  DIAG: 5,
};

/** dual-grid vertex mask bits: cells around a vertex */
export const MASK = { TL: 1, TR: 2, BL: 4, BR: 8 };
