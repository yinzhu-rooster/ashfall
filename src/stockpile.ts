import { Container, Graphics } from 'pixi.js';
import { TILE_SIZE } from './constants';
import { Item, ItemCategory } from './items';

export class Stockpile {
  private tileSet = new Set<string>();
  private tileList: { x: number; y: number }[] = [];
  readonly items: Item[] = [];
  readonly container = new Container();
  private graphics = new Graphics();

  constructor() {
    this.container.addChild(this.graphics);
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  addTile(x: number, y: number): boolean {
    const k = this.key(x, y);
    if (this.tileSet.has(k)) return false;
    this.tileSet.add(k);
    this.tileList.push({ x, y });
    this.redraw();
    return true;
  }

  removeTile(x: number, y: number): void {
    const k = this.key(x, y);
    if (!this.tileSet.has(k)) return;
    this.tileSet.delete(k);
    const idx = this.tileList.findIndex((t) => t.x === x && t.y === y);
    if (idx >= 0) this.tileList.splice(idx, 1);
    this.redraw();
  }

  hasTile(x: number, y: number): boolean {
    return this.tileSet.has(this.key(x, y));
  }

  get tiles(): readonly { x: number; y: number }[] {
    return this.tileList;
  }

  get tileCount(): number {
    return this.tileSet.size;
  }

  nearestTile(fromX: number, fromY: number): { x: number; y: number } | null {
    if (this.tileList.length === 0) return null;
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const t of this.tileList) {
      const d = (t.x - fromX) ** 2 + (t.y - fromY) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  depositItem(item: Item): void {
    this.items.push(item);
  }

  takeItem(category: ItemCategory): Item | null {
    const idx = this.items.findIndex((it) => it.category === category);
    if (idx < 0) return null;
    return this.items.splice(idx, 1)[0]!;
  }

  countByCategory(category: ItemCategory): number {
    let count = 0;
    for (const it of this.items) {
      if (it.category === category) count++;
    }
    return count;
  }

  private redraw(): void {
    this.graphics.clear();
    for (const t of this.tileList) {
      this.graphics
        .rect(t.x * TILE_SIZE + 2, t.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        .stroke({ color: 0xc8b060, alpha: 0.6, width: 2 });
      const cx = t.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = t.y * TILE_SIZE + TILE_SIZE / 2;
      const s = 3;
      this.graphics
        .moveTo(cx, cy - s)
        .lineTo(cx + s, cy)
        .lineTo(cx, cy + s)
        .lineTo(cx - s, cy)
        .closePath()
        .fill({ color: 0xc8b060, alpha: 0.4 });
    }
  }

  toJSON(): object {
    return {
      tiles: this.tileList,
      items: this.items,
    };
  }
}
