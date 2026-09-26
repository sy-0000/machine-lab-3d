// Small parts (screws, nuts, springs, tiny gears, watch pieces, copper vials) plus the containers
// that hold them. Repeated pieces are InstancedMesh.
import * as THREE from 'three';
import { add, group, lathe, V, GeoBatch, HelixCurve } from '../utils/geometry.js';
import { createGearGeometry } from '../utils/gear.js';
import { mulberry32 } from '../materials/noise.js';

let shared = null;
function partGeometries() {
  if (shared) return shared;
  const thread = [[0, 0.003]];
  for (let i = 0; i <= 10; i++) thread.push([i % 2 ? 0.0017 : 0.0021, -i * 0.0022]);
  thread.push([0.0008, -0.024], [0, -0.025]);
  const screw = lathe([[0, 0.0045], [0.0022, 0.0045], [0.004, 0.0035], [0.0042, 0.0005], [0.0023, 0.0], ...thread.slice(1)], 6);
  const nut = new THREE.CylinderGeometry(0.0045, 0.0045, 0.0035, 6);
  const spring = new THREE.TubeGeometry(new HelixCurve(0.0045, 0.03, 7), 70, 0.0008, 4, false);
  const washer = new THREE.TorusGeometry(0.004, 0.0012, 4, 12);
  const gearA = createGearGeometry({ teeth: 12, module: 0.0012, thickness: 0.0018, bore: 0.0008 });
  const gearB = createGearGeometry({ teeth: 24, module: 0.0012, thickness: 0.0016, bore: 0.001, spokes: 4 });
  const gearC = createGearGeometry({ teeth: 40, module: 0.0011, thickness: 0.0015, bore: 0.0012, spokes: 5 });
  const balance = new THREE.TorusGeometry(0.006, 0.0006, 4, 18);
  shared = { screw, nut, spring, washer, gearA, gearB, gearC, balance };
  return shared;
}

// kind → how the piece lies on a surface
const LIE = {
  screw: (r) => new THREE.Euler(Math.PI / 2, r() * 6.28, r() * 6.28, 'YXZ'),
  nut: (r) => new THREE.Euler(0, r() * 6.28, 0),
  spring: (r) => new THREE.Euler(Math.PI / 2, 0, r() * 6.28, 'YXZ'),
  washer: (r) => new THREE.Euler(Math.PI / 2 + (r() - 0.5) * 0.2, 0, r() * 6.28),
  gearA: (r) => new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.15, 0, r() * 6.28),
  gearB: (r) => new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.15, 0, r() * 6.28),
  gearC: (r) => new THREE.Euler(-Math.PI / 2, 0, r() * 6.28),
  balance: (r) => new THREE.Euler(Math.PI / 2, 0, r() * 6.28),
};
const LIFT = { screw: 0.0042, nut: 0.0018, spring: 0.0052, washer: 0.0012, gearA: 0.001, gearB: 0.001, gearC: 0.0008, balance: 0.0008 };

// Scatter `count` pieces of `kind` in a w×d rectangle centred at `center` (top surface height center.y).
export function scatterParts(M, kind, count, center, w, d, seed = 1, material = null, heap = 0) {
  const G = partGeometries();
  const r = mulberry32(seed);
  const mat = material ?? { screw: M.steel, nut: M.steelDark, spring: M.steel, washer: M.brass, gearA: M.brassPolished, gearB: M.brass, gearC: M.brassAged, balance: M.brassPolished }[kind];
  const mesh = new THREE.InstancedMesh(G[kind], mat, count);
  mesh.name = `Scatter_${kind}`;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    const x = center.x + (r() - 0.5) * w;
    const z = center.z + (r() - 0.5) * d;
    const pile = heap > 0 ? heap * Math.max(0, 1 - Math.hypot((x - center.x) / (w / 2), (z - center.z) / (d / 2))) * r() : 0;
    q.setFromEuler(LIE[kind](r));
    m.compose(V(x, center.y + LIFT[kind] + pile, z), q, V(1, 1, 1));
    mesh.setMatrixAt(i, m);
  }
  mesh.computeBoundingSphere();
  mesh.userData.noShadow = true;
  return mesh;
}

