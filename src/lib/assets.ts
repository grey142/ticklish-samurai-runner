export type Drawn = HTMLCanvasElement | HTMLImageElement;

export class ImageBank {
  private raw = new Map<string, HTMLImageElement>();
  private cut = new Map<string, HTMLCanvasElement>();

  async load(entries: { path: string; knockout: boolean }[]): Promise<void> {
    await Promise.all(
      entries.map(
        (entry) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              this.raw.set(entry.path, img);
              if (entry.knockout) this.cut.set(entry.path, knockoutCrop(img));
              resolve();
            };
            img.onerror = () => resolve();
            img.src = entry.path;
          }),
      ),
    );
  }

  has(path: string): boolean {
    return this.raw.has(path) || this.cut.has(path);
  }

  get(path: string): Drawn | null {
    return this.cut.get(path) ?? this.raw.get(path) ?? null;
  }

  scene(path: string): HTMLImageElement | null {
    return this.raw.get(path) ?? null;
  }
}

export function playerPosePath(pose: "run" | "jump" | "slash" | "climb"): string {
  return `./assets/player/${pose}.png`;
}

export function enemySpritePath(id: string, pose: "idle" | "grab" | "headless"): string {
  return `./assets/enemies/${id}/${pose}.png`;
}

export function projectilePath(id: string): string {
  return `./assets/projectiles/${id}/idle.png`;
}

export function cinematicPath(id: string, kind: "struggle" | "gameover", n: number): string {
  return `./assets/cinematics/${id}/${kind}-${n}.png`;
}

export function catalogPaths(enemyIds: string[], projectileIds: string[]): { path: string; knockout: boolean }[] {
  const out: { path: string; knockout: boolean }[] = [
    { path: playerPosePath("run"), knockout: true },
    { path: playerPosePath("jump"), knockout: true },
    { path: playerPosePath("slash"), knockout: true },
    { path: playerPosePath("climb"), knockout: true },
  ];
  for (const id of enemyIds) {
    out.push({ path: enemySpritePath(id, "idle"), knockout: true });
    out.push({ path: enemySpritePath(id, "grab"), knockout: true });
    out.push({ path: enemySpritePath(id, "headless"), knockout: true });
    for (let n = 1; n <= 3; n++) {
      out.push({ path: cinematicPath(id, "struggle", n), knockout: false });
      out.push({ path: cinematicPath(id, "gameover", n), knockout: false });
    }
  }
  for (const id of projectileIds) {
    out.push({ path: projectilePath(id), knockout: true });
    for (let n = 1; n <= 3; n++) {
      out.push({ path: cinematicPath(id, "struggle", n), knockout: false });
      out.push({ path: cinematicPath(id, "gameover", n), knockout: false });
    }
  }
  return out;
}

function knockoutCrop(img: HTMLImageElement): HTMLCanvasElement {
  const src = document.createElement("canvas");
  src.width = img.naturalWidth || img.width;
  src.height = img.naturalHeight || img.height;
  const ctx = src.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, src.width, src.height);
  const d = image.data;
  const w = src.width;
  const h = src.height;
  const corner = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
  const samples = [corner(2, 2), corner(w - 3, 2), corner(2, h - 3), corner(w - 3, h - 3)];
  const bg: [number, number, number] = [
    samples.reduce((a, s) => a + s[0], 0) / 4,
    samples.reduce((a, s) => a + s[1], 0) / 4,
    samples.reduce((a, s) => a + s[2], 0) / 4,
  ];
  const flat = (i: number): boolean => {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const avg = (r + g + b) / 3;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
    return (avg > 196 && chroma < 32) || dist < 48;
  };
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (seen[idx]) return;
    if (!flat(idx * 4)) return;
    seen[idx] = 1;
    stack.push(idx);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const idx = stack.pop()!;
    d[idx * 4 + 3] = 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
    push(x + 1, y + 1);
    push(x - 1, y - 1);
    push(x + 1, y - 1);
    push(x - 1, y + 1);
  }
  ctx.putImageData(image, 0, 0);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return src;
  const pad = 4;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad);
  maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const cut = document.createElement("canvas");
  cut.width = cw;
  cut.height = ch;
  const cctx = cut.getContext("2d");
  if (!cctx) return src;
  cctx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);
  return cut;
}

export function drawContained(
  ctx: CanvasRenderingContext2D,
  img: Drawn,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
  anchor: "bottom" | "center" = "bottom",
): void {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const s = Math.min(boxW / iw, boxH / ih);
  const dw = iw * s;
  const dh = ih * s;
  const dx = x + (boxW - dw) / 2;
  const dy = anchor === "bottom" ? y + boxH - dh : y + (boxH - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: Drawn,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): void {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const s = Math.max(boxW / iw, boxH / ih);
  const dw = iw * s;
  const dh = ih * s;
  ctx.drawImage(img, x + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
}
