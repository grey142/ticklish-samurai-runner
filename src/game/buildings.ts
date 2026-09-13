import type { Game } from "./Game";

export type BuildingKind = "house-two-story" | "house-one-story" | "gate";

// Night-street palette, tuned to blend with the maroon/indigo city backdrop.
const PALETTE = {
  tileTop: "#4a4a72",
  tile: "#39374f",
  tileShadow: "#26243a",
  ridge: "#635f8c",
  eaveShadow: "#1d1b2e",
  timber: "#2a1c22",
  timberLit: "#3f2b32",
  plaster: "#b7996a",
  plasterShadow: "#8c714b",
  stone: "#463e46",
  stoneLine: "#332d36",
  shojiLit: "#f6dca6",
  shojiGrid: "#c39c5c",
  shojiDim: "#6c5942",
  doorPlank: "#38271f",
  doorSeam: "#20140f",
  stud: "#7c6a4c",
  glow: "rgba(255,176,90,0.16)",
};

interface StreetSprites {
  band: number;
  sprites: Record<BuildingKind, HTMLCanvasElement>;
  advance: Record<BuildingKind, number>;
}

// Rooftops always meet the roof lane, so widths are derived from the band height
// (roofY -> groundY) to keep buildings proportional at any resolution.
const WIDTH_RATIO: Record<BuildingKind, number> = {
  "house-two-story": 0.66,
  "house-one-story": 0.78,
  gate: 0.56,
};

const SEQUENCE: BuildingKind[] = [
  "house-two-story",
  "gate",
  "house-one-story",
  "house-two-story",
  "house-one-story",
  "gate",
];

let cache: StreetSprites | null = null;

function ensureSprites(band: number): StreetSprites {
  const key = Math.round(band);
  if (cache && cache.band === key) return cache;
  const advance = {
    "house-two-story": Math.round(key * WIDTH_RATIO["house-two-story"]),
    "house-one-story": Math.round(key * WIDTH_RATIO["house-one-story"]),
    gate: Math.round(key * WIDTH_RATIO.gate),
  } as Record<BuildingKind, number>;
  const sprites = {
    "house-two-story": renderBuilding("house-two-story", advance["house-two-story"], key),
    "house-one-story": renderBuilding("house-one-story", advance["house-one-story"], key),
    gate: renderBuilding("gate", advance.gate, key),
  } as Record<BuildingKind, HTMLCanvasElement>;
  cache = { band: key, sprites, advance };
  return cache;
}

function renderBuilding(kind: BuildingKind, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = Math.max(8, w);
  cv.height = Math.max(8, h);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  if (kind === "gate") drawGate(ctx, cv.width, cv.height);
  else drawHouse(ctx, cv.width, cv.height, kind === "house-two-story" ? 2 : 1);
  return cv;
}

