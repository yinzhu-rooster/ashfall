import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, WORLD_SEED } from './constants';
import { Item, spawnItem } from './items';
import { seededRng, isRoad } from './terrain';
import { Camera } from './camera';

export type POIType = 'grocery' | 'pharmacy' | 'warehouse' | 'house';

interface LootEntry {
  item: string;
  chance: number;
}

const LOOT_TABLES: Record<POIType, LootEntry[]> = {
  grocery: [
    { item: 'Canned Beans', chance: 0.7 },
    { item: 'Canned Soup', chance: 0.6 },
    { item: 'Stale Crackers', chance: 0.5 },
    { item: 'Dried Jerky', chance: 0.4 },
    { item: 'Water Bottle', chance: 0.5 },
    { item: 'Water Jug', chance: 0.2 },
  ],
  pharmacy: [
    { item: 'Bandages', chance: 0.7 },
    { item: 'Painkillers', chance: 0.6 },
    { item: 'Antibiotics', chance: 0.3 },
    { item: 'Water Bottle', chance: 0.3 },
    { item: 'Dirty Water', chance: 0.4 },
  ],
  warehouse: [
    { item: 'Scrap Metal', chance: 0.7 },
    { item: 'Wood Planks', chance: 0.6 },
    { item: 'Nails', chance: 0.5 },
    { item: 'Wire', chance: 0.5 },
    { item: 'Fabric', chance: 0.4 },
    { item: 'Canned Beans', chance: 0.2 },
    { item: 'Dirty Water', chance: 0.3 },
    { item: 'Repair Manual', chance: 0.15 },
    { item: 'Carpentry Basics', chance: 0.1 },
  ],
  house: [
    { item: 'Canned Soup', chance: 0.4 },
    { item: 'Water Bottle', chance: 0.4 },
    { item: 'Bandages', chance: 0.3 },
    { item: 'Fabric', chance: 0.3 },
    { item: 'Old Textbook', chance: 0.15 },
    { item: 'Stale Crackers', chance: 0.3 },
    { item: 'Carpentry Basics', chance: 0.08 },
  ],
};

const POI_COLORS: Record<POIType, number> = {
  grocery: 0x5a8a50,
  pharmacy: 0x6a6aaa,
  warehouse: 0x8a7a5a,
  house: 0x7a6a5a,
};

const POI_LABELS: Record<POIType, string> = {
  grocery: 'Grocery',
  pharmacy: 'Pharmacy',
  warehouse: 'Warehouse',
  house: 'House',
};

const POI_CONFIGS: { type: POIType; w: number; h: number }[] = [
  { type: 'grocery', w: 6, h: 5 },
  { type: 'pharmacy', w: 5, h: 4 },
  { type: 'warehouse', w: 7, h: 5 },
  { type: 'house', w: 4, h: 4 },
  { type: 'house', w: 4, h: 4 },
  { type: 'house', w: 4, h: 4 },
];

// Region size for POI generation (in tiles)
const REGION_SIZE = 128;

export class POI {
  readonly type: POIType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly doorX: number;
  readonly doorY: number;
  readonly regionKey: string;

  lootRemaining: number;
  readonly maxLoot: number;
  scavengedFully = false;

  container: Container | null = null; // lazily created when chunk loads

  constructor(type: POIType, x: number, y: number, w: number, h: number, regionKey: string, rng: () => number) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;
    this.doorX = x + Math.floor(w / 2);
    this.doorY = y + h - 1;
    this.regionKey = regionKey;

