// Heavy oak workbench with a scarred, burnt top, drawer pedestal, lower shelf and cast-iron vise,
// dressed with tools, blueprints, an unfinished clockwork mechanism and small parts.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch } from '../utils/geometry.js';
import { createGearGeometry } from '../utils/gear.js';
import { RivetSet } from '../utils/rivets.js';
import { createWrench, createPliers, createHammer, createScrewdriver, createFile, layFlat } from './tools.js';
import { createPartsTray, createVialRack, createPocketWatch, scatterParts } from './smallParts.js';

const TOP_Y = 0.92;
const LEN = 2.6;
const DEPTH = 1.1;

function createVise(M) {
  const g = group('BenchVise');
  add(g, new THREE.BoxGeometry(0.16, 0.05, 0.2), M.castIron, 'ViseBase', [0, 0.025, 0]);
  add(g, new THREE.CylinderGeometry(0.075, 0.085, 0.03, 20), M.castIron, 'SwivelPlate', [0, 0.065, 0]);
  add(g, new THREE.BoxGeometry(0.2, 0.13, 0.09), M.paintGreen, 'FixedJaw', [0, 0.14, -0.04]);
  add(g, new THREE.BoxGeometry(0.2, 0.13, 0.08), M.paintGreen, 'MovingJaw', [0, 0.14, 0.1]);
  add(g, new THREE.BoxGeometry(0.1, 0.06, 0.2), M.castIron, 'Slide', [0, 0.1, 0.1]);
  for (const z of [0.003, 0.058]) add(g, new THREE.BoxGeometry(0.19, 0.045, 0.008), M.steelDark, 'JawPlate', [0, 0.18, z]);
  add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.26, 12), M.steel, 'Screw', [0, 0.1, 0.24], [Math.PI / 2, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.009, 0.009, 0.26, 10), M.steel, 'TommyBar', [0.02, 0.1, 0.37], [0, 0, Math.PI / 2 - 0.2]);
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.016, 12, 8), M.steel, 'BarKnob', [0.02 + s * 0.128, 0.1 + s * 0.026, 0.37]);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.32, 16), M.brassPolished, 'ClampedRod', [0.05, 0.19, 0.03], [0, 0, Math.PI / 2 - 0.05]);
  return g;
}

function createBlueprintSheet(M) {
  const w = 0.84;
  const h = 0.6;
  const geo = new THREE.PlaneGeometry(w, h, 24, 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rollR = 0.03;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const u = (x + w / 2) / w;
    if (u > 0.86) {
      const s = (u - 0.86) * w;
      const a = s / rollR;
      pos.setX(i, w * 0.36 + Math.sin(a) * rollR);
      pos.setY(i, rollR - Math.cos(a) * rollR);
    } else if (u < 0.04) {
      pos.setY(i, (0.04 - u) * 0.12);
    }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.blueprint);
  m.name = 'BlueprintSheet';
  return m;
}

function createBlueprintRoll(M, length, radius) {
  const g = group('BlueprintRoll');
  const geo = new THREE.CylinderGeometry(radius, radius, length, 20, 1, false);
  add(g, geo, [M.paper, M.rollEnd, M.rollEnd], 'Roll', [0, radius, 0], [0, 0, Math.PI / 2]);
  return g;
}