function drawHouse(ctx: CanvasRenderingContext2D, w: number, h: number, floors: 1 | 2): void {
  const roofH = h * (floors === 2 ? 0.24 : 0.3);
  const wallInset = w * 0.05;
  const wallX = wallInset;
  const wallW = w - wallInset * 2;
  const wallTop = roofH;

  // Wall base plaster + stone plinth.
  ctx.fillStyle = PALETTE.plaster;
  ctx.fillRect(wallX, wallTop, wallW, h - wallTop);
  ctx.fillStyle = PALETTE.plasterShadow;
  ctx.fillRect(wallX, wallTop, wallW, Math.max(2, h * 0.012));
  const plinth = h * 0.1;
  ctx.fillStyle = PALETTE.stone;
  ctx.fillRect(wallX, h - plinth, wallW, plinth);
  ctx.strokeStyle = PALETTE.stoneLine;
  ctx.lineWidth = 1;
  for (let x = wallX; x < wallX + wallW; x += w * 0.16) {
    ctx.beginPath();
    ctx.moveTo(x, h - plinth);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Corner posts + top beam (nageshi).
  const post = Math.max(4, w * 0.045);
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(wallX, wallTop, post, h - wallTop);
  ctx.fillRect(wallX + wallW - post, wallTop, post, h - wallTop);
  const beam = Math.max(4, h * 0.03);
  ctx.fillRect(wallX, wallTop, wallW, beam);

  if (floors === 2) {
    const midY = wallTop + (h - wallTop) * 0.5;
    windowRow(ctx, wallX + post, wallTop + beam, wallW - post * 2, midY - (wallTop + beam) - beam, 4);
    // Mid-floor eave (hisashi): a short tiled lip dividing the two storeys.
    ctx.fillStyle = PALETTE.timberLit;
    ctx.fillRect(wallX - post * 0.4, midY, wallW + post * 0.8, beam);
    ctx.fillStyle = PALETTE.tileShadow;
    ctx.fillRect(wallX - post * 0.4, midY + beam, wallW + post * 0.8, Math.max(2, h * 0.012));
    windowRow(ctx, wallX + post, midY + beam + h * 0.02, wallW - post * 2, h - plinth - (midY + beam + h * 0.02) - h * 0.02, 4);
  } else {
    // One tall storey: shoji band up top over a plain plastered wall.
    windowRow(ctx, wallX + post, wallTop + beam + h * 0.03, wallW - post * 2, (h - wallTop) * 0.34, 5);
    ctx.fillStyle = PALETTE.timberLit;
    const midBeam = wallTop + (h - wallTop) * 0.52;
    ctx.fillRect(wallX, midBeam, wallW, Math.max(3, beam * 0.7));
  }

  // Warm interior glow bleeding from the paper screens.
  ctx.fillStyle = PALETTE.glow;
  ctx.fillRect(wallX, wallTop, wallW, (h - wallTop) * 0.6);

  drawRoof(ctx, w, roofH);
}

function windowRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
): void {
  if (h <= 4 || w <= 4) return;
  const gap = Math.max(2, w * 0.02);
  const panelW = (w - gap * (count + 1)) / count;
  for (let i = 0; i < count; i++) {
    const px = x + gap + i * (panelW + gap);
    const lit = (i * 7 + Math.round(w)) % 5 !== 0;
    ctx.fillStyle = lit ? PALETTE.shojiLit : PALETTE.shojiDim;
    ctx.fillRect(px, y, panelW, h);
    ctx.strokeStyle = PALETTE.shojiGrid;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, y + 0.5, panelW - 1, h - 1);
    const cols = 2;
    const rows = Math.max(2, Math.round(h / (panelW / 1.4)));
    for (let c = 1; c < cols; c++) {
      const cx = px + (panelW / cols) * c;
      ctx.beginPath();
      ctx.moveTo(cx, y);
      ctx.lineTo(cx, y + h);
      ctx.stroke();
    }
    for (let r = 1; r < rows; r++) {
      const cy = y + (h / rows) * r;
      ctx.beginPath();
      ctx.moveTo(px, cy);
      ctx.lineTo(px + panelW, cy);
      ctx.stroke();
    }
  }
}

// Tiled hip roof: flat ridge at the very top (the surface actors stand on)
// sloping out to overhanging eaves with upturned tips.
function drawRoof(ctx: CanvasRenderingContext2D, w: number, roofH: number): void {
  const ridgeInset = w * 0.22;
  const eaveY = roofH;
  ctx.beginPath();
  ctx.moveTo(ridgeInset, 0);
  ctx.lineTo(w - ridgeInset, 0);
  ctx.lineTo(w, eaveY);
  ctx.lineTo(0, eaveY);
  ctx.closePath();
  ctx.fillStyle = PALETTE.tile;
  ctx.fill();

  // Tile courses.
  ctx.strokeStyle = PALETTE.tileShadow;
  ctx.lineWidth = 1;
  const courses = 4;
  for (let i = 1; i <= courses; i++) {
    const t = i / (courses + 1);
    const y = eaveY * t;
    const x0 = ridgeInset * (1 - t);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(w - x0, y);
    ctx.stroke();
  }
  // Vertical tile ribs.
  ctx.strokeStyle = PALETTE.tileTop;
  const ribs = Math.max(6, Math.round(w / (roofH * 0.5)));
  for (let i = 0; i <= ribs; i++) {
    const t = i / ribs;
    const topX = ridgeInset + (w - ridgeInset * 2) * t;
    const botX = w * t;
    ctx.beginPath();
    ctx.moveTo(topX, 0);
    ctx.lineTo(botX, eaveY);
    ctx.stroke();
  }

  // Ridge cap highlight (the walkable crest).
  ctx.fillStyle = PALETTE.ridge;
  ctx.fillRect(ridgeInset, 0, w - ridgeInset * 2, Math.max(3, roofH * 0.12));

  // Eave board + shadow underneath, with upturned corners.
  ctx.fillStyle = PALETTE.tileTop;
  ctx.fillRect(0, eaveY - Math.max(3, roofH * 0.1), w, Math.max(3, roofH * 0.1));
  ctx.fillStyle = PALETTE.eaveShadow;
  ctx.fillRect(0, eaveY, w, Math.max(2, roofH * 0.05));
  const lift = roofH * 0.16;
  ctx.fillStyle = PALETTE.tileTop;
  ctx.beginPath();
  ctx.moveTo(0, eaveY);
  ctx.quadraticCurveTo(-w * 0.02, eaveY - lift, w * 0.05, eaveY - lift);
  ctx.lineTo(w * 0.05, eaveY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, eaveY);
  ctx.quadraticCurveTo(w * 1.02, eaveY - lift, w * 0.95, eaveY - lift);
  ctx.lineTo(w * 0.95, eaveY);
  ctx.closePath();
  ctx.fill();
}