    this.maxLoot = 3 + Math.floor(rng() * 4);
    this.lootRemaining = this.maxLoot;
  }

  buildGraphics(): Container {
    if (this.container) return this.container;

    const c = new Container();
    const gfx = new Graphics();
    const color = POI_COLORS[this.type];

    // Floor
    gfx.rect(
      this.x * TILE_SIZE, this.y * TILE_SIZE,
      this.width * TILE_SIZE, this.height * TILE_SIZE,
    ).fill({ color, alpha: 0.3 });

    // Walls
    for (let tx = this.x; tx < this.x + this.width; tx++) {
      for (let ty = this.y; ty < this.y + this.height; ty++) {
        const isEdge = tx === this.x || tx === this.x + this.width - 1 ||
                       ty === this.y || ty === this.y + this.height - 1;
        const isDoor = tx === this.doorX && ty === this.doorY;

        if (isEdge && !isDoor) {
          gfx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
            .fill({ color, alpha: 0.7 });
          gfx.rect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
            .stroke({ color: 0x000000, alpha: 0.3, width: 1 });
        }
      }
    }

    // Door marker
    gfx.rect(
      this.doorX * TILE_SIZE + 4, this.doorY * TILE_SIZE + 4,
      TILE_SIZE - 8, TILE_SIZE - 8,
    ).fill({ color: 0xc0a060, alpha: 0.6 });

    c.addChild(gfx);

    const label = new Text({
      text: POI_LABELS[this.type],
      style: { fontSize: 10, fill: 0xf0e8d0, fontFamily: 'Courier New' },
    });
    label.anchor.set(0.5, 0.5);
    label.x = (this.x + this.width / 2) * TILE_SIZE;
    label.y = this.y * TILE_SIZE - 8;
    c.addChild(label);

    this.container = c;
    return c;
  }

  destroyGraphics(): void {
    if (this.container) {
      this.container.destroy({ children: true });
      this.container = null;
    }
  }

  containsTile(tx: number, ty: number): boolean {
    return tx >= this.x && tx < this.x + this.width &&
           ty >= this.y && ty < this.y + this.height;
  }

  isWall(tx: number, ty: number): boolean {
    if (!this.containsTile(tx, ty)) return false;
    const isEdge = tx === this.x || tx === this.x + this.width - 1 ||
                   ty === this.y || ty === this.y + this.height - 1;
    const isDoor = tx === this.doorX && ty === this.doorY;
    return isEdge && !isDoor;
  }

  rollLoot(): Item[] {
    if (this.lootRemaining <= 0) return [];

    const table = LOOT_TABLES[this.type];
    const results: Item[] = [];
    for (const entry of table) {
      if (Math.random() < entry.chance) {
        results.push(spawnItem(entry.item));
        if (results.length >= 2) break;
      }
    }

    if (results.length === 0 && this.lootRemaining > 0) {
      const entry = table[Math.floor(Math.random() * table.length)]!;
      results.push(spawnItem(entry.item));
    }

    this.lootRemaining = Math.max(0, this.lootRemaining - results.length);
    if (this.lootRemaining <= 0) {
      this.scavengedFully = true;
    }

    return results;
  }

  updateVisuals(): void {
    if (this.container) {
      this.container.alpha = this.scavengedFully ? 0.5 : 1;
    }
  }
}

export class POIManager {
  // All generated POIs, keyed by region
  private regionPOIs = new Map<string, POI[]>();
  // Spatial index: tile -> POI for wall/containment checks
  private wallTiles = new Set<string>();
  // Currently rendered POIs (have graphics in world)
  private renderedRegions = new Set<string>();

  private worldContainer: Container;
  private poiLayer = new Container();

  constructor(worldContainer: Container) {
    this.worldContainer = worldContainer;
    this.worldContainer.addChild(this.poiLayer);
  }

  /** Generate POIs for a region if not already done */
  ensureRegion(regionX: number, regionY: number): POI[] {
    const key = `${regionX},${regionY}`;
    if (this.regionPOIs.has(key)) return this.regionPOIs.get(key)!;

    const pois = this.generateRegion(regionX, regionY, key);
    this.regionPOIs.set(key, pois);

    // Index wall tiles
    for (const poi of pois) {
      for (let tx = poi.x; tx < poi.x + poi.width; tx++) {
        for (let ty = poi.y; ty < poi.y + poi.height; ty++) {
          if (poi.isWall(tx, ty)) {
            this.wallTiles.add(`${tx},${ty}`);
          }
        }
      }
    }

    return pois;
  }

