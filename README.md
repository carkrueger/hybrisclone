# HYBRISCLONE

A single-player vertical-scrolling shoot-'em-up in the spirit of *Hybris* (Amiga 500), built with **Phaser 4**.

- **Seeded procedural levels:** the same seed always produces the same station layout, enemy waves, power-up carriers, bosses and music.
- **Chiptune soundtrack:** every song and sound effect is synthesized live with WebAudio (pulse, triangle and noise voices). The music for each sector is composed from that sector's seed.
- **Mouse, keyboard or gamepad**, switching automatically to whichever device you used last.
- **Fully offline:** it has no asset files, no CDN and makes no network requests. All graphics are generated in code at boot.

## Run

```bash
npm install
npm run dev       # development server with hot reload
npm test          # determinism tests (RNG, level generator, music composer)
npm run build     # static build in dist/
npm run preview   # serve dist/ on http://localhost:4173
```

`dist/` is self-contained and can be served by any local static server. Browsers refuse to run ES modules from `file://`, so serve it rather than double-clicking `index.html`.

## Controls

| Action | Keyboard        | Mouse                 | Gamepad          |
|--------|-----------------|-----------------------|------------------|
| Move   | Arrows / WASD   | Ship follows pointer  | Left stick / D-pad |
| Fire   | Space / Z (hold)| Left button (hold)    | A / RB / RT      |
| Bomb   | X / Shift       | Right button          | B / LB / LT      |
| Pause  | Esc / P         | —                     | Start            |

Browsers only allow audio after a user gesture, so click or press a key once on the title screen to get sound. A gamepad button press does not count as a gesture.

## Seeds

On the title screen, select **SEED** and type up to 10 letters or digits, then press Enter. With a gamepad, press A to edit, use up/down to change a character, left/right to move, and A again to finish. **RANDOM SEED** rolls a new one. The current seed is shown in the HUD and stored with each high score, so a good run can be replayed.

## Gameplay

- Power pods (**P**) move the ship up a Hybris-style upgrade ladder: main gun spread, side guns, rear guns and homing missiles. Losing a ship costs one level.
- **B** pods add a smart bomb and **S** pods give bonus points.
- Destroying a whole formation gives a bonus.
- Each sector ends with a generated boss. Destroy its gun pods first: the core is armoured while they survive.
- You get an extra ship every 50,000 points.
- High scores are saved in `localStorage`. After game over you can continue from the same sector, but your score resets.

## Project layout

```
src/core     rng (cyrb53 + mulberry32, forkable streams), input manager, storage
src/level    pure, deterministic generators: backdrop tiles, waves, boss, sector
src/gfx      pixel-art definitions, 5x7 font, procedural tiles/textures
src/audio    WebAudio chip, lookahead sequencer, song composer, SFX
src/entities player, weapons, enemies, boss, pools, effects
src/scenes   Boot, Title, Game, Hud, Pause, GameOver
tests/       vitest determinism tests
```

Level generation never uses `Math.random`. Each part of a sector draws from its own sub-stream of the seed (`rng.fork(label)`), and spawns are keyed to scroll distance, so what the player does never changes the level. Cosmetic effects such as particles and screen shake use `Math.random` freely.