// Samurai residence gate (mon): tiled roof over two heavy posts and plank doors.
function drawGate(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const roofH = h * 0.26;
  const post = Math.max(6, w * 0.14);
  const top = roofH;

  // Posts.
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(0, top, post, h - top);
  ctx.fillRect(w - post, top, post, h - top);
  ctx.fillStyle = PALETTE.timberLit;
  ctx.fillRect(post * 0.25, top, Math.max(2, post * 0.18), h - top);
  ctx.fillRect(w - post + post * 0.55, top, Math.max(2, post * 0.18), h - top);

  // Lintel beam across the top of the opening.
  const lintel = Math.max(6, h * 0.05);
  ctx.fillStyle = PALETTE.timberLit;
  ctx.fillRect(0, top, w, lintel);

  // Recessed doorway.
  const doorX = post;
  const doorW = w - post * 2;
  const doorTop = top + lintel;
  const doorH = h - doorTop;
  ctx.fillStyle = PALETTE.doorPlank;
  ctx.fillRect(doorX, doorTop, doorW, doorH);
  // Vertical planks.
  ctx.strokeStyle = PALETTE.doorSeam;
  ctx.lineWidth = 1;
  const planks = 6;
  for (let i = 1; i < planks; i++) {
    const px = doorX + (doorW / planks) * i;
    ctx.beginPath();
    ctx.moveTo(px, doorTop);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
  // Central meeting seam + metal studs on cross-battens.
  ctx.fillStyle = PALETTE.doorSeam;
  ctx.fillRect(doorX + doorW / 2 - 1, doorTop, 2, doorH);
  ctx.fillStyle = PALETTE.stud;
  const battenYs = [doorTop + doorH * 0.22, doorTop + doorH * 0.6];
  for (const by of battenYs) {
    ctx.fillRect(doorX, by, doorW, Math.max(2, h * 0.014));
    const studs = 8;
    for (let i = 0; i <= studs; i++) {
      const sx = doorX + (doorW / studs) * i;
      ctx.beginPath();
      ctx.arc(sx, by + h * 0.007, Math.max(1.2, w * 0.008), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Faint lamp glow spilling under the gate.
  ctx.fillStyle = PALETTE.glow;
  ctx.fillRect(doorX, doorTop, doorW, doorH * 0.5);

  drawRoof(ctx, w, roofH);
}

export function drawStreet(g: Game): void {
  const { ctx, w } = g;
  const roofY = g.roofY();
  const groundY = g.groundY();
  const band = groundY - roofY;
  if (band <= 8) return;
  const { sprites, advance } = ensureSprites(band);

  const advForSeq = SEQUENCE.map((k) => advance[k]);
  const patternW = advForSeq.reduce((a, b) => a + b, 0);
  const prefix: number[] = [0];
  for (let i = 0; i < advForSeq.length; i++) prefix.push(prefix[i] + advForSeq[i]);

  const scroll = g.worldX;
  const startCycle = Math.floor((scroll - w) / patternW) - 1;
  let k = startCycle * SEQUENCE.length;
  // Guard against pathological loops at tiny bands / huge screens.
  for (let guard = 0; guard < 4096; guard++, k++) {
    const cycle = Math.floor(k / SEQUENCE.length);
    const idx = ((k % SEQUENCE.length) + SEQUENCE.length) % SEQUENCE.length;
    const worldStart = cycle * patternW + prefix[idx];
    const x = worldStart - scroll;
    const kind = SEQUENCE[idx];
    const adv = advance[kind];
    if (x > w + adv) break;
    if (x + adv < -adv) continue;
    ctx.drawImage(sprites[kind], Math.round(x), Math.round(roofY), adv, Math.round(band));
  }

  // Unified tiled ridge coping along the roof lane: the continuous crest the
  // player and roof-lane enemies actually stand on (never floating).
  ctx.fillStyle = PALETTE.ridge;
  ctx.fillRect(0, roofY - Math.max(3, band * 0.012), w, Math.max(3, band * 0.012));
  ctx.fillStyle = "rgba(120,110,160,0.5)";
  ctx.fillRect(0, roofY - Math.max(3, band * 0.012), w, 1);
  ctx.fillStyle = PALETTE.eaveShadow;
  ctx.fillRect(0, roofY, w, Math.max(2, band * 0.006));
}
