// Iron-framed oak shelving stocked with leather-bound books, jars of parts, bottles, tins,
// stacked gears, an hourglass, a railway lantern and coils of wire.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { createGearGeometry } from '../utils/gear.js';
import { mulberry32 } from '../materials/noise.js';
import { RivetSet } from '../utils/rivets.js';

const W = 2.9;
const D = 0.5;
const LEVELS = [0.14, 0.82, 1.5, 2.18, 2.86];
const TOP = 3.42;

const BOOK_COLORS = [0x6b1f1a, 0x2d4a2f, 0x5a3a22, 0x1f2c4a, 0x7a5a2a, 0x3a1f2a, 0x8a6a4a, 0x4a4a3a].map((c) => new THREE.Color(c));

function bookRow(books, rand, x0, width, y) {
  let x = x0;
  const end = x0 + width;
  while (x < end - 0.03) {
    const w = 0.03 + rand() * 0.05;
    const h = 0.23 + rand() * 0.13;
    const d = 0.17 + rand() * 0.1;
    const lean = x + w > end - 0.06 && rand() < 0.6 ? 0.25 : 0;
    const color = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)].clone().multiplyScalar(0.8 + rand() * 0.5);
    books.add(new THREE.BoxGeometry(w, h, d), new THREE.Matrix4().compose(V(x + w / 2 + (lean ? h * 0.12 : 0), y + h / 2 - (lean ? 0.012 : 0), -D / 2 + d / 2 + 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -lean)), V(1, 1, 1)), color);
    x += w + 0.002;
    if (lean) break;
  }
}

function jar(M, parent, x, y, contents) {
  const g = group('PartsJar', parent, [x, y, 0]);
  add(g, lathe([[0, 0], [0.055, 0], [0.06, 0.01], [0.06, 0.15], [0.05, 0.165], [0.045, 0.17], [0, 0.17]], 20), M.glass, 'JarGlass').userData.noShadow = true;
  add(g, lathe([[0, 0], [0.054, 0], [0.056, 0.02], [0.05, 0.02 + contents.h], [0, 0.022 + contents.h]], 16), contents.material, 'JarContents', [0, 0.004, 0]);
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.025, 20), M.brassAged, 'JarLid', [0, 0.18, 0]);
  return 0.13;
}

function bottle(M, parent, x, y, mat, rand) {
  const h = 0.2 + rand() * 0.1;
  const g = group('Bottle', parent, [x, y, 0]);
  add(g, lathe([[0, 0], [0.035, 0], [0.038, 0.01], [0.038, h * 0.6], [0.018, h * 0.78], [0.012, h * 0.85], [0.013, h * 0.95], [0, h * 0.95]], 16), mat, 'BottleGlass').userData.noShadow = true;
  add(g, new THREE.CylinderGeometry(0.011, 0.01, 0.03, 8), M.woodPine, 'Cork', [0, h * 0.97, 0]);
  add(g, new THREE.PlaneGeometry(0.05, 0.05), M.paper, 'Label', [0, h * 0.35, 0.0385]);
  return 0.085;
}

function tins(M, parent, x, y, rand) {
  const n = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < n; i++) {
    const r = 0.04 + rand() * 0.02;
    const h = 0.08 + rand() * 0.08;
    add(parent, new THREE.CylinderGeometry(r, r, h, 18), rand() < 0.5 ? M.brassAged : M.ironDark, 'Tin', [x + i * 0.1 + r, y + h / 2, (rand() - 0.5) * 0.12]);
    add(parent, new THREE.CylinderGeometry(r + 0.003, r + 0.003, 0.012, 18), M.brass, 'TinLid', [x + i * 0.1 + r, y + h + 0.006, 0]);
  }
  return n * 0.1 + 0.04;
}

