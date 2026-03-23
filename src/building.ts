import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE } from './constants';
import { ItemCategory } from './items';
import { Stockpile } from './stockpile';

export type StructureType = 'wall' | 'floor' | 'door' | 'bed' | 'campfire';

export interface MaterialCost {
  category: ItemCategory;
  amount: number;
}

export interface StructureDef {
  type: StructureType;
  label: string;
  color: number;
  blocksMovement: boolean;
  buildTicks: number;
  costs: MaterialCost[];
  requiredKnowledge: string | null; // null = always available
}

export const STRUCTURE_DEFS: Record<StructureType, StructureDef> = {
  wall: {
    type: 'wall',
    label: 'Wall',
    color: 0x8a7a60,
    blocksMovement: true,
    buildTicks: 15,
    costs: [{ category: 'materials', amount: 2 }],
    requiredKnowledge: 'Carpentry Basics',
  },
  floor: {
    type: 'floor',
    label: 'Floor',
    color: 0x6a6050,
    blocksMovement: false,
    buildTicks: 8,
    costs: [{ category: 'materials', amount: 1 }],
    requiredKnowledge: null,
  },
  door: {
    type: 'door',
    label: 'Door',
    color: 0xa08040,
    blocksMovement: false,
    buildTicks: 12,
    costs: [{ category: 'materials', amount: 2 }],
    requiredKnowledge: 'Carpentry Basics',
  },
  bed: {
    type: 'bed',
    label: 'Bed',
    color: 0x6080a0,
    blocksMovement: false,
    buildTicks: 10,
    costs: [{ category: 'materials', amount: 1 }],
    requiredKnowledge: null,
  },
  campfire: {
    type: 'campfire',
    label: 'Campfire',
    color: 0xc06020,
    blocksMovement: false,
    buildTicks: 6,
    costs: [{ category: 'materials', amount: 1 }],
    requiredKnowledge: null,
  },
};

export type BuildState = 'blueprint' | 'built';

export interface Structure {
  type: StructureType;
  def: StructureDef;
  x: number;
  y: number;
  state: BuildState;
  buildProgress: number; // 0 to def.buildTicks
  container: Container;
}

function createStructureGraphic(def: StructureDef, state: BuildState): Container {
  const c = new Container();
  const gfx = new Graphics();

  if (def.type === 'campfire') {
    // Circle for campfire
    gfx.circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.35)
      .fill({ color: def.color, alpha: state === 'blueprint' ? 0.3 : 0.8 });
    gfx.circle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE * 0.35)
      .stroke({ color: 0xffa040, alpha: state === 'blueprint' ? 0.4 : 0.8, width: 2 });
  } else if (def.type === 'bed') {
    // Rounded rect for bed
    gfx.roundRect(3, 3, TILE_SIZE - 6, TILE_SIZE - 6, 4)
      .fill({ color: def.color, alpha: state === 'blueprint' ? 0.3 : 0.7 });
    gfx.roundRect(3, 3, TILE_SIZE - 6, TILE_SIZE - 6, 4)
      .stroke({ color: 0x80a0c0, alpha: state === 'blueprint' ? 0.4 : 0.6, width: 1 });
  } else if (def.type === 'door') {
    // Door with gap
    gfx.rect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4)
      .fill({ color: def.color, alpha: state === 'blueprint' ? 0.3 : 0.6 });
    gfx.rect(TILE_SIZE * 0.3, TILE_SIZE * 0.15, TILE_SIZE * 0.4, TILE_SIZE * 0.7)
      .fill({ color: 0x302820, alpha: state === 'blueprint' ? 0.2 : 0.5 });
  } else {
    // Wall or floor: simple filled rect
    gfx.rect(0, 0, TILE_SIZE, TILE_SIZE)
      .fill({ color: def.color, alpha: state === 'blueprint' ? 0.3 : (def.type === 'wall' ? 0.85 : 0.5) });
    gfx.rect(0, 0, TILE_SIZE, TILE_SIZE)
      .stroke({ color: 0x000000, alpha: 0.2, width: 1 });
  }

  c.addChild(gfx);

  // Label for blueprints
  if (state === 'blueprint') {
    const label = new Text({
      text: def.label[0]!,
      style: { fontSize: 10, fill: 0xffffff, fontFamily: 'Courier New' },
    });
    label.anchor.set(0.5, 0.5);
    label.x = TILE_SIZE / 2;
    label.y = TILE_SIZE / 2;
    label.alpha = 0.5;
    c.addChild(label);
  }

  return c;
}

export class BuildingManager {
  readonly structures: Structure[] = [];
  private structureMap = new Map<string, Structure>(); // "x,y" -> Structure
  readonly container = new Container();

  // Knowledge unlocks
  private unlockedKnowledge = new Set<string>();

