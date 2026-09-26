// Chemistry bench: slate-topped oak cabinet with a reagent shelf, a Bunsen burner heating a
// round-bottom flask (bubbling), a copper-coil still feeding a receiving flask, test-tube rack,
// beakers, mortar and pestle, and a brass mechanism under a glass bell jar.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch, HelixCurve } from '../utils/geometry.js';
import { mulberry32 } from '../materials/noise.js';

const TOP = 0.92;

function roundFlask(M, liquid, r = 0.075) {
  const g = group('RoundBottomFlask');
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * (Math.PI - 0.35);
    prof.push([Math.cos(a) * r, r + Math.sin(a) * r]);
  }
  prof.push([0.016, r * 2.05], [0.016, r * 2 + 0.12], [0.02, r * 2 + 0.125]);
  add(g, lathe(prof, 20), M.glass, 'Flask').userData.noShadow = true;
  const fill = [];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI * 0.42);
    fill.push([Math.cos(a) * r * 0.96, r + Math.sin(a) * r * 0.96]);
  }
  fill.push([0, fill[fill.length - 1][1]]);
  add(g, lathe(fill, 16), liquid, 'Liquid').userData.noShadow = true;
  return g;
}

function erlenmeyer(M, liquid, h = 0.16) {
  const g = group('ConicalFlask');
  add(g, lathe([[0, 0], [0.06, 0], [0.064, 0.008], [0.02, h * 0.8], [0.018, h], [0.022, h + 0.004]], 20), M.glass, 'Flask').userData.noShadow = true;
  add(g, lathe([[0, 0.003], [0.058, 0.003], [0.045, h * 0.28], [0, h * 0.28]], 16), liquid, 'Liquid').userData.noShadow = true;
  return g;
}

