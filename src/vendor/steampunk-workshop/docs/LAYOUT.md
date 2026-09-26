# Spatial Layout Plan

All numbers are metres. +Y up, −Z = north. Values live in `src/config/layout.js`.

## Shell

| Element | Spec |
|---|---|
| Plan | Regular octagon, apothem 10 m (wall-to-centre), wall length 8.28 m (revision 2; was 11.5 m) |
| Walls | Brick, 8 m high, iron pilasters at the 8 corners |
| Dome | Faceted octagonal dome springing from the wall top, rise 7 m (apex ≈ 15 m), 8 main ribs, 7 ring purlins, 3 mullions per sector (168 highly transparent panes with edge sheen and faint dust), oculus lantern on top |
| Sky | three.js `Sky` with its sun on the key-light direction + drifting 2.5D cloud layer |
| Gallery | Cast-iron grating walkway at +4.2 m, 1.6 m deep, over walls SE · S · SW · W, plus the first 2.2 m of NW |
| Stair | Straight iron stair along the NW wall, 21 risers × 0.2 m, 0.24 m treads, rising toward the gallery |
| Tie beams | Two crossing I-beams at +7.6 m (N–S, E–W) with a central hub carrying the lamp cluster |

Wall index k (0..7) = N, NE, E, SE, S, SW, W, NW.

```
                         N (0)  BOILER  + chimney, wall pipes
              NW (7)                                 NE (1)
         STAIR ↗ gallery                           GEAR TRAIN wall
                                                   + flyball governor
   W (6)                    [ lamp cluster ]                    E (2)
 TOOL WALL                    WORKBENCH (0,0.35)             GRANDFATHER
 + parts cabinet     GLOBE     stool                          CLOCK
 + grinder
              SW (5)                                 SE (3)
          SHELVING                                TELESCOPE → dome
          barrel, crates                          crate
                         S (4)  ARCHED DOOR, crates
                         ↑ default camera (S-SW, looking NNE)
```

(The first iteration used a 13 m apothem; the blockout showed the room felt empty around a
2.6 m workbench, so it was tightened to 11.5 m. All placements derive from `layout.js`.)

## Revision 2 wall plan

| Wall | Contents |
|---|---|
| 0 N | boiler · coal pile + shovel · barrel · pipe stock rack |
| 1 NE | gear-train wall · open crate · sconces |
| 2 E | 3-bay library bookcase (4.8 × 6.2 m) + rolling ladder on brass rail · picture light · grandfather clock |
| 3 SE | shelving · reading corner (leather armchair, side table, brass lamp, open book, teacup) |
| 4 S | arched door · brass tool chest · gramophone · crate stack |
| 5 SW | chemistry bench · typewriter writing desk + bentwood chair · barrel |
| 6 W | tool wall · parts cabinet · grinder |
| 7 NW | iron stair · west steam branch |
| west floor | workbench + stool at (−4.7, −1.3), turned to face the centre |
| centre | **kept empty** (reserved for a future centrepiece); globe, telescope nearby; airship model hanging from the E–W tie beam at 6 m |

Walls are dense; the ring r ≲ 5 m around the workbench stays open. A vertex-level check
confirms no asset crosses a wall plane.

## Circulation

Entry from the south door → open floor ring (r ≈ 3–9 m) around the central workbench →
boiler (north), clock (east), tool wall (west), shelving (south-west). The stair on the
NW wall climbs to the gallery that wraps the southern/western half, giving an elevated view
back over the workbench and boiler.

## Focal hierarchy

1. **Primary** — the central workbench in the sun pool, with light shafts falling toward the
   viewer from the north-east dome; the boiler's glowing firebox behind it in the wall's shadow.
2. **Secondary** — gear-train wall (motion), grandfather clock (pendulum), lamp cluster.
3. **Tertiary** — tool wall, shelving, telescope, gallery ironwork, dome frame silhouette.

Depth layering from the default view: foreground globe/stool/workbench edge → midground
workbench + beams + lamps → background boiler, gear wall and brick.

## Light sources

| Light | Position | Colour / role |
|---|---|---|
| Sun (directional, shadows) | toward (0.25, 1, −0.45) — N-NE, elev. ≈ 63° | 0xfff1dc, key light; casts the dome grid onto floor |
| Hemisphere | — | cool sky / warm floor bounce, low |
| Environment (PMREM) | — | warm interior reflections for metals |
| Boiler fire (point) | 1.25 m in front of firebox door | 0xff6a24, flickers |
| Lamp cluster (point) | chandelier raised to 4.75 m (bulbs ≥ 3.8 m, above the sightline) | 0xffb466, breathing |
| Bookcase light (point) | in front of the library wall, mid-height | 0xffc07a |
| Reading lamp (point) | brass table lamp in the reading corner | 0xffa352 |
| Gallery pendant (point) | under the SW gallery (shelves / tool wall) | 0xffa24e |
| Gear-wall sconce (point) | NE wall, left of the gear panel (the sun leaves this wall in shade) | 0xffab5c |

The north wall shades the boiler (sun from the north), so the firebox glow reads strongly while
the centre of the room is sunlit: cool/warm contrast by design.

## Camera

Orbit target starts at (0.8, 1.8, −1.4), camera at (−3.7, 2.3, 6.1): globe in the foreground,
workbench and chandelier in the middle, boiler / gear wall / clock behind. Target clamped to
r ≤ 7.4, y ∈ [0.6, 5]; camera clamped to r ≤ 7.9 below the wall top (inside the gallery edge),
inside the dome ellipsoid above it, y ≥ 0.4.
