import { describe, expect, it } from "vitest";
import type { EnemyDef, GameConfig } from "../types";
import {
  coinsFromPoints,
  enemyWeight,
  killPoints,
  pickWeighted,
  pointsFromDistance,
  slashRecharge,
  applyOneShot,
  GAMEOVER_HOLD_SEC,
  GAMEOVER_LINE,
  JUMP_ASCENT_MUL,
  jumpHoldGravity,
  jumpTakeoffSpeed,
  ownerHasLiveShot,
  projectileAdvance,
  spawnCap,
  speedLevelFor,
  struggleAfterTap,
  DEFAULT_SPAWN_RULES,
  distanceWeightMul,
  packSize,
  simulateWindowSpawns,
  windowSpawnCap,
  bowRecharge,
  kunaiCapacity,
  nextTierCost,
  techniqueRechargeMul,
} from "./rules";

const cfg = {
  speedLevels: [
    { level: 1, distance: 0, speedMul: 1 },
    { level: 2, distance: 200, speedMul: 1.02 },
    { level: 6, distance: 1000, speedMul: 1.1 },
  ],
  spawn: { minStaggerMeters: 24, windowMeters: 300, maxZombiesPerWindow: [0, 10, 13, 15, 18, 20, 23] },
  slash: { baseRecharge: 1.5, upgradeStep: 0.2, maxUpgrades: 5, upgradeCosts: [100, 200, 400, 800, 1600], hayateMultiplier: 0.5 },
  economy: { metersPerPoint: 6, pointsPerCoin: 6, roofKillMultiplier: 2, reviveCost: 300, starterCoins: 150 },
} as GameConfig;

describe("speed and economy", () => {
  it("unlocks speed levels by distance", () => {
    expect(speedLevelFor(0, cfg).level).toBe(1);
    expect(speedLevelFor(199, cfg).level).toBe(1);
    expect(speedLevelFor(200, cfg).speedMul).toBe(1.02);
    expect(speedLevelFor(1000, cfg).level).toBe(6);
  });

  it("converts run meters to points and coins", () => {
    expect(pointsFromDistance(36, 6)).toBe(6);
    expect(coinsFromPoints(6, 6)).toBe(1);
    expect(killPoints(6, true, 2)).toBe(12);
  });
});

describe("slash recharge", () => {
  it("drops 0.2s per upgrade and halves with Hayate", () => {
    expect(slashRecharge(cfg, 0, false)).toBeCloseTo(1.5);
    expect(slashRecharge(cfg, 5, false)).toBeCloseTo(0.5);
    expect(slashRecharge(cfg, 5, true)).toBeCloseTo(0.25);
  });
});

