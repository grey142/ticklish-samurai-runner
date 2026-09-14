import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileShop, hasSlashHaste, perkIdFromRaw, type CanonicalShop } from "./shop";

const shopRaw = JSON.parse(readFileSync("public/data/shop-canonical.json", "utf8")) as CanonicalShop;

describe("canonical shop", () => {
  const shop = compileShop(shopRaw);

  it("lists the seven user katanas in order and drops placeholders", () => {
    expect(shop.katanas.map((k) => k.id)).toEqual([
      "ikielas-katana",
      "kurogane",
      "mikazuki",
      "hayate",
      "kagekiri",
      "raikiri",
      "shin-en",
    ]);
    expect(shop.katanas.some((k) => k.id === "night-needle" || k.id === "whisper-blade")).toBe(false);
    expect(shop.katanas[0].range).toBe(1.5);
    expect(shop.katanas[0].cost).toBe(0);
    expect(shop.katanas[3].perk).toBe("hayate");
    expect(shop.katanas[4].perk).toBe("shadow-strike");
    expect(shop.katanas[6].range).toBe(3.5);
    expect(shop.katanas[6].cost).toBe(2500);
  });

  it("builds armor HP from base 100 plus the bonus", () => {
    expect(shop.armors.map((a) => a.id)).toEqual([
      "ikielas-robes",
      "hayate-gusoku",
      "mamushi-wrap",
      "gale-dancers-kusazuri",
      "storm-petal-cuirass",
      "kitsunes-mirage",
      "shadow-tread-o-yoroi",
    ]);
    expect(shop.armors.some((a) => a.id === "traveler-wraps" || a.id === "city-guard")).toBe(false);
    expect(shop.armors[0].hp).toBe(102);
    expect(shop.armors[3].perk).toBe("gale-dancer");
    expect(shop.armors[4].hp).toBe(165);
    expect(shop.armors[6].hp).toBe(225);
    expect(shop.armors[6].perk).toBe("shadow-tread");
  });

  it("maps perk ids onto the live VFX buttons", () => {
    expect(perkIdFromRaw({ id: "call_lightning" })).toBe("call-lightning");
    expect(hasSlashHaste("hayate", null)).toBe(true);
    expect(hasSlashHaste(null, "shadow-tread")).toBe(true);
    expect(hasSlashHaste(null, "storm-petal")).toBe(false);
    expect(shop.perks.filter((p) => p.manual).map((p) => p.id)).toEqual([
      "shadow-strike",
      "call-lightning",
      "blade-of-souls",
      "kitsune-shade",
    ]);
    expect(shop.perks.find((p) => p.id === "shadow-strike")?.cooldown).toBe(15);
    expect(shop.perks.find((p) => p.id === "call-lightning")?.cooldown).toBe(25);
    expect(shop.perks.find((p) => p.id === "blade-of-souls")?.cooldown).toBe(45);
  });

  it("lists five shop techniques and the new upgrade tracks", () => {
    expect(shop.techniques.map((t) => t.id)).toEqual([
      "flying-boost",
      "ethereal",
      "shadow-strike",
      "kunai",
      "bow",
    ]);
    expect(shop.techniques[0].cost).toBe(500);
    expect(shop.techniques[3].baseCapacity).toBe(3);
    expect(shop.techniques[4].recharge).toBe(180);
    expect(shop.upgrades.map((u) => u.id)).toEqual([
      "slash-speed",
      "flying-boost-range",
      "ethereal-range",
      "shadow-strike-range",
      "kunai-capacity",
      "bow-recharge",
    ]);
    expect(shop.upgrades.find((u) => u.id === "kunai-capacity")?.requires).toBe("kunai");
    expect(shop.upgrades.find((u) => u.id === "bow-recharge")?.costs).toEqual([150, 300, 600, 1200]);
    expect(shop.upgrades.find((u) => u.id === "bow-recharge")?.maxLevel).toBe(4);
    expect(shop.upgrades.find((u) => u.id === "flying-boost-range")?.maxLevel).toBe(5);
  });
});
