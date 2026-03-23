import { describe, it, expect } from 'vitest';
import { terrainAt, isWalkable, tileHash, seededRng, isRoad } from '../terrain';

describe('terrain', () => {
  it('returns deterministic terrain for same coordinates', () => {
    const t1 = terrainAt(100, 200);
    const t2 = terrainAt(100, 200);
    expect(t1).toBe(t2);
  });

  it('generates valid terrain types', () => {
    const valid = ['grass', 'dirt', 'rubble', 'asphalt'];
    for (let i = 0; i < 100; i++) {
      const t = terrainAt(i * 7, i * 13);
      expect(valid).toContain(t);
    }
  });

  it('places roads at expected positions', () => {
    // Roads at y % 64 === 20 or 21
    expect(isRoad(50, 20)).toBe(true);
    expect(isRoad(50, 21)).toBe(true);
    expect(isRoad(50, 84)).toBe(true); // 84 % 64 = 20
    expect(isRoad(50, 22)).toBe(false);
  });

  it('isWalkable returns false for out-of-bounds', () => {
    expect(isWalkable(-1, 0)).toBe(false);
    expect(isWalkable(0, -1)).toBe(false);
    expect(isWalkable(4096, 0)).toBe(false);
    expect(isWalkable(0, 4096)).toBe(false);
    expect(isWalkable(100, 100)).toBe(true);
  });

  it('tileHash returns values between 0 and 1', () => {
    for (let i = 0; i < 100; i++) {
      const h = tileHash(i * 17, i * 31);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it('seededRng produces deterministic sequence', () => {
    const rng1 = seededRng(42);
    const rng2 = seededRng(42);
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  it('seededRng produces different sequences for different seeds', () => {
    const rng1 = seededRng(42);
    const rng2 = seededRng(99);
    const vals1 = Array.from({ length: 5 }, () => rng1());
    const vals2 = Array.from({ length: 5 }, () => rng2());
    expect(vals1).not.toEqual(vals2);
  });
});
