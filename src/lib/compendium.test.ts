import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetUrl, buildBrowseGroups, displayName, layoutBrowse, parseCompendium } from "./compendium";

const raw = JSON.parse(readFileSync("public/data/compendium.json", "utf8"));
const enemies = [
  { id: "viner", name: "Viner Trap" },
  { id: "archer", name: "Bolo Archer" },
  { id: "hand-thrower", name: "Hand Thrower" },
];
const projectiles = [
  { id: "bolo-wrap", name: "Bolo Wrap" },
  { id: "throwing-hand", name: "Throwing Hand" },
];

describe("compendium index", () => {
  it("normalizes pack-relative paths onto public/assets", () => {
    expect(assetUrl("cinematics/drone/struggle-1.png")).toBe("./assets/cinematics/drone/struggle-1.png");
    expect(assetUrl("enemies/drone/idle.png")).toBe("./assets/enemies/drone/idle.png");
    expect(assetUrl("./assets/cinematics/drone/struggle-1.png")).toBe("./assets/cinematics/drone/struggle-1.png");
  });

  it("prefers enemies.json display names", () => {
    expect(displayName("viner", "viner", enemies)).toBe("Viner Trap");
    expect(displayName("hundred-hands", "hundred hands")).toBe("Hundred Hands");
  });

  it("nests projectile packs under their parent zombie", () => {
    const entries = parseCompendium(raw);
    expect(entries.filter((e) => e.kind === "zombie")).toHaveLength(12);
    expect(entries.filter((e) => e.kind === "projectile").map((e) => e.id)).toEqual([
      "bolo-wrap",
      "egg-web",
      "slime-shot",
      "throwing-hand",
    ]);

    const groups = buildBrowseGroups(raw, enemies, projectiles);
    const archer = groups.find((g) => g.id === "archer");
    const bolo = groups.find((g) => g.id === "bolo-wrap");
    const thrower = groups.find((g) => g.id === "hand-thrower");
    const hand = groups.find((g) => g.id === "throwing-hand");
    expect(archer?.name).toBe("Bolo Archer");
    expect(archer?.stills).toHaveLength(6);
    expect(bolo?.parentId).toBe("archer");
    expect(bolo?.parentName).toBe("Bolo Archer");
    expect(bolo?.stills).toHaveLength(6);
    expect(groups.indexOf(bolo!)).toBe(groups.indexOf(archer!) + 1);
    expect(thrower?.name).toBe("Hand Thrower");
    expect(hand?.parentId).toBe("hand-thrower");
    expect(groups.some((g) => g.id === "drone" && g.idle?.includes("enemies/drone/idle"))).toBe(true);
  });

  it("lays out a phone-width grid with idle plus 3+3 stills", () => {
    const groups = buildBrowseGroups(raw, enemies, projectiles);
    const laid = layoutBrowse(844, 70, 300, 0, groups, "gallery");
    const droneThumbs = laid.thumbs.filter((t) => t.id.startsWith("view:drone:"));
    expect(droneThumbs.length).toBe(7);
    expect(laid.maxScroll).toBeGreaterThan(0);
    expect(laid.headers.some((h) => /Bolo Wrap/.test(h.text) && /Bolo Archer/.test(h.text))).toBe(true);
  });
});
