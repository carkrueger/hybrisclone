# HYBRISCLONE

A single-player, wide-screen vertical shoot-'em-up in the spirit of *Hybris* (Amiga 500), built with **Phaser 4**.

- **1920×1080 (16:9)**, scaled to fit any window. The whole wide screen is the playfield.
- **Painted HD graphics, all generated in code at boot.** The game ships no image files. It includes:
  - **Backdrop:** a seeded nebula and planet behind a parallax layer of giant capital ships: battleships, carriers, rotating ring stations and dry docks, with thousands of window lights, running lights and engine plumes.
  - **Space station:** dual-grid autotiled plating with raised plateaus, amber trim and drop shadows.
  - **Station details:** 20+ decoration types, big props (domes, reactors, hangars, landing pads, cooling towers, fuel tanks), spinning fans, sweeping radar dishes and chase lights.
  - **Lighting:** shots, engines and explosions cast light on the station; god-ray shafts and lens flares from the sector's sun; coloured rim light on ships.
  - **Ambient life:** traffic convoys, drifting dust, welding sparks, steaming vents and maintenance drones.
  - **Ships:** engine flames, decals, 28 enemy types, 6 mid-boss archetypes and 6 unique sector bosses, with sliding armour plates and turrets with recoil.
  - **Six sector themes**, each with its own plating, decorations, props, capital ships, ambient particles, palette and music.
- **Amiga-MOD-style soundtrack composed from the seed:**
  - **Song form:** intro → verse → chorus → verse → chorus → breakdown → build → key-changed final chorus.
  - **Instruments:** supersaw and pulse leads, an FM-bell counter-melody, tracker-style arpeggios, pads, and acid or sub bass.
  - **Drums:** sampled-style drums with fills.
  - **Mix:** ping-pong echo, reverb and kick ducking.
  - **Rendering:** songs are rendered offline in the background section by section, then streamed.
- **Sector campaign:** 6 themed sectors × 4 levels, with a steady difficulty build-up, then the game loops as Round 2+ at higher difficulty.
- **Seeded levels:** the same seed always gives the same station, waves, bosses and music.
- **Mouse, keyboard or gamepad**, switching automatically to whichever you used last.
- **Fully offline:** no CDN and no network requests. The fonts (Orbitron and Exo 2, OFL) are bundled from npm.

## Run

```bash
npm install
npm run dev       # development server with hot reload (in game, keys 1-9 drop P V L H O W T D B pods)
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

- Power pods (**P**) move the ship up a Hybris-style upgrade ladder: main gun level, side guns, then rear guns. Losing a ship costs one level.
- **Main gun type:** the ladder level powers whichever main gun is fitted. Picking up the type you already carry counts as a power pod.
  - **V**: Vulcan, the classic widening spread.
  - **L**: Laser, a continuous beam that pierces everything in its path. Its damage ramps up while it stays on a target.
  - **H**: Homing, a light center gun plus a growing fan of homing missiles.
- **Specials** stay until you lose a ship. You can carry all of them at once, and a duplicate pickup gives 2,500 points.
  - **O**: Orbiting ball. It can't be destroyed, circles the ship, damages enemies it touches and absorbs enemy bullets.
  - **W**: Wingman. A small escort that trails the ship and fires along with it.
  - **T**: Point defense. A turret that automatically shoots down nearby enemy bullets and missiles.
  - **D**: Deflector shield. It absorbs one hit, then bursts outwards, clearing nearby fire and damaging enemies.
- **B** pods add a smart bomb and **S** pods give bonus points.
- The HUD shows the current gun and ladder below the power meter, and the specials you hold to its right.
- Destroying a whole formation gives a bonus. You get an extra ship every 50,000 points.
- After game over you can enter a high score and continue from the same level, but your score resets.

### Campaign

Each sector has 4 levels. Levels 1–3 end with a **mid-boss**, and level 4 ends with the **sector boss**. After each boss a tally shows your kill %, a no-miss bonus, a bomb-saver bonus and, after level 4, a sector bonus.

| # | Sector | Signature enemies | Sector boss |
|---|---|---|---|
| 1 | Orbital Shipyard | Tug (crate mines), Welder (spark cone), Rail turret | Dreadnought Crane: swinging arms, crate mines, rail shots |
| 2 | Crystal Mines | Shard (splits in 3), Driller (telegraphed dash), Prism (sweeping laser) | Prism Queen: orbiting crystals refract its beam |
| 3 | Alien Hive | Swarmer (flocks), Spitter (acid lobs), Brood pod (hatches swarmers) | Brood Mother: tentacle strikes, eye opens between attacks |
| 4 | Volcanic Foundry | Lava bomber (cross bombs), Flame tank, Missile pod | Magma Forge: lava columns; destroy the heat vents |
| 5 | Fleet Graveyard | Ghost (only hittable when visible), Salvage claw, Sniper | Revenant: cloaks between positions, sniper beams |
| 6 | Capital Citadel | Elite (dodges), Shield drone (protects others), Laser gate | Overseer: shield drones, then laser gates, then rams |

**Mid-boss archetypes:**
- **Warden:** kill the turrets to open the core.
- **Charger:** telegraphed rams; hit it while it rests.
- **Carrier:** launches minions; break the hangar doors.
- **Lancer:** sweeping beams from two emitters.
- **Bombard:** lobs onto marked zones and drops mines.
- **Twins:** two ships; killing one enrages the other.

**Difficulty:** a single scalar `D = sector + 0.3·level + 2.5·round` (in `src/level/difficulty.js`) scales enemy HP, fire rate, bullet speed, wave density, elite chance, boss HP and boss tempo. Every value is capped.

**Readable combat:**
- Combat is pattern-based rather than bullet hell.
- Lasers, rams, lobs and hazard zones always show a warning (line, arrow, target circle or outline) before they hurt.
- Homing missiles can be shot down.
- A hard per-level budget caps how many enemy bullets can be on screen.
- Bosses run one attack at a time, with pauses in between.

## Project layout

```
src/core          rng (cyrb53 + mulberry32, forkable streams), input, storage, settings
src/level         pure, deterministic generators: backdrop (+ raised plateaus, girder layer),
                  dual-grid autotiling, themes, difficulty, enemy defs, waves (3 lanes),
                  boss params, megastructures, ambient, generateLevel(seed, sector, level)
src/gfx/paint     procedural painters: ships, station tilesets, space, FX, boss hulls
src/gfx           StationView (tilemap layers, shadows, lights), post-processing
src/audio         composer/ (theory, melody, arranger), synth/ (instruments, mixer,
                  sample DSP), render.js (offline section renderer), sfx, playback
src/entities      player, weapons, Enemy + behaviors (per-type AI), projectiles (EnemyFire:
                  bullets, missiles, lobs, beams, hazards), attacks, bosses/ (BossBase,
                  mid-boss archetypes, sector bosses), pools, effects
src/scenes        Boot, Title, Game, Hud, Pause, GameOver
tests/            vitest determinism tests
```

Level and music generation never use `Math.random`. Each part of a level draws from its own sub-stream of the seed (`rng.fork(label)`), and spawns are keyed to scroll distance, so what the player does never changes the level. Cosmetic effects such as particles, shake and SFX pitch jitter use `Math.random` freely.
