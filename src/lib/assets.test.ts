import { describe, expect, it } from "vitest";
import { cinematicPath, containDest, enemySpritePath, playerPosePath, playerShotPath, projectilePath, vfxPath } from "./assets";
import { mapPropPath } from "./map-props";

describe("asset paths", () => {
  it("points player poses at PNGs", () => {
    expect(playerPosePath("run")).toBe("./assets/player/run.png");
    expect(playerPosePath("slash")).toBe("./assets/player/slash.png");
  });

  it("points enemies, projectiles, and cinematic beats at PNGs", () => {
    expect(enemySpritePath("drone", "idle")).toBe("./assets/enemies/drone/idle.png");
    expect(projectilePath("egg-web")).toBe("./assets/projectiles/egg-web/idle.png");
    expect(cinematicPath("drone", "struggle", 2)).toBe("./assets/cinematics/drone/struggle-2.png");
    expect(cinematicPath("egg-web", "gameover", 3)).toBe("./assets/cinematics/egg-web/gameover-3.png");
    expect(playerShotPath("kunai-projectile")).toBe("./assets/projectiles/player/kunai-projectile.png");
    expect(playerShotPath("flaming-arrow")).toBe("./assets/projectiles/player/flaming-arrow.png");
    expect(playerShotPath("fireball-boost")).toBe("./assets/projectiles/player/fireball-boost.png");
    expect(mapPropPath("gate-1story.png")).toBe("./assets/map-props/gate-1story.png");
  });
});

describe("cinematic contain fit", () => {
  it("letterboxes a tall still so the whole image fits a landscape screen", () => {
    const fit = containDest(1080, 1920, 1280, 720);
    expect(fit.dw).toBeLessThanOrEqual(1280);
    expect(fit.dh).toBeLessThanOrEqual(720);
    expect(fit.dh).toBeCloseTo(720);
    expect(fit.dw).toBeCloseTo(720 * (1080 / 1920));
    expect(fit.dx).toBeGreaterThan(0);
    expect(fit.dy).toBeCloseTo(0);
  });
});
