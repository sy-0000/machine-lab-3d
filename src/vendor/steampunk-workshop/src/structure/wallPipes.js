// Exposed copper steam lines, the iron flue and the valves / gauges mounted along the walls.
// Runs start from boiler anchors and end at the gear-train feed, so the plant reads as connected.
import * as THREE from 'three';
import { ROOM, wallFrame, cornerPoint } from '../config/layout.js';
import { group, V } from '../utils/geometry.js';
import { createPipe } from '../utils/pipe.js';
import { createValve, createGauge, setGaugeValue } from '../utils/fixtures.js';

const RUN_OFFSET = 0.5;

const wallPt = (k, along, y, offset = RUN_OFFSET) => wallFrame(k, offset, along, y).position;
const cornerPt = (k, y, offset = RUN_OFFSET) => cornerPoint(k, offset, y);

// Which wall a point is nearest to, and how far it sits from it.
function nearestWall(p) {
  const a = Math.atan2(p.x, -p.z);
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  const f = wallFrame(k);
  return { k, normal: f.normal, offset: ROOM.apothem + p.dot(f.normal) };
}

// Clamp brackets tying straight wall-parallel runs back to the brick.
function addClamps(parent, M, points, radius) {
  const clampGeo = new THREE.TorusGeometry(radius * 1.3, radius * 0.3, 6, 16);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mid = a.clone().lerp(b, 0.5);
    const w = nearestWall(mid);
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    if (w.offset > 0.8 || Math.abs(dir.dot(w.normal)) > 0.2 || len < 0.8) continue;
    const n = Math.max(1, Math.floor(len / 1.4));
    for (let j = 1; j <= n; j++) {
      const p = a.clone().lerp(b, j / (n + 1));
      const off = ROOM.apothem + p.dot(w.normal);
      const ring = new THREE.Mesh(clampGeo, M.blackIron);
      ring.position.copy(p);
      ring.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
      ring.name = 'PipeClamp';
      parent.add(ring);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, off - radius), M.blackIron);
      strap.position.copy(p).addScaledVector(w.normal, -(off + radius) / 2 + radius);
      strap.quaternion.setFromUnitVectors(V(0, 0, 1), w.normal);
      strap.name = 'PipeBracket';
      parent.add(strap);
    }
  }
}

// Mount a valve on a pipe at `p`, flow along `dir`, bonnet pointing along `up`.
function mountValve(parent, M, p, dir, up, size, wheelMat) {
  const v = createValve(M, { size, wheelMaterial: wheelMat });
  const x = dir.clone().normalize();
  const y = up.clone().addScaledVector(x, -up.dot(x)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  v.object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  v.object.position.copy(p);
  parent.add(v.object);
  return v;
}

function mountGauge(parent, M, p, normal, radius = 0.11) {
  const stemEnd = p.clone().addScaledVector(normal, 0.18);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), M.brass);
  stem.position.copy(p).lerp(stemEnd, 0.5);
  stem.quaternion.setFromUnitVectors(V(0, 1, 0), normal);
  stem.name = 'GaugeStem';
  parent.add(stem);
  const g = createGauge(M, { radius, depth: 0.05 });
  g.object.position.copy(stemEnd);
  g.object.quaternion.setFromUnitVectors(V(0, 0, 1), normal);
  parent.add(g.object);
  return g.needle;
}

