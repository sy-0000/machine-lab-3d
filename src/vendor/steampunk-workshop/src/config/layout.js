// Single source of truth for room dimensions and asset placement (see docs/LAYOUT.md).
import * as THREE from 'three';

const SIDES = 8;
const APOTHEM = 10;

export const ROOM = {
  sides: SIDES,
  apothem: APOTHEM,
  circumradius: APOTHEM / Math.cos(Math.PI / SIDES),
  wallLength: 2 * APOTHEM * Math.tan(Math.PI / SIDES),
  wallHeight: 8,
  wallThickness: 0.6,
  domeRise: 7,
  oculusRadius: 1.5,
  galleryY: 4.2,
  galleryDepth: 1.6,
  galleryWalls: [3, 4, 5, 6],
  galleryPartial: { wall: 7, length: 2.2 },
  stairRise: 0.2,
  stairTread: 0.24,
  tieBeamY: 7.6,
};

// Direction *toward* the sun (N-NE, ~63° elevation).
export const SUN_DIRECTION = new THREE.Vector3(0.25, 1, -0.45).normalize();

export const CAMERA = {
  position: new THREE.Vector3(-3.7, 2.3, 6.1),
  target: new THREE.Vector3(0.8, 1.8, -1.4),
  fov: 50,
  maxRadius: 7.9,
  minY: 0.4,
  targetMaxRadius: 7.4,
  targetMinY: 0.6,
  targetMaxY: 5,
  minDistance: 1.2,
  maxDistance: 15,
};

export function wallAngle(k) {
  return (k * Math.PI * 2) / SIDES;
}

// Frame of wall k: `position` is on the inner face centre (at floor level unless y given),
// `normal` points into the room, `tangent` runs toward wall k+1.
// An object with rotation.y = rotationY has its local +Z along `normal` and +X along `tangent`.
export function wallFrame(k, offset = 0, along = 0, y = 0) {
  const t = wallAngle(k);
  const s = Math.sin(t);
  const c = Math.cos(t);
  const normal = new THREE.Vector3(-s, 0, c);
  const tangent = new THREE.Vector3(c, 0, s);
  const position = new THREE.Vector3(s * APOTHEM, y, -c * APOTHEM)
    .addScaledVector(normal, offset)
    .addScaledVector(tangent, along);
  return { position, normal, tangent, rotationY: -t };
}

// Point on the corner between wall k and k+1, pulled `offset` into the room.
export function cornerPoint(k, offset = 0, y = 0) {
  const a = (k + 0.5) * ((Math.PI * 2) / SIDES);
  const r = (APOTHEM - offset) / Math.cos(Math.PI / SIDES);
  return new THREE.Vector3(Math.sin(a) * r, y, -Math.cos(a) * r);
}

export function placeOnWall(object, k, offset = 0, along = 0, y = 0) {
  const f = wallFrame(k, offset, along, y);
  object.position.copy(f.position);
  object.rotation.y = f.rotationY;
  return object;
}

// The empty centre of the room where a game places one machine tool at a time.
// rotationY turns the machine's +Z (its front) toward the default camera.
export const MACHINE_SLOT = {
  position: new THREE.Vector3(0, 0, 0),
  rotationY: Math.atan2(-3.7, 6.1),
  maxFootprint: 4.2, // longest horizontal side in metres (clear radius around the centre ≈ 3 m)
  maxHeight: 3.2, // chandelier bulbs hang down to ≈ 3.8 m
};

// Placement of every asset. `size` is the blockout massing (w, h, d) in the asset's local frame.
export const PLACEMENTS = {
  boiler: { wall: 0, offset: 2.1, along: 0, size: [3.0, 5.4, 2.8] },
  gearTrain: { wall: 1, offset: 0.05, along: 0, size: [5.2, 4.0, 0.4], y: 0.6 },
  clock: { wall: 2, offset: 0.24, along: 2.65, size: [0.66, 2.55, 0.46] },
  bookcase: { wall: 2, offset: 0.28, along: -1.0, size: [4.8, 6.2, 0.44] },
  ladder: { wall: 2, along: -1.0, size: [0.55, 4.6, 1.1] },
  toolWall: { wall: 6, offset: 0.02, along: 0.4, size: [3.4, 1.9, 0.3], y: 1.1 },
  partsCabinet: { wall: 6, offset: 0.26, along: -0.4, size: [1.2, 0.95, 0.46] },
  grinder: { wall: 6, offset: 0.9, along: 1.7, size: [0.6, 1.1, 0.5] },
  shelves: { wall: 3, offset: 0.3, along: -1.25, size: [2.9, 3.45, 0.55] },
  armchair: { wall: 3, offset: 1.05, along: 1.85, rotationY: -0.45, size: [0.95, 1.05, 0.95] },
  sideTable: { wall: 3, offset: 0.6, along: 3.0, size: [0.6, 0.65, 0.6] },
  toolChest: { wall: 4, offset: 0.33, along: -2.8, size: [1.0, 1.25, 0.55] },
  gramophone: { wall: 4, offset: 0.35, along: 2.3, rotationY: -0.25, size: [0.6, 1.5, 0.6] },
  chemistryBench: { wall: 5, offset: 0.4, along: -1.3, size: [2.4, 1.8, 0.75] },
  writingDesk: { wall: 5, offset: 0.42, along: 1.65, size: [1.25, 1.0, 0.7] },
  coalPile: { wall: 0, offset: 0.95, along: -3.0, size: [1.5, 0.7, 1.3] },
  pipeStack: { wall: 0, offset: 0.45, along: 2.95, size: [1.6, 0.7, 0.6] },
  door: { wall: 4, offset: 0, along: 0, size: [3.2, 3.9, 0.3] },
  // workbench sits on the west side facing the centre; the middle of the room is left empty
  workbench: { position: [-4.7, 0, -1.3], rotationY: 1.3, size: [2.6, 0.95, 1.1] },
  stool: { position: [-3.55, 0, -0.75], rotationY: 1.7, size: [0.45, 0.62, 0.45] },
  globe: { position: [-3.2, 0, 2.2], rotationY: 0.6, size: [0.85, 1.35, 0.85] },
  telescope: { position: [5.9, 0, 2.4], rotationY: 0, size: [1.2, 1.9, 1.2] },
  airship: { position: [-3.2, 6.05, 0], size: [2.6, 1.1, 0.9] },
  crates: [
    { wall: 4, offset: 0.5, along: 3.3, rotationY: 0.05, size: [0.8, 0.65, 0.62], stack: 2 },
    { wall: 1, offset: 0.55, along: 3.3, rotationY: 0.12, size: [0.8, 0.62, 0.62], open: true },
  ],
  barrels: [
    { wall: 5, offset: 0.5, along: 3.3 },
    { wall: 0, offset: 1.3, along: 2.3 },
  ],
  lampCluster: { position: [0, 4.75, 0.35] },
};
