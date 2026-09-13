import { enemySpritePath, projectilePath } from "./assets";

export interface NamedId {
  id: string;
  name: string;
}

export interface RawCompendiumEntry {
  id: string;
  name: string;
  kind: "zombie" | "projectile";
  idleSprite?: string;
  parentEnemy?: string;
  struggle?: string[];
  gameOver?: string[];
}

export interface RawCompendium {
  entries: RawCompendiumEntry[];
}

export interface StillCard {
  src: string;
  label: string;
}

export interface BrowseGroup {
  id: string;
  name: string;
  kind: "zombie" | "projectile";
  parentId?: string;
  parentName?: string;
  idle?: string;
  stills: StillCard[];
}

export function assetUrl(rel: string): string {
  const t = rel.trim();
  if (!t) return t;
  if (t.startsWith("./")) return t;
  if (t.startsWith("assets/")) return `./${t}`;
  return `./assets/${t.replace(/^\//, "")}`;
}

export function titleCase(raw: string): string {
  return raw
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function displayName(id: string, raw: string, catalog: NamedId[] = []): string {
  const fromCat = catalog.find((row) => row.id === id)?.name;
  if (fromCat) return fromCat;
  if (raw && raw !== raw.toLowerCase() && /[A-Z]/.test(raw)) return raw;
  return titleCase(raw || id);
}

function stillsFrom(entry: RawCompendiumEntry): StillCard[] {
  const out: StillCard[] = [];
  (entry.struggle ?? []).forEach((src, i) => {
    out.push({ src: assetUrl(src), label: `Struggle ${i + 1}` });
  });
  (entry.gameOver ?? []).forEach((src, i) => {
    out.push({ src: assetUrl(src), label: `Game over ${i + 1}` });
  });
  return out;
}

export function parseCompendium(raw: unknown): RawCompendiumEntry[] {
  const o = (raw ?? {}) as { entries?: RawCompendiumEntry[] };
  return Array.isArray(o.entries) ? o.entries.filter((e) => e && e.id && e.kind) : [];
}

export function buildBrowseGroups(
  raw: unknown,
  enemies: NamedId[] = [],
  projectiles: NamedId[] = [],
): BrowseGroup[] {
  const entries = parseCompendium(raw);
  const names = [...enemies, ...projectiles];
  const zombies = entries.filter((e) => e.kind === "zombie");
  const shots = entries.filter((e) => e.kind === "projectile");
  const groups: BrowseGroup[] = [];

  for (const z of zombies) {
    groups.push({
      id: z.id,
      name: displayName(z.id, z.name, names),
      kind: "zombie",
      idle: z.idleSprite ? assetUrl(z.idleSprite) : enemySpritePath(z.id, "idle"),
      stills: stillsFrom(z),
    });
    for (const p of shots.filter((s) => s.parentEnemy === z.id)) {
      groups.push({
        id: p.id,
        name: displayName(p.id, p.name, names),
        kind: "projectile",
        parentId: z.id,
        parentName: displayName(z.id, z.name, names),
        idle: projectilePath(p.id),
        stills: stillsFrom(p),
      });
    }
  }

  for (const p of shots.filter((s) => !zombies.some((z) => z.id === s.parentEnemy))) {
    groups.push({
      id: p.id,
      name: displayName(p.id, p.name, names),
      kind: "projectile",
      parentId: p.parentEnemy,
      parentName: p.parentEnemy ? displayName(p.parentEnemy, p.parentEnemy, names) : undefined,
      idle: projectilePath(p.id),
      stills: stillsFrom(p),
    });
  }

  return groups;
}

export function allStills(groups: BrowseGroup[]): StillCard[] {
  const out: StillCard[] = [];
  for (const g of groups) {
    if (g.idle) out.push({ src: g.idle, label: `${g.name} idle` });
    for (const s of g.stills) out.push({ src: s.src, label: `${g.name} · ${s.label}` });
  }
  return out;
}

export interface ThumbHit {
  id: string;
  src: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HeaderHit {
  text: string;
  x: number;
  y: number;
}

export interface BrowseLayout {
  thumbs: ThumbHit[];
  headers: HeaderHit[];
  maxScroll: number;
}

function placeRow(
  items: { id: string; src: string; label: string }[],
  x0: number,
  y: number,
  maxX: number,
  size: number,
  gap: number,
): { thumbs: ThumbHit[]; y: number } {
  const thumbs: ThumbHit[] = [];
  let x = x0;
  let rowY = y;
  for (const item of items) {
    if (x + size > maxX && x > x0) {
      x = x0;
      rowY += size + gap;
    }
    thumbs.push({ ...item, x, y: rowY, w: size, h: size });
    x += size + gap;
  }
  const yEnd = items.length ? rowY + size : y;
  return { thumbs, y: yEnd };
}

export function layoutBrowse(
  w: number,
  bodyY: number,
  bodyH: number,
  scroll: number,
  groups: BrowseGroup[],
  mode: "compendium" | "gallery",
): BrowseLayout {
  const pad = 12;
  const gap = 6;
  const cols = mode === "gallery" ? (w < 720 ? 5 : 7) : w < 720 ? 4 : 6;
  const size = Math.max(52, Math.min(88, Math.floor((w - pad * 2 - gap * (cols - 1)) / cols)));
  const thumbs: ThumbHit[] = [];
  const headers: HeaderHit[] = [];
  let y = bodyY + 6 - scroll;

  for (const g of groups) {
    const title =
      g.kind === "projectile"
        ? `${g.name}${g.parentName ? `  ·  ${g.parentName}` : ""}`
        : g.name;
    headers.push({ text: title, x: pad, y: y + 16 });
    y += 24;

    const cards: { id: string; src: string; label: string }[] = [];
    if (g.idle) {
      cards.push({
        id: `view:${g.id}:idle`,
        src: g.idle,
        label: `${g.name} idle`,
      });
    }
    g.stills.forEach((s, i) => {
      cards.push({
        id: `view:${g.id}:${i}`,
        src: s.src,
        label: `${g.name} · ${s.label}`,
      });
    });

    const placed = placeRow(cards, pad, y, w - pad, size, gap);
    thumbs.push(...placed.thumbs);
    y = placed.y + 14;
  }

  const contentBottom = y + scroll;
  return { thumbs, headers, maxScroll: Math.max(0, contentBottom - bodyY - bodyH + 8) };
}
