import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CHEATS_KEY,
  maxHpForArmor,
  maxHoldMul,
  parseCheatBook,
  readToggles,
  shopCost,
  struggleTapMul,
  tickleScale,
  writeToggles,
} from "./cheats";

const book = parseCheatBook(JSON.parse(readFileSync("public/data/cheats.json", "utf8")));

describe("cheat book", () => {
  it("lists the ten stacked cheats from assets-v1", () => {
    expect(book.cheats.map((c) => c.id)).toEqual([
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
    ]);
  });

  it("stacks fill-rate, tickle, and shop effects", () => {
    expect(struggleTapMul({ double_struggle_fill_rate: true })).toBe(2);
    expect(struggleTapMul({ half_struggle_fill_rate: true })).toBe(0.5);
    expect(struggleTapMul({ double_struggle_fill_rate: true, half_struggle_fill_rate: true })).toBe(1);
    expect(maxHoldMul({ half_max_hold_timer: true })).toBe(0.5);
    expect(maxHpForArmor(125, { double_health: true })).toBe(225);
    expect(maxHpForArmor(125, {})).toBe(125);
    expect(shopCost(850, { all_shop_free: true })).toBe(0);
    expect(tickleScale("enemy", { double_tickle_damage: true, double_zombie_struggle_damage: true })).toBe(4);
    expect(tickleScale("projectile", { double_tickle_damage: true, double_projectile_damage: true })).toBe(4);
    expect(tickleScale("projectile", { double_zombie_struggle_damage: true })).toBe(1);
  });
});

describe("cheat persistence", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(mem)) delete mem[k];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => mem[k] ?? null,
        setItem: (k: string, v: string) => {
          mem[k] = v;
        },
        removeItem: (k: string) => {
          delete mem[k];
        },
      },
    });
  });

  afterEach(() => {
    localStorage.removeItem(CHEATS_KEY);
  });

  it("round-trips toggles through localStorage", () => {
    writeToggles({ infinite_health: true, all_shop_free: true });
    const got = readToggles();
    expect(got.infinite_health).toBe(true);
    expect(got.all_shop_free).toBe(true);
    expect(got.double_health).toBe(false);
  });
});
