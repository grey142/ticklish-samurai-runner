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

/** Was 0.35; playtest is 2× that flight rate. */
export const PROJECTILE_FLIGHT_MUL = 0.7;

export function projectileAdvance(speed: number, dt: number): number {
  return speed * dt * PROJECTILE_FLIGHT_MUL;
}
