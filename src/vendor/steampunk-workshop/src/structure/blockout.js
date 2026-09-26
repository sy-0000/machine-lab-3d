// Step-2 grey-box massing (open with ?blockout). Built only from config/layout.js so proportions
// and composition can be checked before any detailed modelling.
import * as THREE from 'three';
import { ROOM, PLACEMENTS, wallFrame, placeOnWall } from '../config/layout.js';

export function buildBlockout(scene) {
  const root = new THREE.Group();
  root.name = 'Blockout';
  const clay = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.9 });
  const clayDark = new THREE.MeshStandardMaterial({ color: 0x9e978d, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xe0b070, roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfd6e0, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM.circumradius + 0.5, ROOM.sides, Math.PI / 8), clayDark);
  floor.rotation.x = -Math.PI / 2;
  floor.rotation.z = 0;
  root.add(floor);

  for (let k = 0; k < ROOM.sides; k++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ROOM.wallLength + 0.5, ROOM.wallHeight, ROOM.wallThickness), clay);
    placeOnWall(wall, k, -ROOM.wallThickness / 2, 0, ROOM.wallHeight / 2);
    root.add(wall);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(ROOM.circumradius, ROOM.sides, 6, Math.PI / 8, Math.PI * 2, 0, Math.PI / 2),
    glass,
  );
  dome.scale.y = ROOM.domeRise / ROOM.circumradius;
  dome.position.y = ROOM.wallHeight;
  root.add(dome);

  const box = (size, mat = clay) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
    m.geometry.translate(0, size[1] / 2, 0);
    return m;
  };
  const onWall = (p, mat) => {
    const m = box(p.size, mat);
    placeOnWall(m, p.wall, p.offset, p.along, p.y ?? 0);
    if (p.rotationY) m.rotation.y += p.rotationY;
    root.add(m);
  };
  const free = (p, mat) => {
    const m = box(p.size, mat);
    m.position.set(...p.position);
    m.rotation.y = p.rotationY ?? 0;
    root.add(m);
  };

  onWall(PLACEMENTS.boiler, accent);
  onWall(PLACEMENTS.gearTrain, accent);
  onWall(PLACEMENTS.clock, accent);
  onWall(PLACEMENTS.toolWall);
  onWall(PLACEMENTS.partsCabinet);
  onWall(PLACEMENTS.grinder);
  onWall(PLACEMENTS.shelves);
  onWall(PLACEMENTS.door, clayDark);
  free(PLACEMENTS.workbench, accent);
  free(PLACEMENTS.stool);
  free(PLACEMENTS.globe);
  free(PLACEMENTS.telescope);
  PLACEMENTS.crates.forEach((c) => onWall(c));
  for (const key of ['bookcase', 'armchair', 'sideTable', 'toolChest', 'gramophone', 'chemistryBench', 'writingDesk', 'coalPile', 'pipeStack']) {
    onWall(PLACEMENTS[key], key === 'bookcase' || key === 'chemistryBench' ? accent : clay);
  }
  onWall({ ...PLACEMENTS.ladder, offset: 1.0 });
  free(PLACEMENTS.airship, accent);

  // gallery slabs and stair ramp
  for (const k of ROOM.galleryWalls) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(ROOM.wallLength, 0.25, ROOM.galleryDepth), clayDark);
    placeOnWall(slab, k, ROOM.galleryDepth / 2, 0, ROOM.galleryY - 0.125);
    root.add(slab);
  }
  const { wall, length } = ROOM.galleryPartial;
  const part = new THREE.Mesh(new THREE.BoxGeometry(length, 0.25, ROOM.galleryDepth), clayDark);
  placeOnWall(part, wall, ROOM.galleryDepth / 2, -ROOM.wallLength / 2 + length / 2, ROOM.galleryY - 0.125);
  root.add(part);
  const f = wallFrame(wall, 0.65);
  const run = (Math.round(ROOM.galleryY / ROOM.stairRise) - 1) * ROOM.stairTread;
  const top = -ROOM.wallLength / 2 + length;
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(run, ROOM.galleryY), 0.2, 1.2), clayDark);
  ramp.position.copy(f.position).addScaledVector(f.tangent, top + run / 2).setY(ROOM.galleryY / 2);
  ramp.rotation.set(0, f.rotationY, -Math.atan2(ROOM.galleryY, run));
  root.add(ramp);

  scene.add(root);
  return { object: root, update: () => {}, anchors: { lamps: [{ position: new THREE.Vector3(...PLACEMENTS.lampCluster.position), intensity: 20 }] } };
}
