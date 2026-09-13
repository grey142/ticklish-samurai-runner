import type { MapPropCatalog, MapPropDef } from "../types";

export const PROP_PATTERN = ["house_2story", "house_1story", "gate_1story", "house_1story"] as const;

/** Packed stride was ~0.94× building width; playtest wants ~8× that gap. */
export const PROP_SPACING_MUL = 8;

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
  story: number;
}

export function mapPropPath(file: string): string {
  return `./assets/map-props/${file}`;
}

/** Draw-box top so visible soles at footFrac sit on ledgeY. */
export function standTop(ledgeY: number, drawH: number, footFrac: number): number {
  const frac = footFrac > 0.2 && footFrac <= 1 ? footFrac : 1;
  return ledgeY - drawH * frac;
}

export function mapPropImageEntries(props: { file: string }[]): { path: string; knockout: boolean }[] {
  return props.map((p) => ({ path: mapPropPath(p.file), knockout: false }));
}

export function storyRank(_propId: string, ledgeId: string, explicit?: number): number {
  if (explicit != null && Number.isFinite(explicit)) return explicit;
  if (ledgeId === "ground") return 0;
  if (ledgeId === "roof_top" || ledgeId === "balcony") return 2;
  return 1;
}

/** World climb from street to the one-story roof — 2-story 1F must match this. */
export function oneStoryClimb(catalog: MapPropCatalog, baseH: number): number {
  const one = catalog.props.find((p) => p.id === "house_1story");
  if (!one || baseH <= 0) return baseH * 0.7;
  const g = one.ledges.find((l) => l.id === "ground")?.y ?? 0.95;
  const r = one.ledges.find((l) => l.id === "roof")?.y ?? 0.18;
  return baseH * Math.max(0.15, g - r);
}

export function propDrawHeight(def: MapPropDef, baseH: number, climb1: number): number {
  if (def.id !== "house_2story" || climb1 <= 0) return baseH;
  const g = def.ledges.find((l) => l.id === "ground")?.y ?? 0.95;
  const first = def.ledges.find((l) => l.id === "eave_1f") ?? def.ledges.find((l) => l.id === "engawa");
  if (!first) return baseH;
  const span = Math.max(0.12, g - first.y);
  return climb1 / span;
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
  const climb1 = oneStoryClimb(catalog, propH);

  const tiles = pattern.map((def) => {
    const h = propDrawHeight(def, propH, climb1);
    const ar = def.width / Math.max(1, def.height);
    const w = h * ar;
    const ground = def.ledges.find((l) => l.id === "ground");
    const gy = ground?.y ?? 0.95;
    return { def, w, h, y: groundY - h * gy, stride: w * 0.94 * PROP_SPACING_MUL };
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
    story: storyRank(placed.def.id, l.id, l.story),
  }));
}

export function allLedges(placed: PlacedProp[]): WorldLedge[] {
  return placed.flatMap(ledgesOf);
}

function spansLedge(l: WorldLedge, x: number, w: number): boolean {
  if (w <= 1) return x >= l.x0 && x <= l.x1;
  return x < l.x1 && x + w > l.x0;
}

export function ledgeUnder(ledges: WorldLedge[], x: number, feetY: number, slop: number, w = 0): WorldLedge | null {
  let best: WorldLedge | null = null;
  let bestDist = slop;
  for (const l of ledges) {
    if (!l.standable || !spansLedge(l, x, w)) continue;
    const dist = Math.abs(feetY - l.y);
    if (dist <= bestDist) {
      best = l;
      bestDist = dist;
    }
  }
  return best;
}

export function landingLedge(ledges: WorldLedge[], x: number, feetFrom: number, feetTo: number, w = 0): WorldLedge | null {
  if (feetTo < feetFrom) return null;
  let best: WorldLedge | null = null;
  for (const l of ledges) {
    if (!l.standable || !spansLedge(l, x, w)) continue;
    if (feetFrom <= l.y + 4 && feetTo >= l.y - 2) {
      if (!best || l.y < best.y) best = l;
    }
  }
  return best;
}

const STORY_PREF: Record<number, string[]> = {
  2: ["roof_top", "balcony"],
  1: ["eave_1f", "roof", "lintel", "engawa"],
};

export function currentStory(ledges: WorldLedge[], x: number, feetY: number, groundY: number, w = 0): number {
  const under = ledgeUnder(ledges, x, feetY, 28, w);
  if (under) return under.story;
  if (feetY >= groundY - 24) return 0;
  let best: WorldLedge | null = null;
  for (const l of ledges) {
    if (!l.standable || !spansLedge(l, x, w)) continue;
    if (l.y > feetY && (!best || l.y < best.y)) best = l;
  }
  return best ? Math.max(0, best.story - 1) : 0;
}

export function storyLedge(ledges: WorldLedge[], x: number, w: number, rank: number): WorldLedge | null {
  const cands = ledges.filter((l) => l.standable && l.story === rank && spansLedge(l, x, w));
  if (!cands.length) return null;
  const pref = STORY_PREF[rank] ?? [];
  for (const id of pref) {
    const hit = cands.find((l) => l.ledgeId === id);
    if (hit) return hit;
  }
  return cands.reduce((a, b) => (a.y > b.y ? a : b));
}

/** Next story only — street → 1F roof / one-story roof / gate roof; 1F → 2F. */
export function climbLedge(
  ledges: WorldLedge[],
  x: number,
  feetY: number,
  w = 0,
  groundY = Number.POSITIVE_INFINITY,
): WorldLedge | null {
  const cur = currentStory(ledges, x, feetY, groundY, w);
  if (cur >= 2) return null;
  return storyLedge(ledges, x, w, cur + 1);
}

/** Previous story only — 2F → 1F, 1F → street (null means stand on ground). */
export function dropLedge(
  ledges: WorldLedge[],
  x: number,
  feetY: number,
  w = 0,
  groundY = Number.POSITIVE_INFINITY,
): WorldLedge | null {
  const cur = currentStory(ledges, x, feetY, groundY, w);
  if (cur <= 1) return null;
  return storyLedge(ledges, x, w, cur - 1);
}

export function groundCameraY(mapH: number, viewH: number): number {
  return Math.max(0, mapH - viewH);
}

/** Raise only when the player would clip off the top of the ground-locked view. */
export function followCameraY(mapH: number, viewH: number, playerTop: number, pad = 18): number {
  const ground = groundCameraY(mapH, viewH);
  if (playerTop >= ground + pad) return ground;
  return Math.max(0, Math.min(ground, playerTop - pad));
}

export function roofLedgeY(ledges: WorldLedge[], fallback: number): number {
  const roofs = ledges.filter((l) => l.standable && /roof|balcony|eave/.test(l.ledgeId));
  if (!roofs.length) return fallback;
  return roofs.reduce((sum, l) => sum + l.y, 0) / roofs.length;
}
