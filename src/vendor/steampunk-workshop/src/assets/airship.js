// Scale airship model suspended from the tie beam: sail-cloth envelope on brass hoops, tail fins,
// a planked gondola with rigging, and three propellers. It turns slowly on its swivel, bobs a
// little, and the propellers spin.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';

const LEN = 2.3;
const R = 0.36;

function envelopeRadius(t) {
  // blunt nose, long tapering tail
  return R * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.62);
}

function propeller(M, radius) {
  const p = group('Propeller');
  p.userData.dynamic = true;
  for (let i = 0; i < 3; i++) {
    const blade = add(p, new THREE.BoxGeometry(0.03, radius, 0.006), M.brassPolished, 'Blade', [0, 0, 0], [0, 0, (i / 3) * Math.PI * 2]);
    blade.geometry = blade.geometry.clone().translate(0, radius / 2, 0);
    blade.rotateY(0.35);
  }
  add(p, new THREE.SphereGeometry(0.022, 10, 8), M.brass, 'Spinner');
  return p;
}

// `cableTop` is the swivel height above the model's origin (the tie-beam underside).
export function createAirship(M, { cableTop = 1.35 } = {}) {
  const root = group('AirshipModel');
  const swivel = group('Swivel', root);
  swivel.userData.dynamic = true;
  const ship = group('Ship', swivel);

  // envelope along +X (nose at +X)
  const prof = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    prof.push([envelopeRadius(t), (0.5 - t) * LEN]); // t = 0 at the nose (+X)
  }
  const env = lathe(prof, 32);
  env.rotateZ(-Math.PI / 2);
  env.rotateX(Math.PI / 2);
  add(ship, env, M.canvasFabric, 'Envelope');
  const hoops = new GeoBatch();
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const r = envelopeRadius(t) + 0.004;
    hoops.add(new THREE.TorusGeometry(r, 0.006, 6, 40).rotateY(Math.PI / 2), new THREE.Matrix4().makeTranslation((0.5 - t) * LEN, 0, 0));
  }
  hoops.add(new THREE.CylinderGeometry(0.008, 0.008, LEN * 0.9, 8).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, R + 0.004, 0));
  ship.add(hoops.build(M.brassAged, 'Hoops'));
  add(ship, new THREE.SphereGeometry(0.04, 12, 10), M.brassPolished, 'NoseCap', [LEN / 2 - 0.01, 0, 0]);

  // cruciform tail fins with brass edging
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.lineTo(-0.34, 0);
  fin.lineTo(-0.36, 0.26);
  fin.lineTo(-0.14, 0.2);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.01, bevelEnabled: false });
  finGeo.translate(0, 0, -0.005);
  for (let i = 0; i < 4; i++) {
    const f = add(ship, finGeo, M.canvasFabric, 'TailFin', [-LEN / 2 + 0.42, 0, 0], [(i * Math.PI) / 2, 0, 0]);
    f.position.x = -LEN / 2 + 0.44;
    f.translateY(envelopeRadius(0.8) * 0.6);
  }

  // gondola
  const hull = new THREE.Shape();
  hull.moveTo(-0.34, 0.08);
  hull.quadraticCurveTo(-0.38, 0, -0.26, -0.05);
  hull.lineTo(0.24, -0.05);
  hull.quadraticCurveTo(0.4, -0.02, 0.38, 0.08);
  hull.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hull, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 });
  hullGeo.translate(0, 0, -0.08);
  const gY = -R - 0.3;
  add(ship, hullGeo, M.woodPlanks, 'Gondola', [0.05, gY, 0]);
  add(ship, new THREE.BoxGeometry(0.66, 0.012, 0.17), M.woodDark, 'Deck', [0.05, gY + 0.085, 0]);
  const rail = new GeoBatch();
  for (const s of [-1, 1]) rail.add(new THREE.CylinderGeometry(0.003, 0.003, 0.62, 5).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(0.05, gY + 0.14, s * 0.085));
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) rail.add(new THREE.CylinderGeometry(0.0025, 0.0025, 0.06, 4), new THREE.Matrix4().makeTranslation(-0.25 + i * 0.075, gY + 0.11, s * 0.085));
  // rigging from envelope to gondola
  for (const x of [-0.25, 0, 0.25]) {
    for (const s of [-1, 1]) {
      const a = V(x * 1.4, -R * 0.82, s * R * 0.4);
      const b = V(x + 0.05, gY + 0.09, s * 0.08);
      rail.segment(new THREE.CylinderGeometry(0.002, 0.002, 1, 4), a, b);
    }
  }
  ship.add(rail.build(M.brassAged, 'RailsRigging'));
  add(ship, new THREE.BoxGeometry(0.1, 0.07, 0.12), M.brassAged, 'EngineHouse', [-0.22, gY + 0.12, 0]);
  add(ship, new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8), M.castIron, 'Stack', [-0.22, gY + 0.2, 0]);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) add(ship, new THREE.CircleGeometry(0.014, 12), M.glassAmber, 'Porthole', [-0.05 + i * 0.12, gY + 0.02, s * 0.092], [0, s > 0 ? 0 : Math.PI, 0]).userData.noShadow = true;
  }

  // propellers: stern, and two on outriggers from the gondola
  const props = [];
  const stern = propeller(M, 0.16);
  stern.position.set(-LEN / 2 - 0.03, 0, 0);
  stern.rotation.y = Math.PI / 2;
  ship.add(stern);
  props.push(stern);
  for (const s of [-1, 1]) {
    add(ship, new THREE.CylinderGeometry(0.006, 0.006, 0.3, 6), M.brassAged, 'Outrigger', [-0.2, gY + 0.08, s * 0.22], [Math.PI / 2, 0, 0]);
    add(ship, new THREE.CylinderGeometry(0.025, 0.02, 0.12, 12), M.brass, 'Nacelle', [-0.2, gY + 0.08, s * 0.37], [0, 0, Math.PI / 2]);
    const p = propeller(M, 0.1);
    p.position.set(-0.27, gY + 0.08, s * 0.37);
    p.rotation.y = Math.PI / 2;
    ship.add(p);
    props.push(p);
  }

  // suspension: spreader bar over the envelope and a single cable up to the tie beam swivel
  add(ship, new THREE.CylinderGeometry(0.008, 0.008, 1.2, 8), M.brassAged, 'Spreader', [0, R + 0.35, 0], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    const a = V(s * 0.58, R + 0.35, 0);
    const b = V(s * 0.55, R * 0.95, 0);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, a.distanceTo(b), 4), M.steel);
    c.position.copy(a).lerp(b, 0.5);
    c.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
    c.name = 'Hanger';
    ship.add(c);
  }
  const cableGroup = group('SuspensionCable', root);
  cableGroup.userData.dynamic = true;
  const cable = add(cableGroup, new THREE.CylinderGeometry(0.004, 0.004, 1, 6), M.steel, 'Cable');
  cable.userData.noShadow = true;
  add(root, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 12), M.brassAged, 'Swivel', [0, cableTop, 0]);

  const update = (dt, t) => {
    swivel.rotation.y = t * 0.045;
    swivel.position.y = Math.sin(t * 0.37) * 0.025;
    ship.rotation.z = Math.sin(t * 0.23) * 0.02;
    for (const [i, p] of props.entries()) p.rotation.z = t * (i === 0 ? 7 : 11);
    const low = R + 0.35 + swivel.position.y;
    cableGroup.position.y = (low + cableTop) / 2;
    cableGroup.scale.y = cableTop - low;
  };
  update(0, 0);
  return { object: root, update };
}
