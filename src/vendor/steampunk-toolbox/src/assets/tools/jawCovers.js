// 鉗口罩 ×2：紅銅 L 型軟護片（100 mm），內側嵌兩顆磁鐵；成對收納
import * as THREE from 'three';
import { mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

function jawCover(mat) {
  const g = new THREE.Group();
  const t = 2.5, leg = 30, up = 22, L = 100;
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(mm(leg), 0); s.lineTo(mm(leg), mm(t)); s.lineTo(mm(t), mm(t));
  s.lineTo(mm(t), mm(up)); s.lineTo(0, mm(up)); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: mm(L), bevelEnabled: true, bevelThickness: mm(0.4), bevelSize: mm(0.4), bevelSegments: 2 });
  geo.translate(0, 0, -mm(L / 2));
  geo.rotateY(Math.PI / 2); // 擠出方向 → X；輪廓 x → -Z
  g.add(mesh(geo, mat.copperClean));
  for (const x of [-28, 28]) {
    const mag = mesh(new THREE.CylinderGeometry(mm(6), mm(6), mm(3), 24), mat.magnet);
    mag.rotation.x = Math.PI / 2;
    mag.position.set(mm(x), mm(12), -mm(t + 1.5));
    g.add(mag);
  }
  return g;
}

export function createJawCovers(mat, config = {}) {
  const g = new THREE.Group();
  g.name = 'JawCovers';
  const n = config.count || 2;
  for (let i = 0; i < n; i++) {
    const c = jawCover(mat);
    c.position.z = mm(i * 40);
    g.add(c);
  }
  return g;
}
