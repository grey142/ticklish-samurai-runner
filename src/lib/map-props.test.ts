import { describe, expect, it } from "vitest";
import type { MapPropCatalog } from "../types";
import {
  allLedges,
  climbLedge,
  landingLedge,
  layoutProps,
  ledgeUnder,
  mapPropPath,
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
    const placed = layoutProps(catalog, 0, 800, groundY, 200);
    expect(placed.length).toBeGreaterThan(2);
    expect(placed.some((p) => p.def.id === "gate_1story")).toBe(true);
    const two = placed.find((p) => p.def.id === "house_2story");
    expect(two).toBeTruthy();
    expect(two!.y + two!.h * 0.96).toBeCloseTo(groundY);
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
    expect(climbLedge(ledges, x, porch + 2)?.ledgeId).toBe("roof_top");
  });
});
