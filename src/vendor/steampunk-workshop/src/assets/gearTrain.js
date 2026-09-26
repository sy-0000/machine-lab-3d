// Wall-mounted gear train on a riveted iron back plate. Centres, speeds and tooth phases come
// from utils/gear.js (centre distance = m(z1+z2)/2, ω2 = −ω1·z1/z2, phase-aligned teeth), so the
// teeth mesh correctly while turning. A flyball governor spins on the right, fed by a steam line.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';
import { createGearGeometry, meshWith, coaxialWith, pitchRadius } from '../utils/gear.js';
import { RivetSet } from '../utils/rivets.js';
import { createGauge, setGaugeValue, createValve } from '../utils/fixtures.js';

const PANEL_W = 5.2;
const PANEL_H = 3.8;
const PANEL_Y = 2.6;
const DEG = Math.PI / 180;

export function createGearTrain(M) {
  const root = group('GearTrainWall');
  const rivets = new RivetSet(0.016);
  const bolts = new RivetSet(0.03, 'hex');

  // ---- back plate
  add(root, new THREE.BoxGeometry(PANEL_W, PANEL_H, 0.05), M.castIron, 'BackPlate', [0, PANEL_Y, 0.025]);
  const frame = [
    [PANEL_W + 0.12, 0.1, 0, PANEL_H / 2],
    [PANEL_W + 0.12, 0.1, 0, -PANEL_H / 2],
    [0.1, PANEL_H, -PANEL_W / 2, 0],
    [0.1, PANEL_H, PANEL_W / 2, 0],
  ];
  for (const [w, h, x, y] of frame) add(root, new THREE.BoxGeometry(w, h, 0.07), M.brassAged, 'PlateFrame', [x, PANEL_Y + y, 0.04]);
  rivets.rect(V(0, PANEL_Y, 0.078), PANEL_W / 2, PANEL_H / 2, V(0, 0, 1), 0.2);
  rivets.rect(V(0, PANEL_Y, 0.052), PANEL_W / 2 - 0.16, PANEL_H / 2 - 0.16, V(0, 0, 1), 0.24);
  for (const x of [-PANEL_W / 6, PANEL_W / 6]) rivets.line(V(x, PANEL_Y - PANEL_H / 2 + 0.16, 0.052), V(x, PANEL_Y + PANEL_H / 2 - 0.16, 0.052), 0.24, V(0, 0, 1));

  // ---- gear specification (panel coordinates; x right, y up)
  const G0 = { teeth: 42, module: 0.04, x: -0.6, y: 3.1, theta0: 0, omega: 0.12 };
  const G1 = meshWith(G0, { teeth: 18, module: 0.04 }, -30 * DEG);
  const G1b = coaxialWith(G1, { teeth: 40, module: 0.03 }, 0.07);
  const G2 = meshWith(G1b, { teeth: 16, module: 0.03 }, 10 * DEG);
  const G3 = meshWith(G0, { teeth: 24, module: 0.04 }, 200 * DEG);
  const G4 = meshWith(G1, { teeth: 30, module: 0.04 }, -100 * DEG);
  const G5 = meshWith(G4, { teeth: 12, module: 0.04 }, -160 * DEG);
  const specs = [
    { g: G0, layer: 0.13, thick: 0.07, spokes: 6, mat: M.brassAged, hubMat: M.brassPolished },
    { g: G1, layer: 0.13, thick: 0.07, spokes: 0, mat: M.brass, hubMat: M.brassPolished },
    { g: G1b, layer: 0.23, thick: 0.04, spokes: 5, mat: M.copper, hubMat: M.brassPolished },
    { g: G2, layer: 0.23, thick: 0.04, spokes: 0, mat: M.brassPolished, hubMat: M.steel },
    { g: G3, layer: 0.13, thick: 0.06, spokes: 4, mat: M.brass, hubMat: M.castIron },
    { g: G4, layer: 0.13, thick: 0.06, spokes: 5, mat: M.copper, hubMat: M.brass },
    { g: G5, layer: 0.13, thick: 0.06, spokes: 0, mat: M.castIron, hubMat: M.brass },
  ];

  const rotors = [];
  const shafts = new Map();
  for (const s of specs) {
    const { g } = s;
    const rp = pitchRadius(g.teeth, g.module);
    const pivot = group(`Gear_z${g.teeth}`, root, [g.x, g.y, s.layer]);
    pivot.userData.dynamic = true;
    const geo = createGearGeometry({ teeth: g.teeth, module: g.module, thickness: s.thick, bore: 0.03, spokes: s.spokes, hubRadius: Math.max(0.07, rp * 0.22) });
    add(pivot, geo, s.mat, 'GearBody');
    add(pivot, new THREE.CylinderGeometry(Math.max(0.06, rp * 0.2), Math.max(0.06, rp * 0.2), s.thick + 0.04, 24), s.hubMat, 'Hub', [0, 0, 0], [Math.PI / 2, 0, 0]);
    if (s.spokes >= 4) {
      const spokeRivets = new RivetSet(0.012);
      const rimR = rp - 1.25 * g.module - Math.max(g.module * 1.6, rp * 0.14) * 0.5;
      for (let k = 0; k < s.spokes; k++) {
        const a = (k / s.spokes) * Math.PI * 2 + Math.PI / g.teeth;
        spokeRivets.add(V(Math.cos(a) * rimR, Math.sin(a) * rimR, s.thick / 2), V(0, 0, 1));
      }
      pivot.add(spokeRivets.build(M.brassPolished, 'SpokeRivets'));
    }
    // a key-way mark so the hub rotation reads
    add(pivot, new THREE.BoxGeometry(0.02, Math.max(0.05, rp * 0.18), 0.012), M.steelDark, 'HubKey', [0, Math.max(0.035, rp * 0.1), s.thick / 2 + 0.02]);
    rotors.push({ pivot, g });
    const key = `${g.x.toFixed(3)},${g.y.toFixed(3)}`;
    shafts.set(key, Math.max(shafts.get(key) ?? 0, s.layer + s.thick / 2 + 0.03));
  }

  // shafts, bearing bosses and cap nuts on the plate
  for (const [key, len] of shafts) {
    const [x, y] = key.split(',').map(Number);
    add(root, new THREE.CylinderGeometry(0.11, 0.13, 0.05, 24), M.brassAged, 'BearingBoss', [x, y, 0.075], [Math.PI / 2, 0, 0]);
    add(root, new THREE.CylinderGeometry(0.028, 0.028, len, 12), M.steel, 'Shaft', [x, y, len / 2 + 0.05], [Math.PI / 2, 0, 0]);
    add(root, new THREE.CylinderGeometry(0.045, 0.045, 0.035, 6), M.steelDark, 'CapNut', [x, y, len + 0.065], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      bolts.add(V(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.1, 0.1), V(0, 0, 1), 0.35);
    }
  }

  // ---- flyball governor (right side)
  const govX = 1.95;
  const bracket = group('GovernorBracket', root, [govX, 3.05, 0]);
  add(bracket, new THREE.BoxGeometry(0.1, 0.1, 0.5), M.castIron, 'Arm', [0, 0, 0.3]);
  add(bracket, new THREE.BoxGeometry(0.3, 0.05, 0.3), M.castIron, 'Table', [0, 0.03, 0.45]);
  add(bracket, new THREE.BoxGeometry(0.08, 0.35, 0.08), M.castIron, 'Strut', [0, -0.18, 0.12], [0.9, 0, 0]);
  const gov = group('FlyballGovernor', root, [govX, 3.08, 0.45]);
  gov.userData.dynamic = true;
  add(gov, new THREE.CylinderGeometry(0.018, 0.018, 0.85, 12), M.steel, 'Spindle', [0, 0.42, 0]);
  add(gov, lathe([[0, 0], [0.05, 0], [0.05, 0.03], [0.03, 0.06], [0, 0.06]], 16), M.brassPolished, 'TopCap', [0, 0.84, 0]);
  add(gov, new THREE.CylinderGeometry(0.04, 0.04, 0.07, 16), M.brass, 'Sleeve', [0, 0.36, 0]);
  const swing = 0.62;
  for (const s of [-1, 1]) {
    const arm = group('GovernorArm', gov, [0, 0.84, 0]);
    arm.rotation.z = s * (Math.PI - swing);
    add(arm, new THREE.CylinderGeometry(0.009, 0.009, 0.42, 8), M.steel, 'Arm', [0, 0.21, 0]);
    add(arm, new THREE.SphereGeometry(0.075, 20, 14), M.brassPolished, 'Flyball', [0, 0.45, 0]);
    const link = group('Link', gov, [0, 0.39, 0]);
    const ex = -Math.sin(swing) * 0.22 * s;
    const ey = 0.84 - Math.cos(swing) * 0.22 - 0.39;
    link.rotation.z = -Math.atan2(ex, ey);
    add(link, new THREE.CylinderGeometry(0.007, 0.007, Math.hypot(ex, ey), 6), M.steel, 'LinkRod', [0, Math.hypot(ex, ey) / 2, 0]);
  }
  add(root, lathe([[0, 0], [0.09, 0], [0.09, 0.05], [0.05, 0.08], [0, 0.08]], 20), M.brassAged, 'GovernorBase', [govX, 3.06, 0.45]);
  add(root, new THREE.ConeGeometry(0.08, 0.06, 20), M.brass, 'BevelBox', [govX, 3.0, 0.45], [Math.PI, 0, 0]);

  // steam gauge and throttle valve fed from the wall line
  const gauge = createGauge(M, { radius: 0.16, depth: 0.07 });
  gauge.object.position.set(govX, 1.75, 0.2);
  root.add(gauge.object);
  add(root, new THREE.CylinderGeometry(0.02, 0.02, 0.2, 10), M.brass, 'GaugeStem', [govX, 1.75, 0.1], [Math.PI / 2, 0, 0]);
  const valve = createValve(M, { size: 1.5 });
  valve.object.position.set(govX, 2.35, 0.24);
  valve.object.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  root.add(valve.object);
  add(root, new THREE.CylinderGeometry(0.045, 0.045, 1.25, 14), M.copper, 'FeedPipe', [govX + 0.45, 1.95, 0.24]);
  add(root, new THREE.CylinderGeometry(0.045, 0.045, 0.45, 14), M.copper, 'FeedPipeCross', [govX + 0.22, 2.35, 0.24], [0, 0, Math.PI / 2]);
  add(root, new THREE.SphereGeometry(0.06, 14, 10), M.brass, 'Elbow', [govX + 0.45, 2.35, 0.24]);

  const plate = add(root, new THREE.PlaneGeometry(0.62, 0.2), M.nameplate, 'Nameplate', [govX, 0.95, 0.056]);
  plate.userData.noShadow = true;

  root.add(rivets.build(M.brassAged, 'PanelRivets'));
  root.add(bolts.build(M.steelDark, 'BossBolts'));

  const update = (dt, t) => {
    for (const { pivot, g } of rotors) pivot.rotation.z = g.theta0 + g.omega * t;
    gov.rotation.y = -G2.omega * 3.2 * t;
    setGaugeValue(gauge.needle, 0.5 + Math.sin(t * 0.4) * 0.02 + Math.sin(t * 5.3) * 0.004);
  };

  return {
    object: root,
    update,
    anchors: {
      steamLeak: V(govX + 0.45, 2.42, 0.3),
      feedTop: V(govX + 0.45, 2.58, 0.24),
    },
  };
}
