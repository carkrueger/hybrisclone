// Pickup pods: what each letter does. Pure data + logic (no Phaser) so the
// rules can be unit-tested; GameScene applies the result and plays the fx.

export const WEAPON_TYPES = {
  vulcan: { name: 'VULCAN', color: 0xf08a20 },
  laser: { name: 'LASER', color: 0xd040f0 },
  homing: { name: 'HOMING', color: 0x30c060 },
};

export const SPECIALS = {
  orb: { name: 'ORB', pod: 'O' },
  wing: { name: 'WINGMAN', pod: 'W' },
  pd: { name: 'DEFENSE', pod: 'T' },
};

export const DUPLICATE_BONUS = 2500;

// kind: power | bomb | score | weapon | special | shield
export const PODS = {
  P: { kind: 'power', color: 0x2f7cf0 },
  B: { kind: 'bomb', color: 0xe03838 },
  S: { kind: 'score', color: 0xe0a828 },
  V: { kind: 'weapon', value: 'vulcan', color: WEAPON_TYPES.vulcan.color },
  L: { kind: 'weapon', value: 'laser', color: WEAPON_TYPES.laser.color },
  H: { kind: 'weapon', value: 'homing', color: WEAPON_TYPES.homing.color },
  O: { kind: 'special', value: 'orb', color: 0x8a60ff },
  W: { kind: 'special', value: 'wing', color: 0x20b0b0 },
  T: { kind: 'special', value: 'pd', color: 0xd0a020 },
  D: { kind: 'shield', color: 0x40d0ff },
};

/**
 * state: { power, bombs, weapon, specials: Set, shield }
 * returns { state, text, tone, score, special?, shieldOn? }
 *   tone: 'cyan' | 'red' | 'yellow' | 'weapon' (caller maps to a colour)
 */
export function resolvePickup(state, letter, { maxPower, maxBombs }) {
  const pod = PODS[letter];
  const next = { ...state, specials: new Set(state.specials) };
  const out = { state: next, text: '', tone: 'yellow', score: 0 };
  const bonus = (n) => {
    out.score = n;
    out.text = String(n);
    out.tone = 'yellow';
    return out;
  };
  const powerUp = () => {
    if (next.power >= maxPower) return bonus(5000);
    next.power++;
    out.text = 'POWER UP';
    out.tone = 'cyan';
    return out;
  };
  if (!pod) return bonus(2000);

  switch (pod.kind) {
    case 'power':
      return powerUp();
    case 'bomb':
      if (next.bombs >= maxBombs) return bonus(3000);
      next.bombs++;
      out.text = 'BOMB';
      out.tone = 'red';
      return out;
    case 'weapon':
      if (next.weapon === pod.value) return powerUp();
      next.weapon = pod.value;
      out.text = WEAPON_TYPES[pod.value].name;
      out.tone = 'weapon';
      return out;
    case 'special':
      if (next.specials.has(pod.value)) return bonus(DUPLICATE_BONUS);
      next.specials.add(pod.value);
      out.special = pod.value;
      out.text = SPECIALS[pod.value].name;
      out.tone = 'cyan';
      return out;
    case 'shield':
      if (next.shield) return bonus(DUPLICATE_BONUS);
      next.shield = true;
      out.shieldOn = true;
      out.text = 'SHIELD';
      out.tone = 'cyan';
      return out;
    default:
      return bonus(2000);
  }
}