function createUnfinishedMechanism(M) {
  const g = group('UnfinishedMechanism');
  add(g, new THREE.BoxGeometry(0.34, 0.035, 0.22), M.woodDark, 'Stand', [0, 0.0175, 0]);
  add(g, new THREE.BoxGeometry(0.28, 0.2, 0.006), M.brassAged, 'BackPlate', [0, 0.14, -0.04]);
  const pillar = lathe([[0, 0], [0.007, 0], [0.007, 0.005], [0.005, 0.01], [0.005, 0.05], [0.007, 0.055], [0.007, 0.06], [0, 0.06]], 10);
  for (const [x, y] of [[-0.125, 0.055], [0.125, 0.055], [-0.125, 0.225], [0.125, 0.225]]) {
    add(g, pillar, M.brassPolished, 'Pillar', [x, y, -0.037], [Math.PI / 2, 0, 0]);
  }
  const gears = [
    { teeth: 60, module: 0.0022, x: -0.05, y: 0.15, spokes: 5, mat: M.brassPolished },
    { teeth: 16, module: 0.0022, x: 0.034, y: 0.12, spokes: 0, mat: M.brass },
    { teeth: 40, module: 0.0018, x: 0.034, y: 0.12, z: 0.012, spokes: 4, mat: M.brassPolished },
    { teeth: 12, module: 0.0018, x: 0.09, y: 0.175, spokes: 0, mat: M.brassAged },
  ];
  for (const s of gears) {
    const geo = createGearGeometry({ teeth: s.teeth, module: s.module, thickness: 0.004, bore: 0.0025, spokes: s.spokes });
    add(g, geo, s.mat, `Gear_${s.teeth}`, [s.x, s.y, -0.03 + (s.z ?? 0)]);
    add(g, new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 8), M.steel, 'Arbor', [s.x, s.y, -0.02], [Math.PI / 2, 0, 0]);
  }
  add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 24), M.brassAged, 'SpringBarrel', [-0.08, 0.07, -0.02], [Math.PI / 2, 0, 0]);
  // mainspring coil lying beside, front plate waiting to be fitted
  const spiral = [];
  for (let i = 0; i <= 160; i++) {
    const a = i * 0.25;
    const r = 0.006 + a * 0.0011;
    spiral.push(V(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 200, 0.0012, 4), M.steelBlued, 'Mainspring', [0.23, 0.003, 0.08], [0, 0, 0], [1, 1, 1]).scale.set(1, 1, 1);
  const front = add(g, new THREE.BoxGeometry(0.28, 0.006, 0.2), M.brassAged, 'FrontPlate', [-0.02, 0.003, 0.2], [0, 0.35, 0]);
  front.userData.noShadow = false;
  return g;
}

function createMagnifier(M) {
  const g = group('MagnifierStand');
  add(g, lathe([[0, 0], [0.07, 0], [0.072, 0.01], [0.06, 0.022], [0.02, 0.028], [0, 0.03]], 28), M.castIron, 'Base');
  add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10), M.brassPolished, 'Post', [0, 0.155, 0]);
  add(g, new THREE.SphereGeometry(0.016, 12, 10), M.brass, 'Knuckle', [0, 0.29, 0]);
  const arm = group('Arm', g, [0, 0.29, 0], [0, 0, -0.75]);
  add(arm, new THREE.CylinderGeometry(0.006, 0.006, 0.2, 8), M.brassPolished, 'ArmRod', [0, 0.1, 0]);
  const lens = group('Lens', arm, [0, 0.21, 0], [0, 0, 0.75 + Math.PI / 2 - 0.2]);
  lens.rotation.set(-1.2, 0, 0.75);
  add(lens, new THREE.TorusGeometry(0.06, 0.007, 10, 36), M.brassPolished, 'LensRing', [0, 0.06, 0], [Math.PI / 2, 0, 0]);
  add(lens, new THREE.SphereGeometry(0.06, 24, 8), M.glass, 'LensGlass', [0, 0.06, 0], [0, 0, 0], [1, 0.08, 1]).userData.noShadow = true;
  add(lens, new THREE.CylinderGeometry(0.005, 0.005, 0.04, 8), M.brass, 'LensStem', [0, 0.0, 0]);
  return g;
}

