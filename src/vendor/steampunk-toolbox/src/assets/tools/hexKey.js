// M8 內六角扳手（對邊 6 mm）：黑染鋼 L 型，長臂末端為球頭，短臂平頭倒角
import * as THREE from 'three';
import { mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createHexKey(mat) {
  const g = new THREE.Group();
  g.name = 'HexKey6mm';
  const r = mm(6 / Math.sqrt(3)); // 對邊 6mm 的外接圓半徑
  const bend = mm(7), longL = 110, shortL = 32;
  const m = mat.blackOxide;
  // 長臂：沿 +X
  const longArm = mesh(new THREE.CylinderGeometry(r, r, mm(longL) - bend - mm(8), 6), m);
  longArm.rotation.z = -Math.PI / 2;
  longArm.rotation.x = Math.PI / 6;
  longArm.position.x = bend + (mm(longL) - bend - mm(8)) / 2;
  g.add(longArm);
  // 球頭頸 + 球頭
  const neck = mesh(new THREE.CylinderGeometry(r * 0.62, r, mm(4), 6), m);
  neck.rotation.z = -Math.PI / 2; neck.rotation.x = Math.PI / 6;
  neck.position.x = mm(longL) - mm(6);
  g.add(neck);
  const ball = mesh(new THREE.SphereGeometry(r * 1.02, 6, 8), m);
  ball.rotation.y = Math.PI / 6;
  ball.scale.set(0.9, 1, 1);
  ball.position.x = mm(longL) - mm(2);
  g.add(ball);
  // 90° 彎角
  const elbow = mesh(new THREE.TorusGeometry(bend, r, 6, 16, Math.PI / 2), m);
  elbow.rotation.x = Math.PI / 2;
  elbow.position.set(bend, 0, bend);
  elbow.rotation.z = Math.PI;
  g.add(elbow);
  // 短臂：沿 +Z
  const shortArm = mesh(new THREE.CylinderGeometry(r, r, mm(shortL) - bend, 6), m);
  shortArm.rotation.x = Math.PI / 2;
  shortArm.position.set(0, 0, bend + (mm(shortL) - bend) / 2);
  g.add(shortArm);
  const tip = mesh(new THREE.CylinderGeometry(r * 0.85, r, mm(1), 6), m);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0, mm(shortL) + mm(0.5));
  g.add(tip);
  return g;
}