  // Built-in always-available knowledge
  constructor() {
    // Floor, bed, and campfire don't require knowledge
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  unlockKnowledge(name: string): boolean {
    if (this.unlockedKnowledge.has(name)) return false;
    this.unlockedKnowledge.add(name);
    return true;
  }

  hasKnowledge(name: string): boolean {
    return this.unlockedKnowledge.has(name);
  }

  get knowledgeList(): string[] {
    return [...this.unlockedKnowledge];
  }

  isUnlocked(type: StructureType): boolean {
    const def = STRUCTURE_DEFS[type];
    return def.requiredKnowledge === null || this.unlockedKnowledge.has(def.requiredKnowledge);
  }

  getAvailableTypes(): StructureType[] {
    return (Object.keys(STRUCTURE_DEFS) as StructureType[]).filter((t) => this.isUnlocked(t));
  }

  canPlace(x: number, y: number): boolean {
    return !this.structureMap.has(this.key(x, y));
  }

  /** Check if stockpile has enough materials for a structure */
  canAfford(type: StructureType, stockpile: Stockpile): boolean {
    const def = STRUCTURE_DEFS[type];
    for (const cost of def.costs) {
      if (stockpile.countByCategory(cost.category) < cost.amount) return false;
    }
    return true;
  }

  /** Place a blueprint (not yet built) */
  placeBlueprint(type: StructureType, x: number, y: number): Structure | null {
    if (!this.canPlace(x, y)) return null;

    const def = STRUCTURE_DEFS[type];
    const graphic = createStructureGraphic(def, 'blueprint');
    graphic.x = x * TILE_SIZE;
    graphic.y = y * TILE_SIZE;

    const structure: Structure = {
      type,
      def,
      x,
      y,
      state: 'blueprint',
      buildProgress: 0,
      container: graphic,
    };

    this.structures.push(structure);
    this.structureMap.set(this.key(x, y), structure);
    this.container.addChild(graphic);
    return structure;
  }

  /** Progress building. Returns true when complete. */
  progressBuild(structure: Structure): boolean {
    if (structure.state === 'built') return true;

    structure.buildProgress++;
    if (structure.buildProgress >= structure.def.buildTicks) {
      structure.state = 'built';
      // Replace graphic
      this.container.removeChild(structure.container);
      structure.container.destroy({ children: true });

      const newGraphic = createStructureGraphic(structure.def, 'built');
      newGraphic.x = structure.x * TILE_SIZE;
      newGraphic.y = structure.y * TILE_SIZE;
      structure.container = newGraphic;
      this.container.addChild(newGraphic);
      return true;
    }
    return false;
  }

  /** Remove a structure */
  remove(structure: Structure): void {
    const idx = this.structures.indexOf(structure);
    if (idx >= 0) {
      this.structures.splice(idx, 1);
      this.structureMap.delete(this.key(structure.x, structure.y));
      this.container.removeChild(structure.container);
      structure.container.destroy({ children: true });
    }
  }

  structureAt(x: number, y: number): Structure | undefined {
    return this.structureMap.get(this.key(x, y));
  }

  /** Is this tile blocked by a built wall? */
  blocksMovement(x: number, y: number): boolean {
    const s = this.structureMap.get(this.key(x, y));
    return s !== undefined && s.state === 'built' && s.def.blocksMovement;
  }

  /** Find nearest blueprint that needs building */
  findNearestBlueprint(fromX: number, fromY: number, radius: number): Structure | null {
    let best: Structure | null = null;
    let bestDist = radius * radius;

    for (const s of this.structures) {
      if (s.state !== 'blueprint') continue;
      const dx = s.x - fromX;
      const dy = s.y - fromY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  }

  /** Check if a tile has a bed */
  hasBed(x: number, y: number): boolean {
    const s = this.structureMap.get(this.key(x, y));
    return s !== undefined && s.type === 'bed' && s.state === 'built';
  }

  /** Check if a tile has a campfire */
  hasCampfire(x: number, y: number): boolean {
    const s = this.structureMap.get(this.key(x, y));
    return s !== undefined && s.type === 'campfire' && s.state === 'built';
  }

  /** Find nearest bed for sleeping */
  findNearestBed(fromX: number, fromY: number, radius: number): Structure | null {
    let best: Structure | null = null;
    let bestDist = radius * radius;

    for (const s of this.structures) {
      if (s.type !== 'bed' || s.state !== 'built') continue;
      const dx = s.x - fromX;
      const dy = s.y - fromY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  }

  /** Simple room detection: check if tile is enclosed by walls/doors */
  isEnclosed(x: number, y: number): boolean {
    // Flood fill from (x,y). If we reach 64+ tiles without hitting all walls, not enclosed.
    const visited = new Set<string>();
    const queue: [number, number][] = [[x, y]];
    const maxFill = 64;
    let head = 0;

    while (head < queue.length) {
      const [cx, cy] = queue[head++]!;
      const k = this.key(cx, cy);
      if (visited.has(k)) continue;
      visited.add(k);

      if (visited.size > maxFill) return false; // too big, not a room

      const neighbors: [number, number][] = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
      for (const [nx, ny] of neighbors) {
        const nk = this.key(nx, ny);
        if (visited.has(nk)) continue;
        const s = this.structureMap.get(nk);
        // Wall blocks flood fill, door also counts as wall for enclosure
        if (s && (s.type === 'wall' || s.type === 'door') && s.state === 'built') continue;
        queue.push([nx, ny]);
      }
    }

    return true; // flood fill stayed contained
  }

  /** Get rest bonus for a tile (bed + enclosure + campfire nearby) */
  getRestBonus(x: number, y: number): number {
    let bonus = 0;
    if (this.hasBed(x, y)) bonus += 0.5; // 50% more rest recovery
    if (this.isEnclosed(x, y)) bonus += 0.3; // 30% more
    // Check for campfire within 3 tiles using spatial map
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 9) continue;
        const s = this.structureMap.get(this.key(x + dx, y + dy));
        if (s && s.type === 'campfire' && s.state === 'built') {
          bonus += 0.2;
          return bonus; // early return, found one
        }
      }
    }
    return bonus;
  }
}
