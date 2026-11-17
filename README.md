# Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rohanajesika/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rohanajesika/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty, built
with three.js (vendored under `game/vendor/three`). No Rockstar / GTA names,
art or assets anywhere — the city, the characters and the story are all new.

## The game

Danny Cole owes the Marlin crew $2,400. Three jobs clear the debt — if the
Solmar police do not catch him first.

- **A coastal city to explore** on foot and by car: a road grid of downtown
  towers, a beach, the sea and Harbor Pier.
- **Traffic and pedestrians** that drive the roads and stroll the sidewalks —
  and scatter when shots are fired.
- **Steal and drive cars**: walk up to any parked car, press E, and it is
  yours. The yellow taxi by the start is the easy one; the red Comet is the
  crew's prize.
- **A wanted level (0–5 stars)** with police who respond: steal a car, hit a
  pedestrian or shoot one and the cops come. Ram the player's car, bust him
  on foot. Lay low and the stars fade.
- **Three story missions**: pick up a package at the Marina Kiosk and deliver
  it to Harbor Pier; "borrow" the red Comet for the garage; one last guarded
  job on the pier, then bring the duffel home.
- **Combat**: pistol (F, with reload), punch (left click), and armed pier
  guards who shoot back.
- **HUD with minimap**, health, cash, ammo, speed and the current objective.
- **Start screen, pause menu, game over (BUSTED / WASTED)** and saving to
  localStorage (autosaves on every finished mission).
- **Synthesised sound** (WebAudio, no audio files): engine hum, two-tone
  siren, gunshots, pickup chimes. M mutes.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080>.

## How to play

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse drag | Look around |
| Shift | Run |
| E | Enter / exit a car (steal it) |
| F | Fire pistol |
| Left click | Punch |
| R | Reload |
| Space | Handbrake (in a car) |
| P / Esc | Pause |
| M | Mute sound |

Follow the yellow beacon and the objective line at the bottom of the screen.
The minimap (top right) shows the mission marker, traffic and police cars.

## Layout

- `game/` — the whole game, static files only. `game/index.html` loads
  `game/src/main.js`; three.js r187 is vendored at
  `game/vendor/three/three.module.min.js`.
- `game/src/` — one module per job: `config` (tuning + story), `rng`,
  `input`, `audio`, `city`, `player`, `vehicles`, `traffic`, `police`,
  `missions`, `combat`, `effects`, `hud`, `shots`, `main`.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the
  output and writes `dossier.json` with the kit's `buildDossier`.
- `screenshots/` — four real renders of the game in a headless browser
  (`1-chase.jpg` is the cover: a police chase with the wanted level,
  minimap and mission objective on the HUD).

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?ref=dn6jj4hs&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
