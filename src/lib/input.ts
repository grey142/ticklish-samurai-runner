export type SwipeDir = "up" | "down" | "left" | "right";

export interface InputFrame {
  jumpPressed: boolean;
  jumpHeld: boolean;
  jumpReleased: boolean;
  swipe: SwipeDir | null;
  slash: boolean;
  perk: string | null;
  struggleTap: boolean;
  anyTap: boolean;
  ui: string | null;
  scroll: number;
  tapX: number;
  tapY: number;
  pauseToggle: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Pointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startT: number;
  zone: "play" | "slash" | "ui";
}

const SWIPE_MIN = 42;

/** Map a client (CSS) point into the same view space used to draw UI. Never use canvas.width (DPR buffer). */
export function pointerToView(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  const rw = rect.width || 1;
  const rh = rect.height || 1;
  const vw = viewW > 0 ? viewW : rw;
  const vh = viewH > 0 ? viewH : rh;
  return {
    x: ((clientX - rect.left) / rw) * vw,
    y: ((clientY - rect.top) / rh) * vh,
  };
}

export function hitRect(x: number, y: number, box: Rect): boolean {
  if (box.w <= 0 || box.h <= 0) return false;
  return x >= box.x && y >= box.y && x <= box.x + box.w && y <= box.y + box.h;
}

export class Input {
  private pointers = new Map<number, Pointer>();
  private jumpHeld = false;
  private jumpPressed = false;
  private jumpReleased = false;
  private swipe: SwipeDir | null = null;
  private slashQueued = false;
  private perkQueued: string | null = null;
  private tapQueued = false;
  keys = new Set<string>();
  /** Logical/CSS view size — must match Game.w/h and the ctx transform space. */
  viewW = 1;
  viewH = 1;
  mashAll = false;
  slashRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  perkRects: (Rect & { id: string })[] = [];
  uiRects: (Rect & { id: string })[] = [];
  lastUi: string | null = null;
  private scrollAcc = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private pauseQueued = false;

  setView(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
  }

  attach(canvas: HTMLCanvasElement): void {
    const opts: AddEventListenerOptions = { passive: false };
    canvas.addEventListener("pointerdown", (e) => this.onDown(e, canvas), opts);
    canvas.addEventListener("pointermove", (e) => this.onMove(e, canvas), opts);
    canvas.addEventListener("pointerup", (e) => this.onUp(e, canvas), opts);
    canvas.addEventListener("pointercancel", (e) => this.onUp(e, canvas), opts);
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
      },
      opts,
    );
    canvas.addEventListener(
      "contextmenu",
      (e) => {
        e.preventDefault();
      },
      opts,
    );
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        if (!e.repeat) {
          this.jumpPressed = true;
          this.jumpHeld = true;
          this.tapQueued = true;
        }
        e.preventDefault();
      }
      if ((e.code === "KeyC" || e.code === "KeyE") && !e.repeat) this.swipe = "up";
      if ((e.code === "KeyS" || e.code === "ArrowDown") && !e.repeat) this.swipe = "down";
      if (e.code === "KeyJ" || e.code === "KeyK") this.slashQueued = true;
      if (/^Digit[1-8]$/.test(e.code) && !e.repeat) this.perkQueued = `slot-${e.code.slice(5)}`;
      if (e.code === "Enter") this.tapQueued = true;
      if (e.code === "Escape" && !e.repeat) this.pauseQueued = true;
      if (e.code === "KeyP" && !e.repeat) this.pauseQueued = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        this.jumpHeld = false;
        this.jumpReleased = true;
      }
    });
  }

  local(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): { x: number; y: number } {
    return pointerToView(e.clientX, e.clientY, canvas.getBoundingClientRect(), this.viewW, this.viewH);
  }

  hitAt(x: number, y: number): { ui: string | null; perk: string | null; slash: boolean } {
    const perk = this.perkRects.find((p) => hitRect(x, y, p));
    if (perk) return { ui: null, perk: perk.id, slash: false };
    const ui = this.uiRects.find((p) => hitRect(x, y, p));
    if (ui) return { ui: ui.id, perk: null, slash: false };
    if (hitRect(x, y, this.slashRect)) return { ui: null, perk: null, slash: true };
    return { ui: null, perk: null, slash: false };
  }

  private onDown(e: PointerEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* some WebViews reject capture */
    }
    const { x, y } = this.local(e, canvas);
    this.lastTapX = x;
    this.lastTapY = y;
    if (this.mashAll) {
      this.tapQueued = true;
      this.jumpPressed = true;
      this.jumpHeld = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "play" });
      return;
    }
    const hit = this.hitAt(x, y);
    if (hit.perk) {
      this.perkQueued = hit.perk;
      this.tapQueued = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "ui" });
      return;
    }
    if (hit.ui) {
      this.lastUi = hit.ui;
      this.tapQueued = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "ui" });
      return;
    }
    if (hit.slash) {
      this.slashQueued = true;
      this.tapQueued = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "slash" });
      return;
    }
    this.jumpPressed = true;
    this.jumpHeld = true;
    this.tapQueued = true;
    this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "play" });
  }

  private onMove(e: PointerEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const { x, y } = this.local(e, canvas);
    this.scrollAcc += p.y - y;
    p.x = x;
    p.y = y;
  }

  private onUp(e: PointerEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const p = this.pointers.get(e.pointerId);
    const { x, y } = this.local(e, canvas);
    this.pointers.delete(e.pointerId);
    if (!p) return;
    if (p.zone === "play") {
      const dx = x - p.startX;
      const dy = y - p.startY;
      if (Math.hypot(dx, dy) > SWIPE_MIN) {
        this.swipe = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "down" : "up") : dx > 0 ? "right" : "left";
      }
      this.jumpHeld = [...this.pointers.values()].some((q) => q.zone === "play");
      this.jumpReleased = !this.jumpHeld;
    }
  }

  consume(): InputFrame {
    const ui = this.lastUi;
    const frame: InputFrame = {
      jumpPressed: this.jumpPressed,
      jumpHeld: this.jumpHeld || this.keys.has("Space") || this.keys.has("KeyW"),
      jumpReleased: this.jumpReleased,
      swipe: this.swipe,
      slash: this.slashQueued,
      perk: this.perkQueued,
      struggleTap: this.tapQueued,
      anyTap: this.tapQueued || this.slashQueued,
      ui,
      scroll: this.scrollAcc,
      tapX: this.lastTapX,
      tapY: this.lastTapY,
      pauseToggle: this.pauseQueued,
    };
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.swipe = null;
    this.slashQueued = false;
    this.perkQueued = null;
    this.tapQueued = false;
    this.lastUi = null;
    this.scrollAcc = 0;
    this.pauseQueued = false;
    return frame;
  }
}
