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
  KatanaDef,
  Particle,
  ProjectileDef,
  SaveData,
  Screen,
  ShopCatalog,
  StruggleState,
} from "../types";
import { drawScene } from "./render";

let nextActor = 1;

export class Game {
  cfg!: GameConfig;
  enemies!: EnemyCatalog;
  shop!: ShopCatalog;
  cinematics!: CinematicCatalog;
  save!: SaveData;
  input: Input;
  sfx = new Sfx();
  screen: Screen = "menu";
  shopTab: "blades" | "armor" | "slash" = "blades";
  shopScroll = 0;

  w = 1280;
  h = 720;
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
  actors: Actor[] = [];
  particles: Particle[] = [];
  spawnLog: number[] = [];
  lastSpawnAt = -999;
  struggle: StruggleState | null = null;
  pinkFlash = 0;
  usedRevive = false;
  overSource = "drone";
  overLine = "";
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
    const [game, enemies, shop, cinematics] = await Promise.all([
      fetch("./data/game.json").then((r) => r.json() as Promise<GameConfig>),
      fetch("./data/enemies.json").then((r) => r.json() as Promise<EnemyCatalog>),
      fetch("./data/shop.json").then((r) => r.json() as Promise<ShopCatalog>),
      fetch("./data/cinematics.json").then((r) => r.json() as Promise<CinematicCatalog>),
    ]);
    this.cfg = game;
    this.enemies = enemies;
    this.shop = shop;
    this.cinematics = cinematics;
    this.save = loadSave(game.economy.starterCoins);
    this.applyLoadout();
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
    return this.katana().perk === "hayate";
  }

  recharge(): number {
    return slashRecharge(this.cfg, this.save.slashUpgrades, this.hayate());
  }

  groundY(): number {
    return this.h * 0.8;
  }

  roofY(): number {
    return this.h * 0.4;
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(640, window.innerWidth);
    const h = Math.max(360, window.innerHeight);
    this.w = w;
    this.h = h;
    this.playerH = Math.round(h * 0.26);
    this.playerW = Math.round(this.playerH * 0.5);
    this.playerX = Math.round(w * 0.15);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.onGround) this.playerY = this.groundY() - this.playerH;
    if (this.onRoof) this.playerY = this.roofY() - this.playerH;
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
    this.pinkFlash = 0;
    this.applyLoadout();
    this.hp = this.maxHp;
    this.playerY = this.groundY() - this.playerH;
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
    this.resolveCombat();
    this.slashCd = Math.max(0, this.slashCd - dt);
    this.slashFlash = Math.max(0, this.slashFlash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    for (const k of Object.keys(this.perkCd)) this.perkCd[k] = Math.max(0, this.perkCd[k] - dt);
    this.updateParticles(dt);
  }

  private updatePlayer(dt: number, input: InputFrame, _run: number): void {
    const gY = this.groundY();
    const rY = this.roofY();
    const H1 = this.h * this.cfg.jump.firstMaxHeightScreen;
    const T1 = this.cfg.jump.firstMaxAirSeconds;
    const gHold = (8 * H1) / (T1 * T1);
    const gFall = gHold * 2.35;
    const v1 = (4 * H1) / T1;

    if (input.swipe === "up" && !this.onGround) {
      this.onRoof = true;
      this.onGround = false;
      this.playerY = rY - this.playerH;
      this.vy = 0;
      this.jumps = 0;
      this.slam = false;
      this.holdingFirst = false;
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

    if (!this.onGround && !this.onRoof) {
      const g = this.holdingFirst && this.jumps === 1 ? gHold : gFall;
      this.vy += g * dt;
      this.playerY += this.vy * dt;
      const floor = (this.onRoof ? rY : gY) - this.playerH;
      if (this.playerY >= gY - this.playerH) {
        this.playerY = gY - this.playerH;
        this.vy = 0;
        this.onGround = true;
        this.jumps = 0;
        this.holdingFirst = false;
        if (this.slam) this.slamBurst();
        this.slam = false;
      }
      const ceiling = this.h * 0.04;
      if (this.playerY < ceiling) {
        this.playerY = ceiling;
        if (this.vy < 0) this.vy = 0;
      }
      void floor;
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
    const windowStart = this.distance - 100;
    this.spawnLog = this.spawnLog.filter((d) => d >= windowStart);
    if (this.spawnLog.length >= spawnCap(this.cfg, level)) return;

    const weights = this.enemies.enemies.map((e) => ({ id: e.id, weight: enemyWeight(e, level) }));
    const id = pickWeighted(weights, Math.random);
    if (!id) return;
    if (Math.random() > 0.55 + level * 0.04) return;
    this.spawnEnemy(id);
    this.lastSpawnAt = this.distance;
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
    const s = this.h / 720;
    const ew = def.w * s * 1.25;
    const eh = def.h * s * 1.25;
    const flying = def.flying;
    const roof = !flying && Math.random() < 0.18 && def.role !== "trap";
    const lane: Actor["lane"] = flying ? "air" : roof ? "roof" : "ground";
    const y =
      lane === "roof"
        ? this.roofY() - eh
        : lane === "air"
          ? this.groundY() - eh - this.playerH * 1.05
          : this.groundY() - eh;
    this.actors.push({
      kind: "enemy",
      id: `e${nextActor++}`,
      defId: id,
      x: this.w + 40 + Math.random() * 80,
      y,
      w: ew,
      h: eh,
      hp: def.hp,
      maxHp: def.hp,
      vx: def.approach,
      fireCd: (def.fireEvery ?? 2) * (0.4 + Math.random() * 0.4),
      lane,
    });
  }

  private updateActors(dt: number, run: number, _level: number): void {
    for (const a of this.actors) {
      a.x -= run * dt;
      if (a.kind === "enemy") {
        const def = this.def(a.defId);
        a.x -= def.approach * run * dt;
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
    const p = this.projDef(id);
    const s = this.h / 720;
    this.actors.push({
      kind: "projectile",
      id: `p${nextActor++}`,
      defId: id,
      x: from.x - 10,
      y: from.y + from.h * 0.35,
      w: p.w * s * 1.2,
      h: p.h * s * 1.2,
      hp: 1,
      maxHp: 1,
      vx: p.speed,
      fireCd: 0,
      lane: from.lane,
    });
  }

  private playerBox(): { x: number; y: number; w: number; h: number } {
    return { x: this.playerX + 8, y: this.playerY + 10, w: this.playerW - 12, h: this.playerH - 14 };
  }

  private overlaps(
    a: { x: number; y: number; w: number; h: number },
    b: { x: number; y: number; w: number; h: number },
  ): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  private resolveCombat(): void {
    if (this.invuln > 0 || this.struggle) return;
    const pb = this.playerBox();
    for (const a of this.actors) {
      const pad = a.kind === "enemy" ? this.def(a.defId).grabRange ?? 0 : 0;
      const box = { x: a.x - pad * 0.25, y: a.y, w: a.w + pad * 0.25, h: a.h };
      if (!this.overlaps(pb, box)) continue;
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
    const range = this.katana().range;
    for (const a of this.actors) {
      if (a.x < this.playerX - 20 || a.x > this.playerX + range + a.w) continue;
      const verticalOk = Math.abs(a.y + a.h / 2 - (this.playerY + this.playerH / 2)) < this.h * 0.28;
      if (!verticalOk) continue;
      this.hurtActor(a, 10, this.onRoof);
    }
  }

  private tryPerk(id: string): void {
    const perk = this.katana().perk;
    if (perk !== id) return;
    if ((this.perkCd[id] ?? 0) > 0 || this.struggle) return;
    const def = this.shop.perks.find((p) => p.id === id);
    if (!def || !def.manual) return;
    this.perkCd[id] = def.cooldown;
    this.sfx.perk();
    if (id === "shadow-strike") {
      this.invuln = 0.45;
      for (const a of this.actors) {
        if (a.x > this.playerX - 30 && a.x < this.playerX + 260) this.hurtActor(a, 16, this.onRoof);
      }
    } else if (id === "call-lightning") {
      for (const a of this.actors) {
        if (a.kind === "enemy" && a.x < this.w) this.hurtActor(a, 14, false);
      }
    } else if (id === "blade-of-souls") {
      for (const a of this.actors) {
        if (a.x > this.playerX && a.x < this.w) this.hurtActor(a, 18, false);
      }
    }
  }

  private hurtActor(a: Actor, dmg: number, roofKill: boolean): void {
    a.hp -= dmg;
    this.burst(a.x + a.w / 2, a.y + a.h / 2, a.kind === "enemy" ? this.def(a.defId).color : "#fff");
    this.sfx.hit();
    if (a.hp <= 0 && a.kind === "enemy") {
      const bonus = killPoints(this.def(a.defId).killBonus, roofKill, this.cfg.economy.roofKillMultiplier);
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
      showCinematic: 0,
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
    const perk = this.katana().perk;
    this.input.perkRects = [];
    if (perk && perk !== "hayate") {
      this.input.perkRects.push({ id: perk, x: w - 150, y: h - 230, w: 124, h: 64 });
    }
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
          const col = i < 4 ? 0 : 1;
          const rowI = i < 4 ? i : i - 4;
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
