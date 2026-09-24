# Persistent lathe handle — first version

The existing hammer prototype and its save remain unchanged. The normal `#/lathe` classroom sidebar provides the machining panel: create **Ø20 × 300 mm** stock, explicitly save it, or load the last local save. No developer panel or inspect flag is needed. Save overwrites one handle slot; there is no automatic save, account, level progress or Sandbox slot manager.

## Data and resolution

`src/machining/WorkpieceState.js` creates plain JSON with `version`, `id`, `kind`, `units: mm`, `axis: Z`, `stock: {radiusMm, lengthMm}`, `lengthMm`, `profile: {resolutionMm, radiusMm: []}`, `surfaceMarks`, `features`, and `operationHistory`.

The initial 300 mm is **stock length**, not a drawing target. `lengthMm` is retained across saves and controls rendered length. Facing reduces length only after a rotating, fixed-Z radial stroke reaches the center; no length-setting command exists. Version 2 adds `clamping` and `lengthMm`; old version 1 saves migrate from `actualLengthMm` without losing profile/history. No diameter is stored as geometry. The three reserved arrays also survive reload. No random values, scene references or timestamps are generated.

The default resolution is configurable in `HANDLE_STOCK`: **0.5 mm**, 600 axial cells. Each radius describes `[i * resolution, min((i + 1) * resolution, lengthMm))`. The last cell may be partial. A touched cell takes the minimum radius reached inside its swept portion. This voxel-like axial approximation can extend removal to the cell edge (at most one resolution); it is not sub-cell or exact insert geometry. Stationary contact acts on the cell containing the tip. Geometry uses stepped revolved sections and 48 radial segments; equal-radius runs are merged to avoid redundant geometry. The same saved state generates identical vertex/index buffers.

## Physical cutting boundary

`MachineV1Adapter` reads an explicit upper cutting corner from each existing procedural turning insert, derived from that insert's geometry parameters. It resolves only the active, visible turning tool. Default and modular tools share this path; threading/knurling tools are not simulated. Imported GLB tools without an explicit tip remain non-cutting (calibration TODO), with no bounding-box guess.

The adapter transforms that corner relative to the mounted workpiece, into a **non-spinning** mm frame: `zMm` along the local +X spindle/teaching Z axis, plus transverse `uMm` and `vMm`. Radius is `hypot(uMm, vMm)`; height error is included. UI work offsets only change readouts and cannot change cutting contact. The existing Phase 0 axis meanings/signs remain unchanged. On profile mount / tool change, the actual procedural tool assembly is moved vertically to put its explicitly defined cutting corner on spindle center. This adjustment is removed on unmount/disposal and reapplied after reset. The legacy relative X display retains its Phase 0 meaning; the machining panel uses the separate physical-tip API described below.

Only actual spindle rotation permits cutting. Axis commands sample immediately before/after physical movement, so consecutive commands between frames do not become a fictitious diagonal. Handwheel movement is sampled within the existing Session clock update. No second timer is created. Center height can be re-aligned while stopped. Deliberate height-axis motion is visible as height error and is never silently erased while cutting. Stopped positioning, reset, mounting and loading never connect to an old tip sample. On the first rotating frame, contact is evaluated at the endpoint, conservatively excluding travel while startup was stopped. Each feed is approximated as a straight tool-tip segment; acceleration timing within a frame and rotational/indexing sweeps are not modeled.

`CuttingSimulation` clips the swept line to axial cells and minimizes its transverse squared distance within each interval. It applies `min(oldRadius, actualTipRadius)` only: there is no lesson target, allowed-region clipping, refill or repair of overcut. Coordinates and radii are rounded at 1e-9 mm solely to suppress matrix roundoff. Existing reset preserves the cut profile. World/metre conversions and Three.js access remain within machining adapters / existing procedural-tool boundaries.

## Session and persistence APIs

- `command({type: 'workpiece.createHandle'})`: create and mount stock, spindle stopped.
- `command({type: 'workpiece.mountState', state})`: validate, clone and mount saved JSON, spindle stopped.
- `exportWorkpieceState()`: independent JSON snapshot; no Three.js nodes.
- `command({type: 'workpiece.save'})`: save mounted profile to localStorage.
- `command({type: 'workpiece.load'})`: validate saved data, rebuild geometry, mount while stopped.
- Existing `workpiece.unmount`, player axis/handwheel commands, spindle commands and input locks remain in effect.

