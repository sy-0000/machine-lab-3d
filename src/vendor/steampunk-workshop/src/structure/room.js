// Floor, brick walls, iron pilasters, cornice, base plinth, tie beams and the arched door.
import * as THREE from 'three';
import { ROOM, wallFrame, placeOnWall } from '../config/layout.js';
import { Noise2D } from '../materials/noise.js';
import { GeoBatch, add, group, compose } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Floor slab; vertex colours add large-scale grime: dark edges along the walls, soot in front of
// the boiler, a worn lighter path around the workbench.
function createFloor(M, noise) {
  const size = ROOM.circumradius * 2 + 1;
  const geo = new THREE.PlaneGeometry(size, size, 72, 72);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dirs = [];
  for (let k = 0; k < ROOM.sides; k++) dirs.push(wallFrame(k).normal.clone().negate());
  const boiler = wallFrame(0, 3.2).position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, x / 4, -z / 4);
    let reach = -Infinity;
    for (const d of dirs) reach = Math.max(reach, x * d.x + z * d.z);
    const toWall = ROOM.apothem - reach;
    let c = 0.72 + 0.28 * smooth(0, 2.2, toWall);
    c *= 0.84 + 0.26 * noise.fbm(x / 2.5 + 40, z / 2.5, 4, 256);
    const db = Math.hypot(x - boiler.x, z - boiler.z);
    c *= 1 - 0.3 * Math.exp(-(db * db) / 5);
    c *= 1 + 0.06 * Math.exp(-(x * x + z * z) / 12);
    colors[i * 3] = c * 0.94;
    colors[i * 3 + 1] = c * 0.86;
    colors[i * 3 + 2] = c * 0.76;
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const floor = new THREE.Mesh(geo, M.concrete);
  floor.name = 'ConcreteFloor';
  floor.receiveShadow = true;
  return floor;
}

// One brick wall face with vertex-colour soot, damp and wear so the tiled texture never repeats visibly.
function createWallFace(M, k, noise) {
  const { wallLength: L, wallHeight: H } = ROOM;
  const geo = new THREE.PlaneGeometry(L, H, 36, 24);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const brickScale = 1.8;
  const uOffset = k * 0.37;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + H / 2;
    uv.setXY(i, x / brickScale + uOffset, y / brickScale);
    const n1 = noise.fbm((x + k * 20) / 3, y / 3, 4, 256);
    const n2 = noise.fbm((x + k * 20) / 0.9, y / 0.9, 3, 256);
    let c = 0.8 + 0.34 * n1 + (n2 - 0.5) * 0.12;
    c *= 1 - 0.42 * smooth(0.5, 1.0, y / H); // soot rising to the dome
    c *= 1 - 0.25 * (1 - smooth(0, 0.7, y)); // damp at the floor
    if (k === 0) {
      const d2 = (x * x) / 3 + ((y - 7.2) * (y - 7.2)) / 6;
      c *= 1 - 0.6 * Math.exp(-d2 / 3); // chimney plume
      c *= 1 - 0.2 * Math.exp(-(x * x) / 5) * (1 - smooth(1, 5, y)); // behind the boiler
    }
    if (k === 1 || k === 7) c *= 1 - 0.15 * smooth(4.5, 7.5, y);
    const warm = (n2 - 0.5) * 0.06;
    colors[i * 3] = c * (1 + warm);
    colors[i * 3 + 1] = c * 0.97;
    colors[i * 3 + 2] = c * (0.95 - warm);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const wall = new THREE.Mesh(geo, M.brick);
  wall.name = `BrickWall_${k}`;
  placeOnWall(wall, k, 0, 0, H / 2);
  return wall;
}

function createPilasters(M, rivets) {
  const { wallHeight: H, sides } = ROOM;
  const batch = new GeoBatch();
  for (let k = 0; k < sides; k++) {
    const a = (k + 0.5) * ((Math.PI * 2) / sides);
    const inward = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const r = ROOM.circumradius - 0.02;
    const base = new THREE.Vector3(Math.sin(a) * r, 0, -Math.cos(a) * r);
    const rotY = -a;
    const at = (d, y) => base.clone().addScaledVector(inward, d).setY(y);
    const p1 = at(0.12, H / 2);
    batch.box(0.46, H, 0.3, [p1.x, p1.y, p1.z], [0, rotY, 0]);
    const p2 = at(0.16, 0.3);
    batch.box(0.62, 0.6, 0.42, [p2.x, p2.y, p2.z], [0, rotY, 0]);
    const p3 = at(0.2, H - 0.55);
    batch.box(0.66, 0.3, 0.5, [p3.x, p3.y, p3.z], [0, rotY, 0]);
    const p4 = at(0.15, 4.0);
    batch.box(0.54, 0.12, 0.38, [p4.x, p4.y, p4.z], [0, rotY, 0]);
    const tangent = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    for (const s of [-1, 1]) {
      const e0 = at(0.275, 0.7).addScaledVector(tangent, s * 0.17);
      const e1 = at(0.275, H - 0.8).addScaledVector(tangent, s * 0.17);
      rivets.line(e0, e1, 0.26, inward);
    }
  }
  return batch.build(M.castIron, 'IronPilasters');
}

