import { describe, it, expect } from 'vitest';
import { vi } from 'vitest';

// Mock pixi.js
vi.mock('pixi.js', () => ({
  Container: class {
    children: unknown[] = [];
    addChild(c: unknown) { this.children.push(c); }
    addChildAt(c: unknown) { this.children.push(c); }
    removeChild() {}
    destroy() {}
    set x(_: number) {}
    set y(_: number) {}
  },
  Graphics: class {
    rect() { return this; }
    roundRect() { return this; }
    circle() { return this; }
    fill() { return this; }
    stroke() { return this; }
    clear() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    set x(_: number) {}
    set y(_: number) {}
    set alpha(_: number) {}
  },
  Text: class {
    anchor = { set() {} };
    set x(_: number) {}
    set y(_: number) {}
    set alpha(_: number) {}
  },
}));

import { BuildingManager } from '../building';
import { Stockpile } from '../stockpile';
import { createItem } from '../items';

describe('BuildingManager', () => {
  it('places blueprints and tracks them', () => {
    const bm = new BuildingManager();
    const s = bm.placeBlueprint('floor', 10, 10);
    expect(s).not.toBeNull();
    expect(s!.state).toBe('blueprint');
    expect(bm.structureAt(10, 10)).toBe(s);
  });

  it('prevents placing on occupied tiles', () => {
    const bm = new BuildingManager();
    bm.placeBlueprint('floor', 10, 10);
    expect(bm.placeBlueprint('wall', 10, 10)).toBeNull();
  });

  it('tracks knowledge unlocks', () => {
    const bm = new BuildingManager();
    expect(bm.isUnlocked('wall')).toBe(false); // needs Carpentry Basics
    expect(bm.isUnlocked('floor')).toBe(true); // always available

    bm.unlockKnowledge('Carpentry Basics');
    expect(bm.isUnlocked('wall')).toBe(true);
    expect(bm.isUnlocked('door')).toBe(true);
  });

  it('checks affordability against stockpile', () => {
    const bm = new BuildingManager();
    const sp = new Stockpile();
    sp.addTile(0, 0);

    // Floor costs 1 materials
    expect(bm.canAfford('floor', sp)).toBe(false);

    sp.depositItem(createItem('Metal', 'materials', 2, 10));
    expect(bm.canAfford('floor', sp)).toBe(true);
  });

  it('progresses build to completion', () => {
    const bm = new BuildingManager();
    const s = bm.placeBlueprint('campfire', 5, 5)!;
    expect(s.state).toBe('blueprint');

    // Campfire has buildTicks = 6
    for (let i = 0; i < 5; i++) {
      expect(bm.progressBuild(s)).toBe(false);
    }
    expect(bm.progressBuild(s)).toBe(true);
    expect(s.state).toBe('built');
  });

  it('walls block movement', () => {
    const bm = new BuildingManager();
    bm.unlockKnowledge('Carpentry Basics');
    const wall = bm.placeBlueprint('wall', 3, 3)!;

    // Blueprint doesn't block yet
    expect(bm.blocksMovement(3, 3)).toBe(false);

    // Build it
    for (let i = 0; i < wall.def.buildTicks; i++) {
      bm.progressBuild(wall);
    }
    expect(bm.blocksMovement(3, 3)).toBe(true);
  });

  it('detects enclosed rooms', () => {
    const bm = new BuildingManager();
    bm.unlockKnowledge('Carpentry Basics');

    // Build a 3x3 room with a door
    // W W W
    // W . W
    // W D W
    const positions = [
      [0, 0, 'wall'], [1, 0, 'wall'], [2, 0, 'wall'],
      [0, 1, 'wall'],                  [2, 1, 'wall'],
      [0, 2, 'wall'], [1, 2, 'door'],  [2, 2, 'wall'],
    ] as const;

    for (const [x, y, type] of positions) {
      const s = bm.placeBlueprint(type, x, y)!;
      for (let i = 0; i < s.def.buildTicks; i++) {
        bm.progressBuild(s);
      }
    }

    expect(bm.isEnclosed(1, 1)).toBe(true);
    expect(bm.isEnclosed(5, 5)).toBe(false); // outside
  });

  it('finds nearest bed and blueprint', () => {
    const bm = new BuildingManager();
    const bed = bm.placeBlueprint('bed', 10, 10)!;
    for (let i = 0; i < bed.def.buildTicks; i++) bm.progressBuild(bed);

    const found = bm.findNearestBed(12, 12, 64);
    expect(found).toBe(bed);

    bm.placeBlueprint('floor', 20, 20);
    const bp = bm.findNearestBlueprint(18, 18, 64);
    expect(bp).not.toBeNull();
    expect(bp!.x).toBe(20);
  });
});
