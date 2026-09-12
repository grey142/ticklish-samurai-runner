import "./style.css";
import { Game } from "./game/Game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("canvas missing");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2d context missing");

const game = new Game(canvas, ctx);

void game.boot().then(() => {
  game.resize();
  window.addEventListener("resize", () => game.resize());
  let last = performance.now();
  const loop = (now: number): void => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.tick(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});
