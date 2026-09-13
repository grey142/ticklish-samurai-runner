import { describe, expect, it } from "vitest";
import type { MapPropCatalog } from "../types";
import {
  allLedges,
  climbLedge,
  dropLedge,
  followCameraY,
  groundCameraY,
  landingLedge,
  layoutProps,
  ledgeUnder,
  mapPropPath,
  oneStoryClimb,
  PROP_SPACING_MUL,
  propDrawHeight,
  standTop,
} from "./map-props";

const catalog: MapPropCatalog = {
  props: [
    {
      id: "house_2story",
      file: "house-2story.png",
      width: 100,
      height: 100,
      ledges: [
        { id: "roof_top", y: 0.1, x0: 0.1, x1: 0.9, label: "roof" },
        { id: "balcony", y: 0.42, x0: 0.1, x1: 0.9, label: "balcony" },
        { id: "eave_1f", y: 0.52, x0: 0.1, x1: 0.9, label: "eave" },
        { id: "engawa", y: 0.78, x0: 0.1, x1: 0.9, label: "porch" },
        { id: "ground", y: 0.96, x0: 0.05, x1: 0.95, label: "ground" },
      ],
    },
    {
      id: "house_1story",
      file: "house-1story.png",
      width: 100,
      height: 100,
      ledges: [
        { id: "roof", y: 0.18, x0: 0.1, x1: 0.9, label: "roof" },
        { id: "ground", y: 0.95, x0: 0.05, x1: 0.95, label: "ground" },
      ],
    },
    {
      id: "gate_1story",
      file: "gate-1story.png",
      width: 80,
      height: 100,
      ledges: [
        { id: "roof", y: 0.22, x0: 0.2, x1: 0.8, label: "gate" },
        { id: "ground", y: 0.92, x0: 0.05, x1: 0.95, label: "ground" },
      ],
    },
  ],
};

describe("map props", () => {
  it("points at the map-props folder", () => {
    expect(mapPropPath("house-2story.png")).toBe("./assets/map-props/house-2story.png");
  });

  it("tiles a scrolling strip whose ground ledges sit on the street", () => {
    const groundY = 400;
    const placed = layoutProps(catalog, 0, 12000, groundY, 200);
    expect(placed.length).toBeGreaterThan(2);
    expect(placed.some((p) => p.def.id === "gate_1story")).toBe(true);
    const twos = placed.filter((p) => p.def.id === "house_2story");
    expect(twos.length).toBeGreaterThan(1);
    expect(twos[0].y + twos[0].h * 0.96).toBeCloseTo(groundY);
    expect(twos[1].x - twos[0].x).toBeGreaterThan(twos[0].w * 6);
    expect(PROP_SPACING_MUL).toBe(8);
  });

  it("lands on the highest ledge the feet cross", () => {
    const placed = layoutProps(catalog, 0, 400, 400, 200);
    const house = placed.find((p) => p.def.id === "house_2story")!;
    const ledges = allLedges([house]);
    const x = house.x + house.w * 0.5;
    const roof = house.y + house.h * 0.1;
    const porch = house.y + house.h * 0.78;
    const hit = landingLedge(ledges, x, roof - 8, porch + 4);
    expect(hit?.ledgeId).toBe("roof_top");
    expect(ledgeUnder(ledges, x, roof, 6)?.ledgeId).toBe("roof_top");
    expect(climbLedge(ledges, x, porch + 2, 0, 400)?.ledgeId).toBe("roof_top");
  });

  it("wall-run climbs and drops only one story", () => {
    const placed = layoutProps(catalog, 0, 400, 400, 200);
    const house = placed.find((p) => p.def.id === "house_2story")!;
    const ledges = allLedges([house]);
    const x = house.x + house.w * 0.5;
    const gY = 400;
    expect(climbLedge(ledges, x, gY, 0, gY)?.ledgeId).toBe("eave_1f");
    const eave = house.y + house.h * 0.52;
    expect(climbLedge(ledges, x, eave, 0, gY)?.ledgeId).toBe("roof_top");
    expect(dropLedge(ledges, x, house.y + house.h * 0.1, 0, gY)?.ledgeId).toBe("eave_1f");
    expect(dropLedge(ledges, x, eave, 0, gY)).toBeNull();
  });

  it("scales the two-story house so 1F climb matches the one-story roof", () => {
    const baseH = 200;
    const climb1 = oneStoryClimb(catalog, baseH);
    const two = catalog.props.find((p) => p.id === "house_2story")!;
    const h2 = propDrawHeight(two, baseH, climb1);
    const one = placedOneStoryClimb(catalog, baseH);
    expect(h2 * (0.96 - 0.52)).toBeCloseTo(one);
    expect(h2).toBeGreaterThan(baseH);
  });

  it("standTop puts visible soles on the ledge plane", () => {
    const y = standTop(200, 80, 0.95);
    expect(y + 80 * 0.95).toBeCloseTo(200);
  });

  it("locks the camera to the ground unless the player would leave the top", () => {
    const mapH = 1720;
    const viewH = 1000;
    const ground = groundCameraY(mapH, viewH);
    expect(ground).toBe(720);
    expect(followCameraY(mapH, viewH, 900)).toBe(720);
    expect(followCameraY(mapH, viewH, 100)).toBe(82);
  });
});

function placedOneStoryClimb(cat: MapPropCatalog, baseH: number): number {
  const one = cat.props.find((p) => p.id === "house_1story")!;
  const g = one.ledges.find((l) => l.id === "ground")!.y;
  const r = one.ledges.find((l) => l.id === "roof")!.y;
  return baseH * (g - r);
}
