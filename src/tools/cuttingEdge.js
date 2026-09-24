// Unified explicit cutting edge metadata for the existing procedural insert.
// Coordinates belong to the insert mesh (world-unit geometry), never its Group origin.
export function defineTurningEdge(insert) {
  const { height, radiusTop } = insert.geometry.parameters;
  const tip = [0, height / 2, radiusTop];
  insert.userData.cuttingEdge = { version: 1, units: 'world', tip,
    operations: ['turning', 'facing'] };
  insert.userData.cuttingTipLocal = tip; // Retain the first-version compatibility marker.
}
