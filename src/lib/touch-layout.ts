import type { Rect } from "./input";

export function thumbHit(viewW: number, viewH: number): number {
  return Math.max(56, Math.min(96, Math.round(Math.min(viewW, viewH) * 0.22)));
}

export function layoutPlayControls(
  w: number,
  h: number,
  perkIds: string[],
): { slash: Rect; perks: (Rect & { id: string })[] } {
  const pad = Math.max(12, Math.round(Math.min(w, h) * 0.03));
  const phone = h < 520 || w < 960;
  const slashS = phone ? Math.max(72, thumbHit(w, h)) : 124;
  const slash: Rect = { x: w - pad - slashS, y: h - pad - slashS, w: slashS, h: slashS };
  const perkW = Math.max(56, Math.min(slashS, 136));
  const perkH = Math.max(48, Math.round(slashS * 0.52));
  const perks = perkIds.map((id, i) => ({
    id,
    x: w - pad - perkW,
    y: h - pad - slashS - 10 - (i + 1) * (perkH + 8),
    w: perkW,
    h: perkH,
  }));
  return { slash, perks };
}

function stack(ids: string[], w: number, h: number, topFrac: number): (Rect & { id: string })[] {
  const btnH = Math.max(56, Math.min(72, Math.round(h * 0.11)));
  const btnW = Math.min(440, Math.max(280, Math.round(w * 0.46)));
  const gap = Math.max(10, Math.round(btnH * 0.18));
  const block = btnH * ids.length + gap * Math.max(0, ids.length - 1);
  const top = Math.max(12, Math.min(h * topFrac, h - block - 16));
  const x = (w - btnW) / 2;
  return ids.map((id, i) => ({ id, x, y: top + i * (btnH + gap), w: btnW, h: btnH }));
}

export function layoutMenu(w: number, h: number): (Rect & { id: string })[] {
  return stack(["play", "shop", "howto"], w, h, 0.48);
}

export function layoutHowto(w: number, h: number): (Rect & { id: string })[] {
  const btnH = Math.max(56, Math.min(64, Math.round(h * 0.12)));
  return [{ id: "back", x: 12, y: 10, w: Math.max(120, Math.min(180, w * 0.22)), h: btnH }];
}

export function layoutShop(
  w: number,
  h: number,
  tab: "blades" | "armor" | "slash",
  rowIds: string[],
  prefix: string,
): (Rect & { id: string })[] {
  const btnH = Math.max(56, Math.min(64, Math.round(h * 0.12)));
  const pad = 12;
  const tabW = Math.max(88, Math.min(140, Math.round((w - pad * 2 - 8 * 3) / 4)));
  const rects: (Rect & { id: string })[] = [
    { id: "back", x: pad, y: pad, w: tabW, h: btnH },
    { id: "tab-blades", x: pad + tabW + 8, y: pad, w: tabW, h: btnH },
    { id: "tab-armor", x: pad + (tabW + 8) * 2, y: pad, w: tabW, h: btnH },
    { id: "tab-slash", x: pad + (tabW + 8) * 3, y: pad, w: tabW + 16, h: btnH },
  ];
  const bodyY = pad + btnH + 12;
  const rowH = Math.max(52, Math.min(60, Math.round(h * 0.12)));
  if (tab === "slash") {
    rects.push({ id: "buy-slash", x: pad, y: bodyY + 120, w: Math.min(360, w - pad * 2), h: rowH });
  } else {
    const colW = Math.min(360, (w - pad * 2 - 12) / 2);
    rowIds.forEach((id, i) => {
      const col = i % 2;
      const rowI = Math.floor(i / 2);
      rects.push({
        id: prefix + id,
        x: pad + col * (colW + 12),
        y: bodyY + rowI * (rowH + 8),
        w: colW,
        h: rowH,
      });
    });
  }
  return rects;
}

export function layoutGameOver(w: number, h: number, showRevive: boolean): (Rect & { id: string })[] {
  const ids = showRevive ? ["revive", "retry", "shop", "menu"] : ["retry", "shop", "menu"];
  return stack(ids, w, h, 0.58);
}

export function isTruePortrait(innerW: number, innerH: number): boolean {
  return innerH > innerW && Math.min(innerW, innerH) < 900;
}