function gearStack(M, parent, x, y, rand) {
  const sizes = [[40, 0.004], [30, 0.004], [18, 0.004]];
  let yy = y;
  sizes.forEach(([z, m], i) => {
    const geo = createGearGeometry({ teeth: z, module: m, thickness: 0.012, bore: 0.01, spokes: i === 0 ? 5 : 0 });
    add(parent, geo, [M.brass, M.copper, M.castIron][i], 'StackedGear', [x + 0.1 + (rand() - 0.5) * 0.02, yy + 0.006, (rand() - 0.5) * 0.02], [-Math.PI / 2, 0, rand() * 3]);
    yy += 0.012;
  });
  return 0.2;
}

function hourglass(M, parent, x, y) {
  const g = group('Hourglass', parent, [x + 0.06, y, 0]);
  for (const yy of [0.005, 0.235]) add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), M.woodDark, 'Cap', [0, yy, 0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.005, 0.005, 0.23, 8), M.brassPolished, 'Rod', [Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05]);
  }
  const bulb = [[0, 0.01], [0.035, 0.012], [0.042, 0.04], [0.03, 0.09], [0.006, 0.12], [0.03, 0.15], [0.042, 0.2], [0.035, 0.228], [0, 0.23]];
  add(g, lathe(bulb, 20), M.glass, 'Bulbs').userData.noShadow = true;
  add(g, lathe([[0, 0.012], [0.034, 0.014], [0.036, 0.035], [0.02, 0.055], [0, 0.062]], 16), M.straw, 'Sand');
  add(g, new THREE.ConeGeometry(0.03, 0.03, 16), M.straw, 'SandTop', [0, 0.17, 0], [Math.PI, 0, 0]);
  return 0.14;
}

function lantern(M, parent, x, y) {
  const g = group('RailwayLantern', parent, [x + 0.09, y, 0]);
  add(g, new THREE.CylinderGeometry(0.075, 0.08, 0.04, 16), M.blackIron, 'Base', [0, 0.02, 0]);
  add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.14, 16, 1, true), M.glass, 'Globe', [0, 0.11, 0]).userData.noShadow = true;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.15, 6), M.blackIron, 'Guard', [Math.cos(a) * 0.065, 0.11, Math.sin(a) * 0.065]);
  }
  add(g, new THREE.ConeGeometry(0.08, 0.06, 16), M.blackIron, 'Hood', [0, 0.21, 0]);
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), M.blackIron, 'Chimney', [0, 0.25, 0]);
  add(g, new THREE.TorusGeometry(0.05, 0.004, 6, 16, Math.PI), M.steelDark, 'Bail', [0, 0.26, 0]);
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), M.rope, 'Wick', [0, 0.06, 0]);
  return 0.18;
}

function wireCoil(M, parent, x, y) {
  for (let i = 0; i < 3; i++) add(parent, new THREE.TorusGeometry(0.085 - i * 0.004, 0.012, 8, 24), i === 1 ? M.copperBright : M.copper, 'WireCoil', [x + 0.1, y + 0.012 + i * 0.022, 0], [Math.PI / 2, 0, i * 0.5]);
  return 0.2;
}

function woodBox(M, parent, x, y, rand) {
  const w = 0.18 + rand() * 0.12;
  const h = 0.1 + rand() * 0.1;
  add(parent, new THREE.BoxGeometry(w, h, 0.3), rand() < 0.5 ? M.woodPine : M.woodDark, 'StorageBox', [x + w / 2, y + h / 2, 0]);
  add(parent, new THREE.BoxGeometry(0.06, 0.03, 0.004), M.brassAged, 'BoxLabel', [x + w / 2, y + h / 2, 0.152]);
  return w + 0.02;
}

