import type { EnemyDef, GameConfig, SaveData } from "../types";

export const SAVE_KEY = "tsr-save-v1";

export function emptySave(starterCoins: number): SaveData {
  return {
    coins: starterCoins,
    unlockedKatanas: ["ikielas-katana"],
    unlockedArmors: ["ikielas-robes"],
    equippedKatana: "ikielas-katana",
    equippedArmor: "ikielas-robes",
    slashUpgrades: 0,
    bestDistance: 0,
  };
}

export function speedLevelFor(distance: number, cfg: GameConfig): { level: number; speedMul: number } {
  let current = cfg.speedLevels[0];
  for (const row of cfg.speedLevels) {
    if (distance >= row.distance) current = row;
  }
  return { level: current.level, speedMul: current.speedMul };
}

export function slashRecharge(cfg: GameConfig, upgrades: number, hayate: boolean): number {
  const stepped = Math.max(
    0.1,
    cfg.slash.baseRecharge - Math.min(cfg.slash.maxUpgrades, upgrades) * cfg.slash.upgradeStep,
  );
  return hayate ? stepped * cfg.slash.hayateMultiplier : stepped;
}

export function pointsFromDistance(meters: number, metersPerPoint: number): number {
  return Math.floor(Math.max(0, meters) / metersPerPoint);
}

export function coinsFromPoints(points: number, pointsPerCoin: number): number {
  return Math.floor(Math.max(0, points) / pointsPerCoin);
}

export function killPoints(bonus: number, roofKill: boolean, mul: number): number {
  return Math.round(bonus * (roofKill ? mul : 1));
}

export function enemyWeight(def: EnemyDef, level: number): number {
  const [lo, hi] = def.levels;
  if (level < lo || level > hi) return 0;
  const [w0, w1] = def.weight;
  if (lo === hi) return Math.max(w1, 0.8);
  const t = (level - lo) / (hi - lo);
  return Math.max(0.8, w0 + (w1 - w0) * t);
}

export function spawnCap(cfg: GameConfig, level: number): number {
  return cfg.spawn.maxZombiesPerWindow[level] ?? cfg.spawn.maxZombiesPerWindow.at(-1) ?? 10;
}

export interface SpawnRules {
  windowMeters: number;
  stagger: { baseSlotMeters: number; packSizeMin: number; packSizeMax: number };
  maxZombiesPer300MetersByLevel: Record<string, number>;
  levelRamp: { extraPercentPerLevelPer300m: number };
  distanceRamp: { everyMeters: number; multiplierPerStepNonDrone: number; excludeEnemyIds: string[] };
}

export const DEFAULT_SPAWN_RULES: SpawnRules = {
  windowMeters: 300,
  stagger: { baseSlotMeters: 6, packSizeMin: 1, packSizeMax: 5 },
  maxZombiesPer300MetersByLevel: { "1": 30, "2": 39, "3": 45, "4": 54, "5": 60, "6": 69 },
  levelRamp: { extraPercentPerLevelPer300m: 1.0 },
  distanceRamp: { everyMeters: 150, multiplierPerStepNonDrone: 1.012, excludeEnemyIds: ["drone"] },
};

export function windowSpawnCap(rules: SpawnRules, level: number): number {
  const base = rules.maxZombiesPer300MetersByLevel[String(level)] ?? 30;
  const extra = (rules.levelRamp.extraPercentPerLevelPer300m / 100) * Math.max(0, level - 1);
  return Math.max(1, Math.floor(base * (1 + extra)));
}

export function distanceWeightMul(rules: SpawnRules, distance: number, enemyId: string): number {
  if (rules.distanceRamp.excludeEnemyIds.includes(enemyId)) return 1;
  const steps = Math.floor(Math.max(0, distance) / rules.distanceRamp.everyMeters);
  return rules.distanceRamp.multiplierPerStepNonDrone ** steps;
}

export function packSize(min: number, max: number, rng: () => number): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pickWeighted(entries: { id: string; weight: number }[], rng: () => number): string | null {
  const live = entries.filter((e) => e.weight > 0);
  const sum = live.reduce((a, e) => a + e.weight, 0);
  if (sum <= 0) return null;
  let roll = rng() * sum;
  for (const e of live) {
    roll -= e.weight;
    if (roll <= 0) return e.id;
  }
  return live.at(-1)?.id ?? null;
}

export function struggleAfterTap(meter: number, gain: number, escapeAt: number): number {
  return Math.min(escapeAt, meter + gain);
}

export function nextSlashUpgradeCost(cfg: GameConfig, upgrades: number): number | null {
  if (upgrades >= cfg.slash.maxUpgrades) return null;
  return cfg.slash.upgradeCosts[upgrades] ?? null;
}

export function ownerHasLiveShot(actors: { kind: string; ownerId?: string }[], ownerId: string): boolean {
  return actors.some((a) => a.kind === "projectile" && a.ownerId === ownerId);
}

/** Playtest: every successful hit removes the actor (zombie or projectile). */
export function applyOneShot(hp: number): number {
  return hp > 0 ? 0 : hp;
}

export const GAMEOVER_HOLD_SEC = 5;
export const GAMEOVER_LINE = "you were tickled to death";

/** Faster rise, same apex: takeoff ×1.05 and hold-gravity ×1.05². */
export const JUMP_ASCENT_MUL = 1.05;

export function jumpTakeoffSpeed(maxHeight: number, airSeconds: number): number {
  return ((4 * maxHeight) / airSeconds) * JUMP_ASCENT_MUL;
}

export function jumpHoldGravity(maxHeight: number, airSeconds: number): number {
  return ((8 * maxHeight) / (airSeconds * airSeconds)) * JUMP_ASCENT_MUL * JUMP_ASCENT_MUL;
}

/** Was 0.35; playtest is 2× that flight rate. */
export const PROJECTILE_FLIGHT_MUL = 0.7;

export function projectileAdvance(speed: number, dt: number): number {
  return speed * dt * PROJECTILE_FLIGHT_MUL;
}
