// Tall library bookcase (three bays, near wall-top height) with crown moulding and plinth, stocked
// with varied books, brass curios, glass jars and bound scrolls; a brass picture light on the crown.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { mulberry32 } from '../materials/noise.js';
import { addBookRun } from './books.js';

export function createBookcase(M, { width = 4.8, height = 6.2, depth = 0.44, bays = 3, seed = 7 } = {}) {
  const root = group('LibraryBookcase');
  const rand = mulberry32(seed);
  const back = -depth / 2;
  const front = depth / 2;
  const post = 0.06;
  const bayW = (width - post) / bays;

  // ---- carcass
  const wood = new GeoBatch();
  for (let i = 0; i <= bays; i++) wood.box(post, height - 0.2, depth, [-width / 2 + post / 2 + i * bayW, 0.1 + (height - 0.2) / 2, 0]);
  wood.box(width + 0.06, 0.16, depth + 0.05, [0, 0.08, 0.01]);
  wood.box(width + 0.1, 0.05, depth + 0.08, [0, 0.185, 0.02]);
  wood.box(width + 0.12, 0.1, depth + 0.1, [0, height - 0.15, 0.02]);
  wood.box(width + 0.22, 0.08, depth + 0.16, [0, height - 0.06, 0.04]);
  wood.box(width + 0.3, 0.05, depth + 0.2, [0, height + 0.005, 0.05]);
  for (let i = 0; i < bays; i++) {
    const cx = -width / 2 + post + bayW * (i + 0.5) - post / 2;
    wood.box(bayW - post, 0.14, 0.03, [cx, height - 0.28, front - 0.015]); // frieze board
  }
  const panel = new GeoBatch();
  panel.box(width - 0.02, height - 0.2, 0.02, [0, height / 2, back + 0.01]);

  // shelves: slightly irregular spacing, tallest at the bottom
  const levels = [0.2];
  while (true) {
    const last = levels[levels.length - 1];
    const gap = last < 1.2 ? 0.46 : 0.38 + rand() * 0.06;
    if (last + gap > height - 0.42) break;
    levels.push(last + gap);
  }
  const boards = new GeoBatch();
  for (let i = 0; i < bays; i++) {
    const cx = -width / 2 + post + bayW * (i + 0.5) - post / 2;
    for (const y of levels.slice(1)) boards.box(bayW - post, 0.03, depth - 0.03, [cx, y - 0.015, 0.005]);
  }

  // ---- contents
  const books = new GeoBatch(true);
  const trim = new GeoBatch();
  const brass = new GeoBatch();
  const glass = new GeoBatch();
  const paper = new GeoBatch();
  const fill = new GeoBatch();
  const jar = lathe([[0, 0], [0.045, 0], [0.05, 0.01], [0.05, 0.13], [0.04, 0.145], [0.036, 0.15], [0, 0.15]], 16);
  const jarFill = lathe([[0, 0.004], [0.044, 0.004], [0.046, 0.06], [0, 0.07]], 12);
  const bottle = lathe([[0, 0], [0.03, 0], [0.033, 0.01], [0.033, 0.12], [0.014, 0.16], [0.01, 0.2], [0, 0.2]], 12);
  const orb = new THREE.SphereGeometry(0.045, 16, 12);
  const ringGeo = new THREE.TorusGeometry(0.075, 0.005, 6, 28);
  const standGeo = lathe([[0, 0], [0.04, 0], [0.035, 0.012], [0.008, 0.02], [0.008, 0.07], [0, 0.07]], 12);
  const candle = lathe([[0, 0], [0.04, 0], [0.04, 0.01], [0.012, 0.02], [0.01, 0.16], [0.022, 0.17], [0.018, 0.19], [0, 0.19]], 12);
  const scrollGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 12);
  const bookend = new THREE.BoxGeometry(0.012, 0.16, 0.12);

  const placeCurio = (x, y, z) => {
    const r = rand();
    if (r < 0.3) {
      // armillary sphere on a stand
      brass.add(standGeo, new THREE.Matrix4().makeTranslation(x, y, z));
      brass.add(orb, new THREE.Matrix4().makeTranslation(x, y + 0.14, z));
      brass.add(ringGeo, new THREE.Matrix4().compose(V(x, y + 0.14, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.3, 0)), V(1, 1, 1)));
      brass.add(ringGeo, new THREE.Matrix4().compose(V(x, y + 0.14, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0.5)), V(1, 1, 1)));
      return 0.17;
    }
    if (r < 0.5) {
      brass.add(candle, new THREE.Matrix4().makeTranslation(x, y, z));
      return 0.1;
    }
    if (r < 0.75) {
      glass.add(jar, new THREE.Matrix4().makeTranslation(x, y, z));
      fill.add(jarFill, new THREE.Matrix4().makeTranslation(x, y, z));
      brass.add(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 16), new THREE.Matrix4().makeTranslation(x, y + 0.16, z));
      return 0.12;
    }
    glass.add(bottle, new THREE.Matrix4().makeTranslation(x, y, z));
    glass.add(bottle, new THREE.Matrix4().makeTranslation(x + 0.07, y, z + 0.03));
    return 0.16;
  };
  const placeScrolls = (x, y) => {
    const n = 3 + Math.floor(rand() * 3);
    const len = 0.3 + rand() * 0.08;
    let k = 0;
    for (let row = 0; k < n; row++) {
      for (let i = 0; i < 3 - row && k < n; i++, k++) {
        const px = x + 0.03 + i * 0.046 + row * 0.023;
        const m = new THREE.Matrix4().compose(V(px, y + 0.022 + row * 0.04, back + 0.03 + len / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, (rand() - 0.5) * 0.1)), V(1, len, 1));
        paper.add(scrollGeo, m);
      }
    }
    return 0.17;
  };

  for (let b = 0; b < bays; b++) {
    const x0 = -width / 2 + post + b * bayW + 0.02;
    const inner = bayW - post - 0.04;
    for (let li = 0; li < levels.length; li++) {
      const y = levels[li];
      const top = li + 1 < levels.length ? levels[li + 1] - 0.03 : height - 0.36;
      const maxH = top - y - 0.03;
      let x = x0;
      const end = x0 + inner;
      // a curio or scroll bundle on roughly every third shelf, placed at a random point in the run
      const special = rand();
      const specialAt = x0 + inner * (0.15 + rand() * 0.6);
      let placed = false;
      if (rand() < 0.2) {
        brass.add(bookend, new THREE.Matrix4().makeTranslation(x + 0.006, y + 0.08, back + 0.12));
        x += 0.015;
      }
      while (x < end - 0.04) {
        if (!placed && special < 0.45 && x > specialAt) {
          placed = true;
          const zc = back + 0.16;
          x += 0.02 + (special < 0.28 ? placeCurio(x + 0.06, y, zc) : placeScrolls(x, y)) + 0.02;
          continue;
        }
        const runEnd = placed || special >= 0.45 ? end : Math.min(end, specialAt + 0.001);
        const stop = addBookRun(books, trim, rand, { x0: x, width: runEnd - x, y, backZ: back + 0.02, maxH, maxD: depth - 0.06 });
        x = stop + (stop >= runEnd - 0.04 ? 0.05 : 0.08 + rand() * 0.06);
        if (runEnd === end && stop < end - 0.2) x = stop + 0.05;
        if (x >= end - 0.04) break;
      }
    }
  }

  root.add(wood.build(M.woodDark, 'Carcass'));
  root.add(panel.build(M.darkInterior, 'BackPanel'));
  root.add(boards.build(M.woodWorn, 'Shelves'));
  root.add(books.build(M.leatherBooks, 'Books'));
  root.add(trim.build(M.brassPolished, 'GiltBands'));
  if (!brass.empty) root.add(brass.build(M.brassAged, 'BrassCurios'));
  if (!glass.empty) {
    const gm = glass.build(M.glassAmber, 'GlassJars');
    gm.userData.noShadow = true;
    root.add(gm);
  }
  if (!fill.empty) root.add(fill.build(M.steelDark, 'JarContents'));
  if (!paper.empty) root.add(paper.build(M.paper, 'Scrolls'));

  // brass picture light across the crown
  const light = group('PictureLight', root, [0, height - 0.34, front + 0.2]);
  add(light, new THREE.CylinderGeometry(0.05, 0.05, width * 0.8, 20, 1, false, Math.PI, Math.PI), M.brassPolished, 'Hood', [0, 0, 0], [0, 0, Math.PI / 2]);
  add(light, new THREE.BoxGeometry(width * 0.78, 0.012, 0.05), M.lightStrip, 'Strip', [0, -0.02, 0]).userData.noShadow = true;
  for (const x of [-width * 0.3, 0, width * 0.3]) {
    add(light, new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), M.brassAged, 'Arm', [x, 0.02, -0.12], [Math.PI / 2 - 0.3, 0, 0]);
  }

  return {
    object: root,
    anchors: { light: V(0, height * 0.5, front + 1.7) },
  };
}
