export const CHEATS_KEY = "tsr-cheats-v1";

export const CHEAT_IDS = [
  "infinite_health",
  "instant_struggle_fill",
  "double_health",
  "half_max_hold_timer",
  "all_shop_free",
  "double_struggle_fill_rate",
  "half_struggle_fill_rate",
  "double_tickle_damage",
  "double_projectile_damage",
  "double_zombie_struggle_damage",
] as const;

export type CheatId = (typeof CHEAT_IDS)[number];

export interface CheatItem {
  id: CheatId | string;
  name: string;
  effect: string;
}

export interface CheatBook {
  id?: string;
  entryMethod?: string;
  cheats: CheatItem[];
}

export type CheatToggles = Record<string, boolean>;

export function parseCheatBook(raw: unknown): CheatBook {
  const o = (raw ?? {}) as {
    id?: string;
    entryMethod?: string;
    cheats?: Array<{ id?: string; name?: string; label?: string; effect?: unknown }>;
    items?: Array<{ id?: string; name?: string; label?: string; effect?: unknown }>;
  };
  const rows = Array.isArray(o.cheats) ? o.cheats : Array.isArray(o.items) ? o.items : [];
  const cheats: CheatItem[] = rows
    .filter((row) => typeof row?.id === "string" && row.id.length > 0)
    .map((row) => ({
      id: row.id as string,
      name: String(row.name ?? row.label ?? row.id),
      effect: typeof row.effect === "string" ? row.effect : "",
    }));
  return { id: o.id, entryMethod: o.entryMethod, cheats };
}

export function emptyToggles(): CheatToggles {
  const out: CheatToggles = {};
  for (const id of CHEAT_IDS) out[id] = false;
  return out;
}

export function readToggles(): CheatToggles {
  const base = emptyToggles();
  try {
    const raw = localStorage.getItem(CHEATS_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as CheatToggles;
    for (const id of CHEAT_IDS) {
      if (typeof parsed[id] === "boolean") base[id] = parsed[id];
    }
  } catch {
    /* ignore broken storage */
  }
  return base;
}

export function writeToggles(toggles: CheatToggles): void {
  try {
    localStorage.setItem(CHEATS_KEY, JSON.stringify(toggles));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isOn(toggles: CheatToggles, id: string): boolean {
  return !!toggles[id];
}

export function struggleTapMul(toggles: CheatToggles): number {
  let mul = 1;
  if (isOn(toggles, "double_struggle_fill_rate")) mul *= 2;
  if (isOn(toggles, "half_struggle_fill_rate")) mul *= 0.5;
  return mul;
}

export function maxHoldMul(toggles: CheatToggles): number {
  return isOn(toggles, "half_max_hold_timer") ? 0.5 : 1;
}

/** Armor HP is 100 + bonus. Double health is 200 before that bonus. */
export function maxHpForArmor(armorHp: number, toggles: CheatToggles): number {
  const bonus = Math.max(0, armorHp - 100);
  return isOn(toggles, "double_health") ? 200 + bonus : armorHp;
}

export function shopCost(base: number, toggles: CheatToggles): number {
  return isOn(toggles, "all_shop_free") ? 0 : base;
}

export function tickleScale(kind: "enemy" | "projectile", toggles: CheatToggles): number {
  let mul = 1;
  if (isOn(toggles, "double_tickle_damage")) mul *= 2;
  if (kind === "projectile" && isOn(toggles, "double_projectile_damage")) mul *= 2;
  if (kind === "enemy" && isOn(toggles, "double_zombie_struggle_damage")) mul *= 2;
  return mul;
}

export class CheatState {
  book: CheatBook = { cheats: [] };
  on: CheatToggles = emptyToggles();

  load(raw: unknown): void {
    this.book = parseCheatBook(raw);
    this.on = readToggles();
  }

  active(id: string): boolean {
    return isOn(this.on, id);
  }

  toggle(id: string): boolean {
    this.on[id] = !this.on[id];
    writeToggles(this.on);
    return this.on[id];
  }
}
