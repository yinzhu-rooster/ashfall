export const TILE_SIZE = 32;
export const MAP_WIDTH = 4096;
export const MAP_HEIGHT = 4096;

export const CHUNK_SIZE = 32; // tiles per chunk side
export const CHUNK_BUFFER = 2; // extra chunks beyond viewport to keep loaded
export const WORLD_SEED = 42;

export const GAME_SPEEDS = [0, 1, 3] as const;

export const HOURS_PER_DAY = 24;
export const MINUTES_PER_TICK = 10;
export const TICKS_PER_SECOND_BASE = 4;

export const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x4a6741,
  dirt: 0x7a6b52,
  rubble: 0x6b6560,
  asphalt: 0x484848,
};

// Survivor AI search radius (tiles) — don't search the whole map
export const SEARCH_RADIUS = 64;
