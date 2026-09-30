// 銅刷：一體成形木柄與刷頭，3 × 16 束黃銅絲（InstancedMesh）；側躺收納，刷毛朝 +Z
import * as THREE from 'three';
import { extrudeFlat, circlePath, mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createBrassWireBrush(mat) {
  const outer = new THREE.Group();
  outer.name = 'BrassWireBrush';
  const g = new THREE.Group();
  // 俯視輪廓：刷頭 0~120，握柄 120~260
  const s = new THREE.Shape();
  s.moveTo(mm(4), mm(-12));
  s.lineTo(mm(118), mm(-12));
  s.bezierCurveTo(mm(140), mm(-12), mm(150), mm(-9), mm(175), mm(-9));
  s.bezierCurveTo(mm(215), mm(-9), mm(240), mm(-12), mm(252), mm(-11));
  s.absarc(mm(254), 0, mm(11), -Math.PI / 2, Math.PI / 2, false);
  s.bezierCurveTo(mm(240), mm(12), mm(215), mm(9), mm(175), mm(9));
  s.bezierCurveTo(mm(150), mm(9), mm(140), mm(12), mm(118), mm(12));
  s.lineTo(mm(4), mm(12));
  s.quadraticCurveTo(0, mm(12), 0, mm(8));
  s.lineTo(0, mm(-8));
  s.quadraticCurveTo(0, mm(-12), mm(4), mm(-12));
  s.holes.push(circlePath(mm(254), 0, mm(4)));
  const body = extrudeFlat(s, mm(12), mat.woodHandle, mm(1.5));
  body.position.y = mm(0);
  g.add(body);
  // 黃銅絲束（朝 -Y）：每束以一支略為外擴的圓柱表示（細到次像素的單根銅絲會看不見）
  const rows = 3, cols = 16;
  const tuftGeo = new THREE.CylinderGeometry(mm(2.1), mm(1.5), 1, 10, 1, true);
  tuftGeo.translate(0, -0.5, 0);
  const tufts = new THREE.InstancedMesh(tuftGeo, mat.brassWire, rows * cols);
  const capGeo = new THREE.CircleGeometry(mm(2.1), 10);
  capGeo.rotateX(Math.PI / 2);
  const caps = new THREE.InstancedMesh(capGeo, mat.brassWire, rows * cols);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const cx = mm(8 + c * 7), cz = mm((r - 1) * 7);
    const len = mm(20 + Math.random() * 1.5);
    e.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(cx, mm(0.5), cz), q, new THREE.Vector3(1, len, 1));
    tufts.setMatrixAt(k, m4);
    m4.compose(new THREE.Vector3(cx, mm(0.5) - len, cz), q, new THREE.Vector3(1, 1, 1));
    caps.setMatrixAt(k, m4);
    k++;
  }
  for (const im of [tufts, caps]) {
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingBox(); im.computeBoundingSphere();
    im.castShadow = true;
    g.add(im);
  }
  // 刷頭底部黃銅護板
  const plate = mesh(new THREE.BoxGeometry(mm(116), mm(1), mm(24)), mat.brassDark);
  plate.position.set(mm(60), mm(0.2), 0);
  g.add(plate);
  g.rotation.x = -Math.PI / 2; // 側躺：刷毛朝 +Z
  outer.add(g);
  return outer;
}