function createBlowtorch(M) {
  const g = group('Blowtorch');
  add(g, lathe([[0, 0], [0.065, 0], [0.072, 0.02], [0.072, 0.1], [0.06, 0.125], [0.02, 0.135], [0, 0.136]], 28), M.brass, 'FuelTank');
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.08, 10), M.brassPolished, 'PumpBarrel', [0.03, 0.17, 0]);
  add(g, new THREE.SphereGeometry(0.016, 12, 8), M.woodHandle, 'PumpKnob', [0.03, 0.215, 0]);
  add(g, new THREE.TorusGeometry(0.05, 0.009, 8, 20, Math.PI), M.brassAged, 'HandleLoop', [-0.09, 0.07, 0], [0, 0, Math.PI / 2]);
  add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.08, 12), M.woodHandle, 'HandleGrip', [-0.14, 0.07, 0]);
  add(g, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 10), M.brass, 'Riser', [0.0, 0.19, 0]);
  add(g, new THREE.CylinderGeometry(0.009, 0.009, 0.2, 12), M.brassAged, 'BurnerTube', [0.09, 0.25, 0], [0, 0, Math.PI / 2]);
  add(g, lathe([[0.009, 0], [0.012, 0.02], [0.02, 0.05], [0.018, 0.052], [0.008, 0.02]], 16), M.copper, 'Nozzle', [0.19, 0.25, 0], [0, 0, -Math.PI / 2]);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), M.brassPolished, 'Valve', [0.0, 0.25, 0.018], [Math.PI / 2, 0, 0]);
  add(g, new THREE.BoxGeometry(0.04, 0.008, 0.008), M.steelDark, 'ValveKey', [0.0, 0.25, 0.026]);
  return g;
}

function createOilCan(M) {
  const g = group('OilCan');
  add(g, lathe([[0, 0], [0.055, 0], [0.058, 0.01], [0.05, 0.05], [0.025, 0.08], [0.012, 0.09], [0.012, 0.1], [0, 0.1]], 24), M.copper, 'CanBody');
  const spout = add(g, new THREE.CylinderGeometry(0.003, 0.008, 0.2, 8), M.brass, 'Spout', [0.055, 0.17, 0], [0, 0, -0.7]);
  spout.userData.noShadow = true;
  add(g, new THREE.BoxGeometry(0.018, 0.035, 0.012), M.brassAged, 'ThumbPump', [-0.03, 0.09, 0], [0, 0, 0.5]);
  return g;
}

function createNotebook(M) {
  const g = group('LeatherNotebook');
  add(g, new THREE.BoxGeometry(0.16, 0.028, 0.22), M.leather, 'Cover', [0, 0.014, 0]);
  add(g, new THREE.BoxGeometry(0.152, 0.022, 0.212), M.paper, 'Pages', [0.005, 0.014, 0]);
  add(g, new THREE.BoxGeometry(0.012, 0.03, 0.14), M.leatherDark, 'Strap', [0.05, 0.015, 0]);
  add(g, new THREE.CylinderGeometry(0.0035, 0.0035, 0.17, 6), M.woodPine, 'Pencil', [-0.03, 0.032, 0.01], [Math.PI / 2, 0, 0.3]);
  return g;
}

