export type ItemCategory = 'food' | 'water' | 'medicine' | 'materials' | 'knowledge';

export interface Item {
  id: number;
  name: string;
  category: ItemCategory;
  weight: number;
  value: number; // how much need it satisfies, or generic value
}

let nextItemId = 1;

export function createItem(name: string, category: ItemCategory, weight: number, value: number): Item {
  return { id: nextItemId++, name, category, weight, value };
}

export const ITEM_TEMPLATES: Record<string, { category: ItemCategory; weight: number; value: number }> = {
  'Canned Beans':     { category: 'food',      weight: 1, value: 30 },
  'Dried Jerky':      { category: 'food',      weight: 0.5, value: 20 },
  'Canned Soup':      { category: 'food',      weight: 1, value: 25 },
  'Stale Crackers':   { category: 'food',      weight: 0.5, value: 15 },
  'Water Bottle':     { category: 'water',     weight: 1, value: 30 },
  'Water Jug':        { category: 'water',     weight: 2, value: 50 },
  'Dirty Water':      { category: 'water',     weight: 1, value: 15 },
  'Bandages':         { category: 'medicine',  weight: 0.5, value: 20 },
  'Painkillers':      { category: 'medicine',  weight: 0.3, value: 25 },
  'Antibiotics':      { category: 'medicine',  weight: 0.3, value: 40 },
  'Scrap Metal':      { category: 'materials', weight: 2, value: 10 },
  'Wood Planks':      { category: 'materials', weight: 3, value: 10 },
  'Nails':            { category: 'materials', weight: 0.5, value: 8 },
  'Wire':             { category: 'materials', weight: 1, value: 8 },
  'Fabric':           { category: 'materials', weight: 1, value: 6 },
  'Old Textbook':     { category: 'knowledge', weight: 1, value: 15 },
  'Repair Manual':    { category: 'knowledge', weight: 1, value: 20 },
  'Carpentry Basics': { category: 'knowledge', weight: 1, value: 30 },
};

export function spawnItem(templateName: string): Item {
  const t = ITEM_TEMPLATES[templateName];
  if (!t) throw new Error(`Unknown item template: ${templateName}`);
  return createItem(templateName, t.category, t.weight, t.value);
}

export class Inventory {
  readonly items: Item[] = [];
  readonly maxWeight: number;

  constructor(maxWeight: number) {
    this.maxWeight = maxWeight;
  }

  get currentWeight(): number {
    return this.items.reduce((sum, it) => sum + it.weight, 0);
  }

  get freeWeight(): number {
    return this.maxWeight - this.currentWeight;
  }

  canAdd(item: Item): boolean {
    return this.currentWeight + item.weight <= this.maxWeight;
  }

  add(item: Item): boolean {
    if (!this.canAdd(item)) return false;
    this.items.push(item);
    return true;
  }

  remove(item: Item): boolean {
    const idx = this.items.indexOf(item);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    return true;
  }

  removeById(id: number): Item | null {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx < 0) return null;
    return this.items.splice(idx, 1)[0]!;
  }

  findByCategory(category: ItemCategory): Item | undefined {
    return this.items.find((it) => it.category === category);
  }

  countByCategory(category: ItemCategory): number {
    let count = 0;
    for (const it of this.items) {
      if (it.category === category) count++;
    }
    return count;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}
