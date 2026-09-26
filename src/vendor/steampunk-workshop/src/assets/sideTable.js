// Round tripod side table for the reading corner, carrying the brass lamp, an open book,
// a teacup on its saucer and a pair of reading spectacles.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';
import { createBrassLamp } from './brassLamp.js';
import { createOpenBook } from './books.js';

const TOP = 0.62;

export function createSideTable(M) {
  const root = group('ReadingSideTable');
  add(root, new THREE.CylinderGeometry(0.3, 0.3, 0.028, 40), M.woodDark, 'Top', [0, TOP - 0.014, 0]);
  add(root, new THREE.TorusGeometry(0.3, 0.012, 8, 48), M.woodDark, 'TopMoulding', [0, TOP - 0.018, 0], [Math.PI / 2, 0, 0]);
  add(root, lathe([[0, 0.12], [0.05, 0.12], [0.06, 0.16], [0.035, 0.24], [0.045, 0.33], [0.03, 0.42], [0.028, 0.56], [0.05, 0.59], [0.05, TOP - 0.028], [0, TOP - 0.028]], 18), M.woodDark, 'Pedestal');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const d = V(Math.cos(a), 0, Math.sin(a));
    const pts = [V(0, 0.16, 0).addScaledVector(d, 0.04), V(0, 0.1, 0).addScaledVector(d, 0.14), V(0, 0.03, 0).addScaledVector(d, 0.24), V(0, 0.02, 0).addScaledVector(d, 0.28)];
    add(root, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.018, 8), M.woodDark, 'Foot');
    add(root, new THREE.SphereGeometry(0.02, 10, 8), M.brassAged, 'FootCap', pts[3].toArray());
  }

  const lamp = createBrassLamp(M);
  lamp.object.position.set(-0.1, TOP, -0.12);
  root.add(lamp.object);
  const book = createOpenBook(M);
  book.position.set(0.05, TOP, 0.1);
  book.rotation.y = 0.5;
  root.add(book);
  // teacup and saucer
  const cup = group('Teacup', root, [0.19, TOP, -0.08]);
  add(cup, lathe([[0, 0], [0.06, 0], [0.065, 0.006], [0.05, 0.01], [0, 0.009]], 24), M.porcelain, 'Saucer');
  add(cup, lathe([[0, 0.008], [0.025, 0.008], [0.04, 0.03], [0.045, 0.06], [0.041, 0.06], [0.036, 0.032], [0, 0.03]], 24), M.porcelain, 'Cup');
  add(cup, new THREE.TorusGeometry(0.016, 0.004, 6, 12, Math.PI * 1.3), M.porcelain, 'Handle', [0.045, 0.038, 0], [0, 0, -1.4]);
  add(cup, new THREE.CircleGeometry(0.038, 20), M.liquidAmber, 'Tea', [0, 0.05, 0], [-Math.PI / 2, 0, 0]).userData.noShadow = true;
  // folded spectacles
  const specs = group('Spectacles', root, [-0.14, TOP + 0.006, 0.15], [0, 0.8, 0]);
  for (const s of [-1, 1]) {
    add(specs, new THREE.TorusGeometry(0.022, 0.0015, 6, 20), M.brassPolished, 'Rim', [s * 0.026, 0, 0], [Math.PI / 2 - 0.2, 0, 0]);
    add(specs, new THREE.CircleGeometry(0.021, 16), M.glass, 'Lens', [s * 0.026, 0, 0], [-Math.PI / 2 + 0.2, 0, 0]).userData.noShadow = true;
    add(specs, new THREE.CylinderGeometry(0.001, 0.001, 0.1, 4), M.brassPolished, 'Temple', [s * 0.035, 0.004, -0.05], [Math.PI / 2, 0, s * 0.3]);
  }
  add(specs, new THREE.TorusGeometry(0.006, 0.0015, 4, 10, Math.PI), M.brassPolished, 'Bridge', [0, 0.004, 0]);

  const lampAnchor = lamp.anchors.light.clone().add(lamp.object.position);
  return { object: root, anchors: { light: lampAnchor } };
}
