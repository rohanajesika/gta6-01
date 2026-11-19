# Solmar Bay — Open-World Crime

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rohanajesika/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rohanajesika/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game built with three.js for the make.fun
**gta6-01 "Make GTA 6"** bounty. No characters, names, art, music or
maps from any commercial game — the city, the people and the story are
all invented for this entry.

## The game

Mara Voss arrives in Solmar Bay with $250 and a borrowed name. Fixer
Delia Kross has five jobs: steal a coupe, run a bayfront pickup, lose
the Bay Police in a getaway, hold the dockside deal against rivals,
and pull the Solmar Heist. Between jobs the city is free roam: walk
the streets, take any car, and watch your wanted level.

- A procedural coastal city: gridded streets, towers, palms, a beach
  and a marina pier, all generated from a seed (`?seed=` replays it).
- Traffic that drives the roads and pedestrians who stroll the
  sidewalks — and flee when shots are fired.
- Steal and drive cars (E), a 5-star wanted level, police cars that
  chase and ram, and foot officers who bust you up close.
- Combat on foot: pistol (click) and punch (F), with ammo and health.
- Five story missions with markers, a HUD with health, cash, ammo,
  wanted stars and a live minimap, plus start/pause/busted screens
  and localStorage saves (S).

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| Mouse drag | Look around |
| E | Enter / exit a car |
| Click | Shoot (on foot) |
| F | Punch |
| M | Start the next job |
| P | Pause |
| S | Save |
| R | Restock ammo |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory
and writes `dossier.json` with the kit's vendored library. The four
screenshots in `screenshots/` were taken from this game running in a
headless browser (see `tools/screenshot.mjs`); the playtest driver is
`tools/playtest.mjs`.

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
