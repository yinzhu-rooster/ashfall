import { MAP_WIDTH, MAP_HEIGHT, WORLD_SEED } from './constants';

export type TerrainType = 'grass' | 'dirt' | 'rubble' | 'asphalt';

/** Deterministic terrain for any tile coordinate. Pure function — no state. */
export function terrainAt(x: number, y: number): TerrainType {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return 'grass';

  // Roads: grid every 64 tiles, with some variation
  const roadSpacing = 64;
  const roadRow = y % roadSpacing;
  const roadCol = x % roadSpacing;
  if (roadRow === 20 || roadRow === 21) return 'asphalt';
  if (roadCol === 20 || roadCol === 21) return 'asphalt';

  const h = tileHash(x, y);
  if (h < 0.06) return 'rubble';
  if (h < 0.18) return 'dirt';
  return 'grass';
}

export function isWalkable(x: number, y: number): boolean {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
}

/** Deterministic hash for a tile coordinate, mixed with world seed. Returns 0-1. */
export function tileHash(x: number, y: number): number {
  let h = (x * 374761 + y * 668265 + WORLD_SEED * 982451) & 0xffffff;
  h = ((h >> 8) ^ h) * 0x5bd1e995;
  h = ((h >> 15) ^ h);
  return (h & 0xffff) / 0xffff;
}

/** Seeded PRNG (mulberry32). Call the returned function repeatedly for a sequence. */
export function seededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Check if a tile is on a road */
export function isRoad(x: number, y: number): boolean {
  const t = terrainAt(x, y);
  return t === 'asphalt';
}