describe("spawn rules", () => {
  it("caps zombies per 300m window by level", () => {
    expect(spawnCap(cfg, 1)).toBe(10);
    expect(spawnCap(cfg, 6)).toBe(23);
  });

  it("adds 1% more zombies per 300m at each level and packs 1–5", () => {
    expect(windowSpawnCap(DEFAULT_SPAWN_RULES, 1)).toBe(30);
    expect(windowSpawnCap(DEFAULT_SPAWN_RULES, 2)).toBe(Math.floor(39 * 1.01));
    expect(windowSpawnCap(DEFAULT_SPAWN_RULES, 3)).toBe(Math.floor(45 * 1.02));
    expect(packSize(1, 5, () => 0)).toBe(1);
    expect(packSize(1, 5, () => 0.5)).toBe(1);
    expect(packSize(1, 5, () => 0.7)).toBe(2);
    expect(packSize(1, 5, () => 0.99)).toBe(5);
  });

  it("keeps a 300m window readable instead of filling the 30-zombie cap", () => {
    let i = 0;
    const rng = () => {
      i += 1;
      return (i * 0.37) % 1;
    };
    const n = simulateWindowSpawns(48, 24, 300, 30, rng);
    expect(n).toBeGreaterThanOrEqual(10);
    expect(n).toBeLessThanOrEqual(22);
    expect(n).toBeLessThan(30);
  });

  it("ramps non-drone weights 1.2% every 150m", () => {
    expect(distanceWeightMul(DEFAULT_SPAWN_RULES, 149, "viner")).toBeCloseTo(1);
    expect(distanceWeightMul(DEFAULT_SPAWN_RULES, 150, "viner")).toBeCloseTo(1.012);
    expect(distanceWeightMul(DEFAULT_SPAWN_RULES, 300, "archer")).toBeCloseTo(1.012 ** 2);
    expect(distanceWeightMul(DEFAULT_SPAWN_RULES, 900, "drone")).toBe(1);
  });

  it("weights enemies inside their level band", () => {
    const drone = { levels: [1, 6], weight: [10, 25] } as EnemyDef;
    expect(enemyWeight(drone, 1)).toBe(10);
    expect(enemyWeight(drone, 6)).toBe(25);
    const late = { levels: [5, 6], weight: [0, 3] } as EnemyDef;
    expect(enemyWeight(late, 4)).toBe(0);
    expect(enemyWeight(late, 5)).toBe(0.8);
  });

  it("picks from positive weights", () => {
    const id = pickWeighted(
      [
        { id: "a", weight: 0 },
        { id: "b", weight: 1 },
      ],
      () => 0.1,
    );
    expect(id).toBe("b");
  });
});

describe("struggle mash", () => {
  it("adds +6 toward 100", () => {
    expect(struggleAfterTap(0, 6, 100)).toBe(6);
    expect(struggleAfterTap(96, 6, 100)).toBe(100);
  });
});

describe("projectiles", () => {
  it("allows only one live shot per shooter", () => {
    const actors = [{ kind: "projectile", ownerId: "e1" }];
    expect(ownerHasLiveShot(actors, "e1")).toBe(true);
    expect(ownerHasLiveShot(actors, "e2")).toBe(false);
    expect(ownerHasLiveShot([], "e1")).toBe(false);
  });

  it("moves projectiles twice as fast as the original 0.35 flight rate", () => {
    expect(projectileAdvance(100, 1)).toBeCloseTo(70);
  });
});

describe("technique upgrades", () => {
  it("adds kunai capacity and shortens bow / art recharge", () => {
    expect(kunaiCapacity(3, 2)).toBe(5);
    expect(bowRecharge(2.5, 5, 0.25)).toBeCloseTo(1.25);
    expect(techniqueRechargeMul(0)).toBe(1);
    expect(techniqueRechargeMul(1)).toBeCloseTo(0.9);
    expect(techniqueRechargeMul(3)).toBeCloseTo(0.729);
    expect(nextTierCost([300, 600, 1200], 2)).toBe(1200);
    expect(nextTierCost([300, 600, 1200], 3)).toBeNull();
  });
});

describe("one-shot slash", () => {
  it("kills any live actor in one hit", () => {
    expect(applyOneShot(18)).toBe(0);
    expect(applyOneShot(1)).toBe(0);
  });
});

describe("jump ascent", () => {
  it("raises takeoff speed 5% and keeps the same apex", () => {
    expect(JUMP_ASCENT_MUL).toBeCloseTo(1.05);
    const H = 100;
    const T = 2;
    const v = jumpTakeoffSpeed(H, T);
    const g = jumpHoldGravity(H, T);
    expect(v).toBeCloseTo(((4 * H) / T) * 1.05);
    const apex = v * (v / g) - 0.5 * g * (v / g) ** 2;
    expect(apex).toBeCloseTo(H);
  });
});

describe("game over card", () => {
  it("holds the cinematic then returns home", () => {
    expect(GAMEOVER_LINE).toBe("you were tickled to death");
    expect(GAMEOVER_HOLD_SEC).toBe(5);
  });
});