export function createWallPipes(M, { boiler, gearFeed }) {
  const root = group('WallPipework');
  const needles = [];
  const steamPoints = [];
  const high = 6.1;

  // main steam line: boiler dome → up → along N and NE walls → gear-train feed
  // (the line steps east before turning to the wall so it clears the flue behind the dome)
  const out = boiler.steamOutlet;
  const feedAbove = gearFeed.world.clone().setY(high).addScaledVector(wallFrame(1).normal, RUN_OFFSET - gearFeed.offset);
  const steam = [
    out.clone(),
    out.clone().setY(high),
    V(out.x + 1.2, high, out.z),
    wallPt(0, out.x + 1.2, high),
    cornerPt(0, high),
    feedAbove.clone(),
    feedAbove.clone().setY(high - 0.6),
    gearFeed.world.clone().setY(high - 0.6),
    gearFeed.world.clone(),
  ];
  const main = createPipe(steam, { radius: 0.075, material: M.copper, fittingMaterial: M.brass, name: 'MainSteamLine' });
  root.add(main.object);
  addClamps(root, M, steam, 0.075);
  mountValve(root, M, steam[3].clone().lerp(steam[4], 0.3), steam[4].clone().sub(steam[3]), V(0, -1, 0), 1.4, M.paintRed);

  // flue: crown collar → up → into the north wall
  const flueTop = 6.4;
  const flue = [boiler.flue.clone(), boiler.flue.clone().setY(flueTop), wallPt(0, boiler.flue.x, flueTop, -0.3)];
  const fluePipe = createPipe(flue, { radius: 0.24, material: M.castIron, fittingMaterial: M.ironDark, bend: 0.5, name: 'Flue' });
  root.add(fluePipe.object);
  const thimble = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 24), M.ironDark);
  thimble.position.copy(wallPt(0, boiler.flue.x, flueTop, 0.03));
  thimble.quaternion.setFromUnitVectors(V(0, 1, 0), wallFrame(0).normal);
  thimble.name = 'FlueThimble';
  root.add(thimble);

  // left branch: boiler port → west along the N wall → round the corner → drop on the NW wall
  const lp = boiler.portLeft;
  const left = [
    lp.clone(),
    lp.clone().setX(-2.1),
    wallPt(0, -2.1, lp.y, 0.3),
    wallPt(0, -2.1, 5.4, 0.3),
    cornerPt(7, 5.4),
    wallPt(7, 3.3, 5.4, 0.3),
    wallPt(7, 3.3, 1.0, 0.3),
    wallPt(7, 3.3, 1.0, 0.02),
  ];
  const lPipe = createPipe(left, { radius: 0.05, material: M.copper, fittingMaterial: M.brassAged, name: 'WestBranch' });
  root.add(lPipe.object);
  addClamps(root, M, left, 0.05);
  const n7 = wallFrame(7).normal;
  mountValve(root, M, wallPt(7, 3.3, 1.6, 0.3), V(0, 1, 0), n7, 1.1, M.paintRed);
  needles.push({ needle: mountGauge(root, M, wallPt(7, 3.3, 2.2, 0.3).addScaledVector(n7, 0.04), n7), base: 0.35, seed: 1 });
  steamPoints.push({ position: wallPt(7, 3.3, 1.72, 0.42), direction: n7.clone().add(V(0, 0.6, 0)), strength: 0.45 });

  // right branch: boiler port → east → up the N wall → relief valve venting steam
  const rp = boiler.portRight;
  const right = [
    rp.clone(),
    rp.clone().setX(2.1),
    wallPt(0, 2.1, rp.y, 0.3),
    wallPt(0, 2.1, 3.7, 0.3),
  ];
  const rPipe = createPipe(right, { radius: 0.045, material: M.copper, fittingMaterial: M.brassAged, name: 'EastBranch' });
  root.add(rPipe.object);
  addClamps(root, M, right, 0.045);
  const n0 = wallFrame(0).normal;
  mountValve(root, M, wallPt(0, 2.1, 3.82, 0.3), V(0, 1, 0), n0, 1.0, M.brass);
  const vent = createPipe([wallPt(0, 2.1, 3.9, 0.3), wallPt(0, 2.1, 4.25, 0.3), wallPt(0, 2.1, 4.25, 0.55)], { radius: 0.03, material: M.brassAged, name: 'ReliefVent' });
  root.add(vent.object);
  steamPoints.push({ position: wallPt(0, 2.1, 4.25, 0.6), direction: n0.clone().add(V(0, 0.9, 0)), strength: 0.9 });
  needles.push({ needle: mountGauge(root, M, wallPt(0, 2.1, 2.8, 0.3).addScaledVector(n0, 0.04), n0, 0.13), base: 0.62, seed: 2 });
  mountValve(root, M, V(1.62, rp.y, rp.z), V(1, 0, 0), V(0, 1, 0), 0.9, M.paintRed);

  const update = (dt, t) => {
    for (const n of needles) setGaugeValue(n.needle, n.base + Math.sin(t * 0.5 + n.seed) * 0.02 + Math.sin(t * 6.3 + n.seed * 2) * 0.004);
  };

  return { object: root, update, steam: steamPoints };
}
