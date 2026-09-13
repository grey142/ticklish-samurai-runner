import { describe, expect, it } from "vitest";
import { cinematicPath, enemySpritePath, playerPosePath, projectilePath } from "./assets";

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
  });
});
