import { catalogPaths, enemySpritePath, ImageBank, projectilePath, vfxPath } from "../lib/assets";
import {
  allLedges,
  climbLedge,
  landingLedge,
  layoutProps,
  ledgeUnder,
  mapPropImageEntries,
  roofLedgeY,
  type PlacedProp,
  type WorldLedge,
} from "../lib/map-props";
import { Sfx } from "../lib/audio";
import { Input, type InputFrame } from "../lib/input";
import {
  coinsFromPoints,
  enemyWeight,
  killPoints,
  nextSlashUpgradeCost,
  pickWeighted,
  pointsFromDistance,
  slashRecharge,
  spawnCap,
  speedLevelFor,
  struggleAfterTap,
} from "../lib/rules";
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

  w = 1280;
  h = 720;
  camY = 0;
  worldX = 0;
  distance = 0;
  runPoints = 0;
  runCoins = 0;
  hudCoinsFlash = 0;
  hp = 80;
  maxHp = 80;
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
  images = new ImageBank();
  time = 0;
  menuPulse = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    public ctx: CanvasRenderingContext2D,
  ) {
    this.input = new Input();
    this.input.attach(canvas);
  }

  async boot(): Promise<void> {
    const [game, enemies, shop, cinematics, mapProps] = await Promise.all([
      fetch("./data/game.json").then((r) => r.json() as Promise<GameConfig>),
      fetch("./data/enemies.json").then((r) => r.json() as Promise<EnemyCatalog>),
      fetch("./data/shop.json").then((r) => r.json() as Promise<ShopCatalog>),
      fetch("./data/cinematics.json").then((r) => r.json() as Promise<CinematicCatalog>),
      fetch("./assets/map-props/map-props.json").then((r) => r.json() as Promise<MapPropCatalog>),
    ]);
    this.cfg = game;
    this.enemies = enemies;
    this.shop = shop;
    this.cinematics = cinematics;
    this.mapProps = mapProps;
    this.save = loadSave(game.economy.starterCoins);
    if (new URLSearchParams(location.search).has("dojo")) this.unlockDojo();
    this.applyLoadout();
    const enemyIds = enemies.enemies.map((e) => e.id);
    const projectileIds = enemies.projectiles.map((p) => p.id);
    await this.images.load([...catalogPaths(enemyIds, projectileIds), ...mapPropImageEntries(mapProps.props)]);
  }

  unlockDojo(): void {
    this.save.coins = Math.max(this.save.coins, 4000);
    this.save.unlockedKatanas = [...new Set([...this.save.unlockedKatanas, ...this.shop.katanas.map((k) => k.id)])];
    this.save.unlockedArmors = [...new Set([...this.save.unlockedArmors, ...this.shop.armors.map((a) => a.id)])];
    this.save.equippedKatana = "whisper-blade";
    this.save.equippedArmor = "kitsunes-mirage";
    this.persist();
  }

  applyLoadout(): void {
    const armor = this.armor();
    this.maxHp = armor.hp;
    this.hp = Math.min(this.hp, this.maxHp);
  }

  katana(): KatanaDef {
    return this.shop.katanas.find((k) => k.id === this.save.equippedKatana) ?? this.shop.katanas[0];
  }

  armor(): ArmorDef {
    return this.shop.armors.find((a) => a.id === this.save.equippedArmor) ?? this.shop.armors[0];
  }

  hayate(): boolean {
    return this.katana().perk === "hayate" || this.armor().perk === "gale-dancer";
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
    return this.h * 1.72;
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
    const airborne = this.screen === "playing" && !this.onGround && !this.onRoof;
    const focus = this.playerY + this.playerH * (airborne ? 0.18 : 0.42);
    const keep = airborne ? 0.86 : 0.62;
    const desired = focus - this.h * keep;
    const maxCam = Math.max(0, this.mapH() - this.h);
    const target = Math.max(0, Math.min(maxCam, desired));
    const k = this.screen === "playing" ? 0.22 : 1;
    this.camY += (target - this.camY) * k;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(640, window.innerWidth);
    const h = Math.max(360, window.innerHeight);
    this.w = w;
    this.h = h;
    // Quarter of the visible playfield; the world map is taller than the view.
    this.playerH = Math.round(this.h * 0.25);
    const box = this.spriteBox("./assets/player/run.png", this.playerH);
    this.playerW = box.w;
    this.playerX = Math.round(w * 0.15);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.onGround) this.playerY = this.groundY() - this.playerH;
    if (this.onRoof) {
      const ledge = ledgeUnder(this.worldLedges(), this.feetX(), this.playerY + this.playerH, 24);
      this.playerY = (ledge?.y ?? this.roofY()) - this.playerH;
    }
    this.updateCamera();
  }

  startRun(): void {
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
    this.invuln = 1.5;
    this.slashCd = 0;
    this.slashFlash = 0;
    this.perkCd = {};
    this.vfx = [];
    this.shadeUntil = -1;
    this.pinkFlash = 0;
    this.applyLoadout();
    this.hp = this.maxHp;
    this.playerY = this.groundY() - this.playerH;
    this.camY = Math.max(0, this.mapH() - this.h);
    this.sfx.slash();
  }

  persist(): void {
    writeSave(this.save);
  }

  tick(dt: number): void {
    this.time += dt;
    this.menuPulse += dt;
    this.resizeButtons();
    const input = this.input.consume();
    if (this.screen === "playing") this.updatePlay(dt, input);
    else this.updateMeta(input);
    this.pinkFlash = Math.max(0, this.pinkFlash - dt);
    this.hudCoinsFlash = Math.max(0, this.hudCoinsFlash - dt);
    this.updateCamera();
    drawScene(this);
  }

  private updateMeta(input: InputFrame): void {
    const id = input.ui;
    if (this.screen === "menu") {
      if (id === "play") this.startRun();
      if (id === "shop") this.screen = "shop";
      if (id === "howto") this.screen = "howto";
    } else if (this.screen === "howto") {
      if (id === "back" || input.anyTap && !id) this.screen = "menu";
      if (id === "back") this.screen = "menu";
    } else if (this.screen === "shop") {
      if (id === "back") this.screen = "menu";
      if (id === "tab-blades") this.shopTab = "blades";
      if (id === "tab-armor") this.shopTab = "armor";
      if (id === "tab-slash") this.shopTab = "slash";
      if (id?.startsWith("buy-katana-")) this.buyKatana(id.slice(11));
      if (id?.startsWith("buy-armor-")) this.buyArmor(id.slice(10));
      if (id === "buy-slash") this.buySlash();
    } else if (this.screen === "gameover") {
      if (id === "retry") this.startRun();
      if (id === "shop") this.screen = "shop";
      if (id === "menu") this.screen = "menu";
      if (id === "revive") this.tryRevive();
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
    if (this.save.coins < item.cost) return;
    this.save.coins -= item.cost;
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
    if (this.save.coins < item.cost) return;
    this.save.coins -= item.cost;
    this.save.unlockedArmors.push(id);
    this.save.equippedArmor = id;
    this.applyLoadout();
    this.persist();
    this.sfx.coin();
  }

  buySlash(): void {
    const cost = nextSlashUpgradeCost(this.cfg, this.save.slashUpgrades);
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

  private standOn(y: number, roof: boolean): void {
    this.playerY = y - this.playerH;
    this.vy = 0;
    this.onGround = !roof;
    this.onRoof = roof;
    this.jumps = 0;
    this.holdingFirst = false;
    if (this.slam) this.slamBurst();
    this.slam = false;
  }

  private updatePlayer(dt: number, input: InputFrame, _run: number): void {
    const gY = this.groundY();
    const ledges = this.worldLedges();
    const H1 = this.h * this.cfg.jump.firstMaxHeightScreen;
    const T1 = this.cfg.jump.firstMaxAirSeconds;
    const gHold = (8 * H1) / (T1 * T1);
    const gFall = gHold * 2.35;
    const v1 = (4 * H1) / T1;

    if (input.swipe === "up") {
      const up = climbLedge(ledges, this.playerX, this.playerY + this.playerH, this.playerW);
      if (up) this.standOn(up.y, true);
    } else if (input.swipe === "down" && this.onRoof) {
      this.onRoof = false;
      this.onGround = false;
      this.vy = 220;
      this.jumps = 1;
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
      this.vy = -(4 * H2) / (T2 * 1.65);
      this.slam = false;
      this.sfx.doubleJump();
    }

    if (this.holdingFirst && input.jumpReleased) {
      this.holdingFirst = false;
      if (this.vy < 0) this.vy *= 0.28;
    }

    if (this.onRoof) {
      const stay = ledgeUnder(ledges, this.playerX, this.playerY + this.playerH, 18, this.playerW);
      if (stay) this.playerY = stay.y - this.playerH;
      else {
        this.onRoof = false;
        this.onGround = false;
        this.jumps = Math.max(1, this.jumps);
      }
    }

    if (!this.onGround && !this.onRoof) {
      const feetFrom = this.playerY + this.playerH;
      const g = this.holdingFirst && this.jumps === 1 ? gHold : gFall;
      this.vy += g * dt;
      this.playerY += this.vy * dt;
      const feetTo = this.playerY + this.playerH;
      if (this.vy >= 0 && !this.slam) {
        const hit = landingLedge(ledges, this.playerX, feetFrom, feetTo, this.playerW);
        if (hit) {
          this.standOn(hit.y, true);
          return;
        }
      }
      if (this.playerY >= gY - this.playerH) {
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
    if (this.distance < 20) return;
    if (this.distance - this.lastSpawnAt < this.cfg.spawn.minStaggerMeters) return;
    const windowStart = this.distance - this.cfg.spawn.windowMeters;
    this.spawnLog = this.spawnLog.filter((d) => d >= windowStart);
    if (this.spawnLog.length >= spawnCap(this.cfg, level)) return;

    const weights = this.enemies.enemies.map((e) => ({ id: e.id, weight: enemyWeight(e, level) }));
    const id = pickWeighted(weights, Math.random);
    if (!id) return;
    if (Math.random() > 0.55 + level * 0.04) return;
    this.spawnEnemy(id);
    const cap = spawnCap(this.cfg, level);
    const even = this.cfg.spawn.windowMeters / Math.max(1, cap);
    this.lastSpawnAt = this.distance + Math.random() * Math.max(0, even - this.cfg.spawn.minStaggerMeters);
    this.spawnLog.push(this.distance);
  }

  private def(id: string): EnemyDef {
    return this.enemies.enemies.find((e) => e.id === id) ?? this.enemies.enemies[0];
  }

  private projDef(id: string): ProjectileDef {
    return this.enemies.projectiles.find((p) => p.id === id) ?? this.enemies.projectiles[0];
  }

  private spawnEnemy(id: string): void {
    const def = this.def(id);
    const trap = def.role === "trap";
    const spriteH = this.playerH * (trap ? 0.38 : def.flying ? 0.9 : 1);
    const box = this.spriteBox(enemySpritePath(id, "idle"), spriteH);
    const eh = box.h;
    const ew = box.w;
    const flying = def.flying;
    const roof = !flying && !trap && Math.random() < 0.22;
    const highAir = flying && Math.random() < 0.42;
    const lane: Actor["lane"] = flying ? "air" : roof ? "roof" : "ground";
    const underGap = this.playerH * 0.3;
    const perch = lane === "roof" ? this.pickRoofPerch(ew) : null;
    const usedLane: Actor["lane"] = lane === "roof" && !perch ? "ground" : lane;
    const y =
      perch
        ? perch.y - eh
        : usedLane === "air" && highAir
          ? Math.max(12, this.roofY() - eh - this.playerH * 0.12)
          : usedLane === "air"
            ? this.groundY() - this.playerH - underGap - eh
            : this.groundY() - eh;
    this.actors.push({
      kind: "enemy",
      id: `e${nextActor++}`,
      defId: id,
      x: perch ? perch.x : this.w + 40 + Math.random() * 80,
      y,
      w: ew,
      h: eh,
      hp: def.hp,
      maxHp: def.hp,
      vx: def.approach,
      fireCd: (def.fireEvery ?? 2) * (0.4 + Math.random() * 0.4),
      lane: usedLane,
      jumpedOver: false,
      electrocuted: false,
    });
  }

  private pickRoofPerch(enemyW: number): { x: number; y: number } | null {
    const ledges = this.worldLedges().filter(
      (l) => l.standable && l.x1 > this.w * 0.55 && /roof|balcony|eave|lintel/.test(l.ledgeId),
    );
    if (!ledges.length) return null;
    const ledge = ledges[Math.floor(Math.random() * ledges.length)];
    const span = Math.max(8, ledge.x1 - ledge.x0 - enemyW);
    return { x: ledge.x0 + Math.random() * span, y: ledge.y };
  }

  private updateActors(dt: number, run: number, _level: number): void {
    const ledges = this.worldLedges();
    for (const a of this.actors) {
      a.x -= run * dt;
      if (a.kind === "enemy") {
        const def = this.def(a.defId);
        if (a.lane !== "roof") a.x -= def.approach * run * dt;
        if (a.lane === "roof") {
          const stay = ledgeUnder(ledges, a.x, a.y + a.h, 22, a.w);
          if (stay) a.y = stay.y - a.h;
          else {
            a.lane = "ground";
            a.y = this.groundY() - a.h;
          }
        }
        if (def.projectile && a.x < this.w * 0.92 && a.x > this.playerX + 80) {
          a.fireCd -= dt;
          if (a.fireCd <= 0) {
            this.fireProjectile(def.projectile, a);
            a.fireCd = def.fireEvery ?? 2.4;
          }
        }
      } else {
        const p = this.projDef(a.defId);
        a.x -= p.speed * dt * 0.35;
      }
    }
    this.actors = this.actors.filter((a) => a.x > -180 && a.hp > 0);
  }

  private fireProjectile(id: string, from: Actor): void {
    const def = this.projDef(id);
    const box = this.spriteBox(projectilePath(id), from.h * 0.5);
    this.actors.push({
      kind: "projectile",
      id: `p${nextActor++}`,
      defId: id,
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
      if (this.slashFlash > 0 && a.x < this.playerX + this.katana().range + 20) {
        this.hurtActor(a, 10, this.onRoof || this.slam);
        continue;
      }
      if (a.kind === "projectile") {
        const p = this.projDef(a.defId);
        a.hp = 0;
        this.beginStruggle(a.defId, p.name, "projectile", p.ticklePerSec);
        return;
      }
      const def = this.def(a.defId);
      if (def.role === "ranged") continue;
      this.beginStruggle(def.id, def.name, "enemy", def.ticklePerSec);
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
    const range = this.katana().range;
    const slashBox = { x: this.playerX, y: this.playerY, w: this.playerW + range, h: this.playerH };
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
      for (const a of this.actors) {
        if (a.x > this.playerX && a.x < this.w) this.hurtActor(a, 18, false);
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

  private hurtActor(a: Actor, dmg: number, roofKill: boolean): void {
    a.hp -= dmg;
    this.burst(a.x + a.w / 2, a.y + a.h / 2, a.kind === "enemy" ? this.def(a.defId).color : "#fff");
    this.sfx.hit();
    if (a.hp <= 0 && a.kind === "enemy") {
      const bonus = killPoints(this.def(a.defId).killBonus, roofKill || !!a.electrocuted, this.cfg.economy.roofKillMultiplier);
      this.runPoints += bonus;
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
      meter: 0,
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
  }

  private updateStruggle(dt: number, input: InputFrame): void {
    const s = this.struggle;
    if (!s) return;
    s.elapsed += dt;
    s.showCinematic = Math.max(0, s.showCinematic - dt);
    this.hp -= s.ticklePerSec * dt;
    const holding =
      input.jumpHeld || this.input.keys.has("Space") || this.input.keys.has("KeyW") || this.input.keys.has("Enter");
    if (input.struggleTap || input.jumpPressed || input.slash) {
      s.meter = struggleAfterTap(s.meter, this.cfg.struggle.tapGain, this.cfg.struggle.escapeAt);
      s.mashClock = 0;
    }
    if (holding) {
      s.mashClock += dt;
      if (s.mashClock >= 0.1) {
        s.mashClock = 0;
        s.meter = struggleAfterTap(s.meter, this.cfg.struggle.tapGain, this.cfg.struggle.escapeAt);
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
    if (this.hp <= 0 || s.elapsed >= this.cfg.struggle.maxHoldSeconds) {
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
    this.struggle = null;
    this.sfx.die();
  }

  resizeButtons(): void {
    const w = this.w;
    const h = this.h;
    this.input.slashRect = { x: w - 150, y: h - 150, w: 124, h: 124 };
    this.input.perkRects = this.manualPerks().map((id, i) => ({
      id,
      x: w - 150,
      y: h - 230 - i * 70,
      w: 124,
      h: 64,
    }));
    this.input.uiRects = [];
    if (this.screen === "menu") {
      const top = Math.max(h * 0.44, 150);
      this.input.uiRects = [
        { id: "play", x: w * 0.5 - 130, y: top, w: 260, h: 46 },
        { id: "shop", x: w * 0.5 - 130, y: top + 54, w: 260, h: 40 },
        { id: "howto", x: w * 0.5 - 130, y: top + 100, w: 260, h: 40 },
      ];
    } else if (this.screen === "howto") {
      this.input.uiRects = [{ id: "back", x: 16, y: 12, w: 100, h: 36 }];
    } else if (this.screen === "shop") {
      const rows = this.shopTab === "blades" ? this.shop.katanas : this.shopTab === "armor" ? this.shop.armors : [];
      const rects = [
        { id: "back", x: 16, y: 10, w: 100, h: 34 },
        { id: "tab-blades", x: 16, y: 50, w: 100, h: 32 },
        { id: "tab-armor", x: 122, y: 50, w: 100, h: 32 },
        { id: "tab-slash", x: 228, y: 50, w: 120, h: 32 },
      ];
      if (this.shopTab === "slash") {
        rects.push({ id: "buy-slash", x: 16, y: 228, w: 300, h: 44 });
      } else {
        const colW = Math.min(300, (w - 40) / 2);
        rows.forEach((row, i) => {
          const prefix = this.shopTab === "blades" ? "buy-katana-" : "buy-armor-";
          const col = i % 2;
          const rowI = Math.floor(i / 2);
          rects.push({
            id: prefix + row.id,
            x: 16 + col * (colW + 12),
            y: 90 + rowI * 46,
            w: colW,
            h: 42,
          });
        });
      }
      this.input.uiRects = rects;
    } else if (this.screen === "gameover") {
      const top = Math.min(h * 0.62, h - 190);
      const rects = [
        { id: "retry", x: w * 0.5 - 140, y: top, w: 280, h: 40 },
        { id: "shop", x: w * 0.5 - 140, y: top + 46, w: 280, h: 36 },
        { id: "menu", x: w * 0.5 - 140, y: top + 88, w: 280, h: 36 },
      ];
      if (!this.usedRevive) rects.unshift({ id: "revive", x: w * 0.5 - 140, y: top - 46, w: 280, h: 40 });
      this.input.uiRects = rects;
    }
  }
}
