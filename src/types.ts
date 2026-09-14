export type Screen = "menu" | "playing" | "shop" | "howto" | "gameover" | "cheats" | "compendium" | "gallery";

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
    windowMeters: number;
    maxZombiesPerWindow: number[];
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
  perk?: string | null;
  blurb: string;
}

export interface PerkDef {
  id: string;
  name: string;
  manual: boolean;
  cooldown: number;
  blurb: string;
}

export interface TechniqueDef {
  id: string;
  name: string;
  cost: number;
  sprite: string | null;
  blurb: string;
  recharge: number;
  baseCapacity?: number;
}

export interface UpgradeDef {
  id: string;
  name: string;
  maxLevel: number;
  costs: number[];
  requires?: string;
  blurb: string;
}

export interface ShopCatalog {
  katanas: KatanaDef[];
  armors: ArmorDef[];
  perks: PerkDef[];
  techniques: TechniqueDef[];
  upgrades: UpgradeDef[];
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
  unlockedTechniques: string[];
  kunaiUpgrades: number;
  bowUpgrades: number;
  flyingBoostUpgrades: number;
  etherealUpgrades: number;
  shadowStrikeUpgrades: number;
  techniquePower: number;
  bestDistance: number;
}

export interface MapLedgeDef {
  id: string;
  y: number;
  x0: number;
  x1: number;
  label: string;
  /** 0 street, 1 first story, 2 second story. Climb/drop moves one rank. */
  story?: number;
}

export interface MapPropDef {
  id: string;
  file: string;
  width: number;
  height: number;
  storyHeights?: { first: number; second: number };
  ledges: MapLedgeDef[];
}

export interface MapPropCatalog {
  props: MapPropDef[];
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
  vy?: number;
  fireCd: number;
  lane: "ground" | "roof" | "air";
  jumpedOver?: boolean;
  electrocuted?: boolean;
  ownerId?: string;
  falling?: boolean;
  homingId?: string;
  aimX?: number;
  aimY?: number;
}

export interface VfxBurst {
  sheet: string;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  duration: number;
  frames: number;
  startFrame: number;
  playFrames: number;
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
  mashClock: number;
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
