import { Container, Graphics, RenderTexture, Sprite, Application } from 'pixi.js';
import { TILE_SIZE, CHUNK_SIZE, CHUNK_BUFFER, MAP_WIDTH, MAP_HEIGHT, TERRAIN_COLORS } from './constants';
import { terrainAt, TerrainType } from './terrain';
import { Camera } from './camera';

export interface ChunkData {
  cx: number;
  cy: number;
  terrain: TerrainType[][];
  sprite: Sprite | null;
  container: Container;
}

function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export class ChunkManager {
  private chunks = new Map<string, ChunkData>();
  private worldContainer: Container;
  private app: Application;

  // Track which chunks are currently loaded for efficient iteration
  private loadedKeys = new Set<string>();

  constructor(worldContainer: Container, app: Application) {
    this.worldContainer = worldContainer;
    this.app = app;
  }

  /** Call each frame to load/unload chunks based on camera position */
  update(camera: Camera): void {
    const { minCX, minCY, maxCX, maxCY } = this.getVisibleChunkRange(camera);

    // Load visible + buffer chunks
    const bufMinCX = Math.max(0, minCX - CHUNK_BUFFER);
    const bufMinCY = Math.max(0, minCY - CHUNK_BUFFER);
    const bufMaxCX = Math.min(this.maxChunkX, maxCX + CHUNK_BUFFER);
    const bufMaxCY = Math.min(this.maxChunkY, maxCY + CHUNK_BUFFER);

    const needed = new Set<string>();

    for (let cy = bufMinCY; cy <= bufMaxCY; cy++) {
      for (let cx = bufMinCX; cx <= bufMaxCX; cx++) {
        const key = chunkKey(cx, cy);
        needed.add(key);
        if (!this.chunks.has(key)) {
          this.loadChunk(cx, cy);
        }
      }
    }

    // Unload chunks that are too far
    for (const key of this.loadedKeys) {
      if (!needed.has(key)) {
        this.unloadChunk(key);
      }
    }
  }

  private get maxChunkX(): number {
    return Math.floor((MAP_WIDTH - 1) / CHUNK_SIZE);
  }

  private get maxChunkY(): number {
    return Math.floor((MAP_HEIGHT - 1) / CHUNK_SIZE);
  }

  private getVisibleChunkRange(camera: Camera): { minCX: number; minCY: number; maxCX: number; maxCY: number } {
    // Get world-space bounds of the viewport
    const halfW = window.innerWidth / 2 / camera.zoom;
    const halfH = window.innerHeight / 2 / camera.zoom;
    const centerX = camera.x + window.innerWidth / 2;
    const centerY = camera.y + window.innerHeight / 2;

    const worldLeft = centerX - halfW;
    const worldRight = centerX + halfW;
    const worldTop = centerY - halfH;
    const worldBottom = centerY + halfH;

    return {
      minCX: Math.max(0, Math.floor(worldLeft / (CHUNK_SIZE * TILE_SIZE))),
      minCY: Math.max(0, Math.floor(worldTop / (CHUNK_SIZE * TILE_SIZE))),
      maxCX: Math.min(this.maxChunkX, Math.floor(worldRight / (CHUNK_SIZE * TILE_SIZE))),
      maxCY: Math.min(this.maxChunkY, Math.floor(worldBottom / (CHUNK_SIZE * TILE_SIZE))),
    };
  }

  private loadChunk(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    const container = new Container();
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;

    // Generate terrain
    const terrain: TerrainType[][] = [];
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const row: TerrainType[] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        row.push(terrainAt(startX + lx, startY + ly));
      }
      terrain.push(row);
    }

    // Render terrain to a texture for performance
    const gfx = new Graphics();
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const t = terrain[ly]![lx]!;
        const color = TERRAIN_COLORS[t]!;
        gfx.rect(lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill(color);
        gfx.rect(lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          .stroke({ color: 0x000000, alpha: 0.1, width: 1 });
      }
    }

    // Bake to texture
    const texture = RenderTexture.create({
      width: CHUNK_SIZE * TILE_SIZE,
      height: CHUNK_SIZE * TILE_SIZE,
    });
    this.app.renderer.render({ container: gfx, target: texture });
    gfx.destroy();

    const sprite = new Sprite(texture);
    sprite.x = startX * TILE_SIZE;
    sprite.y = startY * TILE_SIZE;
    container.addChild(sprite);

    container.x = 0;
    container.y = 0;

    const chunk: ChunkData = { cx, cy, terrain, sprite, container };
    this.chunks.set(key, chunk);
    this.loadedKeys.add(key);
    this.worldContainer.addChildAt(container, 0); // terrain at bottom
  }

  private unloadChunk(key: string): void {
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    this.worldContainer.removeChild(chunk.container);
    if (chunk.sprite?.texture) {
      chunk.sprite.texture.destroy(true);
    }
    chunk.container.destroy({ children: true });

    this.chunks.delete(key);
    this.loadedKeys.delete(key);
  }

  /** Get terrain at world tile coords (generates if needed) */
  getTerrainAt(x: number, y: number): TerrainType {
    return terrainAt(x, y);
  }

  /** Get loaded chunk keys for iteration */
  getLoadedChunkKeys(): IterableIterator<string> {
    return this.loadedKeys.values();
  }

  isChunkLoaded(cx: number, cy: number): boolean {
    return this.chunks.has(chunkKey(cx, cy));
  }
}
