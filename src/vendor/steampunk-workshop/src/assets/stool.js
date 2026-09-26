// Workshop stool: splayed oak legs, brass foot ring and a buttoned leather seat worn in the middle.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';

export function createStool(M) {
  const root = group('LeatherStool');
  const seatY = 0.62;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot = V(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
    const top = V(Math.cos(a) * 0.14, seatY - 0.04, Math.sin(a) * 0.14);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, foot.distanceTo(top), 10), M.woodWorn);
    leg.position.copy(foot).lerp(top, 0.5);
    leg.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize());
    leg.name = 'StoolLeg';
    root.add(leg);
  }
  add(root, new THREE.TorusGeometry(0.205, 0.009, 8, 36), M.brassAged, 'FootRing', [0, 0.22, 0], [Math.PI / 2, 0, 0]);
  add(root, new THREE.CylinderGeometry(0.19, 0.18, 0.04, 32), M.woodDark, 'SeatBase', [0, seatY - 0.02, 0]);
  add(root, lathe([[0, 0], [0.19, 0], [0.195, 0.02], [0.18, 0.045], [0.12, 0.06], [0.05, 0.058], [0, 0.056]], 32), M.leather, 'Cushion', [0, seatY, 0]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(root, new THREE.SphereGeometry(0.007, 8, 6), M.brassPolished, 'UpholsteryNail', [Math.cos(a) * 0.192, seatY + 0.012, Math.sin(a) * 0.192]).userData.noShadow = true;
  }
  add(root, new THREE.SphereGeometry(0.01, 8, 6), M.leatherDark, 'Button', [0, seatY + 0.056, 0]);
  return { object: root };
}
