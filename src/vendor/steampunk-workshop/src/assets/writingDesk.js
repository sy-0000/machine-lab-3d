// Writing desk with a leather-inlaid top, pigeonhole gallery and drawer, dressed with the
// typewriter, a manuscript stack, ink and pen, crumpled drafts and a bentwood chair.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { createTypewriter } from './typewriter.js';

const TOP = 0.76;

export function createWritingDesk(M) {
  const root = group('WritingDesk');
  const W = 1.2;
  const D = 0.62;
  const leg = lathe([[0, 0], [0.018, 0], [0.024, 0.06], [0.02, 0.3], [0.028, 0.5], [0.028, TOP - 0.1], [0, TOP - 0.1]], 12);
  const frame = new GeoBatch();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) frame.add(leg, new THREE.Matrix4().makeTranslation(sx * (W / 2 - 0.05), 0, sz * (D / 2 - 0.05)));
  frame.box(W - 0.06, 0.1, 0.02, [0, TOP - 0.08, -D / 2 + 0.04]);
  for (const sx of [-1, 1]) frame.box(0.02, 0.1, D - 0.1, [sx * (W / 2 - 0.04), TOP - 0.08, 0]);
  root.add(frame.build(M.woodDark, 'Frame'));
  add(root, new THREE.BoxGeometry(W, 0.035, D), M.woodWorn, 'Top', [0, TOP - 0.0175, 0]);
  add(root, new THREE.BoxGeometry(W - 0.2, 0.003, D - 0.2), M.leather, 'LeatherInlay', [0, TOP + 0.0015, 0.02]);
  add(root, new THREE.BoxGeometry(0.5, 0.08, 0.02), M.woodWorn, 'Drawer', [0, TOP - 0.08, D / 2 - 0.03]);
  add(root, new THREE.SphereGeometry(0.014, 10, 8), M.brassPolished, 'DrawerKnob', [0, TOP - 0.08, D / 2 - 0.01]);

  // pigeonhole gallery along the back
  const gal = new GeoBatch();
  gal.box(W - 0.04, 0.26, 0.012, [0, TOP + 0.13, -D / 2 + 0.01]);
  gal.box(W - 0.04, 0.012, 0.16, [0, TOP + 0.26, -D / 2 + 0.08]);
  gal.box(W - 0.04, 0.012, 0.16, [0, TOP + 0.13, -D / 2 + 0.08]);
  for (let i = 0; i <= 6; i++) gal.box(0.012, 0.26, 0.16, [-W / 2 + 0.02 + (i * (W - 0.04)) / 6, TOP + 0.13, -D / 2 + 0.08]);
  root.add(gal.build(M.woodDark, 'Pigeonholes'));
  const papers = new GeoBatch();
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 0.02 + ((i + 0.5) * (W - 0.04)) / 6;
    const lvl = i % 2 ? TOP + 0.005 : TOP + 0.137;
    papers.box(0.14, 0.02 + (i % 3) * 0.02, 0.13, [x, lvl + 0.02, -D / 2 + 0.085]);
  }
  root.add(papers.build(M.paper, 'FiledPapers'));

  const tw = createTypewriter(M);
  tw.object.position.set(-0.05, TOP + 0.003, 0.06);
  tw.object.rotation.y = 0.08;
  root.add(tw.object);

  const stack = new GeoBatch();
  for (let i = 0; i < 14; i++) stack.box(0.216, 0.0025, 0.28, [0.38 + (i % 3) * 0.003, TOP + 0.004 + i * 0.0026, 0.05], [0, (i % 4) * 0.02 - 0.03, 0]);
  root.add(stack.build(M.paper, 'Manuscript'));
  add(root, new THREE.BoxGeometry(0.21, 0.0025, 0.27), M.bookPage, 'TopSheet', [0.38, TOP + 0.042, 0.05], [0, -0.03, 0]);
  add(root, lathe([[0, 0], [0.028, 0], [0.03, 0.04], [0.012, 0.055], [0.012, 0.065], [0, 0.065]], 16), M.glassGreen, 'InkBottle', [-0.4, TOP, 0.12]).userData.noShadow = true;
  add(root, lathe([[0, 0], [0.026, 0], [0.026, 0.03], [0, 0.03]], 12), M.coal, 'Ink', [-0.4, TOP + 0.003, 0.12]);
  add(root, new THREE.CylinderGeometry(0.014, 0.014, 0.018, 12), M.brassAged, 'InkCap', [-0.4, TOP + 0.074, 0.12]);
  add(root, new THREE.CylinderGeometry(0.005, 0.004, 0.15, 10), M.enamelBlack, 'FountainPen', [-0.3, TOP + 0.006, 0.2], [0, 0, Math.PI / 2 + 0.02]).rotation.y = 0.5;
  const crumple = new THREE.IcosahedronGeometry(0.035, 1);
  const cp = crumple.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setXYZ(i, cp.getX(i) * (0.8 + Math.sin(i * 7.1) * 0.25), cp.getY(i) * (0.8 + Math.cos(i * 3.3) * 0.25), cp.getZ(i) * (0.85 + Math.sin(i * 1.7) * 0.2));
  crumple.computeVertexNormals();
  for (const [x, y, z] of [[0.52, TOP + 0.03, 0.22], [0.3, 0.03, 0.55], [-0.2, 0.03, 0.68], [0.55, 0.03, 0.4]]) add(root, crumple, M.paper, 'CrumpledDraft', [x, y, z], [x * 5, z * 4, 0]);

  // bentwood chair pushed slightly back from the desk
  const chair = group('BentwoodChair', root, [0.02, 0, 0.62], [0, Math.PI + 0.25, 0]);
  add(chair, new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), M.woodDark, 'Seat', [0, 0.46, 0]);
  add(chair, new THREE.TorusGeometry(0.2, 0.012, 8, 32), M.woodDark, 'SeatRing', [0, 0.44, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = V(Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23);
    const top = V(Math.cos(a) * 0.15, 0.45, Math.sin(a) * 0.15);
    const legM = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, foot.distanceTo(top), 8), M.woodDark);
    legM.position.copy(foot).lerp(top, 0.5);
    legM.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(foot).normalize());
    legM.name = 'ChairLeg';
    chair.add(legM);
  }
  add(chair, new THREE.TorusGeometry(0.17, 0.008, 6, 28), M.woodDark, 'LegRing', [0, 0.2, 0], [Math.PI / 2, 0, 0]);
  add(chair, new THREE.TorusGeometry(0.17, 0.014, 8, 24, Math.PI), M.woodDark, 'BackHoop', [0, 0.72, -0.17], [0.12, 0, 0]);
  for (const sx of [-1, 1]) add(chair, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.woodDark, 'BackPost', [sx * 0.17, 0.6, -0.17], [0.12, 0, 0]);
  return { object: root };
}
