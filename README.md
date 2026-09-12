# Ticklish Samurai Runner

Landscape-phone 2D endless runner. **Ikiela**, a ticklish samurai, auto-runs the old imperial city and mashes out of tickle-zombie grabs. Pretty NSFW on purpose. Placeholders in v1.

Play: **https://grey142.github.io/ticklish-samurai-runner/**

If that 404s, a repo admin still needs one Settings click: **Settings → Pages → Source = GitHub Actions**. The deploy workflow is already in `.github/workflows/deploy-pages.yml`.

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

- `public/data/` — design JSON (`game`, `enemies`, `shop`, `cinematics`)
- `public/assets/player|enemies/<id>|projectiles/<id>|cinematics/<id>/{struggle,gameover}` — colored SVG placeholders
- `src/game/` — canvas loop
- `src/lib/rules.ts` — economy / spawn / slash math (unit tested)

Regenerate placeholder art:

```bash
npm run placeholders
```

## GitHub Pages

Pushes to `main` build with Vite and deploy the `dist` folder via GitHub Actions (`actions/deploy-pages`). Expected URL:

`https://grey142.github.io/ticklish-samurai-runner/`
