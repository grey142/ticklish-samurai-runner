import { nextSlashUpgradeCost, speedLevelFor } from "../lib/rules";
import type { Game } from "./Game";

export function drawScene(g: Game): void {
  const { ctx, w, h } = g;
  ctx.clearRect(0, 0, w, h);
  drawCity(g);
  if (g.screen === "playing" || g.screen === "gameover") {
    drawActors(g);
    drawPlayer(g);
    drawParticles(g);
  }
  if (g.pinkFlash > 0) {
    ctx.fillStyle = `rgba(255, 70, 150, ${0.28 * (g.pinkFlash / 0.22)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (g.screen === "menu") drawMenu(g);
  else if (g.screen === "howto") drawHowto(g);
  else if (g.screen === "shop") drawShop(g);
  else if (g.screen === "playing") {
    drawHud(g);
    if (g.struggle) drawStruggle(g);
  } else if (g.screen === "gameover") drawGameOver(g);
}

function drawCity(g: Game): void {
  const { ctx, w, h } = g;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#14081c");
  sky.addColorStop(0.45, "#2a1230");
  sky.addColorStop(1, "#1a1014");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#f3e0b8";
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.16, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(243,224,184,0.12)";
  ctx.beginPath();
  ctx.arc(w * 0.82, h * 0.16, 70, 0, Math.PI * 2);
  ctx.fill();

  const scroll = g.worldX;
  drawSilhouette(ctx, w, h, scroll * 0.18, h * 0.42, "#1b0e22", 1);
  drawSilhouette(ctx, w, h, scroll * 0.35, h * 0.5, "#241328", 0.7);
  lanterns(ctx, w, h, scroll);

  ctx.fillStyle = "#2a1a16";
  ctx.fillRect(0, g.groundY(), w, h - g.groundY());
  ctx.fillStyle = "#3a241c";
  ctx.fillRect(0, g.groundY(), w, 8);
  ctx.fillStyle = "rgba(80,40,30,0.55)";
  const tile = 48;
  const off = scroll % tile;
  for (let x = -tile; x < w + tile; x += tile) {
    ctx.fillRect(x - off, g.groundY() + 10, tile - 8, 6);
  }

  ctx.strokeStyle = "rgba(180,90,60,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, g.roofY());
  ctx.lineTo(w, g.roofY());
  ctx.stroke();
  ctx.fillStyle = "rgba(90,40,50,0.25)";
  ctx.fillRect(0, g.roofY() - 10, w, 10);
}

function drawSilhouette(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number, base: number, color: string, scale: number): void {
  ctx.fillStyle = color;
  const span = 220 * scale;
  const off = scroll % (span * 3);
  for (let i = -1; i < w / span + 3; i++) {
    const x = i * span - off;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, base + 40);
    ctx.lineTo(x + 20, base + 10);
    ctx.lineTo(x + 40, base + 40);
    ctx.lineTo(x + 50, base);
    ctx.lineTo(x + 80, base - 50 * scale);
    ctx.lineTo(x + 110, base);
    ctx.lineTo(x + 140, base + 20);
    ctx.lineTo(x + 160, base - 20);
    ctx.lineTo(x + 190, base + 30);
    ctx.lineTo(x + span, h);
    ctx.fill();
    ctx.fillRect(x + 70, base - 80 * scale, 8, 30 * scale);
  }
}

function lanterns(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number): void {
  const gap = 180;
  const off = (scroll * 0.55) % gap;
  for (let x = -40; x < w + 80; x += gap) {
    const px = x - off;
    ctx.fillStyle = "rgba(20,10,12,0.8)";
    ctx.fillRect(px + 18, h * 0.22, 3, h * 0.4);
    ctx.fillStyle = "#ff6a3a";
    ctx.beginPath();
    ctx.ellipse(px + 20, h * 0.34, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,140,60,0.15)";
    ctx.beginPath();
    ctx.arc(px + 20, h * 0.36, 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(g: Game): void {
  const { ctx } = g;
  const x = g.playerX;
  const y = g.playerY;
  const t = g.time;
  const bob = g.onGround || g.onRoof ? Math.sin(t * 10) * 2 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  if (g.invuln > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;

  // silver crop armor, bare midriff, long hair, barefoot
  ctx.fillStyle = "#1a1210";
  ctx.fillRect(10, 8, 28, 36);
  ctx.beginPath();
  ctx.fillStyle = "#f0c8a8";
  ctx.arc(24, 16, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(12, 6, 24, 10);
  ctx.fillRect(8, 12, 10, 22);

  ctx.fillStyle = "#cfd6de";
  ctx.fillRect(8, 30, 32, 16);
  ctx.fillStyle = "#8b1e2e";
  ctx.fillRect(8, 44, 32, 3);
  ctx.fillStyle = "#e8b496";
  ctx.fillRect(12, 47, 24, 14);
  ctx.fillStyle = "#cfd6de";
  ctx.fillRect(10, 60, 28, 18);
  ctx.fillStyle = "#2a1c18";
  ctx.fillRect(14, 76, 8, 16);
  ctx.fillRect(26, 76, 8, 16);
  ctx.fillStyle = "#e8b496";
  ctx.fillRect(14, 90, 8, 5);
  ctx.fillRect(26, 90, 8, 5);

  ctx.fillStyle = "#cfd6de";
  ctx.fillRect(-2, 32, 12, 10);
  ctx.fillRect(36, 32, 12, 10);

  if (g.slashFlash > 0) {
    ctx.strokeStyle = "#f4e7d8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(56, 40, 34, -0.8, 0.9);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#d0d5dc";
    ctx.fillRect(40, 18, 4, 52);
    ctx.fillStyle = "#9aa3ae";
    ctx.fillRect(38, 14, 8, 10);
  }
  ctx.restore();
}

function drawActors(g: Game): void {
  for (const a of g.actors) {
    if (a.kind === "enemy") drawEnemy(g, a.defId, a.x, a.y, a.w, a.h, a.hp / a.maxHp);
    else drawProjectile(g, a.defId, a.x, a.y, a.w, a.h);
  }
}

function drawEnemy(g: Game, id: string, x: number, y: number, w: number, h: number, hp: number): void {
  const def = g.enemies.enemies.find((e) => e.id === id);
  const { ctx } = g;
  const color = def?.color ?? "#6aa86a";
  const accent = def?.accent ?? "#243";
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  if (id === "viner") {
    ctx.fillRect(0, h * 0.45, w, h * 0.55);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(8 + i * 16, h);
      ctx.quadraticCurveTo(20 + i * 10, 0, w - 8, 8);
      ctx.stroke();
    }
  } else if (id === "spider") {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.38, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo((i % 2 === 0 ? -8 : w + 8), 8 + i * 10);
      ctx.stroke();
    }
  } else if (id === "hundred-hands") {
    ctx.fillRect(w * 0.25, 8, w * 0.5, h - 10);
    ctx.fillStyle = accent;
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(-6 + (i % 5) * 18, 12 + (i % 3) * 22, 14, 8);
    }
  } else if (id === "licker") {
    ctx.fillRect(8, 6, w - 16, h - 8);
    ctx.fillStyle = "#ff8ab0";
    ctx.fillRect(-30, h * 0.45, 38, 8);
  } else if (id === "brute" || id === "volatile") {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.46, h * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(w * 0.2, 8, w * 0.6, 16);
  } else {
    ctx.fillRect(4, 8, w - 8, h - 10);
    ctx.fillStyle = accent;
    ctx.fillRect(8, 0, w - 16, 16);
    ctx.fillStyle = "#f0c8a8";
    ctx.beginPath();
    ctx.arc(w / 2, 14, 8, 0, Math.PI * 2);
    ctx.fill();
    if (id === "quad-arm") {
      ctx.fillStyle = color;
      ctx.fillRect(-10, 28, 16, 8);
      ctx.fillRect(w - 6, 28, 16, 8);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(4, h - 6, w - 8, 4);
  ctx.fillStyle = "#3d1";
  ctx.fillRect(6, 4, (w - 12) * hp, 4);
  ctx.restore();
}

function drawProjectile(g: Game, id: string, x: number, y: number, w: number, h: number): void {
  const p = g.enemies.projectiles.find((d) => d.id === id);
  const { ctx } = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = p?.color ?? "#fff";
  if (id === "egg-web") {
    ctx.strokeStyle = "#e8e8f0";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 4 + i * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#111";
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(4 + (i % 4) * 10, 6 + Math.floor(i / 4) * 12, 3, 3);
    }
  } else if (id === "bolo-wrap") {
    ctx.fillRect(0, h * 0.3, w, 5);
    ctx.fillRect(2, 2, 6, h - 4);
    ctx.fillRect(w - 8, 2, 6, h - 4);
  } else if (id === "throwing-hand") {
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.45, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.7, 4, 5, 14);
  } else {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(g: Game): void {
  const { ctx } = g;
  for (const p of g.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawHud(g: Game): void {
  const { ctx, w } = g;
  const { level } = speedLevelFor(g.distance, g.cfg);
  panel(ctx, 16, 12, 300, 58, "rgba(10,6,12,0.62)");
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "700 16px Trebuchet MS, sans-serif";
  ctx.fillText(`${Math.floor(g.distance)} m  ·  L${level}`, 28, 34);
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillStyle = g.hudCoinsFlash > 0 ? "#ffe08a" : "#d9b88c";
  ctx.fillText(`${g.save.coins + g.runCoins} coins  ·  +${g.runCoins} this run`, 28, 54);

  panel(ctx, 16, 76, 220, 18, "rgba(10,6,12,0.55)");
  ctx.fillStyle = "#6d2038";
  ctx.fillRect(18, 78, 216, 14);
  ctx.fillStyle = "#ff4d8d";
  ctx.fillRect(18, 78, 216 * (g.hp / g.maxHp), 14);
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "11px Trebuchet MS, sans-serif";
  ctx.fillText(`HP ${Math.max(0, Math.ceil(g.hp))}/${g.maxHp}`, 24, 90);

  const slash = g.input.slashRect;
  const ready = g.slashCd <= 0;
  ctx.fillStyle = ready ? "rgba(255, 77, 141, 0.85)" : "rgba(40,20,28,0.8)";
  round(ctx, slash.x, slash.y, slash.w, slash.h, 28);
  ctx.fill();
  ctx.strokeStyle = "#f4e7d8";
  ctx.lineWidth = 2;
  round(ctx, slash.x, slash.y, slash.w, slash.h, 28);
  ctx.stroke();
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "700 18px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SLASH", slash.x + slash.w / 2, slash.y + 58);
  ctx.font = "12px Trebuchet MS, sans-serif";
  ctx.fillText(ready ? "ready" : g.slashCd.toFixed(1) + "s", slash.x + slash.w / 2, slash.y + 80);
  ctx.textAlign = "left";

  for (const p of g.input.perkRects) {
    const cd = g.perkCd[p.id] ?? 0;
    ctx.fillStyle = cd > 0 ? "rgba(20,16,28,0.75)" : "rgba(90,70,160,0.85)";
    round(ctx, p.x, p.y, p.w, p.h, 12);
    ctx.fill();
    ctx.fillStyle = "#f4e7d8";
    ctx.font = "11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.id.replace(/-/g, " "), p.x + p.w / 2, p.y + 28);
    if (cd > 0) ctx.fillText(cd.toFixed(1), p.x + p.w / 2, p.y + 46);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(244,231,216,0.45)";
  ctx.font = "11px Trebuchet MS, sans-serif";
  ctx.fillText("tap jump · hold first jump · swipe up roof · swipe down slam", 16, g.h - 16);
  void w;
}

function drawStruggle(g: Game): void {
  const { ctx, w, h } = g;
  const s = g.struggle;
  if (!s) return;
  ctx.fillStyle = "rgba(40, 8, 24, 0.45)";
  ctx.fillRect(0, 0, w, h);

  panel(ctx, w * 0.18, 24, w * 0.64, 92, "rgba(20,6,14,0.82)");
  ctx.fillStyle = "#ffb0d0";
  ctx.font = "700 20px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`STRUGGLE  ·  ${s.sourceName}`, w / 2, 54);
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#f4e7d8";
  ctx.fillText("MASH  +6 / 100   ·   she keeps getting tickled", w / 2, 78);
  ctx.textAlign = "left";
  ctx.fillStyle = "#3a1020";
  ctx.fillRect(w * 0.22, 90, w * 0.56, 16);
  ctx.fillStyle = "#ff4d8d";
  ctx.fillRect(w * 0.22, 90, w * 0.56 * (s.meter / 100), 16);

  drawIkielaPose(ctx, w * 0.5 - 70, h * 0.34, false);

  if (s.showCinematic > 0) {
    panel(ctx, w * 0.14, h * 0.22, w * 0.72, h * 0.42, "rgba(12,6,14,0.9)");
    drawIkielaPose(ctx, w * 0.22, h * 0.3, false);
    ctx.fillStyle = "#ffb0d0";
    ctx.font = "700 16px Trebuchet MS, sans-serif";
    ctx.fillText(`Beat ${s.beat + 1} / 3`, w * 0.42, h * 0.32);
    ctx.fillStyle = "#f4e7d8";
    ctx.font = "16px Trebuchet MS, sans-serif";
    wrapText(ctx, s.lines[s.beat] ?? g.cinematics.beats[s.beat], w * 0.42, h * 0.38, w * 0.4, 22);
  }
}

function drawGameOver(g: Game): void {
  const { ctx, w, h } = g;
  ctx.fillStyle = "rgba(10,4,10,0.55)";
  ctx.fillRect(0, 0, w, h);
  panel(ctx, w * 0.16, 20, w * 0.68, h * 0.58, "rgba(18,6,12,0.9)");
  ctx.fillStyle = "#ff4d8d";
  ctx.font = "700 28px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LAUGHED OUT", w / 2, 56);
  drawIkielaPose(ctx, w * 0.22, 80, true);
  ctx.textAlign = "left";
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "16px Trebuchet MS, sans-serif";
  wrapText(ctx, g.overLine, w * 0.42, 110, w * 0.36, 22);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#d9b88c";
  ctx.fillText(`${Math.floor(g.distance)} m   +${g.runCoins} coins`, w * 0.42, 210);
  ctx.fillText(`Bank: ${g.save.coins}   Best: ${g.save.bestDistance} m`, w * 0.42, 232);

  button(ctx, g, "revive", !g.usedRevive && g.save.coins >= g.cfg.economy.reviveCost ? "Revive  300 coins" : "Revive locked");
  button(ctx, g, "retry", "Run again");
  button(ctx, g, "shop", "Shop");
  button(ctx, g, "menu", "Title");
}

function drawMenu(g: Game): void {
  const { ctx, w, h } = g;
  ctx.fillStyle = "rgba(10,6,14,0.35)";
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff4d8d";
  ctx.font = "700 42px Trebuchet MS, sans-serif";
  ctx.fillText("TICKLISH SAMURAI RUNNER", w / 2, h * 0.22);
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "18px Trebuchet MS, sans-serif";
  ctx.fillText("Ikiela vs. the tickle-zombies of the old imperial city", w / 2, h * 0.3);
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#d9b88c";
  ctx.fillText(`${g.save.coins} coins in the sash  ·  best ${g.save.bestDistance} m`, w / 2, h * 0.36);
  ctx.textAlign = "left";
  drawIkielaPose(ctx, w * 0.08, h * 0.42, false);
  button(ctx, g, "play", "Run");
  button(ctx, g, "shop", "Shop");
  button(ctx, g, "howto", "How to play");
}

function drawHowto(g: Game): void {
  const { ctx, w, h } = g;
  ctx.fillStyle = "rgba(10,6,14,0.72)";
  ctx.fillRect(0, 0, w, h);
  panel(ctx, 40, 70, w - 80, h - 110, "rgba(16,8,16,0.88)");
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "700 24px Trebuchet MS, sans-serif";
  ctx.fillText("Thumb rules", 64, 110);
  ctx.font = "16px Trebuchet MS, sans-serif";
  const lines = [
    "Always runs right. No pause — only a grab or a game-over stops her.",
    "Tap = jump (~half screen, ~3s if held). Release early to drop. Second tap = double jump.",
    "Swipe down in air = slam. Swipe up = climb roofs. Swipe down on a roof = drop. No fall damage.",
    "SLASH is the right-hand button. Base 1.5s. Shop cuts 0.2s ×5. Hayate halves the final recharge.",
    "Grab / egg-web / bolo / slime / thrown hand = struggle. Mash +6 to 100 before 16s or HP 0.",
    "Pink flash + laugh every second. Cinematic every 4s. Roof-jump kills pay double.",
    "1 point / 6 m. 1 coin / 6 points. Revive once per run for 300 coins.",
    "Desktop: Space/W jump, S slam, C climb, J slash, 1/2/3 perks.",
  ];
  lines.forEach((line, i) => ctx.fillText(line, 64, 150 + i * 28));
  button(ctx, g, "back", "Back");
}

function drawShop(g: Game): void {
  const { ctx, w, h } = g;
  ctx.fillStyle = "rgba(10,6,14,0.78)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "700 26px Trebuchet MS, sans-serif";
  ctx.fillText("Night Market", 160, 46);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#d9b88c";
  ctx.fillText(`${g.save.coins} coins`, 400, 46);
  button(ctx, g, "back", "Back");
  button(ctx, g, "tab-blades", g.shopTab === "blades" ? "• Blades" : "Blades");
  button(ctx, g, "tab-armor", g.shopTab === "armor" ? "• Armor" : "Armor");
  button(ctx, g, "tab-slash", g.shopTab === "slash" ? "• Slash CD" : "Slash CD");

  if (g.shopTab === "slash") {
    const cost = nextSlashUpgradeCost(g.cfg, g.save.slashUpgrades);
    const hayate = g.hayate();
    panel(ctx, 16, 96, 420, 120, "rgba(20,10,16,0.88)");
    ctx.fillStyle = "#f4e7d8";
    ctx.font = "15px Trebuchet MS, sans-serif";
    ctx.fillText(`Upgrades ${g.save.slashUpgrades}/5`, 28, 122);
    ctx.fillText(`Recharge now: ${g.recharge().toFixed(2)}s${hayate ? " (Hayate ×0.5)" : ""}`, 28, 146);
    ctx.fillText(cost == null ? "Maxed." : `Next: ${cost} coins (−0.2s)`, 28, 168);
    button(ctx, g, "buy-slash", cost == null ? "Maxed" : `Buy upgrade  ${cost}`);
  } else if (g.shopTab === "blades") {
    g.shop.katanas.forEach((k) => {
      const owned = g.save.unlockedKatanas.includes(k.id);
      const eq = g.save.equippedKatana === k.id;
      const label = `${eq ? "★ " : ""}${k.name}  ·  reach ${k.range}${owned ? "" : "  ·  " + k.cost + "c"}`;
      button(ctx, g, "buy-katana-" + k.id, label);
    });
  } else {
    g.shop.armors.forEach((a) => {
      const owned = g.save.unlockedArmors.includes(a.id);
      const eq = g.save.equippedArmor === a.id;
      const label = `${eq ? "★ " : ""}${a.name}  ·  ${a.hp} HP${owned ? "" : "  ·  " + a.cost + "c"}`;
      button(ctx, g, "buy-armor-" + a.id, label);
    });
  }
}

function button(ctx: CanvasRenderingContext2D, g: Game, id: string, label: string): void {
  const box = g.input.uiRects.find((r) => r.id === id);
  if (!box) return;
  ctx.fillStyle = "rgba(255,77,141,0.22)";
  round(ctx, box.x, box.y, box.w, box.h, 10);
  ctx.fill();
  ctx.strokeStyle = "#ff4d8d";
  ctx.lineWidth = 1.5;
  round(ctx, box.x, box.y, box.w, box.h, 10);
  ctx.stroke();
  ctx.fillStyle = "#f4e7d8";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, box.x + box.w / 2, box.y + box.h / 2 + 5);
  ctx.textAlign = "left";
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill;
  round(ctx, x, y, w, h, 12);
  ctx.fill();
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number): void {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawIkielaPose(ctx: CanvasRenderingContext2D, x: number, y: number, bikini: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#111";
  ctx.fillRect(28, 8, 50, 70);
  ctx.fillStyle = "#f0c8a8";
  ctx.beginPath();
  ctx.arc(52, 28, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(34, 8, 40, 16);
  if (bikini) {
    ctx.fillStyle = "#c81e3a";
    ctx.fillRect(34, 52, 38, 12);
    ctx.fillRect(38, 86, 30, 10);
    ctx.fillStyle = "#e8b496";
    ctx.fillRect(36, 64, 34, 22);
  } else {
    ctx.fillStyle = "#cfd6de";
    ctx.fillRect(30, 50, 46, 22);
    ctx.fillStyle = "#e8b496";
    ctx.fillRect(36, 72, 34, 16);
    ctx.fillStyle = "#cfd6de";
    ctx.fillRect(32, 88, 42, 20);
  }
  ctx.fillStyle = "#e8b496";
  ctx.fillRect(38, 128, 10, 16);
  ctx.fillRect(58, 128, 10, 16);
  ctx.restore();
}
