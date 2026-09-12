export type Screen = "menu" | "playing" | "shop" | "howto" | "gameover";

export type EnemyRole = "grab" | "trap" | "ranged" | "grab-ranged";

export interface SpeedLevel {
  level: number;
  distance: number;
  speedMul: number;
}

export interface GameConfig {
  title: string;
  protagonist: string;
  metersPerPixel: number;
  baseRunSpeedPx: number;
  speedLevels: SpeedLevel[];
  spawn: {
    minStaggerMeters: number;
    maxZombiesPer100m: number[];
  };
  economy: {
    metersPerPoint: number;
    pointsPerCoin: number;
    roofKillMultiplier: number;
    reviveCost: number;
    starterCoins: number;
  };
  jump: {
    firstMaxHeightScreen: number;
    firstMaxAirSeconds: number;
    doubleMaxHeightScreen: number;
    doubleAirSeconds: number;
  };
  slash: {
    baseRecharge: number;
    upgradeStep: number;
    maxUpgrades: number;
    upgradeCosts: number[];
    hayateMultiplier: number;
  };
  struggle: {
    tapGain: number;
    escapeAt: number;
    maxHoldSeconds: number;
    cinematicEvery: number;
    cinematicBeats: number;
    flashInterval: number;
  };
}

export interface EnemyDef {
  id: string;
  name: string;
  role: EnemyRole;
  ticklePerSec: number;
  hp: number;
  killBonus: number;
  levels: [number, number];
  weight: [number, number];
  w: number;
  h: number;
  flying: boolean;
  approach: number;
  grabRange?: number;
  projectile?: string;
  fireEvery?: number;
  color: string;
  accent: string;
}

export interface ProjectileDef {
  id: string;
  name: string;
  ticklePerSec: number;
  speed: number;
  w: number;
  h: number;
  trap: boolean;
  flavor: string;
  color: string;
}

export interface EnemyCatalog {
  enemies: EnemyDef[];
  projectiles: ProjectileDef[];
}

export interface KatanaDef {
  id: string;
  name: string;
  cost: number;
  range: number;
  perk: string | null;
  blurb: string;
}

export interface ArmorDef {
  id: string;
  name: string;
  cost: number;
  hp: number;
  blurb: string;
}

export interface PerkDef {
  id: string;
  name: string;
  manual: boolean;
  cooldown: number;
  blurb: string;
}

export interface ShopCatalog {
  katanas: KatanaDef[];
  armors: ArmorDef[];
  perks: PerkDef[];
}

export interface CinematicPack {
  struggle: string[];
  gameover: string[];
}

export interface CinematicCatalog {
  struggleArt: string;
  gameOverArt: string;
  beats: string[];
  bySource: Record<string, CinematicPack>;
}

export interface SaveData {
  coins: number;
  unlockedKatanas: string[];
  unlockedArmors: string[];
  equippedKatana: string;
  equippedArmor: string;
  slashUpgrades: number;
  bestDistance: number;
}

export interface Actor {
  kind: "enemy" | "projectile";
  id: string;
  defId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  vx: number;
  fireCd: number;
  lane: "ground" | "roof" | "air";
}

export interface StruggleState {
  sourceId: string;
  sourceName: string;
  kind: "enemy" | "projectile";
  meter: number;
  elapsed: number;
  ticklePerSec: number;
  nextFlash: number;
  nextCinematic: number;
  beat: number;
  showCinematic: number;
  lines: string[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
