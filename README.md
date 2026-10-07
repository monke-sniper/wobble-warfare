# Wobble Warfare

A wobbly, low-poly **3D battle simulator** in the spirit of Totally Accurate Battle Simulator, with a Ravenfield-style flat-shaded look. Build an army from 10 factions, drop it on the field, press **START** and watch physics-driven chaos.

Plain JavaScript ES modules + [Three.js](https://threejs.org) (vendored in `vendor/`, so it runs offline). No build step.

## Play

Serve the folder (ES modules need http, not `file://`):

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## What's in it

- **64 units across 10 factions**: Tribal, Farmer, Medieval, Ancient, Viking, Dynasty, Pirate, Wild West, Sci-Fi, Dark Magic. Melee, bows, thrown weapons, firearms, magic, healers, necromancers, giants and siege engines (catapult, ballista, cannon, hwacha, gatling).
- **Active-ragdoll physics**: every unit is a 15-point Verlet body pulled toward an animated pose. Units wobble, stumble, get knocked flat, get back up, and go limp when they die. Procedural foot placement on hilly terrain.
- **Combat systems**: ballistic aiming with target leading, shields that block frontal projectiles, deflection, armour, piercing, explosions that launch ragdolls and leave craters, freezing, poison, regeneration, lava, harpoon pulls, dashes and charges. Arrows and spears stick in units and the ground.
- **Campaign**: 40 levels (4 per faction). Each chapter unlocks the next faction and adds it to your roster. Earn 1–3 stars by winning with less gold.
- **Sandbox**: unlimited gold, both armies, 7 biomes, hill slider, random armies, and **battle codes** for sharing setups.
- **Gauntlet**: endless rounds against random armies with a growing budget. One loss ends the run, and your best is saved.
- **Take control** of any unit (F): third-person movement, mouse aim, attack, leap.
- **Cameras**: free-fly, follow, cinematic auto-director, possession, plus slow-mo and speed controls.
- **Juice**: low-poly fireballs, smoke, debris, sparks, shockwaves, flash lights, lightning, tracers, rail beams, screen shake, kill feed, MVP, health bars, procedural 3D-positional sound.

## Controls

| Input | Action |
| --- | --- |
| Click / drag | Place units (drag paints a squad) |
| Right-click | Remove a unit |
| Right-drag | Look around |
| `W A S D`, `Q` / `E` | Fly the camera / down, up |
| `Shift` | Fly faster |
| Wheel | Zoom |
| `1`–`9`, `X` | Pick a unit / remove tool |
| `Space` | Start battle / pause |
| Click a unit | Follow it |
| `F` | Take control of the followed / hovered unit |
| `C` | Cinematic camera |
| `T` | Slow motion |
| `R` | Reset battle |
| `H` | Hide interface |

## Performance

Built to stay smooth with hundreds of units:

- **Instanced rendering**: every body part, hat, weapon, shield, projectile and particle shape is one `InstancedMesh` refilled per frame. A 400-unit battle is about 25 draw calls.
- **Fixed 60 Hz simulation with render interpolation**, a spatial hash grid for neighbour queries, and sleeping corpses.
- **Pooled particles** that scale out instead of fading, so no transparency sorting.
- Corpse cap, unit cap, and **Auto quality** that lowers resolution and shadows if the frame rate drops. Everything is adjustable in Settings.

Measured in Chrome: a 400-unit brawl costs about 3.5 ms of CPU per frame (simulation + render submission).

## Code layout

| Path | Purpose |
| --- | --- |
| `src/sim/` | **Render-agnostic simulation**: `terrain` (heightmap, craters, raycast), `body` (Verlet active ragdoll + pose/walk animator), `unit`, `ai`, `combat` (attacks, projectiles, damage, explosions), `world` (state, spatial grid, fixed step). Visuals and audio are requested through `hooks`. |
| `src/render/` | Three.js: `scene` (renderer, lights, terrain mesh, water, props, zones, quality), `batcher` (instancing), `models` (procedural low-poly library: body parts, ~50 hats, weapons, shields, siege engines, props, projectiles), `unitdraw`, `fx`, `camera`, `portraits` (unit card images rendered from the 3D models). |
| `src/data/` | Data tables: `factions` (units), `weapons`, `biomes`, `levels` (campaign, army layout, random armies, battle codes). |
| `src/ui/ui.js` | DOM screens, palette, campaign map, results, kill feed. |
| `src/game.js` | Mode state machine, input, possession, main loop. |

**Adding a unit** = one entry in `src/data/factions.js` (plus a weapon in `weapons.js` and a hat in `models.js` if it needs new gear).

## Multiplayer later

The simulation never touches Three.js or the DOM, and it uses a seeded RNG (`seedSim`) per battle. Two clients with the same armies and seed produce the same battle, which is the groundwork for replays, shareable battles, or lockstep / server-authoritative online modes. Battle codes already serialise a full setup.

`window.WW` exposes the game state in the browser console for debugging (`WW.advance(n)` steps n frames).
