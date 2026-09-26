// Brass-clad multi-drawer tool chest on iron castors: graduated drawers with bar pulls and label
// cards, riveted corner guards, a hinged top box propped open, one drawer pulled out with tools.
import * as THREE from 'three';
import { add, group, V, GeoBatch } from '../utils/geometry.js';
import { RivetSet } from '../utils/rivets.js';
import { createWrench, createScrewdriver, createPliers, layFlat } from './tools.js';

export function createToolChest(M) {
  const root = group('BrassToolChest');
  const W = 0.95;
  const D = 0.5;
  const bodyY = 0.12;
  const bodyH = 0.86;
  const rivets = new RivetSet(0.006);

  // castors
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = group('Castor', root, [sx * (W / 2 - 0.07), 0, sz * (D / 2 - 0.07)]);
      add(c, new THREE.CylinderGeometry(0.04, 0.04, 0.025, 16), M.castIron, 'Wheel', [0, 0.042, 0], [0, 0, Math.PI / 2]);
      add(c, new THREE.BoxGeometry(0.04, 0.06, 0.05), M.brassAged, 'Fork', [0, 0.075, 0]);
      add(c, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), M.brassAged, 'Swivel', [0, 0.11, 0]);
    }
  }

  // carcass
  add(root, new THREE.BoxGeometry(W, bodyH, D), M.brassAged, 'Body', [0, bodyY + bodyH / 2, 0]);
  const guards = new GeoBatch();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      guards.box(0.04, bodyH + 0.01, 0.04, [sx * (W / 2 - 0.012), bodyY + bodyH / 2, sz * (D / 2 - 0.012)]);
      rivets.line(V(sx * (W / 2 + 0.009), bodyY + 0.05, sz * (D / 2 - 0.012)), V(sx * (W / 2 + 0.009), bodyY + bodyH - 0.05, sz * (D / 2 - 0.012)), 0.1, V(sx, 0, 0));
    }
  }
  root.add(guards.build(M.blackIron, 'CornerGuards'));

  // drawers (graduated), third from the top pulled out
  const heights = [0.08, 0.08, 0.09, 0.1, 0.12, 0.16, 0.2];
  const fronts = new GeoBatch();
  const pulls = new GeoBatch();
  const labels = new GeoBatch();
  let y = bodyY + bodyH - 0.02;
  heights.forEach((h, i) => {
    y -= h;
    const pull = i === 2 ? 0.26 : 0;
    const zf = D / 2 + 0.008 + pull;
    fronts.box(W - 0.09, h - 0.012, 0.018, [0, y + h / 2, zf]);
    pulls.add(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 10).rotateZ(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, y + h / 2 - 0.005, zf + 0.03));
    for (const s of [-1, 1]) pulls.box(0.012, 0.012, 0.03, [s * 0.1, y + h / 2 - 0.005, zf + 0.018]);
    labels.box(0.07, 0.03, 0.003, [-0.3, y + h / 2, zf + 0.011]);
    if (pull) {
      const box = new GeoBatch();
      const depth = D - 0.06;
      box.box(W - 0.1, 0.008, depth, [0, y + 0.012, zf - depth / 2 - 0.01]);
      for (const s of [-1, 1]) box.box(0.008, h - 0.02, depth, [s * (W / 2 - 0.055), y + h / 2, zf - depth / 2 - 0.01]);
      root.add(box.build(M.woodPine, 'DrawerTray'));
      const floorY = y + 0.016;
      root.add(layFlat(createWrench(M, 0.2), -0.2, floorY, zf - 0.16, 1.5));
      root.add(layFlat(createWrench(M, 0.16), -0.05, floorY, zf - 0.2, 1.6));
      root.add(layFlat(createScrewdriver(M, 0.2), 0.15, floorY, zf - 0.18, 1.45));
      root.add(layFlat(createPliers(M, 0.1), 0.3, floorY, zf - 0.2, 1.9));
    }
  });
  root.add(fronts.build(M.brass, 'DrawerFronts'));
  root.add(pulls.build(M.steel, 'Pulls'));
  root.add(labels.build(M.paper, 'LabelCards'));

  // top box with its lid propped open
  const topY = bodyY + bodyH;
  add(root, new THREE.BoxGeometry(W - 0.02, 0.2, D - 0.02), M.brassAged, 'TopBox', [0, topY + 0.1, 0]);
  add(root, new THREE.BoxGeometry(W - 0.06, 0.004, D - 0.06), M.darkInterior, 'TopBoxFloor', [0, topY + 0.197, 0]);
  const lid = group('Lid', root, [0, topY + 0.2, -D / 2 + 0.01]);
  lid.rotation.x = -1.2;
  add(lid, new THREE.BoxGeometry(W - 0.02, 0.025, D - 0.02), M.brassAged, 'LidPanel', [0, 0.012, D / 2 - 0.01]);
  add(lid, new THREE.BoxGeometry(W - 0.12, 0.004, D - 0.12), M.felt, 'LidLining', [0, -0.002, D / 2 - 0.01]);
  add(root, new THREE.CylinderGeometry(0.004, 0.004, 0.3, 6), M.steel, 'LidStay', [W / 2 - 0.06, topY + 0.32, -0.05], [0.6, 0, 0]);
  for (const s of [-1, 1]) add(root, new THREE.TorusGeometry(0.045, 0.008, 6, 16, Math.PI), M.blackIron, 'SideHandle', [s * (W / 2 + 0.01), topY - 0.06, 0], [0, Math.PI / 2, 0]);
  rivets.rect(V(0, topY + 0.1, D / 2 - 0.01 + 0.001), W / 2 - 0.04, 0.07, V(0, 0, 1), 0.08);
  root.add(rivets.build(M.brassPolished, 'ChestRivets'));
  return { object: root };
}
