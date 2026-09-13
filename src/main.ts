import "./style.css";
import { Game } from "./game/Game";
import { isTruePortrait } from "./lib/touch-layout";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("canvas missing");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2d context missing");

const app = document.querySelector<HTMLElement>("#app");
const rotate = document.querySelector<HTMLElement>("#rotate");

function fitShell(): void {
  if (app) {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    app.style.width = `${w}px`;
    app.style.height = `${h}px`;
  }
  if (rotate) {
    const portrait = isTruePortrait(window.innerWidth, window.innerHeight);
    rotate.classList.toggle("show", portrait);
    rotate.setAttribute("aria-hidden", portrait ? "false" : "true");
  }
}

fitShell();

const game = new Game(canvas, ctx);
(window as unknown as { __tsr?: Game }).__tsr = game;
game.resize();
ctx.fillStyle = "#120c14";
ctx.fillRect(0, 0, game.w, game.h);
ctx.fillStyle = "#ff4d8d";
ctx.font = "700 28px Trebuchet MS, sans-serif";
ctx.fillText("Loading Ikiela…", 40, game.h * 0.5);

function onViewport(): void {
  fitShell();
  game.resize();
}

window.addEventListener("resize", onViewport);
window.addEventListener("orientationchange", onViewport);
window.visualViewport?.addEventListener("resize", onViewport);
window.visualViewport?.addEventListener("scroll", onViewport);

void game.boot().then(() => {
  game.resize();
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
