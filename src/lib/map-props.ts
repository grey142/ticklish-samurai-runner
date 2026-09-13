import type { MapPropCatalog, MapPropDef } from "../types";

export const PROP_PATTERN = ["house_2story", "house_1story", "gate_1story", "house_1story"] as const;

export interface PlacedProp {
  def: MapPropDef;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorldLedge {
  propId: string;
  ledgeId: string;
  y: number;
  x0: number;
  x1: number;
  standable: boolean;
}

export function mapPropPath(file: string): string {
  return `./assets/map-props/${file}`;
}

export function mapPropImageEntries(props: { file: string }[]): { path: string; knockout: boolean }[] {
  return props.map((p) => ({ path: mapPropPath(p.file), knockout: false }));
}

export function layoutProps(
  catalog: MapPropCatalog,
  worldX: number,
  viewW: number,
  groundY: number,
  propH: number,
): PlacedProp[] {
  const byId = new Map(catalog.props.map((p) => [p.id, p]));
  const pattern = PROP_PATTERN.map((id) => byId.get(id)).filter((p): p is MapPropDef => !!p);
  if (!pattern.length || propH <= 0) return [];

  const tiles = pattern.map((def) => {
    const ar = def.width / Math.max(1, def.height);
    const w = propH * ar;
    const ground = def.ledges.find((l) => l.id === "ground");
    const gy = ground?.y ?? 0.95;
    return { def, w, h: propH, y: groundY - propH * gy, stride: w * 0.94 };
  });
  const periodW = tiles.reduce((sum, t) => sum + t.stride, 0);
  if (periodW <= 0) return [];

  const pad = tiles[0].w;
  const viewLeft = worldX - pad;
  const viewRight = worldX + viewW + pad;
  const periodStart = Math.floor(viewLeft / periodW) * periodW;
  const out: PlacedProp[] = [];
  for (let base = periodStart; base < viewRight; base += periodW) {
    let cursor = base;
    for (const t of tiles) {
      out.push({ def: t.def, x: cursor - worldX, y: t.y, w: t.w, h: t.h });
      cursor += t.stride;
    }
  }
  return out;
}

export function ledgesOf(placed: PlacedProp): WorldLedge[] {
  return placed.def.ledges.map((l) => ({
    propId: placed.def.id,
    ledgeId: l.id,
    y: placed.y + placed.h * l.y,
    x0: placed.x + placed.w * l.x0,
    x1: placed.x + placed.w * l.x1,
    standable: l.id !== "ground",
  }));
}

export function allLedges(placed: PlacedProp[]): WorldLedge[] {
  return placed.flatMap(ledgesOf);
}

export function ledgeUnder(ledges: WorldLedge[], x: number, feetY: number, slop: number): WorldLedge | null {
  let best: WorldLedge | null = null;
  let bestDist = slop;
  for (const l of ledges) {
    if (!l.standable || x < l.x0 || x > l.x1) continue;
    const dist = Math.abs(feetY - l.y);
    if (dist <= bestDist) {
      best = l;
      bestDist = dist;
    }
  }
  return best;
}

export function landingLedge(ledges: WorldLedge[], x: number, feetFrom: number, feetTo: number): WorldLedge | null {
  if (feetTo < feetFrom) return null;
  let best: WorldLedge | null = null;
  for (const l of ledges) {
    if (!l.standable || x < l.x0 || x > l.x1) continue;
    if (feetFrom <= l.y + 4 && feetTo >= l.y - 2) {
      if (!best || l.y < best.y) best = l;
    }
  }
  return best;
}

export function climbLedge(ledges: WorldLedge[], x: number, feetY: number): WorldLedge | null {
  let best: WorldLedge | null = null;
  for (const l of ledges) {
    if (!l.standable || x < l.x0 || x > l.x1) continue;
    if (l.y < feetY - 10 && (!best || l.y > best.y)) best = l;
  }
  return best;
}

export function dropLedge(ledges: WorldLedge[], x: number, feetY: number): WorldLedge | null {
  let best: WorldLedge | null = null;
  for (const l of ledges) {
    if (!l.standable || x < l.x0 || x > l.x1) continue;
    if (l.y > feetY + 10 && (!best || l.y < best.y)) best = l;
  }
  return best;
}

export function roofLedgeY(ledges: WorldLedge[], fallback: number): number {
  const roofs = ledges.filter((l) => l.standable && /roof|balcony|eave/.test(l.ledgeId));
  if (!roofs.length) return fallback;
  return roofs.reduce((sum, l) => sum + l.y, 0) / roofs.length;
}