export function createWorkbench(M) {
  const root = group('Workbench');
  const bolts = new RivetSet(0.009, 'hex');

  // ---- frame
  const T = 0.1;
  const topGeo = new THREE.BoxGeometry(LEN, T, DEPTH);
  topGeo.userData.metricUV = true; // the top face carries its own unique scarred texture
  add(root, topGeo, [M.woodWorn, M.woodWorn, M.benchTop, M.woodWorn, M.woodWorn, M.woodWorn], 'BenchTop', [0, TOP_Y - T / 2, 0]);
  const legs = new GeoBatch();
  const legH = TOP_Y - T;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) legs.box(0.12, legH, 0.12, [sx * (LEN / 2 - 0.12), legH / 2, sz * (DEPTH / 2 - 0.1)]);
    legs.box(0.08, 0.1, DEPTH - 0.2, [sx * (LEN / 2 - 0.12), 0.16, 0]);
    legs.box(0.06, 0.16, DEPTH - 0.32, [sx * (LEN / 2 - 0.12), legH - 0.08, 0]);
  }
  for (const sz of [-1, 1]) {
    legs.box(LEN - 0.36, 0.16, 0.035, [0, legH - 0.08, sz * (DEPTH / 2 - 0.08)]);
    legs.box(LEN - 0.36, 0.08, 0.06, [0, 0.16, sz * (DEPTH / 2 - 0.1)]);
  }
  root.add(legs.build(M.woodWorn, 'BenchFrame'));
  const shelf = new GeoBatch();
  for (let i = 0; i < 6; i++) shelf.box(LEN - 0.3, 0.025, 0.13, [0, 0.21, -DEPTH / 2 + 0.2 + i * 0.145]);
  root.add(shelf.build(M.woodPine, 'LowerShelf'));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) bolts.add(V(sx * (LEN / 2 - 0.12), legH - 0.08, sz * (DEPTH / 2 - 0.04)), V(0, 0, sz));
  }

  // drawer pedestal (right)
  const ped = group('DrawerPedestal', root, [0.78, 0, 0.02]);
  const pw = 0.62;
  add(ped, new THREE.BoxGeometry(pw, legH - 0.2, DEPTH - 0.26), M.woodWorn, 'Pedestal', [0, 0.25 + (legH - 0.2) / 2 - 0.03, -0.02]);
  const dh = (legH - 0.28) / 3;
  for (let i = 0; i < 3; i++) {
    const y = 0.26 + dh * (i + 0.5);
    const open = i === 2 ? 0.22 : 0;
    add(ped, new THREE.BoxGeometry(pw - 0.05, dh - 0.02, 0.025), M.woodDark, 'DrawerFront', [0, y, (DEPTH - 0.26) / 2 - 0.01 + open]);
    add(ped, new THREE.TorusGeometry(0.03, 0.006, 6, 14, Math.PI), M.brassAged, 'CupPull', [0, y + 0.01, (DEPTH - 0.26) / 2 + 0.01 + open], [0, 0, Math.PI]);
    add(ped, new THREE.BoxGeometry(0.05, 0.03, 0.006), M.brassAged, 'LabelFrame', [0, y + 0.035, (DEPTH - 0.26) / 2 + 0.005 + open]);
    if (open) {
      const inner = new GeoBatch();
      const iz = (DEPTH - 0.26) / 2 - 0.02 + open - 0.2;
      inner.box(pw - 0.1, 0.01, 0.4, [0, y - dh / 2 + 0.02, iz]);
      for (const s of [-1, 1]) inner.box(0.012, dh - 0.05, 0.4, [s * (pw / 2 - 0.056), y - 0.01, iz]);
      ped.add(inner.build(M.woodPine, 'OpenDrawerBox'));
      ped.add(scatterParts(M, 'gearB', 14, V(0, y - dh / 2 + 0.026, iz + 0.05), pw - 0.16, 0.26, 44));
      ped.add(scatterParts(M, 'screw', 40, V(0, y - dh / 2 + 0.026, iz + 0.05), pw - 0.16, 0.3, 45, null, 0.01));
      ped.add(scatterParts(M, 'spring', 8, V(-0.1, y - dh / 2 + 0.026, iz + 0.12), 0.2, 0.1, 46));
    }
  }

  // vise on the front-left corner
  const vise = createVise(M);
  vise.position.set(-1.0, TOP_Y, DEPTH / 2 - 0.12);
  root.add(vise);

  // ---- items on the top
  const top = group('BenchItems', root, [0, TOP_Y, 0]);
  const sheet = createBlueprintSheet(M);
  sheet.position.set(0.2, 0.0015, 0.02);
  sheet.rotation.y = 0.08;
  top.add(sheet);
  const rolls = [[0.75, 0.042, -0.36, 0.1], [0.7, 0.036, -0.28, 0.14], [0.62, 0.04, -0.4, -0.05]];
  for (const [len, r, z, yaw] of rolls) {
    const roll = createBlueprintRoll(M, len, r);
    roll.position.set(0.25, z === -0.4 ? 0.075 : 0, z);
    roll.rotation.y = yaw;
    top.add(roll);
  }
  add(top, new THREE.TorusGeometry(0.043, 0.008, 6, 20), M.leatherDark, 'RollStrap', [0.15, 0.042, -0.36], [0, Math.PI / 2 + 0.1, 0], [1, 1, 0.6]);

  const mech = createUnfinishedMechanism(M);
  mech.position.set(-0.52, 0, -0.18);
  mech.rotation.y = 0.25;
  top.add(mech);
  const mag = createMagnifier(M);
  mag.position.set(-0.28, 0, -0.34);
  mag.rotation.y = 2.4;
  top.add(mag);
  const torch = createBlowtorch(M);
  torch.position.set(1.02, 0, -0.3);
  torch.rotation.y = 2.5;
  top.add(torch);
  const oil = createOilCan(M);
  oil.position.set(-1.1, 0, -0.34);
  oil.rotation.y = 0.6;
  top.add(oil);
  const tray = createPartsTray(M, 5);
  tray.position.set(0.82, 0, 0.3);
  tray.rotation.y = -0.12;
  top.add(tray);
  const vials = createVialRack(M);
  vials.position.set(1.05, 0, -0.02);
  vials.rotation.y = -0.4;
  top.add(vials);
  const watch = createPocketWatch(M);
  watch.position.set(0.44, 0, 0.36);
  watch.rotation.y = 0.5;
  top.add(watch);
  const notebook = createNotebook(M);
  notebook.position.set(-0.75, 0, 0.3);
  notebook.rotation.y = -0.35;
  top.add(notebook);

  top.add(layFlat(createWrench(M, 0.24), -0.22, 0, 0.36, 1.35));
  top.add(layFlat(createWrench(M, 0.17), 0.52, 0.0015, -0.08, -0.5));
  top.add(layFlat(createPliers(M, 0.18), -0.05, 0, 0.38, 2.2));
  top.add(layFlat(createHammer(M), -0.6, 0, 0.42, 1.75));
  top.add(layFlat(createScrewdriver(M, 0.22), 0.1, 0.0015, 0.43, 1.45));
  top.add(layFlat(createFile(M), -0.95, 0, 0.12, 0.2));

  // loose gears, screws and brass shavings around the mechanism
  top.add(scatterParts(M, 'gearC', 3, V(-0.3, 0, 0.05), 0.2, 0.12, 71));
  top.add(scatterParts(M, 'gearA', 6, V(-0.35, 0, 0.08), 0.3, 0.16, 72));
  top.add(scatterParts(M, 'screw', 14, V(-0.1, 0, 0.2), 0.5, 0.2, 73));
  top.add(scatterParts(M, 'nut', 8, V(0.35, 0.0015, 0.2), 0.3, 0.15, 74));

  // wooden toolbox and scrap on the lower shelf
  const box = group('Toolbox', root, [-0.55, 0.222, -0.05]);
  add(box, new THREE.BoxGeometry(0.55, 0.2, 0.28), M.woodPine, 'ToolboxBody', [0, 0.1, 0]);
  add(box, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 10), M.woodHandle, 'ToolboxHandle', [0, 0.32, 0], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) add(box, new THREE.BoxGeometry(0.012, 0.14, 0.2), M.woodPine, 'HandlePost', [s * 0.25, 0.26, 0]);
  add(root, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 16), M.copper, 'CopperPipeOffcut', [0.1, 0.27, 0.25], [0, 0.2, Math.PI / 2]);
  add(root, new THREE.CylinderGeometry(0.03, 0.03, 0.7, 12), M.brassAged, 'BrassRodStock', [0.1, 0.255, 0.38], [0, -0.1, Math.PI / 2]);

  root.add(bolts.build(M.steelDark, 'BenchBolts'));
  return { object: root, anchors: { top: V(0, TOP_Y, 0) } };
}
