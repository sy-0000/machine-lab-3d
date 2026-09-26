# AGENT.md — Steampunk Dome Workshop (Three.js)

## Core requirements (source of truth)

**Concept.** An interior 3D scene of a steampunk artisan workshop under a giant cast-iron glass dome.
Sunlight falls through the dome onto brick walls, a concrete floor and a room full of machinery.
Mood: warm, quiet, hand-made, mechanically alive. **No people, no animals.**

**Engineering constraints**
- `index.html` is only an entry shell. No scene logic inside it.
- Scene, lights, camera, particles and **every model asset** live in separate ES modules, assembled by import.
- Each asset module exports a `createXxx(materials)` factory returning `{ object, update?, anchors? }`.
  `object` is a plain `THREE.Group` tree made from standard `BufferGeometry` + `MeshStandardMaterial`
  (or `InstancedMesh`) so any asset can be exported with `GLTFExporter` (no `onBeforeCompile`,
  no custom shaders on assets; custom shaders are only used by effects: shafts, dust, steam, sparks).
- Procedural textures are generated on `<canvas>` (color / ORM / normal), which GLTFExporter can embed.

**Camera & interaction**
- Third-person free orbit: drag to rotate 360°, smooth damped zoom, damped rotation, optional pan.
- The camera must never leave the walls, go through the floor or out of the dome.
- **No UI of any kind**: no overlays, text, buttons, watermarks or popups.

**Space**
- Octagonal room, giant faceted glass dome: cast-iron ribs, riveted seams, some dusty/aged panes.
- Red brick walls: colour variation, mortar joints, spalling, soot; exposed copper pipes and valves.
- Concrete floor: hairline cracks, oil stains, wear, scattered metal shavings.
- Cast-iron gallery (walkway) on part of the perimeter + iron stair for vertical layering.

**Core assets (each modelled independently)**
- Steam boiler (brass + cast iron, gauges, valves, rivets, pipes, glowing firebox).
- Grandfather clock (wood case, brass pendulum & dial, exposed gearing, swinging pendulum).
- Workbench (scarred/burnt thick top; wrench, pliers, magnifier, blowtorch, blueprints, unfinished mechanism).
- Wall gear train with correct meshing (centre distance = m·(z1+z2)/2, ω2 = −ω1·z1/z2, phase-aligned teeth).
- Small parts: gears, screws, springs, watch parts, copper vials in trays / drawers (InstancedMesh).
- Tool wall, shelving, crates, brass telescope, globe, Edison-bulb lamps, pipes & gauges.
- Wear everywhere: verdigris, scratches, oil, polished grips.

**Look**: brass, copper, dark wood, brick red; warm-white daylight from the dome.
Materials clearly distinct: brass, copper, cast iron, wood, glass, brick, concrete, leather.
Clear foreground / midground / background depth.

**Lighting**: key = dome sunlight with visible shafts and crisp shadows; fill = warm Edison
bulbs + orange boiler fire; cool/warm contrast.

**Motion (soft)**: intermittent steam from boiler/valves, dust in the sunbeams, occasional sparks
from the firebox, slow meshing gears, pendulum swing, bulb breathing flicker, fire flicker.

**Quality & performance**: InstancedMesh / particle systems for repeated small things;
controlled shadow & post-processing cost with quality tiers (`?quality=low|medium|high`) and an
adaptive resolution governor; no visible aliasing, clipping or missing detail.

## Development steps (checklist)

1. [x] Write AGENT.md and the layout plan (`docs/LAYOUT.md`).
2. [x] Project skeleton: `index.html` shell, import map, module folders.
3. [x] Core modules: renderer, quality tiers, scene/sky/environment, damped bounded camera.
4. [x] `config/layout.js` — single source for room dimensions, wall frames, placements.
5. [x] Blockout (`?blockout`) — grey primitive massing of room + every asset to check proportions.
6. [x] Material system — procedural canvas textures + shared material library.
7. [x] Structure: floor, brick walls, pilasters, cornice, door, dome, gallery, stair, tie beams.
8. [x] Assets, one module each, replacing the blockout:
   boiler → clock → workbench (+ hand tools, small parts) → gear train → tool wall →
   shelves → crates/barrel → telescope → globe → lamps → wall pipes → floor details.
9. [x] Lighting: sun + shadow, hemisphere, env map, point lights with flicker.
10. [x] Effects: light shafts, dust, steam, sparks.
11. [x] Post: MSAA target, bloom, grade/vignette, output transform; quality tiers.
12. [x] Polish pass in browser: proportions, clipping, exposure, performance.

## Revision 2 — compact room, dense wall dressing, clear dome + sky

### Requirements
1. **Compact space**: bring the walls closer (apothem 11.5 → 10 m) so the room feels enclosed by
   objects; re-check every placement for clipping / wall penetration; keep the central circulation
   ring (r ≲ 5 m) and viewing space open.
