// 毛刷（清切屑用，1.5 吋）：扁木柄附吊孔、黃銅束套、天然豬鬃（InstancedMesh）
import * as THREE from 'three';
import { extrudeFlat, circlePath, mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createPaintBrush(mat) {
  const g = new THREE.Group();
  g.name = 'PaintBrush';
  // 木柄輪廓（x 由束套往後）
  const s = new THREE.Shape();
  s.moveTo(0, mm(-15));
  s.bezierCurveTo(mm(20), mm(-15), mm(30), mm(-9), mm(55), mm(-9));
  s.bezierCurveTo(mm(90), mm(-9), mm(110), mm(-14), mm(135), mm(-13));
  s.absarc(mm(140), 0, mm(13), -Math.PI / 2 + 0.4, Math.PI / 2 - 0.4, false);
  s.bezierCurveTo(mm(110), mm(14), mm(90), mm(9), mm(55), mm(9));
  s.bezierCurveTo(mm(30), mm(9), mm(20), mm(15), 0, mm(15));
  s.closePath();
  s.holes.push(circlePath(mm(142), 0, mm(3.5)));
  const handle = extrudeFlat(s, mm(8), mat.woodHandle, mm(1.5));
  handle.position.y = mm(2);
  g.add(handle);
  // 黃銅束套
  const ferrule = mesh(new THREE.BoxGeometry(mm(26), mm(13), mm(42)), mat.brass);
  ferrule.position.set(mm(-12), mm(6.5), 0);
  g.add(ferrule);
  for (const x of [-20, -8]) {
    const crimp = mesh(new THREE.BoxGeometry(mm(1.6), mm(13.6), mm(42.6)), mat.brassDark);
    crimp.position.set(mm(x), mm(6.5), 0);
    g.add(crimp);
  }
  // 刷毛
  const n = 460;
  const geo = new THREE.CylinderGeometry(mm(0.35), mm(0.45), 1, 5);
  geo.rotateZ(Math.PI / 2);
  geo.translate(-0.5, 0, 0);
  const light = new THREE.InstancedMesh(geo, mat.bristleNatural, n);
  const dark = new THREE.InstancedMesh(geo, mat.bristleDark, Math.floor(n * 0.25));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let li = 0, di = 0;
  for (let i = 0; i < n + dark.count; i++) {
    const z = (Math.random() - 0.5) * mm(38), y = mm(1.5 + Math.random() * 10);
    const len = mm(40 + Math.random() * 6 - Math.abs(z) / mm(1) * 0.05);
    e.set(0, (Math.random() - 0.5) * 0.06 + z * 0.8, (Math.random() - 0.5) * 0.05);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(mm(-24), y, z), q, new THREE.Vector3(len, 1, 1));
    if (i < n) light.setMatrixAt(li++, m4); else dark.setMatrixAt(di++, m4);
  }
  for (const im of [light, dark]) { im.castShadow = true; im.receiveShadow = true; g.add(im); }
  return g;
}
