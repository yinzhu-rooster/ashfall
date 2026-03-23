import { GameState } from './gamestate';
import { Survivor } from './survivor';
import { Stockpile } from './stockpile';

const SAVE_KEY = 'ashfall_save';

export interface SaveData {
  gameState: Record<string, number>;
  survivors: Record<string, unknown>[];
  stockpile?: { tiles: { x: number; y: number }[]; items: object[] };
}

export function saveGame(
  gameState: GameState,
  survivors: Survivor[],
  stockpile: Stockpile,
): void {
  const data: SaveData = {
    gameState: gameState.toJSON() as Record<string, number>,
    survivors: survivors.map((s) => s.toJSON() as Record<string, unknown>),
    stockpile: stockpile.toJSON() as SaveData['stockpile'],
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SaveData;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
