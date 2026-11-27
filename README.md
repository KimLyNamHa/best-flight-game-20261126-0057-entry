# Skylark — Island Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/KimLyNamHa/best-flight-game-20261126-0057-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/KimLyNamHa/best-flight-game-20261126-0057-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A little 3D flight game for the make.fun bounty **Make the best flight game**. One island, one runway, one cheerful prop plane — fly it in chase view over green hills, a lake, a mountain and a small town.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server — no network needed, everything is vendored). Pick a sortie on the title screen:

- **Ring Run** — fly through 8 glowing rings in order against the clock.
- **Touch & Go** — take off, round the lake buoy, land back on the runway.
- **Supply Drop** — carry crates to the lake camp; press Space over the glowing circle, low and slow.
- **Free Flight** — no objective, just fly.

Controls: **W/S** throttle, **arrow keys** pitch and roll, **A/D** rudder, **Space** action, **R** restart, **P** pause, **M** mute.

Throttle burns fuel, and an empty tank means gliding home. Fly too slow and the wing stalls; come down too hard or too fast and the Skylark is down. A gentle touchdown on the runway scores best.

## Layout

- `game/index.html` — the page, with an import map for three.js
- `game/src/main.js` — bootstrap, game loop, screen state
- `game/src/flight.js` — the flight model (throttle, pitch, roll, lift, stall, fuel, damage)
- `game/src/terrain.js` — the procedural island, runway, town and trees
- `game/src/aircraft.js` — the low-poly plane
- `game/src/sky.js` — sky dome, sun, clouds and fog
- `game/src/rings.js` — target rings and the drop-zone beacon
- `game/src/hud.js` — the glowing instrument overlay
- `game/src/missions.js` — the four sorties
- `game/src/input.js` — keyboard
- `game/src/audio.js` — procedural WebAudio engine, wind and effects
- `game/src/camera.js` — the chase camera
- `game/src/shots.js` — deterministic screenshot poses (`?shot=start|play|land|end`)
- `game/vendor/three.module.min.js` — three.js r160, vendored
- `main.ts` — hands the game in (copies `game/` and `screenshots/`, writes `dossier.json`)

Built with three.js. All art, names and sounds are original.