2. **New wall-side assets (one module each)**: tall library bookcases (near wall-top height, varied
   books, brass trinkets, jars, scrolls) + rolling library ladder on a rail; reading corner (worn
   leather armchair, round side table, brass table lamp, open book); boiler surroundings (coal pile +
   shovel, barrel, stacked pipe stock); brass multi-drawer tool chest; gramophone; typewriter on a
   writing desk; chemistry bench (flasks, test-tube rack, distillation line, bell jar); a slowly
   turning airship model hanging under the dome. Dense against walls, breathing room in the centre.
3. **Lighting**: raise the chandelier (longer chain / cords) so bulbs clear the main sightline;
   rebalance so the new wall-side assets are lit (bookcase picture light, reading lamp).
4. **Dome glass & sky**: highly transparent panes (slight tint, edge sheen, faint dust only);
   procedural sky (three.js `Sky`) with soft 2.5D clouds drifting slowly; sun disc matches the
   sun light direction; light shafts kept; transparency only (no refraction materials).

### Revised wall plan (apothem 10 m, wall length 8.28 m, usable ≈ ±3.7 m between pilasters)

| Wall | Contents |
|---|---|
| 0 N | boiler (centre) · coal pile + shovel (−3.0) · barrel (+2.3, forward) · pipe stock rack (+3.0) |
| 1 NE | gear-train wall · open crate (+3.3) · two sconces (±3.3, left one lit) |
| 2 E | 3-bay library bookcase 4.8 × 6.2 m (−1.0) + rolling ladder on brass rail · picture light · grandfather clock (+2.6) |
| 3 SE (gallery above) | old shelving (−1.25) · reading corner: armchair, side table, brass lamp, open book (+1.9…+3.0) |
| 4 S | arched door (centre) · brass tool chest (−2.8) · gramophone on cabinet (+2.35) · crate stack (+3.3) |
| 5 SW (gallery) | chemistry bench (−1.3) · typewriter desk (+1.6) · barrel (+3.3) |
| 6 W (gallery) | tool wall · parts cabinet · grinder (unchanged) |
| 7 NW | iron stair (landing 2.2 m, treads 0.24 m) · west steam branch drop (+3.3) |
| centre | workbench, stool, globe, telescope (r ≈ 6.5), airship model hanging from the E–W tie beam |

### Steps (revision 2)
13. [x] Update this plan; shrink `ROOM` and re-derive stair / cornice / pipe / lamp positions.
14. [x] Re-place existing assets; check for clipping and wall penetration.
15. [x] New modules: `bookcase.js`, `libraryLadder.js`, `armchair.js`, `sideTable.js`, `brassLamp.js`,
    `coalPile.js`, `pipeStack.js`, `toolChest.js`, `gramophone.js`, `typewriter.js`, `writingDesk.js`,
    `chemistryBench.js`, `airship.js` (+ `books.js` helpers).
16. [x] Lighting: raise chandelier, move / add fixtures, rebalance fill.
17. [x] Dome glass → high transparency; `core/sky.js` (Sky + drifting cloud layer); remove old sky texture.
18. [x] Browser pass: composition, clipping, exposure, frame time.

## Project structure

```
index.html                 entry shell only (import map + one module script)
styles/main.css            full-screen canvas, fade-in
scripts/serve.py           no-cache static dev server
src/main.js                bootstrap
src/workshop.js            public API createWorkshop(): renderer / scene / camera / world / lights / effects / post / loop + machine slot
src/game/machineSlot.js    one machine tool at a time at the empty room centre (fit, floor, centre, shadows)
src/app/world.js           builds + places every module from config/layout.js, static batching, export registry
src/config/                layout.js (room, wall frames, placements, camera), quality.js (tiers)
src/core/                  renderer.js (+ adaptive resolution), scene.js (sky, env map, fog), camera.js, postprocessing.js
src/lighting/              lights.js (sun, sky bounce, fire, lamps), flicker.js (shared intensity curves)
src/materials/             noise.js, textures.js (procedural canvas maps), library.js (shared PBR materials)
src/structure/             room.js, dome.js, gallery.js (+stair), wallPipes.js, floorDetails.js, blockout.js
src/assets/                boiler, grandfatherClock, workbench, tools, smallParts, gearTrain, toolWall (+grinder),
                           shelves, crates (+barrel), telescope, globe, stool, edisonLamps
src/effects/               lightShafts.js, dust.js, steam.js, sparks.js, effects.js
src/utils/                 geometry.js, gear.js, rivets.js, pipe.js, fixtures.js, finalize.js, staticBatch.js
src/tools/exportGLTF.js    GLB export of any asset factory
```

## Run

From the project root: `python scripts/serve.py 5189`, then open `http://localhost:5189/`
(any static server works; the bundled one disables caching for development).

URL options: `?quality=low|medium|high` (otherwise auto + adaptive resolution), `?blockout`
(step-2 grey massing), `?nobatch` (skip static batching, for inspecting individual meshes).

Console helpers (nothing is drawn on screen): `workshop.assets()` lists exportable assets,
`workshop.exportGLTF('SteamBoiler')` downloads one as `.glb`, `workshop.look(px,py,pz, tx,ty,tz)`
moves the camera, `workshop.info()` shows render stats.