  private generateRegion(rx: number, ry: number, key: string): POI[] {
    const rng = seededRng(WORLD_SEED * 7919 + rx * 104729 + ry * 224737);
    const baseX = rx * REGION_SIZE;
    const baseY = ry * REGION_SIZE;
    const pois: POI[] = [];

    // Place 3-6 POIs per region
    const count = 3 + Math.floor(rng() * 4);
    const placed: { x: number; y: number; w: number; h: number }[] = [];

    for (let i = 0; i < count; i++) {
      const cfg = POI_CONFIGS[Math.floor(rng() * POI_CONFIGS.length)]!;

      for (let attempt = 0; attempt < 30; attempt++) {
        const px = baseX + 2 + Math.floor(rng() * (REGION_SIZE - cfg.w - 4));
        const py = baseY + 2 + Math.floor(rng() * (REGION_SIZE - cfg.h - 4));

        // Bounds check
        if (px + cfg.w >= MAP_WIDTH || py + cfg.h >= MAP_HEIGHT) continue;

        // Check overlap with placed POIs (2-tile buffer)
        let fits = true;
        for (const p of placed) {
          if (px - 2 < p.x + p.w && px + cfg.w + 2 > p.x &&
              py - 2 < p.y + p.h && py + cfg.h + 2 > p.y) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;

        // Check roads
        let onRoad = false;
        for (let tx = px; tx < px + cfg.w && !onRoad; tx++) {
          for (let ty = py; ty < py + cfg.h && !onRoad; ty++) {
            if (isRoad(tx, ty)) onRoad = true;
          }
        }
        if (onRoad) continue;

        placed.push({ x: px, y: py, w: cfg.w, h: cfg.h });
        pois.push(new POI(cfg.type, px, py, cfg.w, cfg.h, key, rng));
        break;
      }
    }

    return pois;
  }

  /** Ensure regions visible to camera have graphics, unload distant ones */
  updateVisibility(camera: Camera): void {
    const { minRX, minRY, maxRX, maxRY } = this.getVisibleRegionRange(camera);
    const buf = 1;

    const needed = new Set<string>();
    for (let ry = Math.max(0, minRY - buf); ry <= maxRY + buf; ry++) {
      for (let rx = Math.max(0, minRX - buf); rx <= maxRX + buf; rx++) {
        const key = `${rx},${ry}`;
        needed.add(key);

        // Generate if needed
        this.ensureRegion(rx, ry);

        // Render if not yet rendered
        if (!this.renderedRegions.has(key)) {
          const pois = this.regionPOIs.get(key);
          if (pois) {
            for (const poi of pois) {
              const gfx = poi.buildGraphics();
              this.poiLayer.addChild(gfx);
              poi.updateVisuals();
            }
            this.renderedRegions.add(key);
          }
        }
      }
    }

    // Unload distant region graphics
    for (const key of this.renderedRegions) {
      if (!needed.has(key)) {
        const pois = this.regionPOIs.get(key);
        if (pois) {
          for (const poi of pois) {
            if (poi.container) {
              this.poiLayer.removeChild(poi.container);
              poi.destroyGraphics();
            }
          }
        }
        this.renderedRegions.delete(key);
      }
    }
  }

  private getVisibleRegionRange(camera: Camera): { minRX: number; minRY: number; maxRX: number; maxRY: number } {
    const halfW = window.innerWidth / 2 / camera.zoom;
    const halfH = window.innerHeight / 2 / camera.zoom;
    const centerX = camera.x + window.innerWidth / 2;
    const centerY = camera.y + window.innerHeight / 2;

    return {
      minRX: Math.max(0, Math.floor((centerX - halfW) / (REGION_SIZE * TILE_SIZE))),
      minRY: Math.max(0, Math.floor((centerY - halfH) / (REGION_SIZE * TILE_SIZE))),
      maxRX: Math.floor((centerX + halfW) / (REGION_SIZE * TILE_SIZE)),
      maxRY: Math.floor((centerY + halfH) / (REGION_SIZE * TILE_SIZE)),
    };
  }

  isWall(x: number, y: number): boolean {
    return this.wallTiles.has(`${x},${y}`);
  }

  poiAt(x: number, y: number): POI | undefined {
    const rx = Math.floor(x / REGION_SIZE);
    const ry = Math.floor(y / REGION_SIZE);

    // Check this region and neighbors (POIs can span boundaries)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = `${rx + dx},${ry + dy}`;
        const pois = this.regionPOIs.get(key);
        if (pois) {
          const found = pois.find((p) => p.containsTile(x, y));
          if (found) return found;
        }
      }
    }
    return undefined;
  }

  /** Find nearest POI with loot within search radius */
  findNearestWithLoot(fromX: number, fromY: number, radius: number): POI | null {
    const minRX = Math.max(0, Math.floor((fromX - radius) / REGION_SIZE));
    const maxRX = Math.floor((fromX + radius) / REGION_SIZE);
    const minRY = Math.max(0, Math.floor((fromY - radius) / REGION_SIZE));
    const maxRY = Math.floor((fromY + radius) / REGION_SIZE);

    let best: POI | null = null;
    let bestDist = radius * radius;

    for (let ry = minRY; ry <= maxRY; ry++) {
      for (let rx = minRX; rx <= maxRX; rx++) {
        const pois = this.regionPOIs.get(`${rx},${ry}`);
        if (!pois) continue;
        for (const p of pois) {
          if (p.scavengedFully) continue;
          const dx = p.doorX - fromX;
          const dy = p.doorY - fromY;
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

  /** Ensure POIs around a tile coord are generated (for AI lookups) */
  ensureAround(x: number, y: number, radius: number): void {
    const minRX = Math.max(0, Math.floor((x - radius) / REGION_SIZE));
    const maxRX = Math.floor((x + radius) / REGION_SIZE);
    const minRY = Math.max(0, Math.floor((y - radius) / REGION_SIZE));
    const maxRY = Math.floor((y + radius) / REGION_SIZE);

    for (let ry = minRY; ry <= maxRY; ry++) {
      for (let rx = minRX; rx <= maxRX; rx++) {
        this.ensureRegion(rx, ry);
      }
    }
  }
}

export { REGION_SIZE };
