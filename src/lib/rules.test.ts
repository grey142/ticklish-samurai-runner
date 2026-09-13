import { describe, expect, it } from "vitest";
import type { EnemyDef, GameConfig } from "../types";
import {
  coinsFromPoints,
  enemyWeight,
  killPoints,
  pickWeighted,
  pointsFromDistance,
  slashRecharge,
  spawnCap,
  speedLevelFor,
  struggleAfterTap,
} from "./rules";

const cfg = {
  speedLevels: [
    { level: 1, distance: 0, speedMul: 1 },
    { level: 2, distance: 200, speedMul: 1.02 },
    { level: 6, distance: 1000, speedMul: 1.1 },
  ],
  spawn: { minStaggerMeters: 6, windowMeters: 300, maxZombiesPerWindow: [0, 10, 13, 15, 18, 20, 23] },
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