`WorkpieceStore` uses `machine-lab.machining.handle.v1` and accepts an injected Storage-compatible object for tests. Missing/corrupt/version-mismatched saves, invalid dimensions/units and storage failures are reported rather than silently replacing stock. New/load can replace the mounted unsaved workpiece; save is explicit. A new browser session loads via the panel's load button and can continue cutting. Saved operations are currently appended per material-changing sweep; bounded history/compaction is a future improvement.

## Manual machining and fixture protection

The player panel groups machining status, work coordinates, dimensional measurements and machining controls. X work coordinates use diameter mode; measured stock diameter is a separate readout. X/Z jog and held handwheels, spindle, zero buttons and optional absolute work-coordinate inputs all use Session. The developer panel retains physical machine X/Z, radial X, height error, offsets, unsafe events and the original advanced machine controls. `cuttingEdge.js` is the common explicit insert-corner definition; no Group origin or bounding-box guess is used. GLBs are unchanged.

- `machining.move`: same `axis`, `valueMm`, `mode`, `representation` fields as the old motion command, but in the **physical workpiece frame**. X requires diameter/radial representation. X+ moves away from center on the mounted tool side (`runtime y` decreases); Z+ moves out along the stock (`runtime x` increases). Default X=0 is spindle center; default Z=0 is the stock rear at the chuck-side mount. The adapter includes actual tip offset; no guessed work offset is needed.
- `machining.datum`: optional readout datum only; does not move the tool or alter stock. X offsets are stored radially. `axis.move` / `workOffset.set` remain legacy Phase 0 APIs.
- `machining.clearDatum`: clears both machining offsets without moving axes or changing geometry. The X/Z zero buttons call `machining.datum` with a zero readout. Work X = 2 × (physical radial X − radial X offset); work Z = physical Z − Z offset. These offsets belong only to the Session setup, are not saved in WorkpieceState, and reset on new/load or machine reset.
- `machining.mode`: `turning` or `facing`; selecting a mode removes nothing.
- `machining.alignCenter`: stopped-only physical assembly alignment. Uncalibrated imported tools are rejected.

In facing mode, retract outside the OD, position Z near the free end, and feed X toward zero at fixed Z while rotating. A partially completed pass leaves a visible core and retains length; the front slice disappears and length updates only when the swept tip reaches center. Stopped jumps inside stock, stationary tips, diagonal Z/X strokes, off-center tips and excessive axial engagement do not count as facing. The simulation limit is configurable in `latheMachining.config.js` (default 2 mm per face pass, a teaching approximation, not a machining recommendation). The face plane rounds outward to the next 0.5 mm profile boundary, never removing behind the tool. Repeat actual passes for any eventual drawing length; there is no 240 mm target.

The same config reserves Z=0–40 mm as a teaching clamping zone, plus a configurable cylindrical chuck danger envelope. These are **provisional teaching fixture dimensions, not measured physical jaws**. The retained clamping interval is saved in WorkpieceState and may be configured before mounting. Protected cells cannot be cut. The adapter tests the entire tip sweep against the danger envelope even with the spindle stopped; intrusion records an `unsafe / chuck-collision` event and suppresses material removal for that movement. This is not full tool-body collision detection. Machine travel limits still apply; rejected out-of-travel moves cannot teleport into the chuck.

Shortest manual check (normal machining sidebar; expand “移動到工件座標” for positioning): create stock → move X20 → X zero → jog X+ / X− and observe relative feed → start → work X−3.7 → Z220 → observe local Ø16.3 → retract work X4 → select facing → Z300 → Z zero → work Z−1 → work X−20 → observe length 299 → stop → save → reload and continue. After X zero at Ø20, spindle center is work X−20, not X0; the panel displays the current center and front-face work coordinates. Clearing coordinates restores the default datum and never moves the tip. X/Z inputs command real tool movement, never stock dimensions. Save partial face passes too if needed; reload preserves the remaining core.

## Deferred

Confirmed final drawing length, measured chuck geometry and re-clamping, imported-tool tip calibration, finite insert shape/feed physics, material properties, surface quality, marks/features behavior, knurl/thread operations and multiple save slots. None of these values is guessed from a level target.
