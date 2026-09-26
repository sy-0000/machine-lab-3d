// Cast-iron gallery walkway (grating deck, edge beams, joists, columns, railing) and the iron stair.
import * as THREE from 'three';
import { ROOM, PLACEMENTS, wallFrame } from '../config/layout.js';
import { GeoBatch, add, group, lathe, segmentMatrix } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';

const RISE = ROOM.stairRise;
const TREAD = ROOM.stairTread;
const STAIR_WIDTH = 1.15;

function columnGeometry(height) {
  const r = 0.1;
  return lathe(
    [
      [0, 0], [r * 2.1, 0], [r * 2.1, 0.12], [r * 1.7, 0.16], [r * 1.5, 0.3], [r * 1.15, 0.36],
      [r, 0.45], [r * 0.9, height * 0.55], [r * 0.82, height - 0.42], [r * 1.05, height - 0.38],
      [r * 1.05, height - 0.33], [r * 0.9, height - 0.3], [r * 1.4, height - 0.14], [r * 2.0, height - 0.06],
      [r * 2.0, height], [0, height],
    ],
    20,
  );
}

function balusterGeometry(h) {
  return lathe([[0, 0], [0.025, 0], [0.025, 0.03], [0.012, 0.05], [0.011, h * 0.45], [0.02, h * 0.5], [0.011, h * 0.55], [0.011, h], [0, h]], 8);
}

