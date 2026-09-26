// Pegboard tool wall with hung hand tools, brass goggles and a leather apron; plus a pedestal
// grinder that stands beside it.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { createWrench, createPliers, createHammer, createScrewdriver, createSaw, createFile, createCalipers, createMallet, createBraceDrill } from './tools.js';

const BOARD_W = 3.2;
const BOARD_H = 1.7;

function createGoggles(M) {
  const g = group('BrassGoggles');
  for (const s of [-1, 1]) {
    add(g, lathe([[0.028, 0], [0.032, 0], [0.034, 0.02], [0.03, 0.032], [0.026, 0.032]], 20), M.brass, 'Eyecup', [s * 0.042, 0, 0], [Math.PI / 2, 0, 0]);
    add(g, new THREE.CircleGeometry(0.026, 20), M.glassAmber, 'Lens', [s * 0.042, 0, 0.031]).userData.noShadow = true;
    add(g, new THREE.TorusGeometry(0.029, 0.004, 6, 20), M.brassPolished, 'LensRing', [s * 0.042, 0, 0.032]);
  }
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), M.brass, 'Bridge', [0, 0.006, 0.02], [0, 0, Math.PI / 2]);
  const strap = [V(-0.075, 0, 0.005), V(-0.1, -0.04, -0.01), V(-0.07, -0.12, -0.02), V(0, -0.15, -0.02), V(0.07, -0.12, -0.02), V(0.1, -0.04, -0.01), V(0.075, 0, 0.005)];
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strap), 30, 0.008, 5), M.leatherDark, 'Strap');
  g.scale.setScalar(1.3);
  return g;
}

function createApron(M) {
  const g = group('LeatherApron');
  const geo = new THREE.PlaneGeometry(0.46, 0.72, 8, 12);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const t = (0.36 - y) / 0.72;
    pos.setX(i, x * (0.75 + 0.3 * t));
    pos.setZ(i, Math.sin(x * 9 + y * 3) * 0.012 + t * 0.03 + Math.cos(x * 6) * 0.01 * t);
  }
  geo.computeVertexNormals();
  const apron = add(g, geo, M.leather, 'ApronBody', [0, -0.36, 0]);
  apron.material = M.leather;
  add(g, new THREE.BoxGeometry(0.3, 0.14, 0.012), M.leatherDark, 'Pocket', [0, -0.5, 0.045]);
  add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), M.brassAged, 'PocketRivet', [0, -0.5, 0.053], [0, 0, Math.PI / 2]);
  add(g, new THREE.TorusGeometry(0.12, 0.006, 5, 20, Math.PI), M.leatherDark, 'NeckStrap', [0, 0, 0.01], [0, 0, 0]);
  const pencil = createScrewdriver(M, 0.18);
  pencil.position.set(0.08, -0.47, 0.06);
  pencil.rotation.z = 0.15;
  g.add(pencil);
  return g;
}

