// Gramophone on a small cabinet: turntable with a spinning shellac record, S-curved tonearm and
// soundbox, a flared petal horn in brass, side crank and a stack of record sleeves below.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';

export function createGramophone(M) {
  const root = group('Gramophone');
  // cabinet with turned legs and a lower shelf of records
  const H = 0.7;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(root, lathe([[0, 0], [0.022, 0], [0.028, 0.08], [0.02, 0.2], [0.026, 0.3], [0, 0.3]], 10), M.woodDark, 'Leg', [sx * 0.25, 0, sz * 0.2]);
  }
  add(root, new THREE.BoxGeometry(0.58, 0.04, 0.48), M.woodDark, 'Shelf', [0, 0.12, 0]);
  for (let i = 0; i < 5; i++) add(root, new THREE.BoxGeometry(0.31, 0.012, 0.31), i % 2 ? M.paper : M.leatherDark, 'RecordSleeve', [0.02 + i * 0.006, 0.146 + i * 0.012, (i % 2) * 0.01]);
  add(root, new THREE.BoxGeometry(0.6, H - 0.3, 0.5), M.woodDark, 'Cabinet', [0, 0.3 + (H - 0.3) / 2, 0]);
  add(root, new THREE.BoxGeometry(0.5, H - 0.4, 0.01), M.woodWorn, 'CabinetPanel', [0, 0.3 + (H - 0.3) / 2, 0.253]);
  add(root, new THREE.BoxGeometry(0.64, 0.03, 0.54), M.woodDark, 'CabinetTop', [0, H + 0.015, 0]);
  for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.02, 0.02, 0.02), M.brassAged, 'Corner', [s * 0.3, H + 0.005, 0.26]);

  // turntable
  const deck = H + 0.03;
  add(root, new THREE.CylinderGeometry(0.16, 0.16, 0.02, 40), M.brassAged, 'Platter', [-0.05, deck + 0.01, 0.02]);
  const record = group('Record', root, [-0.05, deck + 0.022, 0.02]);
  record.userData.dynamic = true;
  add(record, new THREE.CylinderGeometry(0.152, 0.152, 0.003, 48), M.vinyl, 'Disc');
  add(record, new THREE.CylinderGeometry(0.045, 0.045, 0.0035, 32), M.paintRed, 'Label');
  add(record, new THREE.BoxGeometry(0.02, 0.0036, 0.004), M.ivory, 'LabelMark', [0.02, 0, 0]);
  for (const r of [0.07, 0.1, 0.13]) add(record, new THREE.TorusGeometry(r, 0.0006, 3, 64), M.steelDark, 'Groove', [0, 0.0017, 0], [Math.PI / 2, 0, 0]).userData.noShadow = true;
  add(root, new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), M.steel, 'Spindle', [-0.05, deck + 0.03, 0.02]);

  // tonearm: pivot base at the back right, S-curve to the soundbox resting on the record
  const base = V(0.2, deck, -0.16);
  add(root, lathe([[0, 0], [0.035, 0], [0.03, 0.03], [0.02, 0.05], [0, 0.05]], 16), M.brassPolished, 'ArmBase', base.toArray());
  const arm = [base.clone().add(V(0, 0.07, 0)), base.clone().add(V(-0.05, 0.08, 0.06)), base.clone().add(V(-0.16, 0.075, 0.13)), base.clone().add(V(-0.23, 0.06, 0.16))];
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arm), 24, 0.012, 10), M.brassPolished, 'Tonearm');
  const box = arm[3];
  add(root, new THREE.CylinderGeometry(0.035, 0.035, 0.018, 24), M.brassPolished, 'Soundbox', [box.x, box.y - 0.01, box.z], [Math.PI / 2, 0, 0.3]);
  add(root, new THREE.CircleGeometry(0.028, 20), M.ivory, 'Diaphragm', [box.x, box.y - 0.01, box.z + 0.0095], [0, 0, 0]);
  add(root, new THREE.CylinderGeometry(0.002, 0.001, 0.03, 6), M.steel, 'Needle', [box.x, box.y - 0.032, box.z]);

  // horn: neck rises from the arm base, bends forward, then the petal bell flares open
  const neck = [base.clone().add(V(0, 0.05, 0)), base.clone().add(V(0, 0.2, -0.02)), base.clone().add(V(-0.02, 0.34, 0.02)), base.clone().add(V(-0.08, 0.44, 0.12))];
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(neck), 24, 0.026, 12), M.brassAged, 'HornNeck');
  const bell = group('HornBell', root, neck[3].toArray());
  bell.quaternion.setFromUnitVectors(V(0, 1, 0), V(-0.35, 0.55, 0.75).normalize());
  const profile = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    profile.push([0.026 + Math.pow(t, 2.6) * 0.3, t * 0.55]);
  }
  // 12 flat-shaded facets read as the soldered petals of a real horn
  const bellGeo = lathe(profile, 12).toNonIndexed();
  bellGeo.computeVertexNormals();
  add(bell, bellGeo, M.brass, 'BellOuter');
  add(bell, lathe(profile.map(([r, y]) => [r - 0.004, y]), 12, 0, Math.PI * 2, true), M.brassPolished, 'BellInner');
  add(bell, new THREE.TorusGeometry(0.326, 0.008, 6, 36), M.brassPolished, 'BellRim', [0, 0.55, 0], [Math.PI / 2, 0, 0]);

  // winding crank on the right side
  add(root, new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), M.steel, 'CrankShaft', [0.34, 0.55, 0], [0, 0, Math.PI / 2]);
  add(root, new THREE.BoxGeometry(0.015, 0.12, 0.015), M.steel, 'CrankArm', [0.38, 0.5, 0]);
  add(root, new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), M.woodHandle, 'CrankKnob', [0.4, 0.45, 0], [0, 0, Math.PI / 2]);

  const update = (dt, t) => {
    record.rotation.y = -t * 1.3;
  };
  return { object: root, update };
}
