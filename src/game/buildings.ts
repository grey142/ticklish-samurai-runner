import type { Game } from "./Game";

export type BuildingKind = "house-two-story" | "house-one-story" | "gate";

// Night-street palette, tuned to blend with the maroon/indigo city backdrop.
const PALETTE = {
  tileTop: "#5b5b86",
  tile: "#3d3b58",
  tileShadow: "#26243c",
  ridge: "#6f6a9c",
  ornament: "#211f34",
  eaveShadow: "#171526",
  timber: "#2c1e24",
  timberLit: "#43303a",
  plaster: "#c2a473",
  plasterHi: "#d3b988",
  plasterShadow: "#93764e",
  stone: "#4c434c",
  stoneLine: "#332d38",
  shojiLit: "#f7dea9",
  shojiGrid: "#b98f52",
  shojiDim: "#6f5c45",
  doorPlank: "#3a281f",
  doorSeam: "#1f130e",
  stud: "#8a774f",
  glow: "rgba(255,178,92,0.18)",
};

interface StreetSprites {
  band: number;
  sprites: Record<BuildingKind, HTMLCanvasElement>;
  advance: Record<BuildingKind, number>;
}

// The map is far taller than the view: the roof lane sits near the top and the
// street near the bottom, so a building spans it all. Architectural detail is
// therefore concentrated in the TOP slice (roof + eaves + upper floor, seen from
// the roof lane) and the BOTTOM slice (street facade + doors, seen from the
// ground); the middle is plain wall that is mostly off-screen in both views.
const WIDTH_RATIO: Record<BuildingKind, number> = {
  "house-two-story": 0.5,
  "house-one-story": 0.58,
  gate: 0.42,
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
  const eaveOver = w * 0.07;
  const wallX = eaveOver;
  const wallW = w - eaveOver * 2;
  // Top roof cap is small so the eave + top-floor window fall within the slice
  // that is visible when the player is standing on the roof lane.
  const roofH = h * (floors === 2 ? 0.075 : 0.095);
  const wallTop = roofH;

  // Full plaster wall behind everything.
  const wallGrad = ctx.createLinearGradient(0, wallTop, 0, h);
  wallGrad.addColorStop(0, PALETTE.plasterHi);
  wallGrad.addColorStop(0.5, PALETTE.plaster);
  wallGrad.addColorStop(1, PALETTE.plasterShadow);
  ctx.fillStyle = wallGrad;
  ctx.fillRect(wallX, wallTop, wallW, h - wallTop);

  const post = Math.max(4, w * 0.05);
  const beam = Math.max(3, h * 0.012);

  // Top-floor eave fascia + shoji band (the part seen from the roof lane).
  const topWinY = wallTop + beam;
  const topWinH = h * 0.075;
  ctx.fillStyle = PALETTE.timberLit;
  ctx.fillRect(wallX, wallTop, wallW, beam);
  if (floors === 2) {
    windowRow(ctx, wallX + post, topWinY, wallW - post * 2, topWinH, 4);
  } else {
    // One storey: a plastered gable face with a small vent lattice, no upper room.
    ctx.fillStyle = PALETTE.plasterShadow;
    ctx.fillRect(wallX + wallW * 0.4, topWinY, wallW * 0.2, topWinH * 0.7);
    latticeGrid(ctx, wallX + wallW * 0.4, topWinY, wallW * 0.2, topWinH * 0.7, 3, 2);
  }

  // Mid-floor eave belt (koshi-yane) — the storey divider, visible from the ground's upper edge.
  const midY = h * (floors === 2 ? 0.44 : 0.5);
  ctx.fillStyle = PALETTE.tile;
  ctx.fillRect(wallX - eaveOver * 0.5, midY, wallW + eaveOver, beam * 2.2);
  ctx.fillStyle = PALETTE.tileTop;
  ctx.fillRect(wallX - eaveOver * 0.5, midY, wallW + eaveOver, Math.max(1, beam * 0.6));
  ctx.fillStyle = PALETTE.eaveShadow;
  ctx.fillRect(wallX - eaveOver * 0.5, midY + beam * 2.2, wallW + eaveOver, beam);

  // Ground-floor shoji + timber frame (the part seen from the street).
  const gWinY = h * 0.66;
  const gWinH = h * 0.2;
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(wallX, gWinY - beam, wallW, beam);
  windowRow(ctx, wallX + post, gWinY, wallW - post * 2, gWinH, floors === 2 ? 4 : 5);

  // Corner posts down the whole facade.
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(wallX, wallTop, post, h - wallTop);
  ctx.fillRect(wallX + wallW - post, wallTop, post, h - wallTop);

  // Stone plinth at the base.
  const plinth = h * 0.06;
  ctx.fillStyle = PALETTE.stone;
  ctx.fillRect(wallX, h - plinth, wallW, plinth);
  ctx.strokeStyle = PALETTE.stoneLine;
  ctx.lineWidth = 1;
  for (let x = wallX; x < wallX + wallW; x += w * 0.14) {
    ctx.beginPath();
    ctx.moveTo(x, h - plinth);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  // Warm interior glow bleeding from the paper screens.
  ctx.fillStyle = PALETTE.glow;
  ctx.fillRect(wallX + post, topWinY, wallW - post * 2, topWinH);
  ctx.fillRect(wallX + post, gWinY, wallW - post * 2, gWinH);

  drawRoof(ctx, w, roofH, eaveOver);
}

function windowRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  count: number,
): void {
  if (h <= 3 || w <= 3) return;
  const gap = Math.max(2, w * 0.02);
  const post = Math.max(2, w * 0.012);
  const panelW = (w - gap * (count + 1)) / count;
  for (let i = 0; i < count; i++) {
    const px = x + gap + i * (panelW + gap);
    const lit = (i * 7 + Math.round(w)) % 5 !== 0;
    ctx.fillStyle = lit ? PALETTE.shojiLit : PALETTE.shojiDim;
    ctx.fillRect(px, y, panelW, h);
    latticeGrid(ctx, px, y, panelW, h, 2, Math.max(2, Math.round(h / (panelW / 1.5))));
    ctx.fillStyle = PALETTE.timber;
    ctx.fillRect(px - post, y, post, h);
  }
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(x + w - post, y, post, h);
}

function latticeGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
): void {
  ctx.strokeStyle = PALETTE.shojiGrid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  for (let c = 1; c < cols; c++) {
    const cx = x + (w / cols) * c;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx, y + h);
    ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const cy = y + (h / rows) * r;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + w, cy);
    ctx.stroke();
  }
}

// Tiled hip roof: flat ridge at the very top (the surface actors stand on),
// sloping out to overhanging eaves with upturned tips and end ornaments.
function drawRoof(ctx: CanvasRenderingContext2D, w: number, roofH: number, over: number): void {
  const ridgeInset = w * 0.24;
  const eaveY = roofH;
  const left = -over * 0.6;
  const right = w + over * 0.6;

  ctx.beginPath();
  ctx.moveTo(ridgeInset, 0);
  ctx.lineTo(w - ridgeInset, 0);
  ctx.lineTo(right, eaveY);
  ctx.lineTo(left, eaveY);
  ctx.closePath();
  const rg = ctx.createLinearGradient(0, 0, 0, eaveY);
  rg.addColorStop(0, PALETTE.tileTop);
  rg.addColorStop(1, PALETTE.tile);
  ctx.fillStyle = rg;
  ctx.fill();

  // Horizontal tile courses.
  ctx.strokeStyle = PALETTE.tileShadow;
  ctx.lineWidth = 1;
  const courses = 3;
  for (let i = 1; i <= courses; i++) {
    const t = i / (courses + 1);
    const y = eaveY * t;
    const x0 = ridgeInset * (1 - t) + left * t;
    const x1 = w - ridgeInset * (1 - t) + (right - w) * t;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  // Vertical tile ribs.
  ctx.strokeStyle = PALETTE.tileShadow;
  const ribs = Math.max(6, Math.round(w / (roofH * 0.9)));
  for (let i = 0; i <= ribs; i++) {
    const t = i / ribs;
    const topX = ridgeInset + (w - ridgeInset * 2) * t;
    const botX = left + (right - left) * t;
    ctx.beginPath();
    ctx.moveTo(topX, 0);
    ctx.lineTo(botX, eaveY);
    ctx.stroke();
  }

  // Ridge crest highlight (the walkable line) + end ornaments (onigawara).
  ctx.fillStyle = PALETTE.ridge;
  ctx.fillRect(ridgeInset, 0, w - ridgeInset * 2, Math.max(2, roofH * 0.22));
  ctx.fillStyle = PALETTE.ornament;
  const orn = Math.max(3, roofH * 0.5);
  ctx.fillRect(ridgeInset - orn * 0.4, -orn * 0.2, orn, orn * 0.7);
  ctx.fillRect(w - ridgeInset - orn * 0.6, -orn * 0.2, orn, orn * 0.7);

  // Eave fascia board + deep shadow beneath, with upturned corner tips.
  ctx.fillStyle = PALETTE.tileTop;
  ctx.fillRect(left, eaveY - Math.max(2, roofH * 0.16), right - left, Math.max(2, roofH * 0.16));
  ctx.fillStyle = PALETTE.eaveShadow;
  ctx.fillRect(left, eaveY, right - left, Math.max(2, roofH * 0.1));
  const lift = roofH * 0.34;
  ctx.fillStyle = PALETTE.tileTop;
  ctx.beginPath();
  ctx.moveTo(left, eaveY);
  ctx.quadraticCurveTo(left - w * 0.03, eaveY - lift, left + w * 0.06, eaveY - lift);
  ctx.lineTo(left + w * 0.06, eaveY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(right, eaveY);
  ctx.quadraticCurveTo(right + w * 0.03, eaveY - lift, right - w * 0.06, eaveY - lift);
  ctx.lineTo(right - w * 0.06, eaveY);
  ctx.closePath();
  ctx.fill();
}

// Samurai residence gate (mon): tiled roof over two heavy posts and plank doors.
function drawGate(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const over = w * 0.12;
  const roofH = h * 0.09;
  const post = Math.max(6, w * 0.16);
  const top = roofH;

  // Recessed wall behind the gateway (mostly off-screen; keeps the mid solid).
  ctx.fillStyle = PALETTE.plasterShadow;
  ctx.fillRect(post, top, w - post * 2, h - top);

  // Heavy posts down the full height.
  ctx.fillStyle = PALETTE.timber;
  ctx.fillRect(0, top, post, h - top);
  ctx.fillRect(w - post, top, post, h - top);
  ctx.fillStyle = PALETTE.timberLit;
  ctx.fillRect(post * 0.3, top, Math.max(2, post * 0.16), h - top);
  ctx.fillRect(w - post + post * 0.55, top, Math.max(2, post * 0.16), h - top);

  // Lintel beam under the roof.
  const lintel = Math.max(5, h * 0.03);
  ctx.fillStyle = PALETTE.timberLit;
  ctx.fillRect(0, top, w, lintel);

  // Plank doors filling the lower (street-visible) half.
  const doorX = post;
  const doorW = w - post * 2;
  const doorTop = h * 0.5;
  const doorH = h - doorTop;
  ctx.fillStyle = PALETTE.doorPlank;
  ctx.fillRect(doorX, doorTop, doorW, doorH);
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
  const battenYs = [doorTop + doorH * 0.16, doorTop + doorH * 0.52, doorTop + doorH * 0.86];
  for (const by of battenYs) {
    ctx.fillRect(doorX, by, doorW, Math.max(2, h * 0.01));
    const studs = 8;
    for (let i = 0; i <= studs; i++) {
      const sx = doorX + (doorW / studs) * i;
      ctx.beginPath();
      ctx.arc(sx, by + h * 0.005, Math.max(1.2, w * 0.01), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Faint lamp glow spilling under the gate.
  ctx.fillStyle = PALETTE.glow;
  ctx.fillRect(doorX, doorTop, doorW, doorH * 0.4);

  drawRoof(ctx, w, roofH, over);
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

  // Thin eave-shadow line just under the ridge lane so the standing crest reads
  // as a continuous tiled roofline rather than a hard-edged floating bar.
  ctx.fillStyle = PALETTE.eaveShadow;
  ctx.fillRect(0, roofY, w, Math.max(1, band * 0.004));
}