export function createShelves(M) {
  const root = group('Shelving');
  const rand = mulberry32(314);
  const rivets = new RivetSet(0.008);

  // frame
  const iron = new GeoBatch();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      iron.box(0.05, TOP, 0.006, [sx * (W / 2 - 0.025), TOP / 2, sz * (D / 2 - 0.003)]);
      iron.box(0.006, TOP, 0.05, [sx * (W / 2 - 0.003), TOP / 2, sz * (D / 2 - 0.025)]);
    }
  }
  for (const y of [...LEVELS, TOP - 0.02]) {
    for (const sz of [-1, 1]) iron.box(W, 0.035, 0.012, [0, y - 0.03, sz * (D / 2 - 0.006)]);
  }
  // X bracing at the back
  const brace = (a, b) => iron.segment(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), a, b);
  brace(V(-W / 2, 0.2, -D / 2 + 0.01), V(0, TOP - 0.1, -D / 2 + 0.01));
  brace(V(0, 0.2, -D / 2 + 0.01), V(-W / 2, TOP - 0.1, -D / 2 + 0.01));
  brace(V(0, 0.2, -D / 2 + 0.01), V(W / 2, TOP - 0.1, -D / 2 + 0.01));
  brace(V(W / 2, 0.2, -D / 2 + 0.01), V(0, TOP - 0.1, -D / 2 + 0.01));
  root.add(iron.build(M.castIron, 'ShelfFrame'));
  for (const y of LEVELS) {
    for (const sx of [-1, 1]) rivets.line(V(sx * (W / 2 - 0.2), y - 0.03, D / 2 + 0.001), V(sx * (W / 2 - 0.02), y - 0.03, D / 2 + 0.001), 0.06, V(0, 0, 1));
  }
  const boards = new GeoBatch();
  for (const y of [...LEVELS, TOP]) boards.box(W - 0.02, 0.035, D - 0.02, [0, y - 0.0125 + 0.004, 0]);
  root.add(boards.build(M.woodWorn, 'ShelfBoards'));

  // contents
  const books = new GeoBatch(true);
  const items = group('ShelfItems', root);
  const plans = [
    ['books', 'jar', 'jar', 'tins', 'gears', 'box'],
    ['bottle', 'bottle', 'bottle', 'books', 'hourglass', 'jar', 'coil'],
    ['box', 'books', 'books', 'lantern', 'bottle', 'jar'],
    ['jar', 'tins', 'books', 'box', 'bottle', 'bottle', 'gears'],
    ['lantern', 'box', 'books', 'coil', 'jar'],
    ['box', 'books', 'tins', 'box'],
  ];
  const contents = [
    { material: M.steel, h: 0.08 },
    { material: M.brass, h: 0.1 },
    { material: M.copper, h: 0.06 },
    { material: M.steelDark, h: 0.11 },
  ];
  [...LEVELS, TOP].forEach((y, li) => {
    let x = -W / 2 + 0.06;
    const surface = y + 0.004 + 0.0125;
    const plan = plans[li];
    for (let j = 0; x < W / 2 - 0.2 && j < 40; j++) {
      const kind = plan[j % plan.length];
      let used = 0;
      if (kind === 'books') {
        const width = 0.3 + rand() * 0.25;
        bookRow(books, rand, x, Math.min(width, W / 2 - 0.05 - x), surface);
        used = width;
      } else if (kind === 'jar') used = jar(M, items, x + 0.06, surface, contents[Math.floor(rand() * contents.length)]);
      else if (kind === 'bottle') used = bottle(M, items, x + 0.04, surface, rand() < 0.6 ? M.glassAmber : M.glassGreen, rand);
      else if (kind === 'tins') used = tins(M, items, x, surface, rand);
      else if (kind === 'gears') used = gearStack(M, items, x, surface, rand);
      else if (kind === 'hourglass') used = hourglass(M, items, x, surface);
      else if (kind === 'lantern') used = lantern(M, items, x, surface);
      else if (kind === 'coil') used = wireCoil(M, items, x, surface);
      else if (kind === 'box') used = woodBox(M, items, x, surface, rand);
      x += used + 0.025 + rand() * 0.05;
    }
  });
  root.add(books.build(M.leatherBooks, 'Books'));
  root.add(rivets.build(M.castIron, 'ShelfRivets'));
  return { object: root };
}
