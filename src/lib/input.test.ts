import { describe, expect, it } from "vitest";
import { hitRect, pointerToView } from "./input";
import { isTruePortrait, layoutMenu, layoutPlayControls, layoutShop, thumbHit } from "./touch-layout";
import { standTop } from "./map-props";

describe("pointerToView uses draw/view space, not the DPR buffer", () => {
  const viewW = 844;
  const viewH = 390;
  const css = { left: 0, top: 0, width: viewW, height: viewH };
  const slash = { x: 748, y: 294, w: 84, h: 84 };
  const play = { x: 282, y: 195, w: 280, h: 56 };

  it("maps a tap on the painted Slash button to the Slash hitbox (iPhone landscape, 3x DPR)", () => {
    const bufferW = viewW * 3;
    const bufferH = viewH * 3;
    const clientX = slash.x + slash.w / 2;
    const clientY = slash.y + slash.h / 2;
    const view = pointerToView(clientX, clientY, css, viewW, viewH);
    expect(hitRect(view.x, view.y, slash)).toBe(true);

    const wrong = pointerToView(clientX, clientY, css, bufferW, bufferH);
    expect(hitRect(wrong.x, wrong.y, slash)).toBe(false);
    expect(wrong.x).toBeCloseTo(clientX * 3);
  });

  it("maps a tap on the painted Start button to play", () => {
    const view = pointerToView(play.x + play.w / 2, play.y + play.h / 2, css, viewW, viewH);
    expect(hitRect(view.x, view.y, play)).toBe(true);
    const menu = layoutMenu(viewW, viewH);
    const start = menu.find((r) => r.id === "play")!;
    const tap = pointerToView(start.x + start.w / 2, start.y + start.h / 2, css, viewW, viewH);
    expect(hitRect(tap.x, tap.y, start)).toBe(true);
    expect(menu.map((r) => r.id)).toEqual(["play", "shop", "compendium", "gallery", "cheats", "howto"]);
    for (const r of menu) {
      expect(r.h).toBeGreaterThanOrEqual(48);
      expect(r.w).toBeGreaterThanOrEqual(132);
    }
  });

  it("keeps thumb targets at least 56 CSS pixels", () => {
    expect(thumbHit(844, 390)).toBeGreaterThanOrEqual(56);
    const { slash, perks } = layoutPlayControls(844, 390, ["shadow-strike"]);
    expect(slash.w).toBeGreaterThanOrEqual(72);
    expect(slash.h).toBeGreaterThanOrEqual(72);
    expect(perks[0].h).toBeGreaterThanOrEqual(48);
    expect(slash.x + slash.w).toBeLessThanOrEqual(844);
    expect(slash.y + slash.h).toBeLessThanOrEqual(390);
  });

  it("lays out Katanas / Armors / Techniques / Upgrades as thumb-sized shop tabs", () => {
    const shop = layoutShop(844, 390, "techniques", ["kunai", "bow", "flying-boost", "shadow-strike", "ethereal"], "buy-tech-");
    expect(shop.map((r) => r.id).filter((id) => !id.startsWith("buy-"))).toEqual([
      "back",
      "tab-blades",
      "tab-armor",
      "tab-techniques",
      "tab-upgrades",
    ]);
    const tabs = shop.filter((r) => r.id.startsWith("tab-"));
    expect(tabs).toHaveLength(4);
    for (const r of tabs) {
      expect(r.h).toBeGreaterThanOrEqual(48);
      expect(r.w).toBeGreaterThanOrEqual(64);
    }
    const tech = tabs.find((r) => r.id === "tab-techniques")!;
    const up = tabs.find((r) => r.id === "tab-upgrades")!;
    expect(tech.y).toBe(up.y);
    expect(tech.x + tech.w).toBeLessThanOrEqual(up.x);
    const perks = layoutPlayControls(844, 390, ["kunai", "bow", "flying-boost", "shadow-strike", "ethereal"]);
    expect(perks.perks).toHaveLength(5);
    for (const p of perks.perks) expect(p.h).toBeGreaterThanOrEqual(48);
  });

  it("only treats real portrait as the rotate case", () => {
    expect(isTruePortrait(390, 844)).toBe(true);
    expect(isTruePortrait(844, 390)).toBe(false);
    expect(isTruePortrait(1280, 720)).toBe(false);
  });
});

describe("standTop", () => {
  it("places visible soles on the ledge Y", () => {
    expect(standTop(400, 100, 1)).toBe(300);
    expect(standTop(400, 100, 0.92)).toBeCloseTo(308);
    expect(400 - (308 + 100 * 0.92)).toBeCloseTo(0);
  });
});