export function createToolWall(M) {
  const root = group('ToolWall');
  const z0 = 0.045;
  const board = group('Pegboard', root, [0, BOARD_H / 2, z0]);
  add(board, new THREE.BoxGeometry(BOARD_W, BOARD_H, 0.022), M.pegboard, 'Board');
  const frame = new GeoBatch();
  frame.box(BOARD_W + 0.1, 0.06, 0.04, [0, BOARD_H / 2 + 0.02, 0.01]);
  frame.box(BOARD_W + 0.1, 0.06, 0.04, [0, -BOARD_H / 2 - 0.02, 0.01]);
  frame.box(0.06, BOARD_H, 0.04, [-BOARD_W / 2 - 0.02, 0, 0.01]);
  frame.box(0.06, BOARD_H, 0.04, [BOARD_W / 2 + 0.02, 0, 0.01]);
  frame.box(BOARD_W + 0.2, 0.05, 0.14, [0, BOARD_H / 2 + 0.07, 0.05]); // top ledge
  board.add(frame.build(M.woodDark, 'BoardFrame'));

  const face = 0.011;
  const pegs = [];
  const hang = (tool, x, y, rz = 0) => {
    const t = tool.userData.thickness ?? 0.02;
    tool.position.set(x, y, face + t / 2 + 0.004);
    tool.rotation.z = rz;
    board.add(tool);
    return tool;
  };
  const peg = (x, y) => pegs.push(V(x, y, face));

  // top row
  const saw = hang(createSaw(M), -1.32, 0.3);
  saw.rotation.z = 0.05;
  peg(-1.34, 0.5);
  const wrenchSizes = [0.13, 0.16, 0.19, 0.22, 0.25, 0.28];
  wrenchSizes.forEach((s, i) => {
    const x = -0.95 + i * 0.1;
    hang(createWrench(M, s), x, 0.62 - s / 2, 0);
    peg(x, 0.62 - s * 0.87);
  });
  hang(createHammer(M, 0.34), -0.12, 0.44, Math.PI);
  peg(-0.12, 0.6);
  hang(createHammer(M, 0.28), 0.08, 0.47, Math.PI);
  peg(0.08, 0.61);
  hang(createMallet(M), 0.3, 0.4, Math.PI);
  peg(0.3, 0.57);
  hang(createBraceDrill(M), 0.66, 0.42);
  peg(0.66, 0.6);
  hang(createCalipers(M), 1.0, 0.45);
  peg(1.0, 0.56);

  // lower row
  [0.26, 0.24, 0.21, 0.19, 0.16].forEach((l, i) => {
    const x = -1.35 + i * 0.07;
    hang(createScrewdriver(M, l, i % 2 ? M.woodHandle : M.woodDark), x, -0.22 - l / 2 + 0.12, 0);
    peg(x, -0.08);
  });
  hang(createPliers(M, 0.05), -0.82, -0.25, Math.PI);
  peg(-0.82, -0.2);
  hang(createPliers(M, 0.1), -0.62, -0.25, Math.PI);
  peg(-0.62, -0.2);
  hang(createFile(M, 0.3), -0.38, -0.28, Math.PI);
  peg(-0.38, -0.08);
  hang(createFile(M, 0.24), -0.26, -0.3, Math.PI);
  peg(-0.26, -0.14);
  const coil = add(board, new THREE.TorusGeometry(0.11, 0.02, 8, 28), M.copper, 'WireCoil', [0.05, -0.2, 0.05], [0, 0, 0]);
  coil.scale.set(1, 1, 0.6);
  add(board, new THREE.TorusGeometry(0.105, 0.012, 6, 28), M.copperBright, 'WireCoilInner', [0.05, -0.2, 0.07], [0, 0, 0.3]);
  peg(0.05, -0.1);
  const goggles = createGoggles(M);
  goggles.position.set(0.42, -0.15, 0.06);
  board.add(goggles);
  peg(0.42, -0.1);
  const apron = createApron(M);
  apron.position.set(1.05, 0.12, 0.05);
  board.add(apron);
  peg(1.05, 0.12);

  // wooden pegs (instanced)
  const pegGeo = new THREE.CylinderGeometry(0.008, 0.009, 0.07, 8);
  pegGeo.rotateX(Math.PI / 2);
  pegGeo.translate(0, 0, 0.035);
  const pegMesh = new THREE.InstancedMesh(pegGeo, M.woodHandle, pegs.length);
  pegMesh.name = 'Pegs';
  pegs.forEach((p, i) => pegMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
  pegMesh.userData.noShadow = true;
  board.add(pegMesh);

  // shelf on the top ledge
  const ledge = group('LedgeItems', board, [0, BOARD_H / 2 + 0.095, 0.05]);
  for (let i = 0; i < 4; i++) {
    const tin = add(ledge, new THREE.CylinderGeometry(0.045, 0.045, 0.09 + i * 0.012, 18), i % 2 ? M.brassAged : M.ironDark, 'Tin', [-1.2 + i * 0.13, 0.045 + i * 0.006, 0]);
    tin.userData.noShadow = false;
  }
  add(ledge, lathe([[0, 0], [0.05, 0], [0.055, 0.02], [0.03, 0.12], [0.015, 0.14], [0.015, 0.17], [0, 0.17]], 16), M.copper, 'OilerCan', [1.2, 0, 0]);
  return { object: root };
}

export function createGrinder(M) {
  const g = group('PedestalGrinder');
  add(g, lathe([[0, 0], [0.26, 0], [0.26, 0.04], [0.18, 0.08], [0.09, 0.14], [0.07, 0.7], [0.1, 0.76], [0, 0.78]], 24), M.paintGreen, 'Pedestal');
  add(g, new THREE.BoxGeometry(0.22, 0.12, 0.14), M.paintGreen, 'BearingHousing', [0, 0.84, 0]);
  add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.7, 12), M.steel, 'Spindle', [0, 0.84, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.CylinderGeometry(0.19, 0.19, 0.06, 40), M.stone, 'GrindingStone', [0.26, 0.84, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.CylinderGeometry(0.13, 0.13, 0.05, 32), M.leatherDark, 'BuffingWheel', [-0.26, 0.84, 0], [0, 0, Math.PI / 2]);
  for (const x of [0.22, 0.3, -0.23, -0.29]) add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), M.steelDark, 'Flange', [x, 0.84, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.TorusGeometry(0.215, 0.018, 8, 24, Math.PI * 1.1), M.paintGreen, 'WheelGuard', [0.26, 0.84, 0], [0, Math.PI / 2, 0.25]);
  add(g, new THREE.BoxGeometry(0.08, 0.012, 0.12), M.steelDark, 'ToolRest', [0.26, 0.74, 0.2]);
  add(g, new THREE.BoxGeometry(0.2, 0.08, 0.3), M.copper, 'WaterTrough', [0.26, 0.6, 0.06]);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8), M.steel, 'CrankArm', [0.4, 0.74, 0], [0, 0, 0.5]);
  add(g, new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10), M.woodHandle, 'CrankHandle', [0.45, 0.65, 0.05], [Math.PI / 2, 0, 0]);
  return { object: g };
}
