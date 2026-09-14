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
  const cols = perkIds.length > 4 ? 2 : 1;
  const perkW = Math.max(56, Math.min(slashS, 120));
  const room = Math.max(48, slash.y - pad - 8);
  const rows = Math.max(1, Math.ceil(perkIds.length / cols));
  const perkH = Math.max(48, Math.min(56, Math.floor((room - (rows - 1) * 6) / rows)));
  const perks = perkIds.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id,
      x: w - pad - (col + 1) * perkW - col * 6,
      y: slash.y - 8 - (row + 1) * (perkH + 6),
      w: perkW,
      h: perkH,
    };
  });
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
  const ids = ["play", "shop", "compendium", "gallery", "cheats", "howto"];
  const pad = 12;
  const gap = 8;
  const cols = 2;
  const rows = 3;
  const btnH = Math.max(48, Math.min(56, Math.round(h * 0.12)));
  const left = Math.max(pad, Math.round(w * 0.34));
  const btnW = Math.min(260, Math.max(132, Math.round((w - left - pad - gap) / cols)));
  const blockH = btnH * rows + gap * (rows - 1);
  const top = Math.max(12, Math.min(Math.round(h * 0.4), h - blockH - 12));
  return ids.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return { id, x: left + col * (btnW + gap), y: top + row * (btnH + gap), w: btnW, h: btnH };
  });
}

export function layoutPauseBtn(w: number, h: number): Rect & { id: string } {
  const btnW = Math.max(72, Math.min(96, Math.round(w * 0.12)));
  const btnH = Math.max(40, Math.min(48, Math.round(h * 0.1)));
  return { id: "pause", x: w - 12 - btnW, y: 12, w: btnW, h: btnH };
}

export function layoutPauseOverlay(w: number, h: number): (Rect & { id: string })[] {
  const btnH = Math.max(56, Math.min(64, Math.round(h * 0.12)));
  const btnW = Math.min(360, Math.max(220, Math.round(w * 0.4)));
  const x = (w - btnW) / 2;
  const y = h * 0.42;
  return [
    { id: "resume", x, y, w: btnW, h: btnH },
    { id: "cheats", x, y: y + btnH + 12, w: btnW, h: btnH },
  ];
}

export function layoutBackChrome(w: number, h: number): (Rect & { id: string })[] {
  const btnH = Math.max(48, Math.min(56, Math.round(h * 0.12)));
  const backW = Math.max(120, Math.min(180, w * 0.2));
  const pageW = Math.max(56, Math.min(72, Math.round(w * 0.1)));
  return [
    { id: "back", x: 12, y: 10, w: backW, h: btnH },
    { id: "page-up", x: w - 12 - pageW * 2 - 8, y: 10, w: pageW, h: btnH },
    { id: "page-down", x: w - 12 - pageW, y: 10, w: pageW, h: btnH },
  ];
}

export function layoutCheatRows(
  w: number,
  h: number,
  ids: string[],
  scroll: number,
): { rows: (Rect & { id: string })[]; maxScroll: number; bodyY: number; bodyH: number } {
  const chrome = layoutBackChrome(w, h);
  const bodyY = chrome[0].y + chrome[0].h + 10;
  const bodyH = h - bodyY - 10;
  const rowH = Math.max(40, Math.min(48, Math.round(h * 0.11)));
  const gap = 6;
  const rows = ids.map((id, i) => ({
    id: `cheat-${id}`,
    x: 12,
    y: bodyY + 8 + i * (rowH + gap) - scroll,
    w: w - 24,
    h: rowH,
  }));
  const content = ids.length * (rowH + gap) + 8;
  return { rows, maxScroll: Math.max(0, content - bodyH), bodyY, bodyH };
}

export function browseBody(w: number, h: number): { bodyY: number; bodyH: number } {
  const chrome = layoutBackChrome(w, h);
  const bodyY = chrome[0].y + chrome[0].h + 8;
  return { bodyY, bodyH: h - bodyY - 8 };
}

export function layoutHowto(w: number, h: number): (Rect & { id: string })[] {
  const btnH = Math.max(56, Math.min(64, Math.round(h * 0.12)));
  return [{ id: "back", x: 12, y: 10, w: Math.max(120, Math.min(180, w * 0.22)), h: btnH }];
}

export type ShopTab = "blades" | "armor" | "techniques" | "upgrades";

export function layoutShop(
  w: number,
  h: number,
  tab: ShopTab,
  rowIds: string[],
  prefix: string,
): (Rect & { id: string })[] {
  const btnH = Math.max(48, Math.min(56, Math.round(h * 0.11)));
  const pad = 10;
  const gap = 6;
  const backW = Math.max(72, Math.min(120, Math.round(w * 0.16)));
  const rects: (Rect & { id: string })[] = [{ id: "back", x: pad, y: pad, w: backW, h: btnH }];
  const tabs = ["tab-blades", "tab-armor", "tab-techniques", "tab-upgrades"];
  const tabY = pad + btnH + gap;
  const tabW = Math.max(64, Math.floor((w - pad * 2 - gap * (tabs.length - 1)) / tabs.length));
  tabs.forEach((id, i) => {
    rects.push({ id, x: pad + i * (tabW + gap), y: tabY, w: tabW, h: btnH });
  });
  const bodyY = tabY + btnH + 10;
  const rowH = Math.max(48, Math.min(56, Math.round(h * 0.11)));
  const colW = Math.min(360, (w - pad * 2 - 12) / 2);
  const extra = tab === "upgrades" ? 28 : 0;
  rowIds.forEach((id, i) => {
    const col = i % 2;
    const rowI = Math.floor(i / 2);
    rects.push({
      id: prefix + id,
      x: pad + col * (colW + 12),
      y: bodyY + extra + rowI * (rowH + 8),
      w: colW,
      h: rowH,
    });
  });
  return rects;
}

export function layoutGameOver(w: number, h: number, showRevive: boolean): (Rect & { id: string })[] {
  const ids = showRevive ? ["revive", "retry", "shop", "menu"] : ["retry", "shop", "menu"];
  return stack(ids, w, h, 0.58);
}

export function isTruePortrait(innerW: number, innerH: number): boolean {
  return innerH > innerW && Math.min(innerW, innerH) < 900;
}
