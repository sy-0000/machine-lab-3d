// 壓花刀（車床用，雙輪菱形紋）：方形刀桿、叉形刀頭、兩只滾花輪、黃銅樞軸與固定螺絲
import * as THREE from 'three';
import { mesh, cylinderX } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createKnurlingTool(mat) {
  const g = new THREE.Group();
  g.name = 'KnurlingTool';
  const S = 16; // 刀桿 16 × 16
  const shank = mesh(new THREE.BoxGeometry(mm(140), mm(S), mm(S)), mat.steelDark);
  shank.position.set(mm(70), mm(S / 2), 0);
  g.add(shank);
  // 刀頭本體
  const head = mesh(new THREE.BoxGeometry(mm(26), mm(20), mm(34)), mat.steel);
  head.position.set(mm(153), mm(10), 0);
  g.add(head);
  // 叉形上下夾板
  for (const y of [1.5, 18.5]) {
    const plate = mesh(new THREE.BoxGeometry(mm(22), mm(3), mm(34)), mat.steel);
    plate.position.set(mm(175), mm(y), 0);
    g.add(plate);
  }
  // 兩只滾花輪（軸向 Y），突出刀頭前緣
  for (const z of [-9, 9]) {
    const wheel = mesh(new THREE.CylinderGeometry(mm(10), mm(10), mm(8), 48), mat.knurlSteel);
    wheel.position.set(mm(180), mm(10), mm(z));
    g.add(wheel);
    const pin = mesh(new THREE.CylinderGeometry(mm(2.5), mm(2.5), mm(21), 16), mat.brassPolished);
    pin.position.set(mm(180), mm(10), mm(z));
    g.add(pin);
  }
  // 樞軸與內六角固定螺絲（黃銅）
  const pivot = cylinderX(mm(4), mm(4), mm(3), mat.brassPolished, 24);
  pivot.rotation.set(0, 0, 0);
  pivot.position.set(mm(153), mm(20.5), 0);
  pivot.rotation.x = 0; pivot.rotation.z = 0;
  g.add(pivot);
  const cap = mesh(new THREE.CylinderGeometry(mm(4.5), mm(4.5), mm(4), 24), mat.brass);
  cap.position.set(mm(153), mm(22), 0);
  g.add(cap);
  const socket = mesh(new THREE.CylinderGeometry(mm(1.8), mm(1.8), mm(4.2), 6), mat.blackPaint);
  socket.position.set(mm(153), mm(22.2), 0);
  g.add(socket);
  return g;
}
