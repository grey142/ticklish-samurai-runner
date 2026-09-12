import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "public/assets");

const enemies = [
  ["drone", "#6fb36f"],
  ["viner", "#3d8b4a"],
  ["quad-arm", "#8fbf6a"],
  ["bolter", "#c9d36a"],
  ["hundred-hands", "#9ad17a"],
  ["licker", "#d47aa0"],
  ["spider", "#2a2a32"],
  ["slimer", "#6ad18a"],
  ["archer", "#8a6a4a"],
  ["volatile", "#d14a7a"],
  ["brute", "#5a7a4a"],
  ["hand-thrower", "#c98a6a"],
];
const projectiles = [
  ["egg-web", "#e8e8f0"],
  ["slime-shot", "#7dff9a"],
  ["bolo-wrap", "#c4a06a"],
  ["throwing-hand", "#e8b89a"],
];

function svg(body, w = 128, h = 160) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${body}
</svg>
`;
}

function write(rel, contents) {
  const path = join(assets, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function figure(color, label, bikini = false) {
  const top = bikini
    ? `<rect x="38" y="70" width="52" height="16" fill="#c81e3a"/>
       <rect x="42" y="108" width="44" height="12" fill="#c81e3a"/>
       <rect x="40" y="86" width="48" height="22" fill="#e8b496"/>`
    : `<rect x="34" y="64" width="60" height="28" fill="#cfd6de"/>
       <rect x="40" y="92" width="48" height="18" fill="#e8b496"/>
       <rect x="36" y="110" width="56" height="26" fill="#cfd6de"/>`;
  return svg(`
  <rect width="128" height="160" fill="#1a1020"/>
  <rect x="36" y="18" width="56" height="78" fill="#111"/>
  <circle cx="64" cy="36" r="16" fill="#f0c8a8"/>
  <rect x="40" y="16" width="48" height="14" fill="#111"/>
  ${top}
  <rect x="44" y="140" width="12" height="14" fill="#e8b496"/>
  <rect x="72" y="140" width="12" height="14" fill="#e8b496"/>
  <rect x="8" y="8" width="16" height="16" fill="${color}"/>
  <text x="8" y="154" fill="#f4e7d8" font-size="10" font-family="sans-serif">${label}</text>
`);
}

function blob(color, label) {
  return svg(
    `
  <rect width="96" height="96" fill="#140c16"/>
  <circle cx="48" cy="48" r="28" fill="${color}"/>
  <text x="8" y="88" fill="#f4e7d8" font-size="10" font-family="sans-serif">${label}</text>
`,
    96,
    96,
  );
}

write("player/idle.svg", figure("#cfd6de", "Ikiela idle"));
write("player/jump.svg", figure("#cfd6de", "Ikiela jump"));
write("player/slash.svg", figure("#cfd6de", "Ikiela slash"));
write("player/struggle.svg", figure("#cfd6de", "struggle armor"));
write("player/gameover.svg", figure("#c81e3a", "game over", true));

for (const [id, color] of enemies) {
  write(`enemies/${id}/idle.svg`, blob(color, id));
  write(`cinematics/${id}/struggle/1.svg`, figure(color, `${id} s1`));
  write(`cinematics/${id}/struggle/2.svg`, figure(color, `${id} s2`));
  write(`cinematics/${id}/struggle/3.svg`, figure(color, `${id} s3`));
  write(`cinematics/${id}/gameover/1.svg`, figure(color, `${id} over`, true));
}
for (const [id, color] of projectiles) {
  write(`projectiles/${id}/idle.svg`, blob(color, id));
  write(`cinematics/${id}/struggle/1.svg`, figure(color, `${id} s1`));
  write(`cinematics/${id}/struggle/2.svg`, figure(color, `${id} s2`));
  write(`cinematics/${id}/struggle/3.svg`, figure(color, `${id} s3`));
  write(`cinematics/${id}/gameover/1.svg`, figure(color, `${id} over`, true));
}

write(
  "ui/logo.svg",
  svg(`<rect width="128" height="160" fill="#120c14"/><text x="10" y="80" fill="#ff4d8d" font-size="16">TSR</text>`),
);

console.log("placeholders written");