function createCornice(M, rivets) {
  const { wallLength: L, wallHeight: H, sides } = ROOM;
  const iron = new GeoBatch();
  for (let k = 0; k < sides; k++) {
    const f = wallFrame(k);
    const at = (d, y) => f.position.clone().addScaledVector(f.normal, d).setY(y);
    const p1 = at(0.22, H - 0.2);
    iron.box(L + 0.4, 0.4, 0.44, [p1.x, p1.y, p1.z], [0, f.rotationY, 0]);
    const p2 = at(0.12, H - 0.5);
    iron.box(L + 0.2, 0.12, 0.24, [p2.x, p2.y, p2.z], [0, f.rotationY, 0]);
    for (let j = -3; j <= 3; j++) {
      const bp = at(0.22, H - 0.5).addScaledVector(f.tangent, j * (L / 7.5));
      iron.box(0.12, 0.35, 0.3, [bp.x, bp.y - 0.12, bp.z], [0, f.rotationY, 0]); // corbel brackets
    }
    rivets.line(at(0.445, H - 0.28).addScaledVector(f.tangent, -L / 2), at(0.445, H - 0.28).addScaledVector(f.tangent, L / 2), 0.3, f.normal);
    rivets.line(at(0.445, H - 0.1).addScaledVector(f.tangent, -L / 2), at(0.445, H - 0.1).addScaledVector(f.tangent, L / 2), 0.3, f.normal);
  }
  return iron.build(M.castIron, 'Cornice');
}

function createPlinth(M) {
  const { wallLength: L, sides } = ROOM;
  const batch = new GeoBatch();
  for (let k = 0; k < sides; k++) {
    const f = wallFrame(k, 0.05, 0, 0.16);
    batch.box(L + 0.2, 0.32, 0.1, [f.position.x, f.position.y, f.position.z], [0, f.rotationY, 0]);
  }
  const m = batch.build(M.stone, 'WallPlinth');
  m.material = M.stone;
  return m;
}

function createTieBeams(M, rivets) {
  const y = ROOM.tieBeamY;
  const A = ROOM.apothem;
  const batch = new GeoBatch();
  for (const dir of [0, 1]) {
    const len = A * 2;
    const rot = [0, dir ? Math.PI / 2 : 0, 0];
    batch.add(new THREE.BoxGeometry(len, 0.4, 0.03), compose([0, y, 0], rot));
    batch.add(new THREE.BoxGeometry(len, 0.035, 0.24), compose([0, y + 0.2, 0], rot));
    batch.add(new THREE.BoxGeometry(len, 0.035, 0.24), compose([0, y - 0.2, 0], rot));
    // stiffeners
    for (let s = -A + 1; s < A; s += 1.6) {
      const p = dir ? [0, y, s] : [s, y, 0];
      batch.add(new THREE.BoxGeometry(0.02, 0.36, 0.22), compose(p, rot));
    }
    for (const side of [-1, 1]) {
      for (const yy of [y + 0.14, y - 0.14]) {
        const a = dir ? new THREE.Vector3(side * 0.02, yy, -A + 0.4) : new THREE.Vector3(-A + 0.4, yy, side * 0.02);
        const b = dir ? new THREE.Vector3(side * 0.02, yy, A - 0.4) : new THREE.Vector3(A - 0.4, yy, side * 0.02);
        const n = dir ? new THREE.Vector3(side, 0, 0) : new THREE.Vector3(0, 0, side);
        rivets.line(a, b, 0.4, n);
      }
    }
    // wall bearing plates
    for (const s of [-1, 1]) {
      const p = dir ? [0, y, s * (A - 0.1)] : [s * (A - 0.1), y, 0];
      batch.add(new THREE.BoxGeometry(0.2, 0.9, 0.6), compose(p, rot));
    }
  }
  const beams = batch.build(M.ironDark, 'TieBeams');
  const hub = group('TieBeamHub');
  add(hub, new THREE.CylinderGeometry(0.42, 0.42, 0.5, 32), M.castIron, 'HubDrum', [0, y, 0]);
  add(hub, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32), M.brassAged, 'HubBand', [0, y + 0.16, 0]);
  add(hub, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32), M.brassAged, 'HubBand', [0, y - 0.16, 0]);
  add(hub, new THREE.SphereGeometry(0.14, 16, 8), M.brass, 'HubBoss', [0, y - 0.28, 0], [0, 0, 0], [1, 0.6, 1]);
  rivets.ring(0.43, y + 0.08, 24);
  rivets.ring(0.43, y - 0.08, 24, 0.13);
  return { beams, hub };
}

