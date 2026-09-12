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
  slashRect = { x: 0, y: 0, w: 0, h: 0 };
  perkRects: { id: string; x: number; y: number; w: number; h: number }[] = [];
  uiRects: { id: string; x: number; y: number; w: number; h: number }[] = [];
  lastUi: string | null = null;

  attach(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("pointerdown", (e) => this.onDown(e, canvas));
    canvas.addEventListener("pointermove", (e) => this.onMove(e, canvas));
    canvas.addEventListener("pointerup", (e) => this.onUp(e, canvas));
    canvas.addEventListener("pointercancel", (e) => this.onUp(e, canvas));
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
      if (e.code === "KeyJ" || e.code === "KeyK") this.slashQueued = true;
      if (e.code === "Digit1") this.perkQueued = "shadow-strike";
      if (e.code === "Digit2") this.perkQueued = "call-lightning";
      if (e.code === "Digit3") this.perkQueued = "blade-of-souls";
      if (e.code === "Enter" || e.code === "KeyP") this.tapQueued = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        this.jumpHeld = false;
        this.jumpReleased = true;
      }
    });
  }

  private local(e: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  }

  private hit(x: number, y: number, box: { x: number; y: number; w: number; h: number }): boolean {
    return x >= box.x && y >= box.y && x <= box.x + box.w && y <= box.y + box.h;
  }

  private onDown(e: PointerEvent, canvas: HTMLCanvasElement): void {
    const { x, y } = this.local(e, canvas);
    const perk = this.perkRects.find((p) => this.hit(x, y, p));
    if (perk) {
      this.perkQueued = perk.id;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "ui" });
      return;
    }
    const ui = this.uiRects.find((p) => this.hit(x, y, p));
    if (ui) {
      this.lastUi = ui.id;
      this.tapQueued = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "ui" });
      return;
    }
    if (this.hit(x, y, this.slashRect)) {
      this.slashQueued = true;
      this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "slash" });
      return;
    }
    this.jumpPressed = true;
    this.jumpHeld = true;
    this.tapQueued = true;
    this.pointers.set(e.pointerId, { id: e.pointerId, x, y, startX: x, startY: y, startT: performance.now(), zone: "play" });
  }

  private onMove(e: PointerEvent, canvas: HTMLCanvasElement): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const { x, y } = this.local(e, canvas);
    p.x = x;
    p.y = y;
  }

  private onUp(e: PointerEvent, canvas: HTMLCanvasElement): void {
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
    const swipeDownKey = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const swipeUpKey = this.keys.has("KeyC") || this.keys.has("KeyE");
    const ui = this.lastUi;
    const frame: InputFrame = {
      jumpPressed: this.jumpPressed,
      jumpHeld: this.jumpHeld || this.keys.has("Space") || this.keys.has("KeyW"),
      jumpReleased: this.jumpReleased,
      swipe: this.swipe ?? (swipeDownKey ? "down" : swipeUpKey ? "up" : null),
      slash: this.slashQueued,
      perk: this.perkQueued,
      struggleTap: this.tapQueued,
      anyTap: this.tapQueued || this.slashQueued,
      ui,
    };
    this.jumpPressed = false;
    this.jumpReleased = false;
    this.swipe = null;
    this.slashQueued = false;
    this.perkQueued = null;
    this.tapQueued = false;
    this.lastUi = null;
    return frame;
  }
}
