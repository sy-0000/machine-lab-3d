// Floor dressing: oil-stain decals under the machines, curled metal shavings around the vise and
// grinder, a cast-iron drain, a coiled hose and a few dropped bolts.
import * as THREE from 'three';
import { group, add, V, HelixCurve } from '../utils/geometry.js';
import { mulberry32 } from '../materials/noise.js';
import { scatterParts } from '../assets/smallParts.js';

function decal(M, x, z, size, rot, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (0.7 + (Math.abs(rot) % 0.3))), M.oilStain);
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, 0.002, z);
  m.name = 'OilStain';
  m.renderOrder = -1;
  m.userData.noShadow = true;
  if (opacity < 1) {
    m.material = M.oilStain.clone();
    m.material.opacity = opacity;
  }
  return m;
}

function shavings(M, centers, count, seed) {
  const rand = mulberry32(seed);
  const geos = [
    new THREE.TubeGeometry(new HelixCurve(0.008, 0.03, 2.5), 16, 0.0012, 3),
    new THREE.TubeGeometry(new HelixCurve(0.012, 0.02, 1.5), 12, 0.0016, 3),
  ];
  const mats = [M.steel, M.brassPolished];
  const out = [];
  geos.forEach((geo, gi) => {
    const mesh = new THREE.InstancedMesh(geo, mats[gi], count);
    mesh.name = gi ? 'BrassSwarf' : 'SteelShavings';
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const c = centers[Math.floor(rand() * centers.length)];
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.7) * c.r;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (rand() - 0.5) * 0.6, rand() * 6.28, rand() * 6.28));
      const s = 0.6 + rand() * 0.9;
      m.compose(V(c.x + Math.cos(a) * r, 0.006 * s, c.z + Math.sin(a) * r), q, V(s, s, s));
      mesh.setMatrixAt(i, m);
    }
    mesh.userData.noShadow = true;
    out.push(mesh);
  });
  return out;
}

export function createFloorDetails(M, spots) {
  const root = group('FloorDetails');
  const { boilerFront, vise, grinder, workbench } = spots;
  root.add(decal(M, boilerFront.x - 0.3, boilerFront.z + 0.2, 2.2, 0.4));
  root.add(decal(M, boilerFront.x + 1.2, boilerFront.z - 0.1, 1.2, 1.3, 0.7));
  root.add(decal(M, vise.x + 0.2, vise.z + 0.5, 1.0, 2.1, 0.8));
  root.add(decal(M, workbench.x + 0.9, workbench.z - 0.2, 1.4, 0.9, 0.55));
  root.add(decal(M, grinder.x, grinder.z, 0.9, 0.2, 0.7));
  root.add(decal(M, 3.2, -4.8, 1.6, 2.6, 0.45));
  root.add(decal(M, -4.4, 1.4, 1.1, 1.1, 0.4));

  for (const mesh of shavings(M, [
    { x: vise.x, z: vise.z + 0.35, r: 0.8 },
    { x: grinder.x, z: grinder.z, r: 0.6 },
    { x: workbench.x + 0.3, z: workbench.z + 0.7, r: 0.9 },
  ], 150, 7)) root.add(mesh);

  root.add(scatterParts(M, 'screw', 18, V(workbench.x - 0.4, 0, workbench.z + 0.9), 1.6, 0.8, 301));
  root.add(scatterParts(M, 'nut', 12, V(boilerFront.x + 0.8, 0, boilerFront.z + 0.6), 1.2, 0.8, 302));
  root.add(scatterParts(M, 'washer', 10, V(grinder.x + 0.3, 0, grinder.z + 0.3), 0.8, 0.6, 303));

  // cast-iron floor drain in front of the boiler
  const drain = group('FloorDrain', root, [boilerFront.x + 1.4, 0, boilerFront.z + 0.9]);
  add(drain, new THREE.CylinderGeometry(0.24, 0.24, 0.012, 32), M.castIron, 'DrainRim', [0, 0.006, 0]);
  for (let i = -3; i <= 3; i++) {
    const w = Math.sqrt(0.2 * 0.2 - (i * 0.05) ** 2) * 2;
    add(drain, new THREE.BoxGeometry(w, 0.014, 0.018), M.ironDark, 'DrainBar', [0, 0.008, i * 0.05]);
  }
  add(drain, new THREE.CircleGeometry(0.2, 24), M.darkInterior, 'DrainHole', [0, 0.003, 0], [-Math.PI / 2, 0, 0]);

  // coiled canvas hose beside the boiler
  const hose = group('CoiledHose', root, [boilerFront.x - 1.9, 0, boilerFront.z + 0.4]);
  for (let i = 0; i < 4; i++) {
    add(hose, new THREE.TorusGeometry(0.32 - i * 0.018, 0.03, 8, 36), M.rubber, 'HoseLoop', [0, 0.03 + i * 0.05, 0], [Math.PI / 2 + (i % 2 ? 0.05 : -0.05), 0, i * 0.4]);
  }
  add(hose, new THREE.CylinderGeometry(0.04, 0.035, 0.12, 14), M.brass, 'HoseNozzle', [0.36, 0.05, 0.1], [0, 0.3, Math.PI / 2]);
  return { object: root };
}
