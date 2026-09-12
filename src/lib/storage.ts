import type { SaveData } from "../types";
import { emptySave, SAVE_KEY } from "./rules";

export function loadSave(starterCoins: number): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return emptySave(starterCoins);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = emptySave(starterCoins);
    return {
      ...base,
      ...parsed,
      unlockedKatanas: unique(["ikielas-katana", ...(parsed.unlockedKatanas ?? [])]),
      unlockedArmors: unique(["ikielas-robes", ...(parsed.unlockedArmors ?? [])]),
    };
  } catch {
    return emptySave(starterCoins);
  }
}

export function writeSave(save: SaveData): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}
