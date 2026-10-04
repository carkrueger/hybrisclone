# HYBRISCLONE

A single-player, wide-screen vertical shoot-'em-up in the spirit of *Hybris* (Amiga 500), built with **Phaser 4**.

- **1920×1080 (16:9)**, scaled to fit any window. The whole wide screen is the playfield.
- **Painted HD graphics, all generated in code at boot.** The game ships no image files. It includes:
  - **Backdrop:** a seeded nebula and planet behind a parallax layer of giant capital ships: battleships, carriers, rotating ring stations and dry docks, with thousands of window lights, running lights and engine plumes.
  - **Space station:** dual-grid autotiled plating with raised plateaus, amber trim and drop shadows.
  - **Station details:** 20+ decoration types, big props (domes, reactors, hangars, landing pads, cooling towers, fuel tanks), spinning fans, sweeping radar dishes and chase lights.
  - **Lighting:** shots, engines and explosions cast light on the station; god-ray shafts and lens flares from the sector's sun; coloured rim light on ships.
  - **Ambient life:** traffic convoys, drifting dust, welding sparks, steaming vents and maintenance drones.
  - **Ships:** engine flames, decals, nine enemy types (including gunships, interceptors and mines), bosses with sliding armour plates, and turrets with recoil.
- **Amiga-MOD-style soundtrack composed from the seed:**
  - **Song form:** intro → verse → chorus → verse → chorus → breakdown → build → key-changed final chorus.
  - **Instruments:** supersaw and pulse leads, an FM-bell counter-melody, tracker-style arpeggios, pads, and acid or sub bass.
  - **Drums:** sampled-style drums with fills.
  - **Mix:** ping-pong echo, reverb and kick ducking.
  - **Rendering:** songs are rendered offline in the background section by section, then streamed.
- **Seeded levels:** the same seed always gives the same station, waves, bosses and music.
- **Mouse, keyboard or gamepad**, switching automatically to whichever you used last.
- **Fully offline:** no CDN and no network requests. The fonts (Orbitron and Exo 2, OFL) are bundled from npm.

## Run

```bash
npm install
npm run dev       # development server with hot reload
npm test          # determinism tests (RNG, level generator, autotiling, composer)
npm run build     # static build in dist/
npm run preview   # serve dist/ on http://localhost:4173
```

`dist/` is self-contained. Serve it with any local static server: browsers refuse to run ES modules from `file://`.

`music-preview/` (not committed) contains WAV renders of the title, sector 1 and boss 1 songs for seed `HYBRIS`.

## Controls

| Action | Keyboard         | Mouse                | Gamepad            |
|--------|------------------|----------------------|--------------------|
| Move   | Arrows / WASD    | Ship follows pointer | Left stick / D-pad |
| Fire   | Space / Z (hold) | Left button (hold)   | A / RB / RT        |
| Bomb   | X / Shift        | Right button         | B / LB / LT        |
| Pause  | Esc / P          | —                    | Start              |

Browsers only allow audio after a user gesture, so click or press a key once on the title screen. A gamepad button press does not count as a gesture.

## Options (title screen)

- **SEED:** type up to 10 letters or digits and press Enter. With a gamepad, press A to edit, use up/down and left/right, and press A to finish. **RANDOM SEED** rolls a new one.
- **QUALITY** (low / medium / high):
  - Low turns off bloom, shadows, engine trails, station lights and animations, dynamic lighting, god rays, rim light and ambient life, and reduces particles.
  - Medium keeps everything except the foreground dust.
  - The setting applies the next time a game starts.
- **CRT FILTER:** scanlines and a slight barrel distortion.
- **MUSIC / SFX volume.**

## Gameplay

- Power pods (**P**) move the ship up a Hybris-style upgrade ladder: main gun spread, side guns, rear guns, then homing missiles. Losing a ship costs one level.
- **B** pods add a smart bomb and **S** pods give bonus points.
- Destroying a whole formation gives a bonus. You get an extra ship every 50,000 points.
- Each sector ends with a generated boss. Destroy its gun pods first: the core is armoured while they survive.
- After game over you can enter a high score and continue from the same sector, but your score resets.

## Project layout

```
src/core          rng (cyrb53 + mulberry32, forkable streams), input, storage, settings
src/level         pure, deterministic generators: backdrop (+ raised plateaus, girder layer),
                  dual-grid autotiling, waves (3 lanes), boss, sector
src/gfx/paint     procedural painters: ships, station tilesets, space, FX, boss hulls
src/gfx           StationView (tilemap layers, shadows, lights), post-processing
src/audio         composer/ (theory, melody, arranger), synth/ (instruments, mixer,
                  sample DSP), render.js (offline section renderer), sfx, playback
src/entities      player, weapons, enemies, boss, pools, effects
src/scenes        Boot, Title, Game, Hud, Pause, GameOver
tests/            vitest determinism tests
```

Level and music generation never use `Math.random`. Each part of a sector draws from its own sub-stream of the seed (`rng.fork(label)`), and spawns are keyed to scroll distance, so what the player does never changes the level. Cosmetic effects such as particles, shake and SFX pitch jitter use `Math.random` freely.
