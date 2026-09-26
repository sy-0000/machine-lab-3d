// Worn oxblood leather club armchair: rolled arms, deep-buttoned back, sagging seat cushion,
// brass nailhead trim and short turned legs on castors.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';

export function createArmchair(M) {
  const root = group('LeatherArmchair');
  const L = M.leatherOxblood;
  const W = 0.92;
  const D = 0.88;

  const leg = lathe([[0, 0], [0.022, 0], [0.03, 0.03], [0.026, 0.07], [0.032, 0.1], [0.03, 0.13], [0, 0.13]], 12);
  const legs = new GeoBatch();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.add(leg, new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.08)));
  root.add(legs.build(M.woodDark, 'Legs'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(root, new THREE.SphereGeometry(0.018, 10, 8), M.brassAged, 'Castor', [sx * (W / 2 - 0.08), 0.015, sz * (D / 2 - 0.08)]);

  add(root, new RoundedBoxGeometry(W - 0.02, 0.26, D - 0.04, 3, 0.04), L, 'Base', [0, 0.26, 0]);
  const seat = add(root, new RoundedBoxGeometry(W - 0.34, 0.15, D - 0.2, 4, 0.06), L, 'SeatCushion', [0, 0.46, 0.07]);
  seat.scale.set(1, 0.9, 1);
  // the cushion is sat-in: a shallow dip in the middle
  const sp = seat.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i);
    const z = sp.getZ(i);
    const y = sp.getY(i);
    if (y > 0) sp.setY(i, y - 0.025 * Math.exp(-(x * x) / 0.04 - ((z - 0.05) * (z - 0.05)) / 0.05));
  }
  seat.geometry.computeVertexNormals();

  const backRest = group('Back', root, [0, 0.62, -D / 2 + 0.13], [-0.12, 0, 0]);
  add(backRest, new RoundedBoxGeometry(W - 0.02, 0.6, 0.2, 4, 0.07), L, 'BackPanel');
  add(backRest, new THREE.CylinderGeometry(0.09, 0.09, W - 0.02, 20), L, 'BackRoll', [0, 0.3, 0.0], [0, 0, Math.PI / 2]);
  const buttons = new GeoBatch();
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 5 - (r % 2); c++) {
      const x = -0.3 + c * 0.15 + (r % 2) * 0.075;
      buttons.add(new THREE.SphereGeometry(0.011, 8, 6), new THREE.Matrix4().makeTranslation(x, -0.15 + r * 0.14, 0.1));
    }
  }
  backRest.add(buttons.build(M.leatherDark, 'Buttons'));

  const nails = new RivetSet(0.006);
  for (const s of [-1, 1]) {
    const arm = group(s < 0 ? 'ArmLeft' : 'ArmRight', root, [s * (W / 2 - 0.08), 0, 0]);
    add(arm, new RoundedBoxGeometry(0.16, 0.36, D - 0.02, 3, 0.04), L, 'ArmSide', [0, 0.5, 0]);
    add(arm, new THREE.CylinderGeometry(0.1, 0.1, D - 0.02, 20), L, 'ArmRoll', [s * 0.02, 0.7, 0], [Math.PI / 2, 0, 0]);
    add(arm, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 20), M.leatherDark, 'ArmScroll', [s * 0.02, 0.7, D / 2 - 0.005], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      nails.add(V(s * (W / 2 - 0.08) + s * 0.02 + Math.cos(a) * 0.085, 0.7 + Math.sin(a) * 0.085, D / 2 + 0.006), V(0, 0, 1));
    }
  }
  for (let i = 0; i <= 18; i++) nails.add(V(-W / 2 + 0.03 + (i * (W - 0.06)) / 18, 0.17, D / 2 - 0.018), V(0, 0, 1));
  root.add(nails.build(M.brassPolished, 'Nailheads'));

  // a folded wool throw over the left arm
  const throwGeo = new THREE.PlaneGeometry(0.42, 0.6, 6, 10);
  const tp = throwGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const a = (y / 0.6) * Math.PI;
    tp.setXYZ(i, tp.getX(i), Math.cos(a) * 0.12, Math.sin(a) * 0.12 + Math.sin(tp.getX(i) * 20) * 0.004);
  }
  throwGeo.computeVertexNormals();
  const blanket = add(root, throwGeo, M.felt, 'Throw', [-(W / 2 - 0.06), 0.68, 0.05], [0, Math.PI / 2, Math.PI / 2]);
  blanket.material = M.felt;
  return { object: root };
}
