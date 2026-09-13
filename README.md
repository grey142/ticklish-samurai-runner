# Ticklish Samurai Runner

Landscape-phone 2D endless runner. **Ikiela**, a ticklish samurai, auto-runs the old imperial city and mashes out of tickle-zombie grabs. Pretty NSFW on purpose. Real PNG sprites + cinematic stills (release `assets-v1`).

Play: **https://grey142.github.io/ticklish-samurai-runner/**

That URL goes live after this lands on `main` **and** a repo admin does the leftover GitHub Settings clicks the Actions token cannot do:

1. **Settings → General → Danger Zone → Change repository visibility → Public** (the repo is private today; GitHub Free will not serve a public `*.github.io` site from a private repo).
2. **Settings → Pages → Source = GitHub Actions**.

## Local

```bash
npm install
npm test
npm run dev
```

Open the printed local URL (Vite, default `http://localhost:5173`). Use a landscape window or phone.

```bash
npm run build
npm run preview
```

## Controls

Thumb zone = most of the screen. Right button = slash.

| Action | Touch | Desktop |
| --- | --- | --- |
| Jump (hold-sensitive first jump) | tap / hold | Space or W |
| Double jump | second tap in air | Space again |
| Slam | swipe down in air | S / ↓ |
| Climb roofs | swipe up | C or E |
| Drop off roof | swipe down on roof | S / ↓ |
| Slash | SLASH button | J |
| Manual blade perk | perk button | 1 / 2 / 3 |
| Struggle escape | mash anywhere | mash Space / click |

First jump: same max height (~half screen, ~3s if held). Letting go starts the fall early. Double jump is not hold-sensitive (~3/4 screen, ~+2s). No fall damage. The run never pauses except for a struggle resolve or death.

## Rules (v1)

- Speed levels at 0 / 200 / 350 / 500 / 800 / 1000 m (+2% run speed each).
- 1 point per 6 m. 1 coin per 6 points. Roof-jump kills pay double. Revive once/run for 300 coins.
- Grab or tickle projectile → pink flash + laugh each second, mash +6 to 100, hold ≤16s, cinematic every 4s (3 beats). Fail → game-over cinematic.
- Spawn stagger ≥6 m. Hard cap /100 m: L1 10, L2 13, L3 15, L4 18, L5 20, L6 23.
- 12 enemies + 4 projectiles. Egg web traps, then tiny spiders tickle (the spider body does not grab). Bolo wraps ankles, then tickles feet.
- Shop: 7 katanas, 7 armors, slash recharge ×5 (100→1600). **Hayate** passively halves final slash recharge. Shadow Strike / Call Lightning / Blade of Souls are manual buttons.
- Unlocks persist in `localStorage` key `tsr-save-v1`. Starter loadout: Ikiela's Katana + Ikiela's Robes.

## Layout

- `public/data/` — design JSON (`game`, `enemies`, `shop`, `cinematics`) plus `cinematics-manifest.json`
- `public/assets/player/*.png` — `run`, `jump`, `slash`, `climb` (plus `run-sheet`, alts, `ref.jpg`)
- `public/assets/enemies/<id>/{idle,grab,headless,throw}.png`
- `public/assets/projectiles/<id>/idle.png`
- `public/assets/cinematics/<id>/struggle-1..3.png` and `gameover-1..3.png` (12 enemies + 4 projectiles)
- `public/assets/ability-vfx/` — Shadow Strike / Call Lightning / Blade of Souls / electrocute-wind sheets. Kitsune shade tints the existing player sprite `#9B4DFF` (no extra pack).
- `src/game/` — canvas loop; loaders knock out the studio backdrop on gameplay sprites
- `src/lib/rules.ts` — economy / spawn / slash math (unit tested)

## GitHub Pages

Pushes to `main` build with Vite and deploy the `dist` folder via GitHub Actions (`actions/deploy-pages`). Expected URL:

`https://grey142.github.io/ticklish-samurai-runner/`
