// Plank shipping crates (one opened, with straw and pipe fittings) and iron-hooped barrels.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch, scaleUV } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';
import { mulberry32 } from '../materials/noise.js';

export function createCrate(M, { w = 0.8, h = 0.6, d = 0.6, open = false, seed = 1 } = {}) {
  const root = group(open ? 'OpenCrate' : 'Crate');
  const rand = mulberry32(seed);
  const planks = new GeoBatch();
  const battens = new GeoBatch();
  const nails = new RivetSet(0.006);
  const t = 0.02;
  const rows = 3;
  const ph = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = ph * (r + 0.5);
    const jitter = () => (rand() - 0.5) * 0.004;
    planks.box(w, ph - 0.008, t, [0, y + jitter(), d / 2 - t / 2]);
    planks.box(w, ph - 0.008, t, [0, y + jitter(), -d / 2 + t / 2]);
    planks.box(t, ph - 0.008, d - 2 * t, [w / 2 - t / 2, y + jitter(), 0]);
    planks.box(t, ph - 0.008, d - 2 * t, [-w / 2 + t / 2, y + jitter(), 0]);
  }
  planks.box(w - 0.01, t, d - 0.01, [0, t / 2, 0]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      battens.box(0.05, h, 0.025, [sx * (w / 2 - 0.035), h / 2, sz * (d / 2 + 0.0125)]);
      battens.box(0.025, h, 0.05, [sx * (w / 2 + 0.0125), h / 2, sz * (d / 2 - 0.035)]);
      for (let r = 0; r < rows; r++) nails.add(V(sx * (w / 2 - 0.035), ph * (r + 0.5), sz * (d / 2 + 0.026)), V(0, 0, sz));
    }
  }
  for (const sz of [-1, 1]) battens.box(w - 0.1, 0.05, 0.022, [0, h * 0.5, sz * (d / 2 + 0.011)]);
  const lid = new GeoBatch();
  const lidPlanks = 4;
  for (let i = 0; i < lidPlanks; i++) lid.box(w, t, d / lidPlanks - 0.006, [0, 0, -d / 2 + (d / lidPlanks) * (i + 0.5)]);
  lid.box(0.06, t, d, [-w / 2 + 0.08, -t, 0]);
  lid.box(0.06, t, d, [w / 2 - 0.08, -t, 0]);
  root.add(planks.build(M.woodPine, 'Planks'));
  root.add(battens.build(M.woodWorn, 'Battens'));
  const lidMesh = lid.build(M.woodPine, 'Lid');
  if (open) {
    lidMesh.position.set(w / 2 + 0.08, h * 0.45, 0.05);
    lidMesh.rotation.set(0.05, 0.2, 1.35);
    // straw bedding and loose pipe fittings
    const strawGeo = new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 4);
    const straw = new THREE.InstancedMesh(strawGeo, M.straw, 260);
    straw.name = 'Straw';
    const m = new THREE.Matrix4();
    for (let i = 0; i < 260; i++) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
      const edge = i > 200;
      const p = V((rand() - 0.5) * (w - 0.06), h - 0.08 + rand() * 0.1 + (edge ? 0.03 : 0), (rand() - 0.5) * (d - 0.06));
      if (edge) p.x = (rand() < 0.5 ? -1 : 1) * (w / 2 - 0.03);
      m.compose(p, q, V(1, 0.6 + rand() * 0.8, 1));
      straw.setMatrixAt(i, m);
    }
    straw.userData.noShadow = true;
    root.add(straw);
    add(root, new THREE.BoxGeometry(w - 0.05, 0.02, d - 0.05), M.straw, 'StrawBed', [0, h - 0.06, 0]);
    const elbow = new THREE.TorusGeometry(0.06, 0.025, 10, 16, Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      add(root, elbow, i % 2 ? M.copper : M.brassAged, 'PipeElbow', [(rand() - 0.5) * (w - 0.25), h - 0.02, (rand() - 0.5) * (d - 0.25)], [rand() * 2, rand() * 3, rand()]);
    }
    add(root, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 14), M.copper, 'PipeLength', [0.05, h + 0.02, -0.05], [0.3, 0.2, Math.PI / 2 - 0.25]);
  } else {
    lidMesh.position.set(0, h + t / 2, 0);
  }
  root.add(lidMesh);
  root.add(nails.build(M.steelDark, 'Nails'));
  return { object: root, height: h };
}

export function createBarrel(M) {
  const root = group('Barrel');
  const H = 0.9;
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * H;
    const r = 0.28 + Math.sin((i / 12) * Math.PI) * 0.05;
    profile.push([r, y]);
  }
  add(root, scaleUV(lathe(profile, 28), 3, 1), M.woodPlanks, 'Staves');
  add(root, new THREE.CylinderGeometry(0.275, 0.275, 0.02, 28), M.woodPlanks, 'Head', [0, H - 0.03, 0]);
  for (const y of [0.08, 0.28, 0.62, 0.82]) {
    const r = 0.28 + Math.sin((y / H) * Math.PI) * 0.05 + 0.004;
    add(root, new THREE.CylinderGeometry(r, r, 0.04, 28, 1, true), M.ironDark, 'Hoop', [0, y, 0]);
  }
  add(root, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M.woodDark, 'Bung', [0.08, H - 0.02, 0.05]);
  return { object: root };
}
