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
      unlockedTechniques: unique(parsed.unlockedTechniques ?? []),
      kunaiUpgrades: Math.max(0, parsed.kunaiUpgrades ?? 0),
      bowUpgrades: Math.max(0, parsed.bowUpgrades ?? 0),
      flyingBoostUpgrades: Math.max(0, parsed.flyingBoostUpgrades ?? 0),
      etherealUpgrades: Math.max(0, parsed.etherealUpgrades ?? 0),
      shadowStrikeUpgrades: Math.max(0, parsed.shadowStrikeUpgrades ?? 0),
      techniquePower: Math.max(0, parsed.techniquePower ?? 0),
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
