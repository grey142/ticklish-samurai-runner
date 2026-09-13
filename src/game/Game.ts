import { catalogPaths, enemySpritePath, ImageBank, measureFootFrac, playerPosePath, projectilePath, vfxPath } from "../lib/assets";
import {
  allLedges,
  climbLedge,
  dropLedge,
  followCameraY,
  floorUnderFeet,
  groundCameraY,
  landingLedge,
  layoutProps,
  ledgeUnder,
  mapPropImageEntries,
  roofLedgeY,
  standTop,
  supportLedge,
  type PlacedProp,
  type WorldLedge,
} from "../lib/map-props";
import { Sfx } from "../lib/audio";
import { Input, type InputFrame } from "../lib/input";
import {
  browseBody,
  layoutBackChrome,
  layoutCheatRows,
  layoutHowto,
  layoutMenu,
  layoutPauseBtn,
  layoutPauseOverlay,
  layoutPlayControls,
  layoutShop,
} from "../lib/touch-layout";
import {
  coinsFromPoints,
  enemyWeight,
  GAMEOVER_HOLD_SEC,
  jumpHoldGravity,
  jumpTakeoffSpeed,
  killPoints,
  nextSlashUpgradeCost,
  pickWeighted,
  pointsFromDistance,
  slashRecharge,
  applyOneShot,
  DEFAULT_SPAWN_RULES,
  distanceWeightMul,
  ownerHasLiveShot,
  packSize,
  projectileAdvance,
  speedLevelFor,
  struggleAfterTap,
  windowSpawnCap,
  type SpawnRules,
} from "../lib/rules";
import { CheatState, maxHpForArmor, maxHoldMul, shopCost, struggleTapMul, tickleScale } from "../lib/cheats";
import { buildBrowseGroups, layoutBrowse, type BrowseGroup, type ThumbHit } from "../lib/compendium";
import { compileShop, hasSlashHaste, type CanonicalShop } from "../lib/shop";
import { loadSave, writeSave } from "../lib/storage";
import type {
  Actor,
  ArmorDef,
  CinematicCatalog,
  EnemyCatalog,
  EnemyDef,
  GameConfig,
  MapPropCatalog,
  KatanaDef,
  Particle,
  ProjectileDef,
  SaveData,
  Screen,
  ShopCatalog,
  StruggleState,
  VfxBurst,
} from "../types";
import { drawScene } from "./render";

let nextActor = 1;

export class Game {
  cfg!: GameConfig;
  enemies!: EnemyCatalog;
  shop!: ShopCatalog;
  cinematics!: CinematicCatalog;
  mapProps: MapPropCatalog = { props: [] };
  save!: SaveData;
  input: Input;
  sfx = new Sfx();
  screen: Screen = "menu";
  shopTab: "blades" | "armor" | "slash" = "blades";
  shopScroll = 0;
  spawnRules: SpawnRules = DEFAULT_SPAWN_RULES;
  cheats = new CheatState();
  browse: BrowseGroup[] = [];
  browseScroll = 0;
  cheatScroll = 0;
  paused = false;
  cheatsFrom: "menu" | "pause" = "menu";
  viewer: { src: string; label: string } | null = null;
  thumbs: ThumbHit[] = [];
  browseHeaders: { text: string; x: number; y: number }[] = [];
  browseBodyY = 0;
  browseBodyH = 0;
  wheelAcc = 0;

  w = 1280;
  h = 720;
  camY = 0;
  worldX = 0;
  distance = 0;
  runPoints = 0;
  runCoins = 0;
  hudCoinsFlash = 0;
  hp = 102;
  maxHp = 102;
  playerX = 210;
  playerY = 0;
  playerW = 46;
  playerH = 92;
  vy = 0;
  onGround = true;
  onRoof = false;
  jumps = 0;
  holdingFirst = false;
  slam = false;
  invuln = 0;
  slashCd = 0;
  slashFlash = 0;
  perkCd: Record<string, number> = {};
  vfx: VfxBurst[] = [];
  shadeUntil = -1;
  tintScratch: HTMLCanvasElement | null = null;
  actors: Actor[] = [];
  particles: Particle[] = [];
  spawnLog: number[] = [];
  lastSpawnAt = -999;
  struggle: StruggleState | null = null;
  pinkFlash = 0;
  usedRevive = false;
  overSource = "drone";
  overLine = "";
  overFrame = 1;
  overT = 0;
  images = new ImageBank();
  time = 0;
  menuPulse = 0;
  perchWanted: string | null = null;