// Shallow wooden tray with six compartments of parts.
export function createPartsTray(M, seed = 3) {
  const g = group('PartsTray');
  const W = 0.38;
  const D = 0.25;
  const H = 0.045;
  const wood = new GeoBatch();
  wood.box(W, 0.008, D, [0, 0.004, 0]);
  for (const s of [-1, 1]) {
    wood.box(W, H, 0.01, [0, H / 2, s * (D / 2 - 0.005)]);
    wood.box(0.01, H, D, [s * (W / 2 - 0.005), H / 2, 0]);
  }
  for (const x of [-W / 6, W / 6]) wood.box(0.006, H * 0.8, D - 0.02, [x, H * 0.4, 0]);
  wood.box(W - 0.02, H * 0.8, 0.006, [0, H * 0.4, 0]);
  g.add(wood.build(M.woodWorn, 'TrayBody'));
  const kinds = [['screw', 26], ['nut', 22], ['gearA', 9], ['spring', 7], ['gearB', 5], ['washer', 24]];
  kinds.forEach(([kind, n], i) => {
    const cx = (-1 + (i % 3)) * (W / 3);
    const cz = (i < 3 ? -1 : 1) * (D / 4);
    g.add(scatterParts(M, kind, n, V(cx, 0.008, cz), W / 3 - 0.03, D / 2 - 0.03, seed + i * 17, null, 0.008));
  });
  return g;
}

// Wooden rack of small copper vials with corks, one of green glass.
export function createVialRack(M) {
  const g = group('VialRack');
  add(g, new THREE.BoxGeometry(0.26, 0.035, 0.07), M.woodDark, 'RackBlock', [0, 0.0175, 0]);
  add(g, new THREE.BoxGeometry(0.26, 0.012, 0.07), M.woodDark, 'RackTop', [0, 0.075, 0]);
  for (const x of [-0.125, 0.125]) add(g, new THREE.BoxGeometry(0.01, 0.07, 0.07), M.woodDark, 'RackEnd', [x, 0.045, 0]);
  const vial = lathe([[0, 0], [0.012, 0], [0.014, 0.004], [0.014, 0.075], [0.009, 0.085], [0.007, 0.095], [0.008, 0.1], [0, 0.1]], 16);
  const cork = new THREE.CylinderGeometry(0.0072, 0.0062, 0.016, 10);
  for (let i = 0; i < 5; i++) {
    const x = -0.096 + i * 0.048;
    const tilt = (i === 3 ? 0.06 : 0);
    const mat = i === 2 ? M.glassGreen : i === 4 ? M.copperBright : M.copper;
    const v = add(g, vial, mat, 'Vial', [x, 0.012, 0], [tilt, 0, tilt]);
    if (i === 2) add(g, lathe([[0, 0], [0.011, 0], [0.012, 0.05], [0, 0.05]], 12), M.glassAmber, 'Tincture', [x, 0.016, 0]).userData.noShadow = true;
    add(g, cork, M.woodPine, 'Cork', [x, 0.118, 0]);
    v.userData.noShadow = i === 2;
  }
  return g;
}

// Open pocket watch with visible movement and a coiled chain.
export function createPocketWatch(M) {
  const g = group('PocketWatch');
  const G = partGeometries();
  add(g, lathe([[0, 0], [0.02, 0], [0.025, 0.003], [0.026, 0.008], [0.024, 0.012], [0, 0.012]], 32), M.brassPolished, 'Case');
  add(g, new THREE.CylinderGeometry(0.022, 0.022, 0.001, 32), M.brassAged, 'MovementPlate', [0, 0.0115, 0]);
  const gears = [[G.gearB, 0.008, 0.004], [G.gearA, -0.009, 0.006], [G.gearA, 0.002, -0.011]];
  for (const [geo, x, z] of gears) add(g, geo, M.brassPolished, 'WatchWheel', [x, 0.0128, z], [-Math.PI / 2, 0, x * 40], 0.55);
  add(g, G.balance, M.steelBlued, 'BalanceWheel', [-0.006, 0.0132, -0.008], [Math.PI / 2, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.0022, 0.0022, 0.006, 10), M.brassPolished, 'Pendant', [0, 0.006, -0.028], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(0.008, 0.0016, 6, 16), M.brassPolished, 'Bow', [0, 0.006, -0.037], [Math.PI / 2, 0, 0]);
  const lid = group('Lid', g, [0, 0.012, 0.025]);
  lid.rotation.x = -1.95;
  add(lid, lathe([[0, 0], [0.024, 0], [0.025, 0.002], [0.02, 0.004], [0, 0.0045]], 32), M.brassPolished, 'LidShell', [0, 0, -0.025]);
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 0.7;
    pts.push(V(Math.sin(a) * 0.03 + i * 0.006, 0.002, -0.045 - i * 0.008 + Math.cos(a) * 0.012));
  }
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.0013, 5), M.brass, 'WatchChain').userData.noShadow = true;
  return g;
}

