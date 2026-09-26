// Coal heap beside the boiler: a lumpy displaced mound covered with instanced coal lumps,
// spill around its foot, a shovel driven in, and a cast-iron edge kerb holding it against the wall.
import * as THREE from 'three';
import { add, group, V } from '../utils/geometry.js';
import { Noise2D, mulberry32 } from '../materials/noise.js';

const A = 0.7; // half width (x)
const B = 0.55; // half depth (z)
const H = 0.55; // peak height

function heightAt(x, z, noise) {
  const r = (x / A) ** 2 + ((z + 0.12) / B) ** 2;
  if (r >= 1) return 0;
  return H * Math.pow(1 - r, 0.75) * (0.85 + 0.3 * noise.value(x * 6 + 10, z * 6 + 10));
}

export function createCoalPile(M) {
  const root = group('CoalPile');
  const noise = new Noise2D(211);
  const rand = mulberry32(88);

  const geo = new THREE.PlaneGeometry(A * 2.1, B * 2.1, 28, 22);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i), noise) - 0.01);
  geo.computeVertexNormals();
  add(root, geo, M.coal, 'Mound');

  const lumpGeo = new THREE.DodecahedronGeometry(0.05, 0);
  const count = 340;
  const lumps = new THREE.InstancedMesh(lumpGeo, M.coal, count);
  lumps.name = 'CoalLumps';
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    let y;
    if (i < count * 0.85) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      x = Math.cos(a) * r * A;
      z = Math.sin(a) * r * B - 0.12;
      y = heightAt(x, z, noise);
    } else {
      // spill across the floor in front
      x = (rand() - 0.5) * 1.8;
      z = B * 0.6 + rand() * 0.6;
      y = 0;
    }
    const s = 0.5 + rand() * 1.1;
    q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3));
    m.compose(V(x, y + 0.02 * s, z), q, V(s, s * 0.8, s));
    lumps.setMatrixAt(i, m);
  }
  lumps.computeBoundingSphere();
  root.add(lumps);

  // kerb
  add(root, new THREE.BoxGeometry(A * 2.2, 0.12, 0.06), M.castIron, 'KerbFront', [0, 0.06, B + 0.05]);
  for (const s of [-1, 1]) add(root, new THREE.BoxGeometry(0.06, 0.12, B * 1.6), M.castIron, 'KerbSide', [s * (A + 0.06), 0.06, -0.1]);

  // shovel driven into the heap
  const shovel = group('CoalShovel', root, [0.22, heightAt(0.22, 0.05, noise) - 0.06, 0.05], [0.5, -0.4, 0.15]);
  add(shovel, new THREE.BoxGeometry(0.24, 0.3, 0.012), M.steelDark, 'Blade', [0, 0.1, 0]);
  add(shovel, new THREE.BoxGeometry(0.24, 0.012, 0.06), M.steelDark, 'BladeLip', [0, 0.25, 0.024]);
  add(shovel, new THREE.CylinderGeometry(0.022, 0.03, 0.14, 10), M.steelDark, 'Socket', [0, 0.32, 0]);
  add(shovel, new THREE.CylinderGeometry(0.018, 0.02, 0.85, 10), M.woodHandle, 'Shaft', [0, 0.8, 0]);
  add(shovel, new THREE.TorusGeometry(0.05, 0.012, 6, 16), M.woodHandle, 'DGrip', [0, 1.26, 0]);
  return { object: root };
}