function createDoor(M) {
  const g = group('ArchedDoor');
  const W = 2.2;
  const R = W / 2;
  const hRect = 2.5;
  const leafShape = (side) => {
    const s = new THREE.Shape();
    const x0 = side < 0 ? -R : 0;
    const x1 = side < 0 ? 0 : R;
    s.moveTo(x0, 0);
    s.lineTo(x1, 0);
    if (side < 0) {
      s.lineTo(0, hRect + R);
      s.absarc(0, hRect, R, Math.PI / 2, Math.PI, false);
    } else {
      s.lineTo(R, hRect);
      s.absarc(0, hRect, R, 0, Math.PI / 2, false);
    }
    s.lineTo(x0, 0);
    return s;
  };
  const rivets = new RivetSet(0.014);
  for (const side of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(leafShape(side), { depth: 0.08, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 20 });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.1, uv.getY(i) / 2.2);
    add(g, geo, M.woodPlanks, side < 0 ? 'LeafLeft' : 'LeafRight', [side * 0.006, 0, 0.02]);
    for (const y of [0.5, 1.6, 2.6]) {
      const len = y > 2.5 ? Math.sqrt(R * R - (y - hRect) ** 2) - 0.05 : R - 0.06;
      const cx = side * (len / 2 + 0.03);
      add(g, new THREE.BoxGeometry(len, 0.075, 0.012), M.ironDark, 'StrapHinge', [cx, y, 0.112]);
      add(g, new THREE.CylinderGeometry(0.04, 0.04, 0.09, 12), M.ironDark, 'HingeKnuckle', [side * (R - 0.02), y, 0.1]);
      for (let j = 0; j < 5; j++) rivets.add(new THREE.Vector3(side * (0.1 + (j * (len - 0.12)) / 4), y, 0.118), new THREE.Vector3(0, 0, 1));
    }
    const ring = add(g, new THREE.TorusGeometry(0.075, 0.012, 8, 24), M.brassAged, 'RingPull', [side * 0.16, 1.16, 0.135], [0.2, 0, 0]);
    ring.userData.noShadow = true;
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12), M.brassAged, 'RingBoss', [side * 0.16, 1.24, 0.12], [Math.PI / 2, 0, 0]);
  }
  // brick arch surround (voussoirs) and jambs
  const arch = new GeoBatch();
  const n = 17;
  for (let i = 0; i < n; i++) {
    const a = (i + 0.5) * (Math.PI / n);
    const r = R + 0.2;
    arch.add(new THREE.BoxGeometry(0.18, 0.42, 0.2), compose([Math.cos(a) * r, hRect + Math.sin(a) * r, 0.04], [0, 0, a - Math.PI / 2]));
  }
  for (const s of [-1, 1]) {
    for (let j = 0; j < 7; j++) {
      const w = j % 2 ? 0.34 : 0.26;
      arch.add(new THREE.BoxGeometry(w, 0.33, 0.2), compose([s * (R + 0.03 + w / 2), 0.2 + j * 0.35, 0.04]));
    }
  }
  g.add(arch.build(M.brickArch, 'ArchSurround'));
  add(g, new THREE.BoxGeometry(W + 0.8, 0.08, 0.5), M.stone, 'Threshold', [0, 0.04, 0.12]);
  const r = rivets.build(M.ironDark, 'DoorRivets');
  if (r) g.add(r);
  return g;
}

export function createRoom(M) {
  const root = group('RoomShell');
  const noise = new Noise2D(5);
  root.add(createFloor(M, noise));
  for (let k = 0; k < ROOM.sides; k++) root.add(createWallFace(M, k, noise));
  const rivets = new RivetSet(0.018);
  root.add(createPilasters(M, rivets));
  root.add(createCornice(M, rivets));
  root.add(createPlinth(M));
  const { beams, hub } = createTieBeams(M, rivets);
  root.add(beams, hub);
  root.add(rivets.build(M.castIron, 'ShellRivets'));
  const door = createDoor(M);
  placeOnWall(door, 4, 0, 0, 0);
  root.add(door);
  return { object: root };
}
