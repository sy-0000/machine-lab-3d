// Antique typewriter: black enamel body, four stepped rows of ivory keys with brass rims,
// fanned typebar basket, rubber platen with a typed sheet, ribbon spools and carriage lever.
import * as THREE from 'three';
import { add, group, V } from '../utils/geometry.js';

export function createTypewriter(M) {
  const root = group('Typewriter');
  const W = 0.34;

  // body: side profile extruded across the width
  const s = new THREE.Shape();
  s.moveTo(0.15, 0);
  s.lineTo(0.15, 0.03);
  s.lineTo(0.03, 0.09);
  s.lineTo(-0.07, 0.125);
  s.lineTo(-0.15, 0.125);
  s.lineTo(-0.16, 0.1);
  s.lineTo(-0.16, 0);
  s.closePath();
  const body = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  body.rotateY(-Math.PI / 2);
  body.translate(W / 2, 0, 0);
  add(root, body, M.enamelBlack, 'Body');
  add(root, new THREE.BoxGeometry(W + 0.02, 0.012, 0.33), M.enamelBlack, 'Base', [0, 0.006, -0.005]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, new THREE.CylinderGeometry(0.012, 0.012, 0.008, 10), M.rubber, 'Foot', [sx * 0.15, -0.002, sz * 0.13]);
  add(root, new THREE.BoxGeometry(0.08, 0.018, 0.002), M.brassPolished, 'Decal', [0, 0.1, -0.162]).userData.noShadow = true;

  // keys (instanced stems, caps, rims)
  const rows = 4;
  const cols = 11;
  const n = rows * cols;
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.03, 5), M.steel, n);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 14), M.ivory, n);
  const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(0.0078, 0.0012, 4, 14).rotateX(Math.PI / 2), M.brassPolished, n);
  stems.name = 'KeyStems';
  caps.name = 'KeyCaps';
  rims.name = 'KeyRims';
  const m = new THREE.Matrix4();
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++, i++) {
      const x = -0.13 + c * 0.026 + (r % 2) * 0.008;
      const z = 0.14 - r * 0.028;
      const bed = 0.03 + ((0.15 - z) / 0.12) * 0.06; // follows the sloped front
      const top = bed + 0.022;
      m.makeTranslation(x, bed + 0.01, z);
      stems.setMatrixAt(i, m);
      m.makeTranslation(x, top, z);
      caps.setMatrixAt(i, m);
      rims.setMatrixAt(i, m);
    }
  }
  for (const im of [stems, caps, rims]) {
    im.computeBoundingSphere();
    im.userData.noShadow = true;
    root.add(im);
  }
  add(root, new THREE.BoxGeometry(0.17, 0.006, 0.012), M.ivory, 'SpaceBar', [0, 0.05, 0.158]);

  // typebar basket (fan of thin bars behind the keyboard)
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.002, 0.075, 0.003), M.steel, 30);
  bars.name = 'Typebars';
  for (let k = 0; k < 30; k++) {
    const a = -1.3 + (k / 29) * 2.6;
    m.compose(V(Math.sin(a) * 0.04, 0.128, -0.05 + Math.cos(a) * 0.02), new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.2, a * 0.6, 0)), V(1, 1, 1));
    bars.setMatrixAt(k, m);
  }
  bars.userData.noShadow = true;
  root.add(bars);

  // carriage, platen and paper
  add(root, new THREE.BoxGeometry(0.44, 0.012, 0.04), M.steel, 'CarriageRail', [0.02, 0.145, -0.11]);
  add(root, new THREE.CylinderGeometry(0.026, 0.026, 0.38, 24), M.rubber, 'Platen', [0.02, 0.172, -0.1], [0, 0, Math.PI / 2]);
  for (const sx of [-1, 1]) add(root, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), M.ivory, 'PlatenKnob', [0.02 + sx * 0.2, 0.172, -0.1], [0, 0, Math.PI / 2]);
  const lever = [V(-0.19, 0.18, -0.08), V(-0.23, 0.2, -0.03), V(-0.24, 0.21, 0.03)];
  add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lever), 12, 0.004, 6), M.steel, 'ReturnLever');
  add(root, new THREE.SphereGeometry(0.009, 10, 8), M.ivory, 'LeverTip', lever[2].toArray());
  const paperGeo = new THREE.PlaneGeometry(0.216, 0.3, 1, 16);
  const pp = paperGeo.attributes.position;
  for (let k = 0; k < pp.count; k++) {
    const y = pp.getY(k) + 0.15; // 0..0.3 along the sheet
    if (y < 0.06) {
      const a = (1 - y / 0.06) * Math.PI * 0.6;
      pp.setY(k, 0.172 + Math.sin(a) * 0.028);
      pp.setZ(k, -0.1 + Math.cos(a) * 0.028);
    } else {
      pp.setY(k, 0.172 + (y - 0.06) * 0.97);
      pp.setZ(k, -0.1 + 0.028 - (y - 0.06) * 0.25);
    }
  }
  paperGeo.computeVertexNormals();
  add(root, paperGeo, M.bookPage, 'TypedSheet', [0.02, 0, 0]).userData.noShadow = true;

  // ribbon spools
  for (const sx of [-1, 1]) {
    add(root, new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), M.brassPolished, 'Spool', [sx * 0.1, 0.132, -0.04]);
    add(root, new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), M.paintRed, 'Ribbon', [sx * 0.1, 0.139, -0.04]);
  }
  return { object: root, height: 0.2 };
}
