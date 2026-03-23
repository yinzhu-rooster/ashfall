import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

// Mock pixi.js
vi.mock('pixi.js', () => ({
  Container: class {
    addChild() {}
    removeChild() {}
    removeChildren() {}
  },
  Graphics: class {
    rect() { return this; }
    circle() { return this; }
    fill() { return this; }
    stroke() { return this; }
    clear() { return this; }
  },
  Text: class {
    anchor = { set() {} };
    style = {};
    set x(_: number) {}
    set y(_: number) {}
  },
}));

import { SocialManager } from '../social';
import { Survivor } from '../survivor';
import { BACKGROUNDS } from '../types';

describe('SocialManager', () => {
  function makeSurvivor(x: number, y: number): Survivor {
    return new Survivor(x, y, BACKGROUNDS[0]);
  }

  it('builds bonds between adjacent survivors', () => {
    const social = new SocialManager();
    const a = makeSurvivor(10, 10);
    const b = makeSurvivor(11, 10); // adjacent

    // Tick several times
    for (let i = 0; i < 100; i++) {
      social.tick([a, b]);
    }

    const bond = social.getBond(a, b);
    expect(bond).toBeGreaterThan(0);
  });

  it('does not build bonds between distant survivors', () => {
    const social = new SocialManager();
    const a = makeSurvivor(10, 10);
    const b = makeSurvivor(50, 50); // far away

    for (let i = 0; i < 100; i++) {
      social.tick([a, b]);
    }

    expect(social.getBond(a, b)).toBe(0);
  });

  it('returns bonds for a specific survivor', () => {
    const social = new SocialManager();
    const a = makeSurvivor(10, 10);
    const b = makeSurvivor(11, 10);
    const c = makeSurvivor(100, 100);

    for (let i = 0; i < 50; i++) {
      social.tick([a, b, c]);
    }

    const bondsA = social.getBondsFor(a, [a, b, c]);
    expect(bondsA.length).toBeGreaterThan(0);
    expect(bondsA[0]!.name).toBe(b.name);
  });
});
