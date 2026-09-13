import type { ArmorDef, KatanaDef, PerkDef, ShopCatalog } from "../types";

const PERK_ALIAS: Record<string, string> = {
  slash_recharge_half: "hayate",
  shadow_strike: "shadow-strike",
  call_lightning: "call-lightning",
  blade_of_souls: "blade-of-souls",
  wind_blade: "gale-dancer",
  storm_petal_electrocute: "storm-petal",
  kitsune_shade: "kitsune-shade",
  shadow_tread: "shadow-tread",
};

export function normalizePerkId(id: string | null | undefined): string | null {
  if (!id) return null;
  return PERK_ALIAS[id] ?? id.replace(/_/g, "-");
}

export function perkIdFromRaw(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return normalizePerkId(raw);
  if (typeof raw === "object" && raw && "id" in raw) {
    return normalizePerkId(String((raw as { id: string }).id));
  }
  return null;
}

export interface CanonicalKatana {
  id: string;
  name: string;
  order?: number;
  cost: number;
  range: number;
  perk: unknown;
  flavor?: string;
  blurb?: string;
}

export interface CanonicalArmor {
  id: string;
  name: string;
  order?: number;
  cost: number;
  healthBonus?: number;
  health?: number;
  perk: unknown;
  flavor?: string;
  blurb?: string;
}

export interface CanonicalShop {
  baseHealth?: number;
  katanas: CanonicalKatana[];
  armors: CanonicalArmor[];
}

export const SHOP_PERKS: PerkDef[] = [
  { id: "shadow-strike", name: "Shadow Strike", manual: true, cooldown: 15, blurb: "Dash-cut the foe in front." },
  { id: "call-lightning", name: "Call Lightning", manual: true, cooldown: 25, blurb: "Sky-fire every foe on screen." },
  { id: "blade-of-souls", name: "Blade of Souls", manual: true, cooldown: 45, blurb: "Kill within 10 m. +15 HP per kill." },
  { id: "kitsune-shade", name: "Kitsune's Mirage", manual: true, cooldown: 20, blurb: "Purple shade 30 m. Unhittable." },
  { id: "hayate", name: "Hayate Flow", manual: false, cooldown: 0, blurb: "Slash recharge ×0.5." },
  { id: "gale-dancer", name: "Wind Blade", manual: false, cooldown: 0, blurb: "Slash recharge ×0.5." },
  { id: "storm-petal", name: "Storm Petal", manual: false, cooldown: 0, blurb: "Jump-over electrocute + double points." },
  { id: "shadow-tread", name: "Shadow-Tread", manual: false, cooldown: 0, blurb: "+5 HP/kill, tickle ×0.75, slash ×0.5." },
];

export function compileShop(raw: CanonicalShop): ShopCatalog {
  const base = raw.baseHealth ?? 100;
  const katanas: KatanaDef[] = [...raw.katanas]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((k) => ({
      id: k.id,
      name: k.name,
      cost: k.cost,
      range: k.range,
      perk: perkIdFromRaw(k.perk),
      blurb: k.blurb ?? k.flavor ?? "",
    }));
  const armors: ArmorDef[] = [...raw.armors]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((a) => ({
      id: a.id,
      name: a.name,
      cost: a.cost,
      hp: base + (a.healthBonus ?? a.health ?? 0),
      perk: perkIdFromRaw(a.perk),
      blurb: a.blurb ?? a.flavor ?? "",
    }));
  return { katanas, armors, perks: SHOP_PERKS };
}

export const HASTE_PERKS = new Set(["hayate", "gale-dancer", "shadow-tread"]);

export function hasSlashHaste(katanaPerk: string | null | undefined, armorPerk: string | null | undefined): boolean {
  return HASTE_PERKS.has(katanaPerk ?? "") || HASTE_PERKS.has(armorPerk ?? "");
}
