import { describe, it, expect } from 'vitest';
import { PODS, resolvePickup, DUPLICATE_BONUS } from '../src/entities/pickups.js';
import { LADDER, MAX_POWER } from '../src/entities/weapons.js';

const LIMITS = { maxPower: MAX_POWER, maxBombs: 5 };
const base = (o = {}) => ({ power: 3, bombs: 2, weapon: 'vulcan', specials: new Set(), shield: false, ...o });

describe('resolvePickup', () => {
  it('powers up on P and pays out once maxed', () => {
    expect(resolvePickup(base(), 'P', LIMITS).state.power).toBe(4);
    const r = resolvePickup(base({ power: MAX_POWER }), 'P', LIMITS);
    expect(r.state.power).toBe(MAX_POWER);
    expect(r.score).toBe(5000);
  });

  it('adds bombs up to the cap', () => {
    expect(resolvePickup(base(), 'B', LIMITS).state.bombs).toBe(3);
    const r = resolvePickup(base({ bombs: 5 }), 'B', LIMITS);
    expect(r.state.bombs).toBe(5);
    expect(r.score).toBe(3000);
  });

  it('switches the main gun, or powers up when it is already active', () => {
    const sw = resolvePickup(base(), 'L', LIMITS);
    expect(sw.state.weapon).toBe('laser');
    expect(sw.state.power).toBe(3);
    const same = resolvePickup(base({ weapon: 'homing' }), 'H', LIMITS);
    expect(same.state.weapon).toBe('homing');
    expect(same.state.power).toBe(4);
  });

  it('stacks one of each special; duplicates pay a bonus', () => {
    const a = resolvePickup(base(), 'O', LIMITS);
    expect(a.special).toBe('orb');
    const b = resolvePickup(a.state, 'W', LIMITS);
    expect([...b.state.specials].sort()).toEqual(['orb', 'wing']);
    const dup = resolvePickup(b.state, 'O', LIMITS);
    expect(dup.special).toBeUndefined();
    expect(dup.score).toBe(DUPLICATE_BONUS);
  });

  it('raises the shield once; a second D pays a bonus', () => {
    const a = resolvePickup(base(), 'D', LIMITS);
    expect(a.shieldOn).toBe(true);
    expect(a.state.shield).toBe(true);
    const b = resolvePickup(a.state, 'D', LIMITS);
    expect(b.shieldOn).toBeUndefined();
    expect(b.score).toBe(DUPLICATE_BONUS);
  });

  it('does not mutate the input state', () => {
    const st = base();
    resolvePickup(st, 'T', LIMITS);
    expect(st.specials.size).toBe(0);
  });

  it('handles every pod letter', () => {
    for (const k of Object.keys(PODS)) expect(resolvePickup(base(), k, LIMITS).text).toBeTruthy();
  });
});

describe('LADDER', () => {
  it('only ever moves up', () => {
    for (let i = 1; i < LADDER.length; i++) {
      const a = LADDER[i - 1];
      const b = LADDER[i];
      expect(b.main >= a.main && b.side >= a.side && b.rear >= a.rear).toBe(true);
      expect(b.main + b.side + b.rear).toBeGreaterThan(a.main + a.side + a.rear);
    }
  });
});
