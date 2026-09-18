# Drill Press — Three.js Interactive Asset

## Files

- `drill_press_interactive.glb` — semantic hierarchy and separated interactive parts.
- `drill_press_parts.json` — axes, pivots, limits, interaction types, mounts, and review notes.

## Coordinate system

- Units: meters
- Up: +Y
- Right: +X
- Front: -Z

## Confirmed interactive structure

- `Quill/SpindleAssembly`: `Spindle`, `Chuck`, and `DrillBit` geometry share the Y rotation axis. `HeadHousing` is outside the rotating group.
- `FeedHandlePivot`: three handles are separated into rod, grip, end-cap, and collar nodes. They share one X-axis pivot.
- Rotating `FeedHandlePivot` should drive `Quill.position.y`; recommended quill travel is -0.085 m to 0 m.
- `SwitchLever` is separated under `Controls` for click/toggle interaction.
- `WorkTable`, `TableBracket`, and their future mounts are nested under `TableAssembly`.

## Three.js loading

```js
const loader = new GLTFLoader();
loader.load('/models/drill_press_interactive.glb', (gltf) => {
  const drillPress = gltf.scene.getObjectByName('DrillPress');
  const spindle = gltf.scene.getObjectByName('SpindleAssembly');
  const feed = gltf.scene.getObjectByName('FeedHandlePivot');
  const quill = gltf.scene.getObjectByName('Quill');
  scene.add(drillPress);

  // Example animation loop
  spindle.rotation.y += spindleRunning ? 0.12 : 0;
});
```

Read `drill_press_parts.json` instead of hard-coding pivots and limits in the UI.

## Missing or uncertain source parts

- No reliable table-lift handwheel was visible in the source model. `TableLiftHandwheel_MOUNT` is an empty attachment node.
- No vise or workpiece was present. Empty `Vise_MOUNT` and `Workpiece_MOUNT` nodes are supplied.
- Table rotation and lift are mechanically plausible, but the exact source mechanism and safe travel cannot be proven from the mesh alone.
- The source has a texture-atlas/detail primitive distributed across the machine; it remains static so small labels and surface pieces are not lost.

## Validation

- Source nodes/meshes: 29 / 29
- Source/output triangles: 27342 / 27342
- Triangle count preserved: True
- Output geometry nodes: 42

The file was reloaded after export to verify that it is a valid GLB and that named nodes are accessible to Three.js.
