# Persistent lathe handle — first version

The existing hammer prototype and its save remain unchanged. Use the existing lathe developer panel to create **Ø20 × 300 mm** stock, explicitly save it, or load the last local save. Save overwrites one handle slot; there is no automatic save, account, level progress or Sandbox slot manager.

## Data and resolution

`src/machining/WorkpieceState.js` creates plain JSON with `version`, `id`, `kind`, `units: mm`, `axis: Z`, `stock: {radiusMm, lengthMm}`, `actualLengthMm`, `profile: {resolutionMm, radiusMm: []}`, `surfaceMarks`, `features`, and `operationHistory`.

The initial 300 mm is **stock length**, not a drawing target. `actualLengthMm` is retained across saves and controls rendered length. Facing/trimming is not yet implemented; initial length remains 300 mm. No diameter is stored as geometry. The three reserved arrays also survive reload. No random values, scene references or timestamps are generated.

The default resolution is configurable in `HANDLE_STOCK`: **0.5 mm**, 600 axial cells. Each radius describes `[i * resolution, min((i + 1) * resolution, actualLengthMm))`. The last cell may be partial. A touched cell takes the minimum radius reached inside its swept portion. This voxel-like axial approximation can extend removal to the cell edge (at most one resolution); it is not sub-cell or exact insert geometry. Stationary contact acts on the cell containing the tip. Geometry uses stepped revolved sections and 48 radial segments; equal-radius runs are merged to avoid redundant geometry. The same saved state generates identical vertex/index buffers.

## Physical cutting boundary

`MachineV1Adapter` reads an explicit upper cutting corner from each existing procedural turning insert, derived from that insert's geometry parameters. It resolves only the active, visible turning tool. Default and modular tools share this path; threading/knurling tools are not simulated. Imported GLB tools without an explicit tip remain non-cutting (calibration TODO), with no bounding-box guess.

The adapter transforms that corner relative to the mounted workpiece, into a **non-spinning** mm frame: `zMm` along the local +X spindle/teaching Z axis, plus transverse `uMm` and `vMm`. Radius is `hypot(uMm, vMm)`; height error is included. UI work offsets only change readouts and cannot change cutting contact. The existing Phase 0 axis meanings/signs remain unchanged. Current model tip height and cross-slide direction still need teaching calibration; the legacy relative X display is not a measured diameter.

Only actual spindle rotation permits cutting. Axis commands sample immediately before/after physical movement, so consecutive commands between frames do not become a fictitious diagonal. Handwheel movement is sampled within the existing Session clock update. No second timer is created. Stopped positioning, reset, mounting and loading never connect to an old tip sample. On the first rotating frame, contact is evaluated at the endpoint, conservatively excluding travel while startup was stopped. Each feed is approximated as a straight tool-tip segment; acceleration timing within a frame and rotational/indexing sweeps are not modeled.

`CuttingSimulation` clips the swept line to axial cells and minimizes its transverse squared distance within each interval. It applies `min(oldRadius, actualTipRadius)` only: there is no lesson target, allowed-region clipping, refill or repair of overcut. Coordinates and radii are rounded at 1e-9 mm solely to suppress matrix roundoff. Existing reset preserves the cut profile. World/metre conversions and Three.js access remain within machining adapters / existing procedural-tool boundaries.

## Session and persistence APIs

- `command({type: 'workpiece.createHandle'})`: create and mount stock, spindle stopped.
- `command({type: 'workpiece.mountState', state})`: validate, clone and mount saved JSON, spindle stopped.
- `exportWorkpieceState()`: independent JSON snapshot; no Three.js nodes.
- `command({type: 'workpiece.save'})`: save mounted profile to localStorage.
- `command({type: 'workpiece.load'})`: validate saved data, rebuild geometry, mount while stopped.
- Existing `workpiece.unmount`, player axis/handwheel commands, spindle commands and input locks remain in effect.

`WorkpieceStore` uses `machine-lab.machining.handle.v1` and accepts an injected Storage-compatible object for tests. Missing/corrupt/version-mismatched saves, invalid dimensions/units and storage failures are reported rather than silently replacing stock. New/load can replace the mounted unsaved workpiece; save is explicit. A new browser session loads via the panel's load button and can continue cutting. Saved operations are currently appended per material-changing sweep; bounded history/compaction is a future improvement.

## Deferred

Facing and final drawing length, center-height/sign calibration for the classroom readout, chuck grip/exposed stock and re-clamping, imported-tool tip calibration, finite insert shape/feed physics, material properties, surface quality, marks/features behavior, knurl/thread operations and multiple save slots. None of these values is guessed from a level target.
