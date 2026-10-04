# Wobble Warfare

A 2D sci-fi battle simulator in the spirit of Totally Accurate Battle Simulator. Spend a budget on wobbly ragdoll soldiers, drop them on hilly alien terrain, press **START**, and watch physics-driven chaos unfold.

Plain HTML5 canvas + JavaScript. No build step, no dependencies.

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

then visit http://localhost:8000.

## Features

- **9 units**: Rifleman, Breacher, Cyber Ninja, Medic, Grenadier, Riot Shield, Railgunner, Rocketeer, Combat Mech
- **Custom Verlet ragdoll physics**: units balance, walk over hills, stumble when hit and go limp when they die
- **Campaign**: 8 levels with budgets and 1–3 star ratings (spend less, earn more), progress saved in `localStorage`
- **Sandbox**: build both armies with unlimited budget, random armies, new maps
- **Juice**: deformable terrain craters, explosions that launch ragdolls, tracers, shell casings, slow-mo finishes, procedural WebAudio sound effects

## Controls

| Input | Action |
| --- | --- |
| Click / drag | Place the selected unit |
| Right-click | Remove a unit |
| `1`–`9` | Pick a unit type (`X` = remove tool) |
| Right-drag, `WASD` / arrows | Pan the camera |
| Mouse wheel, `+` / `-` | Zoom |
| `Space` | Start battle / pause |
| `T` | Slow motion |
| `C` | Auto-camera |
| Click a unit (in battle) | Follow it |
| `R` | Reset battle |

## Code layout

| File | Purpose |
| --- | --- |
| `js/core.js` | Shared `WW` namespace, math helpers, save data |
| `js/terrain.js` | Heightmap generation, craters, parallax sky and ground drawing |
| `js/physics.js` | Verlet points, distance constraints, ground collision, props |
| `js/ragdoll.js` | Skeleton, balance/walk controller, unit drawing |
| `js/weapons.js` | Weapons, projectiles, hit detection, explosions, damage |
| `js/units.js` | Unit roster (data-driven) and the `Unit` class |
| `js/ai.js` | Targeting, movement, firing, medic healing |
| `js/camera.js` | Pan, zoom, follow, auto-framing, screen shake |
| `js/audio.js` | Procedural sound effects |
| `js/levels.js` | Campaign levels |
| `js/ui.js` | Menus, HUD, palette, results |
| `js/main.js` | Game loop, state machine, rendering, input |

Adding a unit means adding one entry to `G.UNITS` in `js/units.js` (and a weapon in `G.WEAPONS` if it needs a new one).