export function createChemistryBench(M) {
  const root = group('ChemistryBench');
  const rand = mulberry32(404);
  const W = 2.4;
  const D = 0.72;

  // ---- bench
  const cab = new GeoBatch();
  cab.box(W - 0.04, TOP - 0.1, D - 0.06, [0, 0.05 + (TOP - 0.1) / 2, -0.02]);
  cab.box(W, 0.06, D - 0.02, [0, 0.03, -0.01]);
  root.add(cab.build(M.woodDark, 'Cabinet'));
  const doors = new GeoBatch();
  for (let i = 0; i < 4; i++) doors.box(W / 4 - 0.04, TOP - 0.2, 0.02, [-W / 2 + W / 8 + (i * W) / 4, 0.1 + (TOP - 0.2) / 2, D / 2 - 0.04]);
  root.add(doors.build(M.woodWorn, 'CabinetDoors'));
  for (let i = 0; i < 4; i++) add(root, new THREE.SphereGeometry(0.014, 10, 8), M.brassAged, 'DoorKnob', [-W / 2 + W / 8 + (i * W) / 4 + (i % 2 ? -0.2 : 0.2), 0.62, D / 2 - 0.02]);
  add(root, new THREE.BoxGeometry(W + 0.04, 0.05, D + 0.02), M.slate, 'SlateTop', [0, TOP - 0.025, 0]);
  // reagent shelf on brass posts
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) add(root, new THREE.CylinderGeometry(0.014, 0.014, 0.62, 10), M.brassAged, 'ShelfPost', [x, TOP + 0.31, -D / 2 + 0.08]);
  add(root, new THREE.BoxGeometry(W - 0.04, 0.03, 0.2), M.woodWorn, 'ReagentShelf', [0, TOP + 0.6, -D / 2 + 0.1]);
  const reagentLiquids = [M.liquidAmber, M.liquidGreen, M.liquidBlue, M.liquidRed];
  for (let i = 0; i < 12; i++) {
    const x = -W / 2 + 0.16 + i * 0.18 + (rand() - 0.5) * 0.04;
    const h = 0.16 + rand() * 0.1;
    const b = group('ReagentBottle', root, [x, TOP + 0.615, -D / 2 + 0.1]);
    add(b, lathe([[0, 0], [0.036, 0], [0.038, 0.01], [0.038, h * 0.7], [0.016, h * 0.85], [0.014, h], [0, h]], 14), rand() < 0.5 ? M.glassAmber : M.glassGreen, 'Glass').userData.noShadow = true;
    add(b, new THREE.CylinderGeometry(0.015, 0.012, 0.03, 10), M.woodPine, 'Stopper', [0, h + 0.012, 0]);
    add(b, new THREE.PlaneGeometry(0.04, 0.04), M.paper, 'Label', [0, h * 0.35, 0.0385]);
    if (rand() < 0.6) add(b, lathe([[0, 0.004], [0.034, 0.004], [0.034, h * 0.4], [0, h * 0.4]], 10), reagentLiquids[i % 4], 'Contents').userData.noShadow = true;
  }

  const top = group('BenchItems', root, [0, TOP, 0]);

  // ---- burner + retort stand + boiling flask
  const stand = group('RetortStand', top, [-0.75, 0, 0.02]);
  add(stand, new THREE.BoxGeometry(0.22, 0.02, 0.14), M.castIron, 'StandBase', [0, 0.01, -0.05]);
  add(stand, new THREE.CylinderGeometry(0.008, 0.008, 0.62, 8), M.steel, 'StandRod', [-0.08, 0.32, -0.08]);
  add(stand, new THREE.TorusGeometry(0.06, 0.006, 6, 20), M.steel, 'RingClamp', [0, 0.22, 0], [Math.PI / 2, 0, 0]);
  add(stand, new THREE.BoxGeometry(0.08, 0.01, 0.01), M.steel, 'ClampArm', [-0.04, 0.22, -0.04], [0, 0.8, 0]);
  add(stand, new THREE.BoxGeometry(0.1, 0.004, 0.1), M.steelDark, 'Gauze', [0, 0.215, 0]);
  const burner = group('BunsenBurner', stand, [0, 0.02, 0]);
  add(burner, lathe([[0, 0], [0.04, 0], [0.04, 0.012], [0.012, 0.02], [0.01, 0.12], [0.011, 0.125], [0, 0.125]], 16), M.brass, 'Burner');
  add(burner, new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), M.rubber, 'GasTap', [0.045, 0.012, 0], [0, 0, Math.PI / 2]);
  const flameGroup = group('FlamePivot', burner, [0, 0.125, 0]);
  flameGroup.userData.dynamic = true;
  add(flameGroup, new THREE.ConeGeometry(0.012, 0.06, 12, 1, true), M.flameBlue, 'Flame', [0, 0.03, 0]).userData.noShadow = true;
  const flask = roundFlask(M, M.liquidGreen, 0.07);
  flask.position.set(0, 0.215, 0);
  stand.add(flask);

  // bubbles rising in the boiling flask
  const bubbleCount = 14;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.004, 6, 4), M.glass, bubbleCount);
  bubbles.name = 'Bubbles';
  bubbles.userData.dynamic = true;
  bubbles.userData.noShadow = true;
  bubbles.frustumCulled = false;
  const bubbleSeeds = Array.from({ length: bubbleCount }, () => [rand() * 6.28, rand(), 0.4 + rand() * 0.6]);
  flask.add(bubbles);

  // ---- still: neck tube → copper coil condenser → receiving flask
  const neckTop = V(-0.75, 0.215 + 0.14 + 0.12, 0.02);
  const coilTop = V(-0.3, 0.42, -0.06);
  add(top, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([neckTop, neckTop.clone().add(V(0.05, 0.06, 0)), V(-0.5, 0.49, -0.04), coilTop]), 30, 0.008, 8), M.glass, 'DeliveryTube').userData.noShadow = true;
  const coil = new THREE.TubeGeometry(new HelixCurve(0.06, 0.3, 6), 180, 0.007, 6);
  add(top, coil, M.copperBright, 'CondenserCoil', [coilTop.x, 0.27, coilTop.z]);
  add(top, new THREE.CylinderGeometry(0.085, 0.085, 0.34, 24, 1, true), M.glass, 'CoolingJacket', [coilTop.x, 0.27, coilTop.z]).userData.noShadow = true;
  add(top, new THREE.CylinderGeometry(0.083, 0.083, 0.2, 20), M.water, 'JacketWater', [coilTop.x, 0.2, coilTop.z]).userData.noShadow = true;
  add(top, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 24), M.brassAged, 'JacketBase', [coilTop.x, 0.1, coilTop.z]);
  for (const s of [-1, 1]) add(top, new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), M.brassAged, 'JacketLeg', [coilTop.x + s * 0.07, 0.05, coilTop.z]);
  add(top, new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), M.copperBright, 'Outlet', [coilTop.x + 0.1, 0.1, coilTop.z], [0, 0, 0.9]);
  const receiver = erlenmeyer(M, M.liquidAmber);
  receiver.position.set(coilTop.x + 0.16, 0, coilTop.z + 0.02);
  top.add(receiver);

  // ---- test-tube rack
  const rack = group('TestTubeRack', top, [0.15, 0, 0.12]);
  add(rack, new THREE.BoxGeometry(0.32, 0.012, 0.07), M.woodPine, 'RackBase', [0, 0.006, 0]);
  add(rack, new THREE.BoxGeometry(0.32, 0.012, 0.07), M.woodPine, 'RackTop', [0, 0.1, 0]);
  for (const s of [-1, 1]) add(rack, new THREE.BoxGeometry(0.012, 0.1, 0.07), M.woodPine, 'RackEnd', [s * 0.155, 0.055, 0]);
  const tube = lathe([[0, 0], [0.008, 0.002], [0.009, 0.01], [0.009, 0.15], [0.0105, 0.152]], 10);
  const tubeLiquids = [M.liquidRed, M.liquidBlue, M.liquidGreen, M.liquidAmber];
  for (let i = 0; i < 8; i++) {
    const x = -0.13 + i * 0.037;
    const lift = i === 5 ? 0.06 : 0.02;
    add(rack, tube, M.glass, 'TestTube', [x, lift, 0], [0, 0, i === 5 ? 0.12 : 0]).userData.noShadow = true;
    if (i !== 2) add(rack, new THREE.CylinderGeometry(0.0078, 0.0078, 0.03 + rand() * 0.06, 8), tubeLiquids[i % 4], 'TubeLiquid', [x, lift + 0.035, 0]).userData.noShadow = true;
  }

  // ---- beakers, mortar and pestle
  for (const [x, z, liq] of [[0.55, 0.14, M.liquidBlue], [0.66, 0.02, null]]) {
    const b = group('Beaker', top, [x, 0, z]);
    add(b, lathe([[0, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.12], [0.046, 0.125]], 18), M.glass, 'Glass').userData.noShadow = true;
    if (liq) add(b, new THREE.CylinderGeometry(0.039, 0.039, 0.06, 16), liq, 'Liquid', [0, 0.034, 0]).userData.noShadow = true;
  }
  add(top, lathe([[0, 0], [0.05, 0], [0.06, 0.03], [0.058, 0.06], [0.05, 0.062], [0.045, 0.035], [0, 0.02]], 20), M.stone, 'Mortar', [0.45, 0, -0.12]);
  add(top, new THREE.CylinderGeometry(0.012, 0.02, 0.13, 10), M.stone, 'Pestle', [0.46, 0.08, -0.12], [0.5, 0, 0.3]);

  // ---- bell jar with a small brass mechanism
  const jar = group('BellJar', top, [0.95, 0, -0.08]);
  add(jar, new THREE.CylinderGeometry(0.13, 0.14, 0.03, 32), M.brassAged, 'JarBase', [0, 0.015, 0]);
  add(jar, lathe([[0.115, 0.03], [0.115, 0.22], [0.1, 0.28], [0.06, 0.32], [0.02, 0.335], [0, 0.337]], 32), M.glass, 'Dome').userData.noShadow = true;
  add(jar, new THREE.SphereGeometry(0.018, 12, 8), M.glass, 'Knob', [0, 0.35, 0]).userData.noShadow = true;
  add(jar, new THREE.CylinderGeometry(0.05, 0.06, 0.03, 16), M.woodDark, 'Plinth', [0, 0.045, 0]);
  add(jar, new THREE.TorusGeometry(0.045, 0.004, 6, 24), M.brassPolished, 'Ring', [0, 0.13, 0], [Math.PI / 2, 0, 0]);
  add(jar, new THREE.TorusGeometry(0.045, 0.004, 6, 24), M.brassPolished, 'Ring', [0, 0.13, 0], [0.3, 0.6, 0]);
  add(jar, new THREE.SphereGeometry(0.02, 12, 10), M.copperBright, 'Core', [0, 0.13, 0]);
  add(jar, new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), M.brass, 'Post', [0, 0.095, 0]);

  // notebook
  add(top, new THREE.BoxGeometry(0.16, 0.02, 0.22), M.leather, 'LabNotebook', [-0.25, 0.01, 0.2], [0, 0.3, 0]);

  const m = new THREE.Matrix4();
  const update = (dt, t) => {
    for (let i = 0; i < bubbleCount; i++) {
      const [a, off, speed] = bubbleSeeds[i];
      const u = (t * speed * 0.6 + off) % 1;
      const r = 0.035 * (1 - u * 0.4);
      m.makeTranslation(Math.cos(a + u * 2) * r, 0.012 + u * 0.075, Math.sin(a + u * 2) * r);
      m.scale(V(0.6 + u, 0.6 + u, 0.6 + u));
      bubbles.setMatrixAt(i, m);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    const f = 1 + Math.sin(t * 23) * 0.08 + Math.sin(t * 37) * 0.05;
    flameGroup.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
  };
  return { object: root, update };
}
