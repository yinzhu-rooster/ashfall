import { describe, it, expect } from 'vitest';
import { Stockpile } from '../stockpile';
import { createItem } from '../items';

// Mock pixi.js for tests
import { vi } from 'vitest';
vi.mock('pixi.js', () => ({
  Container: class { addChild() {} removeChild() {} },
  Graphics: class {
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    clear() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
  },
}));

describe('Stockpile', () => {
  it('adds and removes tiles', () => {
    const s = new Stockpile();
    expect(s.addTile(5, 5)).toBe(true);
    expect(s.hasTile(5, 5)).toBe(true);
    expect(s.tileCount).toBe(1);

    // No duplicate
    expect(s.addTile(5, 5)).toBe(false);
    expect(s.tileCount).toBe(1);

    s.removeTile(5, 5);
    expect(s.hasTile(5, 5)).toBe(false);
    expect(s.tileCount).toBe(0);
  });

  it('deposits and takes items by category', () => {
    const s = new Stockpile();
    s.addTile(0, 0);

    const food = createItem('Beans', 'food', 1, 25);
    const water = createItem('Water', 'water', 1, 30);
    const mats = createItem('Metal', 'materials', 2, 10);

    s.depositItem(food);
    s.depositItem(water);
    s.depositItem(mats);

    expect(s.countByCategory('food')).toBe(1);
    expect(s.countByCategory('water')).toBe(1);
    expect(s.countByCategory('materials')).toBe(1);

    const taken = s.takeItem('food');
    expect(taken?.name).toBe('Beans');
    expect(s.countByCategory('food')).toBe(0);

    expect(s.takeItem('medicine')).toBeNull();
  });

  it('finds nearest tile', () => {
    const s = new Stockpile();
    s.addTile(10, 10);
    s.addTile(20, 20);

    const nearest = s.nearestTile(12, 12);
    expect(nearest?.x).toBe(10);
    expect(nearest?.y).toBe(10);

    const nearest2 = s.nearestTile(19, 19);
    expect(nearest2?.x).toBe(20);
    expect(nearest2?.y).toBe(20);
  });

  it('returns null for nearest when empty', () => {
    const s = new Stockpile();
    expect(s.nearestTile(0, 0)).toBeNull();
  });
});