  constructor(
    public canvas: HTMLCanvasElement,
    public ctx: CanvasRenderingContext2D,
  ) {
    this.input = new Input();
    this.input.attach(canvas);
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.wheelAcc += e.deltaY;
      },
      { passive: false },
    );
  }

  async boot(): Promise<void> {
    const [game, enemies, shopRaw, spawnRaw, cinematics, mapProps, cheatsRaw, compendiumRaw] = await Promise.all([
      fetch("./data/game.json").then((r) => r.json() as Promise<GameConfig>),
      fetch("./data/enemies.json").then((r) => r.json() as Promise<EnemyCatalog>),
      fetch("./data/shop-canonical.json").then((r) => r.json() as Promise<CanonicalShop>),
      fetch("./data/spawn-rules.json").then((r) => r.json() as Promise<SpawnRules>),
      fetch("./data/cinematics.json").then((r) => r.json() as Promise<CinematicCatalog>),
      fetch("./assets/map-props/map-props.json").then((r) => r.json() as Promise<MapPropCatalog>),
      fetch("./data/cheats.json").then((r) => r.json() as Promise<unknown>),
      fetch("./data/compendium.json").then((r) => r.json() as Promise<unknown>),
    ]);
    this.cfg = game;
    this.enemies = enemies;
    this.shop = compileShop(shopRaw);
    this.spawnRules = {
      ...DEFAULT_SPAWN_RULES,
      ...spawnRaw,
      stagger: { ...DEFAULT_SPAWN_RULES.stagger, ...spawnRaw.stagger },
    };
    this.cinematics = cinematics;
    this.mapProps = mapProps;
    this.cheats.load(cheatsRaw);
    this.browse = buildBrowseGroups(compendiumRaw, enemies.enemies, enemies.projectiles);
    this.save = loadSave(game.economy.starterCoins);
    this.sanitizeLoadout();
    this.syncFreeShop();
    this.persist();
    const q = new URLSearchParams(location.search);
    if (q.has("dojo")) this.unlockDojo();
    this.perchWanted = q.get("perch");
    this.applyLoadout();
    const enemyIds = enemies.enemies.map((e) => e.id);
    const projectileIds = enemies.projectiles.map((p) => p.id);
    await this.images.load([...catalogPaths(enemyIds, projectileIds), ...mapPropImageEntries(mapProps.props)]);
  }

  unlockDojo(): void {
    this.save.coins = Math.max(this.save.coins, 4000);
    this.save.unlockedKatanas = [...new Set([...this.save.unlockedKatanas, ...this.shop.katanas.map((k) => k.id)])];
    this.save.unlockedArmors = [...new Set([...this.save.unlockedArmors, ...this.shop.armors.map((a) => a.id)])];
    this.save.equippedKatana = "kagekiri";
    this.save.equippedArmor = "kitsunes-mirage";
    this.persist();
  }

  applyLoadout(): void {
    const armor = this.armor();
    const next = maxHpForArmor(armor.hp, this.cheats.on);
    if (next > this.maxHp) this.hp += next - this.maxHp;
    this.maxHp = next;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  shopPrice(base: number): number {
    return shopCost(base, this.cheats.on);
  }

  slashUpgradeCost(): number | null {
    const cost = nextSlashUpgradeCost(this.cfg, this.save.slashUpgrades);
    if (cost == null) return null;
    return this.shopPrice(cost);
  }

  syncFreeShop(): void {
    if (!this.cheats.active("all_shop_free")) return;
    this.save.unlockedKatanas = [...new Set([...this.save.unlockedKatanas, ...this.shop.katanas.map((k) => k.id)])];
    this.save.unlockedArmors = [...new Set([...this.save.unlockedArmors, ...this.shop.armors.map((a) => a.id)])];
  }

  toggleCheat(id: string): void {
    this.cheats.toggle(id);
    if (id === "all_shop_free") this.syncFreeShop();
    if (id === "double_health") this.applyLoadout();
    if (id === "instant_struggle_fill" && this.struggle && this.cheats.active(id)) {
      this.struggle.meter = this.cfg.struggle.escapeAt;
    }
    this.persist();
  }

  leaveCheats(): void {
    this.viewer = null;
    if (this.cheatsFrom === "pause") {
      this.screen = "playing";
      this.paused = true;
    } else {
      this.screen = "menu";
    }
  }

  katana(): KatanaDef {
    return this.shop.katanas.find((k) => k.id === this.save.equippedKatana) ?? this.shop.katanas[0];
  }

  armor(): ArmorDef {
    return this.shop.armors.find((a) => a.id === this.save.equippedArmor) ?? this.shop.armors[0];
  }

  hayate(): boolean {
    return hasSlashHaste(this.katana().perk, this.armor().perk);
  }

  slashReach(): number {
    return this.playerW * this.katana().range;
  }

  tickleMul(): number {
    return this.armor().perk === "shadow-tread" ? 0.75 : 1;
  }

  sanitizeLoadout(): void {
    const blades = new Set(this.shop.katanas.map((k) => k.id));
    const suits = new Set(this.shop.armors.map((a) => a.id));
    this.save.unlockedKatanas = this.save.unlockedKatanas.filter((id) => blades.has(id));
    this.save.unlockedArmors = this.save.unlockedArmors.filter((id) => suits.has(id));
    if (!this.save.unlockedKatanas.includes("ikielas-katana")) this.save.unlockedKatanas.unshift("ikielas-katana");
    if (!this.save.unlockedArmors.includes("ikielas-robes")) this.save.unlockedArmors.unshift("ikielas-robes");
    if (!blades.has(this.save.equippedKatana)) this.save.equippedKatana = "ikielas-katana";
    if (!suits.has(this.save.equippedArmor)) this.save.equippedArmor = "ikielas-robes";
  }

  shadeActive(): boolean {
    return this.shadeUntil >= 0 && this.distance < this.shadeUntil;
  }

  manualPerks(): string[] {
    const ids: string[] = [];
    for (const id of [this.katana().perk, this.armor().perk]) {
      if (!id) continue;
      const def = this.shop.perks.find((p) => p.id === id);
      if (def?.manual) ids.push(id);
    }
    return ids;
  }

  playVfx(
    file: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { frames?: number; startFrame?: number; playFrames?: number; duration?: number },
  ): void {
    const frames = opts?.frames ?? 4;
    this.vfx.push({
      sheet: vfxPath(file),
      x,
      y,
      w,
      h,
      t: 0,
      duration: opts?.duration ?? 0.42,
      frames,
      startFrame: opts?.startFrame ?? 0,
      playFrames: opts?.playFrames ?? frames,
    });
  }

  recharge(): number {
    return slashRecharge(this.cfg, this.save.slashUpgrades, this.hayate());
  }

  mapH(): number {
    return this.h * 1.85;
  }

  groundY(): number {
    return this.mapH() * 0.9;
  }

  roofY(): number {
    return roofLedgeY(this.worldLedges(), this.groundY() - this.h * 0.42);
  }

  propH(): number {
    return Math.round(this.h * 0.74);
  }

  placedProps(): PlacedProp[] {
    return layoutProps(this.mapProps, this.worldX, this.w, this.groundY(), this.propH());
  }

  worldLedges(): WorldLedge[] {
    return allLedges(this.placedProps());
  }

  private feetX(): number {
    return this.playerX + this.playerW * 0.5;
  }

  spriteBox(path: string, height: number): { w: number; h: number } {
    const img = this.images.get(path);
    const ar = img && img.height > 0 ? img.width / img.height : 0.48;
    return { w: Math.max(12, Math.round(height * ar)), h: Math.round(height) };
  }

  updateCamera(): void {
    const mapH = this.mapH();
    const target =
      this.screen === "playing" ? followCameraY(mapH, this.h, this.playerY) : groundCameraY(mapH, this.h);
    const k = this.screen === "playing" ? 0.28 : 1;
    this.camY += (target - this.camY) * k;
  }

  resize(): void {
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width || window.innerWidth || 640;
    const cssH = rect.height || window.innerHeight || 360;
    const w = Math.max(320, Math.round(cssW));
    const h = Math.max(200, Math.round(cssH));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = w;
    this.h = h;
    this.input.setView(w, h);
    // Quarter of the visible playfield; the world map is taller than the view.
    this.playerH = Math.round(this.h * 0.25);
    const box = this.spriteBox("./assets/player/run.png", this.playerH);
    this.playerW = box.w;
    this.playerX = Math.round(w * 0.15);
    const bw = Math.floor(w * dpr);
    const bh = Math.floor(h * dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw;
      this.canvas.height = bh;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.onGround) this.playerY = standTop(this.groundY(), this.playerH, this.playerFootFrac());
    if (this.onRoof) {
      const ledge = ledgeUnder(this.worldLedges(), this.feetX(), this.playerFeetY(), 24);
      this.playerY = standTop(ledge?.y ?? this.roofY(), this.playerH, this.playerFootFrac());
    }
    this.resizeButtons();
    this.updateCamera();
  }

  startRun(): void {
    this.paused = false;
    this.viewer = null;
    this.screen = "playing";
    this.worldX = 0;
    this.distance = 0;
    this.runPoints = 0;
    this.runCoins = 0;
    this.actors = [];
    this.particles = [];
    this.spawnLog = [];
    this.lastSpawnAt = 0;
    this.struggle = null;
    this.usedRevive = false;
    this.jumps = 0;
    this.vy = 0;
    this.onGround = true;
    this.onRoof = false;
    this.holdingFirst = false;
    this.slam = false;
    this.invuln = 2.2;
    this.slashCd = 0;
    this.slashFlash = 0;
    this.perkCd = {};
    this.vfx = [];
    this.shadeUntil = -1;
    this.pinkFlash = 0;
    this.applyLoadout();
    this.hp = this.maxHp;
    this.playerY = standTop(this.groundY(), this.playerH, this.playerFootFrac());
    this.camY = groundCameraY(this.mapH(), this.h);
    this.sfx.slash();
  }

  persist(): void {
    writeSave(this.save);
  }

  tick(dt: number): void {
    this.time += dt;
    this.menuPulse += dt;
    this.input.mashAll = this.screen === "playing" && !!this.struggle;
    this.resizeButtons();
    const input = this.input.consume();
    if (this.screen === "playing") this.updatePlay(dt, input);
    else this.updateMeta(dt, input);
    this.pinkFlash = Math.max(0, this.pinkFlash - dt);
    this.hudCoinsFlash = Math.max(0, this.hudCoinsFlash - dt);
    this.updateCamera();
    drawScene(this);
  }

  private updateMeta(dt: number, input: InputFrame): void {
    const id = input.ui;
    if (this.viewer) {
      if (id === "back" || input.anyTap) this.viewer = null;
      return;
    }
    if (this.screen === "menu") {
      if (id === "play") this.startRun();
      if (id === "shop") this.screen = "shop";
      if (id === "howto") this.screen = "howto";
      if (id === "cheats") {
        this.cheatsFrom = "menu";
        this.cheatScroll = 0;
        this.screen = "cheats";
      }
      if (id === "compendium") {
        this.browseScroll = 0;
        this.screen = "compendium";
      }
      if (id === "gallery") {
        this.browseScroll = 0;
        this.screen = "gallery";
      }
    } else if (this.screen === "howto") {
      if (id === "back" || (input.anyTap && !id)) this.screen = "menu";
    } else if (this.screen === "shop") {
      if (id === "back") this.screen = "menu";
      if (id === "tab-blades") this.shopTab = "blades";
      if (id === "tab-armor") this.shopTab = "armor";
      if (id === "tab-slash") this.shopTab = "slash";
      if (id?.startsWith("buy-katana-")) this.buyKatana(id.slice(11));
      if (id?.startsWith("buy-armor-")) this.buyArmor(id.slice(10));
      if (id === "buy-slash") this.buySlash();
    } else if (this.screen === "cheats") {
      this.applyListScroll("cheat", input);
      if (id === "back") this.leaveCheats();
      if (id?.startsWith("cheat-")) this.toggleCheat(id.slice(6));
    } else if (this.screen === "compendium" || this.screen === "gallery") {
      this.applyListScroll("browse", input);
      if (id === "back") this.screen = "menu";
      if (!id && input.anyTap && Math.abs(input.scroll) < 8) {
        const thumb = this.thumbs.find((t) => input.tapX >= t.x && input.tapY >= t.y && input.tapX <= t.x + t.w && input.tapY <= t.y + t.h);
        if (thumb) this.viewer = { src: thumb.src, label: thumb.label };
      }
    } else if (this.screen === "gameover") {
      this.overT += dt;
      if (this.overT >= GAMEOVER_HOLD_SEC || input.anyTap) this.screen = "menu";
    }
  }

  private applyListScroll(which: "cheat" | "browse", input: InputFrame): void {
    const wheel = this.wheelAcc;
    this.wheelAcc = 0;
    const page = this.h * 0.7;
    let delta = input.scroll + wheel;
    if (input.ui === "page-up") delta -= page;
    if (input.ui === "page-down") delta += page;
    if (input.swipe === "up") delta += page * 0.45;
    if (input.swipe === "down") delta -= page * 0.45;
    if (which === "cheat") {
      const { maxScroll } = layoutCheatRows(
        this.w,
        this.h,
        this.cheats.book.cheats.map((c) => c.id),
        this.cheatScroll,
      );
      this.cheatScroll = Math.max(0, Math.min(maxScroll, this.cheatScroll + delta));
    } else {
      const { bodyY, bodyH } = browseBody(this.w, this.h);
      const laid = layoutBrowse(this.w, bodyY, bodyH, this.browseScroll, this.browse, this.screen === "gallery" ? "gallery" : "compendium");
      this.browseScroll = Math.max(0, Math.min(laid.maxScroll, this.browseScroll + delta));
    }
  }

  buyKatana(id: string): void {
    const item = this.shop.katanas.find((k) => k.id === id);
    if (!item) return;
    if (this.save.unlockedKatanas.includes(id)) {
      this.save.equippedKatana = id;
      this.persist();
      return;
    }
    const cost = this.shopPrice(item.cost);
    if (this.save.coins < cost) return;
    this.save.coins -= cost;
    this.save.unlockedKatanas.push(id);
    this.save.equippedKatana = id;
    this.persist();
    this.sfx.coin();
  }

  buyArmor(id: string): void {
    const item = this.shop.armors.find((a) => a.id === id);
    if (!item) return;
    if (this.save.unlockedArmors.includes(id)) {
      this.save.equippedArmor = id;
      this.applyLoadout();
      this.persist();
      return;
    }
    const cost = this.shopPrice(item.cost);
    if (this.save.coins < cost) return;
    this.save.coins -= cost;
    this.save.unlockedArmors.push(id);
    this.save.equippedArmor = id;
    this.applyLoadout();
    this.persist();
    this.sfx.coin();
  }

  buySlash(): void {
    const cost = this.slashUpgradeCost();
    if (cost == null || this.save.coins < cost) return;
    this.save.coins -= cost;
    this.save.slashUpgrades += 1;
    this.persist();
    this.sfx.coin();
  }

  tryRevive(): void {
    if (this.usedRevive || this.save.coins < this.cfg.economy.reviveCost) return;
    this.save.coins -= this.cfg.economy.reviveCost;
    this.usedRevive = true;
    this.persist();
    this.hp = Math.ceil(this.maxHp * 0.55);
    this.struggle = null;
    this.invuln = 1.6;
    this.screen = "playing";
    this.sfx.perk();
  }

  private updatePlay(dt: number, input: InputFrame): void {
    if (this.viewer) {
      if (input.ui === "back" || input.anyTap) this.viewer = null;
      return;
    }
    if (!this.struggle && (input.pauseToggle || input.ui === "pause")) {
      this.paused = !this.paused;
      return;
    }
    if (this.paused) {
      if (input.ui === "resume") this.paused = false;
      if (input.ui === "cheats") {
        this.cheatsFrom = "pause";
        this.cheatScroll = 0;
        this.screen = "cheats";
      }
      return;
    }
    if (this.struggle) {
      this.updateStruggle(dt, input);
      return;
    }

    const { level, speedMul } = speedLevelFor(this.distance, this.cfg);
    const run = this.cfg.baseRunSpeedPx * speedMul;
    this.worldX += run * dt;
    this.distance += run * dt * this.cfg.metersPerPixel;
    const distPts = pointsFromDistance(this.distance, this.cfg.economy.metersPerPoint);
    const killPts = this.runPoints;
    const coins = coinsFromPoints(distPts + killPts, this.cfg.economy.pointsPerCoin);
    if (coins > this.runCoins) {
      this.hudCoinsFlash = 0.35;
      this.sfx.coin();
    }
    this.runCoins = coins;

    this.updatePlayer(dt, input, run);
    this.maybeSpawn(level);
    this.updateActors(dt, run, level);
    if (input.slash) this.trySlash();
    if (input.perk) this.tryPerk(input.perk);
    this.tickJumpOver();
    this.resolveCombat();
    this.slashCd = Math.max(0, this.slashCd - dt);
    this.slashFlash = Math.max(0, this.slashFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    for (const k of Object.keys(this.perkCd)) this.perkCd[k] = Math.max(0, this.perkCd[k] - dt);
    if (this.shadeUntil >= 0 && this.distance >= this.shadeUntil) this.shadeUntil = -1;
    this.updateParticles(dt);
    for (const fx of this.vfx) fx.t += dt;
    this.vfx = this.vfx.filter((fx) => fx.t < fx.duration);
  }

  private playerFootFrac(): number {
    return measureFootFrac(this.images.get(playerPosePath("run")));
  }

  private actorFootFrac(defId: string): number {
    return measureFootFrac(this.images.get(enemySpritePath(defId, "idle")));
  }

  private playerFeetY(): number {
    return this.playerY + this.playerH * this.playerFootFrac();
  }

  private standOn(y: number, roof: boolean): void {
    this.playerY = standTop(y, this.playerH, this.playerFootFrac());
    this.vy = 0;
    this.onGround = !roof;
    this.onRoof = roof;
    this.jumps = 0;
    this.holdingFirst = false;
    if (this.slam) this.slamBurst();
    this.slam = false;
  }

  private standActorOn(a: Actor, y: number): void {
    a.y = standTop(y, a.h, this.actorFootFrac(a.defId));
  }

  private updatePlayer(dt: number, input: InputFrame, _run: number): void {
    const gY = this.groundY();
    const ledges = this.worldLedges();
    const H1 = this.h * this.cfg.jump.firstMaxHeightScreen;
    const T1 = this.cfg.jump.firstMaxAirSeconds;
    const gHold = jumpHoldGravity(H1, T1);
    const gFall = gHold * 2.35;
    const v1 = jumpTakeoffSpeed(H1, T1);

    if (input.swipe === "up") {
      const up = climbLedge(ledges, this.playerX, this.playerFeetY(), this.playerW, gY);
      if (up) this.standOn(up.y, true);
    } else if (input.swipe === "down" && this.onRoof) {
      const down = dropLedge(ledges, this.playerX, this.playerFeetY(), this.playerW, gY);
      if (down) this.standOn(down.y, true);
      else this.standOn(gY, false);
    } else if (input.swipe === "down" && !this.onGround && !this.onRoof) {
      this.slam = true;
      this.vy = 1650;
      this.holdingFirst = false;
      this.sfx.slam();
    }

    const grounded = this.onGround || this.onRoof;
    if (input.jumpPressed && grounded) {
      this.onGround = false;
      this.onRoof = false;
      this.jumps = 1;
      this.holdingFirst = true;
      this.vy = -v1;
      this.slam = false;
      this.sfx.jump();
    } else if (input.jumpPressed && !grounded && this.jumps === 1) {
      this.jumps = 2;
      this.holdingFirst = false;
      const H2 = this.h * this.cfg.jump.doubleMaxHeightScreen;
      const T2 = this.cfg.jump.doubleAirSeconds;
      this.vy = -jumpTakeoffSpeed(H2, T2 * 1.65);
      this.slam = false;
      this.sfx.doubleJump();
    }

    if (this.holdingFirst && input.jumpReleased) {
      this.holdingFirst = false;
      if (this.vy < 0) this.vy *= 0.28;
    }

    if (this.onRoof) {
      const stay = ledgeUnder(ledges, this.playerX, this.playerFeetY(), 18, this.playerW);
      if (stay) this.playerY = standTop(stay.y, this.playerH, this.playerFootFrac());
      else {
        this.onRoof = false;
        this.onGround = false;
        this.jumps = Math.max(1, this.jumps);
      }
    }

    if (!this.onGround && !this.onRoof) {
      const feetFrom = this.playerFeetY();
      const g = this.holdingFirst && this.jumps === 1 ? gHold : gFall;
      this.vy += g * dt;
      this.playerY += this.vy * dt;
      const feetTo = this.playerFeetY();
      if (this.vy >= 0 && !this.slam) {
        const hit = landingLedge(ledges, this.playerX, feetFrom, feetTo, this.playerW);
        if (hit) {
          this.standOn(hit.y, true);
          return;
        }
      }
      if (this.playerFeetY() >= gY) {
        this.standOn(gY, false);
      }
      const ceiling = 8;
      if (this.playerY < ceiling) {
        this.playerY = ceiling;
        if (this.vy < 0) this.vy = 0;
      }
    }
  }

  private slamBurst(): void {
    for (const a of this.actors) {
      if (a.kind !== "enemy") continue;
      if (Math.abs(a.x - this.playerX) < 90 && a.lane !== "roof") {
        this.hurtActor(a, 12, true);
      }
    }
  }

  private maybeSpawn(level: number): void {
    const firstAt = this.spawnRules.firstSpawnMeters ?? 48;
    if (this.distance < firstAt) return;
    if (this.distance - this.lastSpawnAt < this.cfg.spawn.minStaggerMeters) return;
    const windowStart = this.distance - this.spawnRules.windowMeters;
    this.spawnLog = this.spawnLog.filter((d) => d >= windowStart);
    const cap = windowSpawnCap(this.spawnRules, level);
    const left = cap - this.spawnLog.length;
    if (left <= 0) return;

    const n = Math.min(
      left,
      packSize(this.spawnRules.stagger.packSizeMin, this.spawnRules.stagger.packSizeMax, Math.random),
    );
    for (let i = 0; i < n; i++) {
      const weights = this.enemies.enemies.map((e) => ({
        id: e.id,
        weight: enemyWeight(e, level) * distanceWeightMul(this.spawnRules, this.distance, e.id),
      }));
      const id = pickWeighted(weights, Math.random);
      if (!id) break;
      const gap = this.spawnRules.stagger.packGapPx ?? 110;
      this.spawnEnemy(id, i * (gap + Math.random() * 36));
      this.spawnLog.push(this.distance);
    }
    this.lastSpawnAt = this.distance;
  }

  private def(id: string): EnemyDef {
    return this.enemies.enemies.find((e) => e.id === id) ?? this.enemies.enemies[0];
  }

  private projDef(id: string): ProjectileDef {
    return this.enemies.projectiles.find((p) => p.id === id) ?? this.enemies.projectiles[0];
  }

  private spawnEnemy(id: string, packOffset = 0): void {
    const def = this.def(id);
    const trap = def.role === "trap";
    const spriteH = this.playerH * (def.flying ? 0.9 : 1);
    const box = this.spriteBox(enemySpritePath(id, "idle"), spriteH);
    const eh = box.h;
    const ew = box.w;
    const flying = def.flying;
    const forcePerch = !!this.perchWanted;
    const wantRoof = !trap && (forcePerch || flying || Math.random() < 0.3);
    const x = this.w + 40 + packOffset + Math.random() * 24;
    const perch = wantRoof ? this.elevatedSupportAt(x, ew) : null;
    const usedLane: Actor["lane"] = perch ? "roof" : "ground";
    const foot = this.actorFootFrac(id);
    const y = standTop(perch ? perch.y : this.groundY(), eh, foot);
    this.actors.push({
      kind: "enemy",
      id: `e${nextActor++}`,
      defId: id,
      x,
      y,
      w: ew,
      h: eh,
      hp: 1,
      maxHp: 1,
      vx: def.approach,
      fireCd: def.projectile ? 0.06 + Math.random() * 0.14 : (def.fireEvery ?? 2) * (0.4 + Math.random() * 0.4),
      lane: usedLane,
      jumpedOver: false,
      electrocuted: false,
    });
  }

  private perchKind(): RegExp | undefined {
    const want = this.perchWanted;
    if (want === "engawa" || want === "porch") return /engawa/;
    if (want === "roof") return /roof/;
    if (want === "balcony") return /balcony/;
    return undefined;
  }

  /** Decks above the ground-locked view look like empty sky. */
  private visibleDeckMinY(): number {
    return groundCameraY(this.mapH(), this.h) + 24;
  }

  private elevatedSupportAt(x: number, w: number): WorldLedge | null {
    return supportLedge(this.worldLedges(), x, w, this.perchKind(), this.visibleDeckMinY());
  }

  private updateActors(dt: number, run: number, _level: number): void {
    const ledges = this.worldLedges();
    for (const a of this.actors) {
      a.x -= run * dt;
      if (a.kind === "enemy") {
        const def = this.def(a.defId);
        if (a.lane !== "roof") a.x -= def.approach * run * dt;
        const feetY = a.y + a.h * this.actorFootFrac(a.defId);
        const floorY = floorUnderFeet(
          ledges,
          a.x,
          a.w,
          feetY,
          this.groundY(),
          36,
          this.visibleDeckMinY(),
        );
        this.standActorOn(a, floorY);
        a.lane = floorY < this.groundY() - 8 ? "roof" : "ground";
        if (def.projectile && a.x < this.w - 40 && a.x + a.w > 0) {
          if (ownerHasLiveShot(this.actors, a.id)) continue;
          a.fireCd -= dt;
          if (a.fireCd <= 0) {
            this.fireProjectile(def.projectile, a);
            a.fireCd = def.fireEvery ?? 2.4;
          }
        }
      } else {
        const p = this.projDef(a.defId);
        a.x -= projectileAdvance(p.speed, dt);
      }
    }
    this.actors = this.actors.filter((a) => a.x > -180 && a.hp > 0);
  }

  private fireProjectile(id: string, from: Actor): void {
    if (ownerHasLiveShot(this.actors, from.id)) return;
    const def = this.projDef(id);
    const box = this.spriteBox(projectilePath(id), from.h * 0.5);
    this.actors.push({
      kind: "projectile",
      id: `p${nextActor++}`,
      defId: id,
      ownerId: from.id,
      x: from.x - box.w * 0.35,
      y: from.y + from.h * 0.5 - box.h * 0.5,
      w: box.w,
      h: box.h,
      hp: 1,
      maxHp: 1,
      vx: def.speed,
      fireCd: 0,
      lane: from.lane,
    });
  }

  private playerBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.playerX, y: this.playerY, w: this.playerW, h: this.playerH };
  }

  private overlaps(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private resolveCombat(): void {
    if (this.invuln > 0 || this.shadeActive() || this.struggle) return;
    const pb = this.playerBox();
    for (const a of this.actors) {
      if (!this.overlaps(pb, a)) continue;
      if (this.slashFlash > 0 && a.x < this.playerX + this.slashReach() + 20) {
        this.hurtActor(a, 10, this.onRoof || this.slam);
        continue;
      }
      if (a.kind === "projectile") {
        const p = this.projDef(a.defId);
        a.hp = 0;
        this.beginStruggle(a.defId, p.name, "projectile", p.ticklePerSec * tickleScale("projectile", this.cheats.on));
        return;
      }
      const def = this.def(a.defId);
      if (def.role === "ranged") continue;
      this.beginStruggle(def.id, def.name, "enemy", def.ticklePerSec * tickleScale("enemy", this.cheats.on));
      a.hp = 0;
      return;
    }
  }

  private trySlash(): void {
    if (this.slashCd > 0 || this.struggle) return;
    this.slashCd = this.recharge();
    this.slashFlash = 0.16;
    this.sfx.slash();
    if (this.hayate()) {
      this.playVfx("electrocute-wind.png", this.playerX + this.playerW * 0.2, this.playerY - 20, this.playerH * 1.4, this.playerH * 1.1, {
        startFrame: 3,
        playFrames: 1,
        duration: 0.28,
      });
    }
    const slashBox = { x: this.playerX, y: this.playerY, w: this.playerW + this.slashReach(), h: this.playerH };
    for (const a of this.actors) {
      if (!this.overlaps(slashBox, a)) continue;
      this.hurtActor(a, 10, this.onRoof);
    }
  }

  private tryPerk(id: string): void {
    if (!this.manualPerks().includes(id)) return;
    if ((this.perkCd[id] ?? 0) > 0 || this.struggle) return;
    const def = this.shop.perks.find((p) => p.id === id);
    if (!def || !def.manual) return;
    this.perkCd[id] = def.cooldown;
    this.sfx.perk();
    const fxW = this.w * 0.55;
    const fxH = this.h * 0.55;
    if (id === "shadow-strike") {
      this.invuln = 0.45;
      this.playVfx("shadow-strike.png", this.playerX - 20, this.playerY - this.playerH * 0.3, fxW * 0.7, fxH * 0.7);
      for (const a of this.actors) {
        if (a.x > this.playerX - 30 && a.x < this.playerX + 260) this.hurtActor(a, 16, this.onRoof);
      }
    } else if (id === "call-lightning") {
      this.playVfx("call-lightning.png", this.playerX + 40, this.playerY - this.playerH * 1.6, fxW, this.playerH * 2.8);
      for (const a of this.actors) {
        if (a.kind === "enemy" && a.x < this.w) {
          if (this.armor().perk === "storm-petal") a.electrocuted = true;
          this.hurtActor(a, 14, false);
        }
      }
    } else if (id === "blade-of-souls") {
      this.playVfx("blade-of-souls.png", this.playerX, this.playerY - this.h * 0.15, fxW, fxH);
      const reach = 10 / this.cfg.metersPerPixel;
      for (const a of this.actors) {
        if (a.kind !== "enemy") continue;
        if (a.x < this.playerX || a.x > this.playerX + reach) continue;
        this.hurtActor(a, 18, false, { soulHeal: 15 });
      }
    } else if (id === "kitsune-shade") {
      this.shadeUntil = this.distance + 30;
    }
  }

  private tickJumpOver(): void {
    if (this.onGround || this.armor().perk !== "storm-petal") return;
    const pb = this.playerBox();
    for (const a of this.actors) {
      if (a.kind !== "enemy" || a.jumpedOver) continue;
      const overX = pb.x + pb.w > a.x && pb.x < a.x + a.w;
      const overY = pb.y + pb.h < a.y + a.h * 0.55;
      if (!overX || !overY) continue;
      a.jumpedOver = true;
      a.electrocuted = true;
      this.playVfx("electrocute-wind.png", a.x - 20, a.y - a.h * 0.4, a.w * 2.2, a.h * 1.6, {
        startFrame: 0,
        playFrames: 3,
        duration: 0.4,
      });
      if (Math.random() < 0.25) this.hurtActor(a, 999, true);
    }
  }

  private hurtActor(a: Actor, _dmg: number, roofKill: boolean, extra?: { soulHeal?: number }): void {
    a.hp = applyOneShot(a.hp);
    this.burst(a.x + a.w / 2, a.y + a.h / 2, a.kind === "enemy" ? this.def(a.defId).color : "#fff");
    this.sfx.hit();
    if (a.hp <= 0 && a.kind === "enemy") {
      const bonus = killPoints(this.def(a.defId).killBonus, roofKill || !!a.electrocuted, this.cfg.economy.roofKillMultiplier);
      this.runPoints += bonus;
      let heal = extra?.soulHeal ?? 0;
      if (this.armor().perk === "shadow-tread") heal += 5;
      if (heal > 0) this.hp = Math.min(this.maxHp, this.hp + heal);
    }
  }

  private burst(x: number, y: number, color: string): void {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 220,
        vy: (Math.random() - 0.8) * 220,
        life: 0.35 + Math.random() * 0.25,
        max: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private beginStruggle(sourceId: string, sourceName: string, kind: "enemy" | "projectile", tickle: number): void {
    const pack = this.cinematics.bySource[sourceId] ?? {
      struggle: this.cinematics.beats,
      gameover: ["Ikiela is laughed out of the old city."],
    };
    this.struggle = {
      sourceId,
      sourceName,
      kind,
      meter: this.cheats.active("instant_struggle_fill") ? this.cfg.struggle.escapeAt : 0,
      elapsed: 0,
      ticklePerSec: tickle,
      nextFlash: 0,
      nextCinematic: this.cfg.struggle.cinematicEvery,
      beat: 0,
      showCinematic: 1.6,
      lines: pack.struggle,
      mashClock: 0,
    };
    this.sfx.grab();
    this.pinkFlash = 0.25;
    this.sfx.laugh();
    this.input.mashAll = true;
  }

  private updateStruggle(dt: number, input: InputFrame): void {
    const s = this.struggle;
    if (!s) return;
    s.elapsed += dt;
    s.showCinematic = Math.max(0, s.showCinematic - dt);
    if (!this.cheats.active("infinite_health")) {
      this.hp -= s.ticklePerSec * dt * this.tickleMul();
    }
    const tapGain = this.cfg.struggle.tapGain * struggleTapMul(this.cheats.on);
    const holding =
      input.jumpHeld || this.input.keys.has("Space") || this.input.keys.has("KeyW") || this.input.keys.has("Enter");
    if (this.cheats.active("instant_struggle_fill")) {
      s.meter = this.cfg.struggle.escapeAt;
    } else if (input.struggleTap || input.jumpPressed || input.slash) {
      s.meter = struggleAfterTap(s.meter, tapGain, this.cfg.struggle.escapeAt);
      s.mashClock = 0;
    }
    if (!this.cheats.active("instant_struggle_fill") && holding) {
      s.mashClock += dt;
      if (s.mashClock >= 0.1) {
        s.mashClock = 0;
        s.meter = struggleAfterTap(s.meter, tapGain, this.cfg.struggle.escapeAt);
      }
    }
    s.nextFlash -= dt;
    if (s.nextFlash <= 0) {
      s.nextFlash = this.cfg.struggle.flashInterval;
      this.pinkFlash = 0.22;
      this.sfx.laugh();
    }
    s.nextCinematic -= dt;
    if (s.nextCinematic <= 0) {
      s.nextCinematic = this.cfg.struggle.cinematicEvery;
      s.beat = (s.beat + 1) % this.cfg.struggle.cinematicBeats;
      s.showCinematic = 1.15;
    }
    if (s.meter >= this.cfg.struggle.escapeAt) {
      this.struggle = null;
      this.invuln = 0.8;
      this.sfx.slash();
      return;
    }
    if (this.hp <= 0 || s.elapsed >= this.cfg.struggle.maxHoldSeconds * maxHoldMul(this.cheats.on)) {
      this.hp = 0;
      this.endRun(s.sourceId);
    }
  }

  private endRun(sourceId: string): void {
    const pack = this.cinematics.bySource[sourceId];
    this.overSource = sourceId;
    this.overFrame = 1 + Math.floor(Math.random() * 3);
    this.overLine = pack?.gameover[Math.floor(Math.random() * (pack.gameover.length || 1))] ?? "The laugh wins.";
    const distPts = pointsFromDistance(this.distance, this.cfg.economy.metersPerPoint);
    const coins = coinsFromPoints(distPts + this.runPoints, this.cfg.economy.pointsPerCoin);
    this.runCoins = coins;
    this.save.coins += coins;
    this.save.bestDistance = Math.max(this.save.bestDistance, Math.floor(this.distance));
    this.persist();
    this.screen = "gameover";
    this.overT = 0;
    this.struggle = null;
    this.input.mashAll = false;
    this.sfx.die();
  }

  resizeButtons(): void {
    const w = this.w;
    const h = this.h;
    const play = layoutPlayControls(w, h, this.screen === "playing" ? this.manualPerks() : []);
    this.input.slashRect = this.screen === "playing" && !this.struggle && !this.paused ? play.slash : { x: 0, y: 0, w: 0, h: 0 };
    this.input.perkRects = this.screen === "playing" && !this.struggle && !this.paused ? play.perks : [];
    this.input.uiRects = [];
    if (this.viewer) {
      this.input.uiRects = [{ id: "back", x: 12, y: 10, w: Math.max(120, Math.min(180, w * 0.2)), h: Math.max(48, Math.min(56, Math.round(h * 0.12))) }];
      return;
    }
    if (this.screen === "menu") this.input.uiRects = layoutMenu(w, h);
    else if (this.screen === "howto") this.input.uiRects = layoutHowto(w, h);
    else if (this.screen === "shop") {
      const blades = this.shopTab === "blades";
      const rows = blades ? this.shop.katanas : this.shopTab === "armor" ? this.shop.armors : [];
      this.input.uiRects = layoutShop(w, h, this.shopTab, rows.map((r) => r.id), blades ? "buy-katana-" : "buy-armor-");
    } else if (this.screen === "cheats") {
      const chrome = layoutBackChrome(w, h);
      const { rows, bodyY, bodyH } = layoutCheatRows(w, h, this.cheats.book.cheats.map((c) => c.id), this.cheatScroll);
      this.input.uiRects = [...chrome, ...rows.filter((r) => r.y + r.h > bodyY && r.y < bodyY + bodyH)];
    } else if (this.screen === "compendium" || this.screen === "gallery") {
      const chrome = layoutBackChrome(w, h);
      const { bodyY, bodyH } = browseBody(w, h);
      const laid = layoutBrowse(w, bodyY, bodyH, this.browseScroll, this.browse, this.screen === "gallery" ? "gallery" : "compendium");
      this.browseBodyY = bodyY;
      this.browseBodyH = bodyH;
      this.browseHeaders = laid.headers;
      this.thumbs = laid.thumbs.filter((t) => t.y + t.h > bodyY && t.y < bodyY + bodyH);
      this.input.uiRects = chrome;
    } else if (this.screen === "playing" && !this.struggle) {
      this.input.uiRects = this.paused ? [layoutPauseBtn(w, h), ...layoutPauseOverlay(w, h)] : [layoutPauseBtn(w, h)];
    }
  }
}