export function createGallery(M) {
  const root = group('Gallery');
  const { apothem: A, galleryY: Y, galleryDepth: W, wallLength: L } = ROOM;
  const Li = 2 * (A - W) * Math.tan(Math.PI / ROOM.sides);

  const segments = ROOM.galleryWalls.map((k) => ({ k, x0: -L / 2, x1: L / 2, xi0: -Li / 2, xi1: Li / 2 }));
  const part = ROOM.galleryPartial;
  const stairTopX = -L / 2 + part.length;
  segments.push({ k: part.wall, x0: -L / 2, x1: stairTopX, xi0: -Li / 2, xi1: stairTopX, partial: true });

  const toWorld = (k, x, d, y) => {
    const f = wallFrame(k);
    return f.position.clone().addScaledVector(f.tangent, x).addScaledVector(f.normal, d).setY(y);
  };

  // ---- grating deck
  const pos = [];
  const uv = [];
  for (const s of segments) {
    const q = [toWorld(s.k, s.x0, 0, Y), toWorld(s.k, s.x1, 0, Y), toWorld(s.k, s.xi1, W, Y), toWorld(s.k, s.xi0, W, Y)];
    for (const t of [0, 2, 1, 0, 3, 2]) {
      pos.push(q[t].x, q[t].y, q[t].z);
      uv.push(q[t].x * 2, q[t].z * 2);
    }
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  deck.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  deck.computeVertexNormals();
  add(root, deck, M.grating, 'GratingDeck');

  // ---- beams, joists, brackets
  const iron = new GeoBatch();
  const rivets = new RivetSet(0.014);
  const beamGeo = new THREE.BoxGeometry(0.1, 1, 0.28);
  const joistGeo = new THREE.BoxGeometry(0.06, 1, 0.16);
  const inner = [];
  for (const s of segments) {
    const f = wallFrame(s.k);
    const a = toWorld(s.k, s.xi0, W, Y - 0.14);
    const b = toWorld(s.k, s.xi1, W, Y - 0.14);
    iron.segment(beamGeo, a, b, new THREE.Vector3(0, 1, 0));
    const wa = toWorld(s.k, s.x0, 0.05, Y - 0.1);
    const wb = toWorld(s.k, s.x1, 0.05, Y - 0.1);
    iron.segment(new THREE.BoxGeometry(0.1, 1, 0.2), wa, wb, new THREE.Vector3(0, 1, 0));
    rivets.line(a.clone().addScaledVector(f.normal, 0.05).setY(Y - 0.06), b.clone().addScaledVector(f.normal, 0.05).setY(Y - 0.06), 0.3, f.normal);
    rivets.line(a.clone().addScaledVector(f.normal, 0.05).setY(Y - 0.22), b.clone().addScaledVector(f.normal, 0.05).setY(Y - 0.22), 0.3, f.normal);
    const n = Math.max(2, Math.round((s.xi1 - s.xi0) / 1.1));
    for (let j = 0; j <= n; j++) {
      const x = s.xi0 + ((s.xi1 - s.xi0) * j) / n;
      const p0 = toWorld(s.k, x, 0.1, Y - 0.1);
      const p1 = toWorld(s.k, x, W - 0.05, Y - 0.1);
      iron.segment(joistGeo, p0, p1, new THREE.Vector3(0, 1, 0));
      if (j % 2 === 0) {
        // cast knee bracket into the wall
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(0.9, 0);
        shape.quadraticCurveTo(0.25, -0.2, 0, -0.9);
        shape.lineTo(0, 0);
        const hole = new THREE.Path();
        hole.absarc(0.22, -0.2, 0.1, 0, Math.PI * 2, true);
        shape.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 10 });
        g.translate(0, 0, -0.015);
        const m = new THREE.Matrix4().makeBasis(f.normal, new THREE.Vector3(0, 1, 0), f.tangent.clone().negate());
        m.setPosition(toWorld(s.k, x, 0.02, Y - 0.2));
        iron.add(g, m);
      }
    }
    inner.push({ s, a: toWorld(s.k, s.xi0, W, Y), b: toWorld(s.k, s.xi1, W, Y) });
  }
  root.add(iron.build(M.castIron, 'GalleryIronwork'));

  // ---- columns at the inner edge
  const colGeo = columnGeometry(Y - 0.28);
  const colPositions = [];
  for (const { a, b, s } of inner) {
    // no mid-span column on the door wall: it would stand in the doorway
    if (!s.partial && s.k !== PLACEMENTS.door.wall) colPositions.push(a.clone().lerp(b, 0.5));
    colPositions.push(a.clone());
  }
  const last = inner[inner.length - 1];
  colPositions.push(last.b.clone());
  const endSeg = inner.find((i) => i.s.k === ROOM.galleryWalls[ROOM.galleryWalls.length - 1]);
  const firstSeg = inner.find((i) => i.s.k === ROOM.galleryWalls[0]);
  colPositions.push(firstSeg.a.clone(), endSeg.b.clone());
  const unique = [];
  for (const p of colPositions) if (!unique.some((q) => q.distanceTo(p) < 0.3)) unique.push(p);
  const colBatch = new GeoBatch();
  for (const p of unique) colBatch.add(colGeo, new THREE.Matrix4().makeTranslation(p.x, 0, p.z));
  root.add(colBatch.build(M.castIron, 'GalleryColumns'));

  // ---- railing (instanced balusters + wooden handrail)
  const railH = 1.0;
  const balGeo = balusterGeometry(railH);
  const balMatrices = [];
  const rail = new GeoBatch();
  const midRail = new GeoBatch();
  const newel = new GeoBatch();
  const railRun = (p0, p1, spacing = 0.14) => {
    const len = p0.distanceTo(p1);
    const n = Math.max(1, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      const p = p0.clone().lerp(p1, i / n);
      balMatrices.push(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
    }
    const up = (v, h) => v.clone().setY(v.y + h);
    rail.segment(new THREE.CylinderGeometry(0.038, 0.038, 1, 10), up(p0, railH + 0.02), up(p1, railH + 0.02));
    midRail.segment(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), up(p0, 0.12), up(p1, 0.12));
    midRail.segment(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), up(p0, railH - 0.12), up(p1, railH - 0.12));
    for (const p of [p0, p1]) {
      newel.add(new THREE.BoxGeometry(0.07, railH + 0.06, 0.07), new THREE.Matrix4().makeTranslation(p.x, p.y + (railH + 0.06) / 2, p.z));
      newel.add(new THREE.SphereGeometry(0.05, 12, 8), new THREE.Matrix4().makeTranslation(p.x, p.y + railH + 0.1, p.z));
    }
  };
  const inset = 0.06;
  for (const { s } of inner) {
    railRun(toWorld(s.k, s.xi0, W - inset, Y), toWorld(s.k, s.xi1, W - inset, Y));
  }
  // closed end of the gallery (against the east side) and the landing side next to the stair
  const endK = ROOM.galleryWalls[0];
  railRun(toWorld(endK, -L / 2, 0.1, Y), toWorld(endK, -Li / 2, W - inset, Y));
  railRun(toWorld(part.wall, stairTopX, STAIR_WIDTH + 0.15, Y), toWorld(part.wall, stairTopX, W - inset, Y));

  // ---- stair along the NW wall, rising toward the gallery landing
  const stair = group('IronStair', root);
  const risers = Math.round(Y / RISE);
  const treadGeo = new THREE.BoxGeometry(TREAD + 0.03, 0.035, STAIR_WIDTH);
  const treads = new GeoBatch();
  const stairIron = new GeoBatch();
  const f = wallFrame(part.wall);
  for (let i = 0; i < risers - 1; i++) {
    const x = stairTopX + (risers - 1 - i) * TREAD - TREAD / 2;
    const p = toWorld(part.wall, x, 0.05 + STAIR_WIDTH / 2, (i + 1) * RISE - 0.0175);
    treads.add(treadGeo, new THREE.Matrix4().makeRotationY(f.rotationY).setPosition(p));
    const nose = toWorld(part.wall, x - TREAD / 2 - 0.005, 0.05 + STAIR_WIDTH / 2, (i + 1) * RISE - 0.045);
    stairIron.add(new THREE.BoxGeometry(0.03, 0.05, STAIR_WIDTH), new THREE.Matrix4().makeRotationY(f.rotationY).setPosition(nose));
  }
  const bottomX = stairTopX + (risers - 1) * TREAD;
  for (const d of [0.05, 0.05 + STAIR_WIDTH]) {
    const a = toWorld(part.wall, bottomX + 0.1, d, 0.02);
    const b = toWorld(part.wall, stairTopX, d, Y - 0.05);
    stairIron.segment(new THREE.BoxGeometry(0.3, 1, 0.035), a, b, f.normal);
    const a2 = a.clone().lerp(b, 0.05).addScaledVector(f.normal, 0.02);
    const b2 = a.clone().lerp(b, 0.95).addScaledVector(f.normal, 0.02);
    rivets.line(a2, b2, 0.35, f.normal);
  }
  stair.add(treads.build(M.castIron, 'StairTreads'));
  stair.add(stairIron.build(M.castIron, 'StairStringers'));

  // stair railing on the open side follows the pitch
  const open = 0.05 + STAIR_WIDTH;
  for (let i = 0; i < risers - 1; i++) {
    const x = stairTopX + (risers - 1 - i) * TREAD - TREAD / 2;
    const p = toWorld(part.wall, x, open - 0.05, (i + 1) * RISE);
    balMatrices.push(new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
  }
  const s0 = toWorld(part.wall, bottomX - TREAD / 2, open - 0.05, RISE);
  const s1 = toWorld(part.wall, stairTopX, open - 0.05, Y);
  rail.segment(new THREE.CylinderGeometry(0.038, 0.038, 1, 10), s0.clone().setY(s0.y + railH + 0.02), s1.clone().setY(s1.y + railH + 0.02));
  midRail.segment(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), s0.clone().setY(s0.y + railH - 0.12), s1.clone().setY(s1.y + railH - 0.12));
  newel.add(columnGeometry(railH + 0.25).scale(0.45, 1, 0.45), new THREE.Matrix4().makeTranslation(s0.x, 0, s0.z));
  newel.add(new THREE.SphereGeometry(0.07, 14, 10), new THREE.Matrix4().makeTranslation(s0.x, railH + 0.33, s0.z));

  const balusters = new THREE.InstancedMesh(balGeo, M.castIron, balMatrices.length);
  balusters.name = 'Balusters';
  balMatrices.forEach((m, i) => balusters.setMatrixAt(i, m));
  balusters.computeBoundingSphere();
  root.add(balusters);
  root.add(rail.build(M.woodHandle, 'Handrail'));
  root.add(midRail.build(M.castIron, 'RailBars'));
  root.add(newel.build(M.brassAged, 'NewelPosts'));
  root.add(rivets.build(M.castIron, 'GalleryRivets'));
  return { object: root };
}
