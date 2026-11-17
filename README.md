# Solmar Bay — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/epanpai/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/epanpai/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun's **gta6-01** bounty: a
sun-soaked coastal city to explore on foot and by car, with traffic and
pedestrians, cars to steal, a wanted level with police who respond, six
story missions, combat, a HUD with a minimap, a start screen and saves.
Every name, character, vehicle, story, sound and piece of art is original —
nothing from Rockstar Games or any other commercial game.

## The city

**Solmar Bay** is a 14×14-block coastal city: downtown towers, a plaza,
parks with ponds, a marina, and Palmera Beach along the south shore. You play
**Jax Moreno**, a wheelman pulled back into the life by fixer **Lena Cruz**
and crew boss **Big T**.

## How to play

- **On foot** — WASD / arrows to walk (Shift to run), mouse to aim, click to
  shoot, **E** to enter a car, **T** to hail a taxi fare.
- **Driving** — W / S gas & brake, A / D steer, Space handbrake, **E** to
  get out. Stealing a car raises your wanted level.
- **Wanted** — crimes raise your stars; police cars and foot cops hunt you.
  Break line of sight and lay low until the stars fade — or get busted.
- **Missions** — drive to the yellow **!** marker to start one of six story
  missions, from stealing your first car to cracking the City Hall vault.
- **Side jobs** — taxi fares and street cash keep your pockets full.
- **P** pause · **M** mute · **R** restart from save. Progress saves
  automatically (money, missions, position).

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files, and every
sound and music loop is synthesized live with WebAudio.

## Layout

- `game/` — the playable game (`index.html` + `src/` modules)
- `game/src/config.js` — world constants & tuning
- `game/src/city.js` — procedural city generation
- `game/src/entities.js` — cars, pedestrians, particles
- `game/src/police.js` — wanted level & police AI
- `game/src/missions.js` — story missions & taxi jobs
- `game/src/combat.js` — shooting & armed rivals
- `game/src/render.js` — top-down city rendering
- `game/src/hud.js` — HUD, minimap & menus
- `game/src/audio.js` — synthesized sound & music
- `game/src/save.js` — localStorage saves
- `game/src/shots.js` — deterministic screenshot poses
- `screenshots/` — real renders of the game in a browser
- `main.ts` — the make.fun program that hands the entry in
