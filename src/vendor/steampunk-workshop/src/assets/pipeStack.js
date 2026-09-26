// Stock of pipe lengths stacked on two cast-iron cradles: hollow copper, iron and brass tubes of
// mixed diameter, a flanged length and loose elbows, lashed with rope.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { mulberry32 } from '../materials/noise.js';

function hollowTube(ri, ro, len) {
  const g = lathe([[ri, 0], [ro, 0], [ro, len], [ri, len], [ri, 0]], 20);
  g.rotateZ(-Math.PI / 2);
  g.translate(-len / 2, 0, 0);
  return g;
}

export function createPipeStack(M) {
  const root = group('PipeStock');
  const rand = mulberry32(61);
  const cradles = new GeoBatch();
  for (const x of [-0.5, 0.5]) {
    cradles.box(0.06, 0.08, 0.6, [x, 0.04, 0]);
    for (const s of [-1, 1]) cradles.box(0.05, 0.36, 0.05, [x, 0.18, s * 0.27]);
  }
  root.add(cradles.build(M.castIron, 'Cradles'));

  const batches = { copper: new GeoBatch(), iron: new GeoBatch(), brass: new GeoBatch() };
  const rows = [
    { n: 5, r: 0.05 },
    { n: 4, r: 0.05 },
    { n: 3, r: 0.045 },
  ];
  let y = 0.08;
  rows.forEach((row, ri) => {
    const pitch = row.r * 2.05;
    const x0 = -((row.n - 1) * pitch) / 2;
    for (let i = 0; i < row.n; i++) {
      const kind = ['copper', 'iron', 'brass'][Math.floor(rand() * 3)];
      const r = row.r * (0.85 + rand() * 0.15);
      const len = 1.5 + rand() * 0.35;
      const g = hollowTube(r * 0.8, r, len);
      const z = x0 + i * pitch;
      batches[kind].add(g, new THREE.Matrix4().makeTranslation((rand() - 0.5) * 0.18, y + row.r, z));
      if (rand() < 0.3) batches.iron.add(new THREE.CylinderGeometry(r * 1.8, r * 1.8, 0.03, 18).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(len / 2 - 0.02, y + row.r, z));
    }
    y += row.r * 1.75;
    void ri;
  });
  root.add(batches.copper.build(M.copper, 'CopperStock'));
  root.add(batches.iron.build(M.castIron, 'IronStock'));
  root.add(batches.brass.build(M.brassAged, 'BrassStock'));

  // rope lashing around the stack at each cradle
  for (const x of [-0.5, 0.5]) {
    add(root, new THREE.TorusGeometry(0.3, 0.008, 6, 32), M.rope, 'Lashing', [x + 0.04, 0.3, 0], [0, Math.PI / 2, 0], [1, 0.85, 1]).userData.noShadow = true;
  }
  const elbow = new THREE.TorusGeometry(0.07, 0.035, 10, 16, Math.PI / 2);
  add(root, elbow, M.copper, 'LooseElbow', [0.62, 0.035, 0.42], [Math.PI / 2, 0, 0.4]);
  add(root, elbow, M.brassAged, 'LooseElbow', [0.35, 0.035, 0.5], [Math.PI / 2, 0, 2.2]);
  add(root, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), M.castIron, 'Coupler', [-0.62, 0.06, 0.44]);
  return { object: root, height: y };
}
