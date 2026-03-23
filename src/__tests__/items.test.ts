import { describe, it, expect } from 'vitest';
import { Inventory, spawnItem, createItem } from '../items';

describe('Inventory', () => {
  it('respects weight capacity', () => {
    const inv = new Inventory(5);
    const heavy = createItem('Heavy', 'materials', 4, 10);
    const light = createItem('Light', 'materials', 2, 5);

    expect(inv.add(heavy)).toBe(true);
    expect(inv.currentWeight).toBe(4);
    expect(inv.canAdd(light)).toBe(false);
    expect(inv.add(light)).toBe(false);
  });

  it('can add and remove items', () => {
    const inv = new Inventory(10);
    const item = createItem('Test', 'food', 1, 10);

    expect(inv.add(item)).toBe(true);
    expect(inv.items.length).toBe(1);
    expect(inv.remove(item)).toBe(true);
    expect(inv.items.length).toBe(0);
    expect(inv.isEmpty()).toBe(true);
  });

  it('finds items by category', () => {
    const inv = new Inventory(20);
    inv.add(createItem('Metal', 'materials', 2, 10));
    inv.add(createItem('Beans', 'food', 1, 25));
    inv.add(createItem('Water', 'water', 1, 30));

    expect(inv.findByCategory('food')?.name).toBe('Beans');
    expect(inv.findByCategory('medicine')).toBeUndefined();
    expect(inv.countByCategory('materials')).toBe(1);
  });

  it('reports free weight correctly', () => {
    const inv = new Inventory(10);
    inv.add(createItem('A', 'food', 3, 10));
    inv.add(createItem('B', 'water', 2, 10));
    expect(inv.freeWeight).toBe(5);
  });
});

describe('spawnItem', () => {
  it('creates items from templates', () => {
    const item = spawnItem('Canned Beans');
    expect(item.name).toBe('Canned Beans');
    expect(item.category).toBe('food');
    expect(item.weight).toBe(1);
    expect(item.value).toBe(30);
  });

  it('throws for unknown templates', () => {
    expect(() => spawnItem('Nonexistent')).toThrow();
  });

  it('assigns unique IDs', () => {
    const a = spawnItem('Water Bottle');
    const b = spawnItem('Water Bottle');
    expect(a.id).not.toBe(b.id);
  });
});
