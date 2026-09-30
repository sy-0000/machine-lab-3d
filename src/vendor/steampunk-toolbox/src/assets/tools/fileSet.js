// 銼刀 ×3：平銼、半圓銼、圓銼。交叉齒紋鋼身、木柄、黃銅套圈。count 決定件數（依序取型）
import * as THREE from 'three';
import { latheAlongX, mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

function taperAlongX(geo, len, endScaleY, endScaleZ) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) + len / 2) / len; // 0 根部 → 1 尖端
    const ky = 1 - (1 - endScaleY) * Math.pow(t, 1.6), kz = 1 - (1 - endScaleZ) * Math.pow(t, 1.6);
    p.setY(i, p.getY(i) * ky); p.setZ(i, p.getZ(i) * kz);
  }
  geo.computeVertexNormals();
  return geo;
}

function blade(type, mat) {
  const L = mm(150);
  let geo;
  if (type === 'flat') {
    geo = new THREE.BoxGeometry(L, mm(4.5), mm(16), 40, 1, 1);
    taperAlongX(geo, L, 0.7, 0.6);
  } else if (type === 'half') {
    const s = new THREE.Shape();
    s.moveTo(-mm(8), 0); s.lineTo(mm(8), 0);
    s.absarc(0, -mm(3.5), mm(8.7), Math.atan2(mm(3.5), mm(8)), Math.PI - Math.atan2(mm(3.5), mm(8)), false);
    s.closePath();
    geo = new THREE.ExtrudeGeometry(s, { depth: L, steps: 40, bevelEnabled: false, curveSegments: 24 });
    geo.translate(0, -mm(2.5), -L / 2);
    geo.rotateY(Math.PI / 2);
    geo.rotateX(Math.PI / 2);
    taperAlongX(geo, L, 0.55, 0.55);
  } else {
    geo = new THREE.CylinderGeometry(mm(4.5), mm(4.5), L, 24, 40);
    geo.rotateZ(-Math.PI / 2);
    taperAlongX(geo, L, 0.45, 0.45);
  }
  const b = mesh(geo, mat.fileSteel);
  b.position.x = L / 2;
  return b;
}

function file(type, mat) {
  const g = new THREE.Group();
  g.add(blade(type, mat));
  // 肩部（無齒）
  const shoulder = mesh(new THREE.BoxGeometry(mm(8), mm(4), mm(type === 'round' ? 8 : 12)), mat.steelDark);
  shoulder.position.x = -mm(3);
  g.add(shoulder);
  // 黃銅套圈
  const ferrule = latheAlongX([[0, 0], [mm(13), 0], [mm(13.5), mm(3)], [mm(13), mm(12)], [0, mm(12)]], mat.brass, 32);
  ferrule.position.x = -mm(19);
  g.add(ferrule);
  // 木柄（握把處磨亮）
  const handle = latheAlongX([
    [0, -mm(100)], [mm(9), -mm(100)], [mm(12), -mm(95)], [mm(14), -mm(70)], [mm(13.5), -mm(35)], [mm(11.5), -mm(6)], [mm(12.5), 0], [0, 0],
  ], mat.woodHandle, 32);
  handle.position.x = -mm(19);
  g.add(handle);
  return g;
}

export function createFileSet(mat, config = {}) {
  const g = new THREE.Group();
  g.name = 'FileSet';
  const types = ['flat', 'half', 'round'];
  const n = config.count || 3;
  for (let i = 0; i < n; i++) {
    const f = file(types[i % 3], mat);
    f.position.z = mm((i - (n - 1) / 2) * 40);
    f.position.x = mm(i * 6);
    g.add(f);
  }
  return g;
}