// Chest of small drawers for parts; one drawer is pulled out to show its contents.
export function createPartsCabinet(M) {
  const g = group('PartsCabinet');
  const W = 1.2;
  const H = 0.95;
  const D = 0.44;
  const cols = 4;
  const rows = 5;
  const carcass = new GeoBatch();
  carcass.box(W + 0.04, 0.04, D + 0.04, [0, H + 0.02, 0]);
  carcass.box(W, 0.08, D - 0.02, [0, 0.04, -0.01]);
  for (const s of [-1, 1]) carcass.box(0.025, H, D, [s * (W / 2 - 0.0125), H / 2, 0]);
  carcass.box(W, H, 0.015, [0, H / 2, -D / 2 + 0.0075]);
  const cw = (W - 0.05) / cols;
  const rh = (H - 0.1) / rows;
  for (let c = 1; c < cols; c++) carcass.box(0.012, H - 0.1, D - 0.02, [-W / 2 + 0.025 + c * cw, 0.08 + (H - 0.1) / 2 + 0.005, 0]);
  for (let r = 1; r < rows; r++) carcass.box(W - 0.05, 0.01, D - 0.02, [0, 0.08 + r * rh, 0]);
  g.add(carcass.build(M.woodWorn, 'Carcass'));
  const fronts = new GeoBatch();
  const holders = new GeoBatch();
  const labels = new GeoBatch();
  const knobs = new GeoBatch();
  const openCol = 2;
  const openRow = 3;
  const pull = 0.24;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = -W / 2 + 0.025 + cw * (c + 0.5);
      const y = 0.08 + rh * (r + 0.5);
      const z = D / 2 - 0.01 + (c === openCol && r === openRow ? pull : 0);
      fronts.box(cw - 0.012, rh - 0.012, 0.02, [x, y, z]);
      holders.box(0.08, 0.035, 0.004, [x, y + 0.025, z + 0.012]);
      labels.box(0.07, 0.026, 0.002, [x, y + 0.025, z + 0.013]);
      knobs.add(new THREE.SphereGeometry(0.014, 12, 8), new THREE.Matrix4().makeTranslation(x, y - 0.018, z + 0.02));
    }
  }
  g.add(fronts.build(M.woodDark, 'DrawerFronts'));
  g.add(holders.build(M.brassAged, 'LabelHolders'));
  g.add(labels.build(M.paper, 'Labels'));
  g.add(knobs.build(M.brassPolished, 'DrawerKnobs'));
  // pulled drawer box and its contents
  const ox = -W / 2 + 0.025 + cw * (openCol + 0.5);
  const oy = 0.08 + rh * (openRow + 0.5);
  const box = new GeoBatch();
  const dz = D / 2 - 0.02 + pull - (D - 0.06) / 2;
  box.box(cw - 0.03, 0.008, D - 0.06, [ox, oy - rh / 2 + 0.012, dz]);
  for (const s of [-1, 1]) box.box(0.008, rh - 0.03, D - 0.06, [ox + s * (cw / 2 - 0.019), oy - 0.005, dz]);
  box.box(cw - 0.03, rh - 0.03, 0.008, [ox, oy - 0.005, dz - (D - 0.06) / 2]);
  g.add(box.build(M.woodPine, 'OpenDrawer'));
  const floorY = oy - rh / 2 + 0.016;
  g.add(scatterParts(M, 'screw', 60, V(ox, floorY, dz + 0.08), cw - 0.06, 0.2, 91, null, 0.012));
  g.add(scatterParts(M, 'gearA', 10, V(ox, floorY + 0.006, dz + 0.1), cw - 0.08, 0.14, 92));
  return g;
}
