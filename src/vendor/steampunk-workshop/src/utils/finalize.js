// Post-build pass shared by every asset: shadow flags and static-matrix freezing.
import * as THREE from 'three';
import { metricBoxUV } from './geometry.js';

const _s = new THREE.Vector3();

// Meshes smaller than `minRadius` do not cast shadows (cheap, and invisible at that size).
// Plain box primitives also get metric, grain-aligned UVs here.
export function applyShadows(root, minRadius = 0.06) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    metricBoxUV(o.geometry);
    o.receiveShadow = true;
    if (o.userData.noShadow || o.material.transparent) {
      o.castShadow = false;
      return;
    }
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(_s);
    const r = o.geometry.boundingSphere.radius * Math.max(_s.x, _s.y, _s.z);
    o.castShadow = r >= minRadius || o.isInstancedMesh;
  });
}

// Everything not flagged `userData.dynamic` stops recomputing its local matrix every frame.
export function freezeStatic(root) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.userData.dynamic) return;
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
}
