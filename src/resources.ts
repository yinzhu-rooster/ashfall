import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE, CHUNK_SIZE, SEARCH_RADIUS, WORLD_SEED } from './constants';
import { terrainAt, seededRng } from './terrain';
import { Camera } from './camera';

export type ResourceType = 'food' | 'water';

export interface ResourcePickup {
  type: ResourceType;
  tileX: number;
  tileY: number;
  amount: number;
  container: Container;
}

const RESOURCE_COLORS: Record<ResourceType, number> = {
  food: 0xc47030,
  water: 0x4090d0,
};

const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: 'F',
  water: 'W',
};

function createResourceGraphic(type: ResourceType): Container {
  const c = new Container();
  const size = TILE_SIZE * 0.3;

  const gfx = new Graphics();
  gfx.roundRect(-size, -size, size * 2, size * 2, 3).fill(RESOURCE_COLORS[type]);
  gfx.roundRect(-size, -size, size * 2, size * 2, 3).stroke({ color: 0xffffff, alpha: 0.3, width: 1 });
  c.addChild(gfx);

  const label = new Text({
    text: RESOURCE_LABELS[type],
    style: { fontSize: 9, fill: 0xffffff, fontFamily: 'Courier New', fontWeight: 'bold' },
  });
  label.anchor.set(0.5, 0.5);
  c.addChild(label);

  return c;
}

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class ResourceManager {
  // Per-chunk item storage
  private chunkPickups = new Map<string, ResourcePickup[]>();
  // Chunks that have had initial resources generated
  private generatedChunks = new Set<string>();
  // Rendered chunks (have graphics in world)
  private renderedChunks = new Set<string>();

  readonly container = new Container();

  /** Generate initial resources for a chunk if not done */
  ensureChunk(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    if (this.generatedChunks.has(key)) return;
    this.generatedChunks.add(key);

    const rng = seededRng(WORLD_SEED * 3571 + cx * 7877 + cy * 6991);
    const baseX = cx * CHUNK_SIZE;
    const baseY = cy * CHUNK_SIZE;

    // 1-3 resources per chunk
    const count = Math.floor(rng() * 3) + 1;
    for (let i = 0; i < count; i++) {
      const lx = Math.floor(rng() * CHUNK_SIZE);
      const ly = Math.floor(rng() * CHUNK_SIZE);
      const tx = baseX + lx;
      const ty = baseY + ly;
      const t = terrainAt(tx, ty);
      if (t === 'asphalt') continue;
      if (this.pickupAt(tx, ty)) continue;

      const type: ResourceType = rng() < 0.5 ? 'food' : 'water';
      this.spawn(type, tx, ty);
    }
  }

  /** Show/hide resource graphics based on camera visibility */
  updateVisibility(camera: Camera): void {
    const halfW = window.innerWidth / 2 / camera.zoom;
    const halfH = window.innerHeight / 2 / camera.zoom;
    const centerX = camera.x + window.innerWidth / 2;
    const centerY = camera.y + window.innerHeight / 2;

    const minCX = Math.max(0, Math.floor((centerX - halfW) / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const maxCX = Math.floor((centerX + halfW) / (CHUNK_SIZE * TILE_SIZE)) + 1;
    const minCY = Math.max(0, Math.floor((centerY - halfH) / (CHUNK_SIZE * TILE_SIZE)) - 1);
    const maxCY = Math.floor((centerY + halfH) / (CHUNK_SIZE * TILE_SIZE)) + 1;

    const needed = new Set<string>();
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const key = chunkKey(cx, cy);
        needed.add(key);
        this.ensureChunk(cx, cy);

        // Add graphics if not rendered
        if (!this.renderedChunks.has(key)) {
          const pickups = this.chunkPickups.get(key);
          if (pickups) {
            for (const p of pickups) {
              this.container.addChild(p.container);
            }
            this.renderedChunks.add(key);
          }
        }
      }
    }

    // Remove graphics for distant chunks
    for (const key of this.renderedChunks) {
      if (!needed.has(key)) {
        const pickups = this.chunkPickups.get(key);
        if (pickups) {
          for (const p of pickups) {
            this.container.removeChild(p.container);
          }
        }
        this.renderedChunks.delete(key);
      }
    }
  }

  spawn(type: ResourceType, tileX: number, tileY: number, amount = 25): void {
    const graphic = createResourceGraphic(type);
    graphic.x = tileX * TILE_SIZE + TILE_SIZE / 2;
    graphic.y = tileY * TILE_SIZE + TILE_SIZE / 2;

    const pickup: ResourcePickup = { type, tileX, tileY, amount, container: graphic };

    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const key = chunkKey(cx, cy);

    if (!this.chunkPickups.has(key)) {
      this.chunkPickups.set(key, []);
    }
    this.chunkPickups.get(key)!.push(pickup);

    // If this chunk is rendered, add graphic
    if (this.renderedChunks.has(key)) {
      this.container.addChild(graphic);
    }
  }

  pickupAt(x: number, y: number): ResourcePickup | undefined {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cy = Math.floor(y / CHUNK_SIZE);
    const pickups = this.chunkPickups.get(chunkKey(cx, cy));
    return pickups?.find((p) => p.tileX === x && p.tileY === y);
  }

  remove(pickup: ResourcePickup): void {
    const cx = Math.floor(pickup.tileX / CHUNK_SIZE);
    const cy = Math.floor(pickup.tileY / CHUNK_SIZE);
    const key = chunkKey(cx, cy);
    const pickups = this.chunkPickups.get(key);
    if (pickups) {
      const idx = pickups.indexOf(pickup);
      if (idx >= 0) {
        pickups.splice(idx, 1);
        this.container.removeChild(pickup.container);
      }
    }
  }

  /** Find nearest pickup within search radius */
  findNearest(fromX: number, fromY: number, type: ResourceType): ResourcePickup | null {
    const radius = SEARCH_RADIUS;
    const minCX = Math.max(0, Math.floor((fromX - radius) / CHUNK_SIZE));
    const maxCX = Math.floor((fromX + radius) / CHUNK_SIZE);
    const minCY = Math.max(0, Math.floor((fromY - radius) / CHUNK_SIZE));
    const maxCY = Math.floor((fromY + radius) / CHUNK_SIZE);

    let best: ResourcePickup | null = null;
    let bestDist = radius * radius;

    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        const pickups = this.chunkPickups.get(chunkKey(cx, cy));
        if (!pickups) continue;
        for (const p of pickups) {
          if (p.type !== type) continue;
          const dx = p.tileX - fromX;
          const dy = p.tileY - fromY;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = p;
          }
        }
      }
    }
    return best;
  }

  /** Spawn a random resource near a position */
  spawnNear(centerX: number, centerY: number, type: ResourceType): void {
    for (let attempt = 0; attempt < 20; attempt++) {
      const tx = centerX + Math.floor(Math.random() * 40) - 20;
      const ty = centerY + Math.floor(Math.random() * 40) - 20;
      if (tx < 0 || ty < 0) continue;
      const t = terrainAt(tx, ty);
      if (t === 'asphalt') continue;
      if (this.pickupAt(tx, ty)) continue;
      this.spawn(type, tx, ty);
      return;
    }
  }
}
