// Runtime draw-call reduction: merges every static, opaque, single-material mesh that shares a
// material (and attribute layout / shadow flags) into one world-space mesh. Asset factories stay
// untouched, so any asset can still be rebuilt on its own for glTF export.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KEEP = ['position', 'normal', 'uv', 'color'];

function isDynamic(o) {
  for (let p = o; p; p = p.parent) if (p.userData.dynamic || p.userData.noBatch) return true;
  return false;
}

export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const rootInverse = root.matrixWorld.clone().invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent || isDynamic(o)) return;
    if (o.matrixWorld.determinant() < 0) return;
    const g = o.geometry;
    const attrs = KEEP.filter((k) => g.attributes[k]).join(',');
    const key = `${o.material.uuid}|${attrs}|${o.castShadow}|${o.receiveShadow}|${!!g.index}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });

  let removed = 0;
  let created = 0;
  const m = new THREE.Matrix4();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      g.clearGroups();
      m.multiplyMatrices(rootInverse, o.matrixWorld);
      g.applyMatrix4(m);
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const first = list[0];
    const mesh = new THREE.Mesh(merged, first.material);
    mesh.name = `Batched_${first.material.name || 'material'}`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    root.add(mesh);
    created++;
    for (const o of list) {
      o.parent.remove(o);
      removed++;
    }
  }
  return { removed, created };
}
