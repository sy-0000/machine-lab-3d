// Longcase (grandfather) clock: mahogany case, glazed trunk door with swinging brass pendulum,
// three weights, enamel dial with blued hands (real time), and an arched skeleton window showing
// the escape wheel train ticking in step with the pendulum.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';
import { createGearGeometry, meshWith } from '../utils/gear.js';
import { RivetSet } from '../utils/rivets.js';

const PERIOD = 2; // seconds pendulum: one beat per second
const HOOD_Y = 1.62;
const DIAL_Y = HOOD_Y + 0.27;
const ARCH_Y = HOOD_Y + 0.55;

function handShape(length, width, tail) {
  const s = new THREE.Shape();
  s.moveTo(-width * 0.35, -tail);
  s.lineTo(width * 0.35, -tail);
  s.lineTo(width * 0.3, length * 0.55);
  s.quadraticCurveTo(width * 1.4, length * 0.7, 0, length * 0.86); // spade
  s.lineTo(width * 0.15, length * 0.86);
  s.lineTo(0, length);
  s.lineTo(-width * 0.15, length * 0.86);
  s.quadraticCurveTo(-width * 1.4, length * 0.7, -width * 0.3, length * 0.55);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, length * 0.7, width * 0.35, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false, curveSegments: 8 });
}

export function createGrandfatherClock(M) {
  const root = group('GrandfatherClock');
  const W = M.woodDark;
  const bolts = new RivetSet(0.006);

  // ---- base
  add(root, new THREE.BoxGeometry(0.68, 0.08, 0.47), W, 'Plinth', [0, 0.04, 0]);
  for (const x of [-0.29, 0.29]) add(root, new THREE.BoxGeometry(0.08, 0.04, 0.44), W, 'BracketFoot', [x, 0.1, 0]);
  add(root, new THREE.BoxGeometry(0.6, 0.42, 0.42), W, 'Base', [0, 0.33, 0]);
  add(root, new THREE.BoxGeometry(0.42, 0.26, 0.02), W, 'BasePanel', [0, 0.33, 0.215]);
  add(root, new THREE.BoxGeometry(0.64, 0.05, 0.45), W, 'BaseMoulding', [0, 0.565, 0]);

  // ---- trunk (open-backed box with glazed door)
  const trunkY0 = 0.59;
  const trunkH = 1.0;
  const tc = trunkY0 + trunkH / 2;
  add(root, new THREE.BoxGeometry(0.5, trunkH, 0.02), W, 'TrunkBack', [0, tc, -0.18]);
  add(root, new THREE.PlaneGeometry(0.46, trunkH), M.darkInterior, 'TrunkInterior', [0, tc, -0.169]);
  for (const x of [-0.24, 0.24]) add(root, new THREE.BoxGeometry(0.02, trunkH, 0.32), W, 'TrunkSide', [x, tc, -0.03]);
  const winY0 = 0.76;
  const winY1 = 1.46;
  add(root, new THREE.BoxGeometry(0.5, winY0 - trunkY0, 0.025), W, 'DoorRailLow', [0, (trunkY0 + winY0) / 2, 0.118]);
  add(root, new THREE.BoxGeometry(0.5, trunkY0 + trunkH - winY1, 0.025), W, 'DoorRailTop', [0, (winY1 + trunkY0 + trunkH) / 2, 0.118]);
  for (const x of [-0.2, 0.2]) add(root, new THREE.BoxGeometry(0.1, winY1 - winY0, 0.025), W, 'DoorStile', [x, (winY0 + winY1) / 2, 0.118]);
  add(root, new THREE.PlaneGeometry(0.3, winY1 - winY0), M.glass, 'DoorGlass', [0, (winY0 + winY1) / 2, 0.122]).userData.noShadow = true;
  for (const [w, h, x, y] of [[0.31, 0.008, 0, winY0], [0.31, 0.008, 0, winY1], [0.008, 0.71, -0.153, (winY0 + winY1) / 2], [0.008, 0.71, 0.153, (winY0 + winY1) / 2]]) {
    add(root, new THREE.BoxGeometry(w, h, 0.01), M.brassAged, 'DoorBead', [x, y, 0.133]);
  }
  add(root, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), M.brassPolished, 'Escutcheon', [0.19, 1.1, 0.134], [Math.PI / 2, 0, 0]);
  add(root, new THREE.BoxGeometry(0.64, 0.05, 0.4), W, 'WaistMoulding', [0, trunkY0 + trunkH + 0.025, 0]);

  // ---- hood
  const hood = group('Hood', root, [0, HOOD_Y, 0]);
  const hoodH = 0.72;
  add(hood, new THREE.BoxGeometry(0.6, hoodH, 0.02), W, 'HoodBack', [0, hoodH / 2, -0.18]);
  for (const x of [-0.29, 0.29]) add(hood, new THREE.BoxGeometry(0.02, hoodH, 0.38), W, 'HoodSide', [x, hoodH / 2, 0]);
  add(hood, new THREE.BoxGeometry(0.66, 0.035, 0.44), W, 'HoodTop', [0, hoodH + 0.018, 0]);
  add(hood, new THREE.PlaneGeometry(0.56, hoodH), M.darkInterior, 'HoodInterior', [0, hoodH / 2, -0.169]);

  const face = new THREE.Shape();
  face.moveTo(-0.28, 0);
  face.lineTo(0.28, 0);
  face.lineTo(0.28, hoodH);
  face.lineTo(-0.28, hoodH);
  face.closePath();
  const arch = new THREE.Path();
  const aY0 = ARCH_Y - HOOD_Y - 0.06;
  const aY1 = ARCH_Y - HOOD_Y;
  arch.moveTo(-0.1, aY0);
  arch.lineTo(0.1, aY0);
  arch.lineTo(0.1, aY1);
  arch.absarc(0, aY1, 0.1, 0, Math.PI, false);
  arch.lineTo(-0.1, aY0);
  face.holes.push(arch);
  const faceGeo = new THREE.ExtrudeGeometry(face, { depth: 0.02, bevelEnabled: false, curveSegments: 16 });
  add(hood, faceGeo, W, 'FaceBoard', [0, 0, 0.17]);
  const archGlass = new THREE.Shape();
  archGlass.moveTo(-0.1, aY0);
  archGlass.lineTo(0.1, aY0);
  archGlass.lineTo(0.1, aY1);
  archGlass.absarc(0, aY1, 0.1, 0, Math.PI, false);
  archGlass.closePath();
  add(hood, new THREE.ShapeGeometry(archGlass, 12), M.glass, 'ArchGlass', [0, 0, 0.192]).userData.noShadow = true;
  add(hood, new THREE.TorusGeometry(0.101, 0.006, 6, 24, Math.PI), M.brassPolished, 'ArchBead', [0, aY1, 0.193]);

  // dial
  const dialZ = 0.192;
  add(hood, new THREE.CircleGeometry(0.2, 48), M.clockDial, 'Dial', [0, DIAL_Y - HOOD_Y, dialZ]);
  add(hood, new THREE.TorusGeometry(0.205, 0.013, 10, 48), M.brassPolished, 'DialBezel', [0, DIAL_Y - HOOD_Y, dialZ]);
  add(hood, new THREE.SphereGeometry(0.2, 32, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 'DialGlass', [0, DIAL_Y - HOOD_Y, dialZ], [Math.PI / 2, 0, 0], [1, 0.12, 1]).userData.noShadow = true;
  for (const [x, y] of [[-0.24, 0.03], [0.24, 0.03], [-0.24, 0.5], [0.24, 0.5]]) {
    add(hood, new THREE.CircleGeometry(0.03, 16), M.brassAged, 'Spandrel', [x * 0.9, y + 0.03, dialZ + 0.001]);
  }
  const minuteHand = group('MinuteHand', hood, [0, DIAL_Y - HOOD_Y, dialZ + 0.012]);
  add(minuteHand, handShape(0.17, 0.02, 0.03), M.steelBlued, 'MinuteBlade');
  const hourHand = group('HourHand', hood, [0, DIAL_Y - HOOD_Y, dialZ + 0.008]);
  add(hourHand, handShape(0.115, 0.026, 0.02), M.steelBlued, 'HourBlade');
  add(hood, new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12), M.brassPolished, 'HandCollet', [0, DIAL_Y - HOOD_Y, dialZ + 0.012], [Math.PI / 2, 0, 0]);
  minuteHand.userData.dynamic = true;
  hourHand.userData.dynamic = true;
  minuteHand.children[0].userData.noShadow = true;
  hourHand.children[0].userData.noShadow = true;

  // hood columns
  const column = lathe([[0, 0], [0.03, 0], [0.03, 0.03], [0.02, 0.05], [0.018, 0.56], [0.026, 0.6], [0.03, 0.62], [0.03, 0.64], [0, 0.64]], 14);
  for (const x of [-0.27, 0.27]) add(hood, column, M.brass, 'HoodColumn', [x, 0.04, 0.21]);

  // ---- skeleton window: escape wheel, third wheel, pinion and the rocking anchor
  const train = group('EscapementTrain', hood, [0, ARCH_Y - HOOD_Y, 0.12]);
  add(train, new THREE.BoxGeometry(0.3, 0.26, 0.008), M.brassAged, 'Backplate', [0, 0.02, -0.01]);
  const m = 0.0035;
  const escape = { teeth: 30, module: m, x: 0, y: -0.01, theta0: 0, omega: 0 };
  const third = meshWith(escape, { teeth: 48, module: m }, (200 * Math.PI) / 180);
  const pinion = meshWith(escape, { teeth: 12, module: m }, (-25 * Math.PI) / 180);
  const makeGear = (g, spokes, mat, z) => {
    const pivot = group('GearPivot', train, [g.x, g.y, z]);
    add(pivot, createGearGeometry({ teeth: g.teeth, module: g.module, thickness: 0.004, bore: 0.002, spokes }), mat, `Wheel_${g.teeth}`);
    add(pivot, new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), M.steel, 'Arbor', [0, 0, 0], [Math.PI / 2, 0, 0]);
    pivot.userData.dynamic = true;
    return { pivot, spec: g };
  };
  const gears = [makeGear(escape, 5, M.brassPolished, 0.01), makeGear(third, 4, M.brass, 0.01), makeGear(pinion, 0, M.brassAged, 0.01)];
  const anchor = group('Anchor', train, [0, 0.085, 0.018]);
  const anchorShape = new THREE.Shape();
  anchorShape.moveTo(-0.07, -0.05);
  anchorShape.lineTo(-0.055, -0.052);
  anchorShape.lineTo(-0.012, 0.008);
  anchorShape.lineTo(0.012, 0.008);
  anchorShape.lineTo(0.055, -0.052);
  anchorShape.lineTo(0.07, -0.05);
  anchorShape.lineTo(0.02, 0.022);
  anchorShape.lineTo(-0.02, 0.022);
  anchorShape.closePath();
  add(anchor, new THREE.ExtrudeGeometry(anchorShape, { depth: 0.004, bevelEnabled: false }), M.steelBlued, 'AnchorPallets');
  add(anchor, new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), M.steel, 'AnchorArbor', [0, 0.012, 0], [Math.PI / 2, 0, 0]);
  anchor.userData.dynamic = true;
  for (const [x, y] of [[-0.13, -0.09], [0.13, -0.09], [-0.13, 0.13], [0.13, 0.13]]) bolts.add(V(x, ARCH_Y - HOOD_Y + y, 0.116).add(V(0, HOOD_Y, 0)), V(0, 0, 1));

  // ---- crown
  const crown = group('Crown', hood, [0, hoodH + 0.035, 0]);
  for (const s of [-1, 1]) {
    const c = add(crown, new THREE.BoxGeometry(0.27, 0.05, 0.4), W, 'Pediment', [s * 0.17, 0.07, 0]);
    c.rotation.z = -s * 0.42;
  }
  add(crown, new THREE.BoxGeometry(0.1, 0.12, 0.3), W, 'CrownPlinth', [0, 0.06, 0]);
  const finial = lathe([[0, 0], [0.03, 0], [0.03, 0.02], [0.012, 0.035], [0.035, 0.07], [0.012, 0.1], [0.006, 0.16], [0, 0.17]], 14);
  add(crown, finial, M.brassPolished, 'CentreFinial', [0, 0.12, 0.05]);
  for (const x of [-0.29, 0.29]) {
    add(crown, new THREE.BoxGeometry(0.06, 0.06, 0.06), W, 'FinialBlock', [x, 0.03, 0.17]);
    add(crown, finial, M.brassPolished, 'SideFinial', [x, 0.06, 0.17], [0, 0, 0], 0.7);
  }

  // ---- pendulum and weights
  const pendulum = group('Pendulum', root, [0, 1.57, 0.0]);
  pendulum.userData.dynamic = true;
  add(pendulum, new THREE.BoxGeometry(0.012, 0.66, 0.004), M.brassAged, 'Rod', [0, -0.33, 0]);
  add(pendulum, new THREE.CylinderGeometry(0.082, 0.082, 0.018, 40), M.brassPolished, 'Bob', [0, -0.66, 0], [Math.PI / 2, 0, 0]);
  add(pendulum, new THREE.TorusGeometry(0.082, 0.006, 8, 40), M.brass, 'BobRim', [0, -0.66, 0]);
  add(pendulum, new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6), M.steel, 'RatingNut', [0, -0.755, 0]);
  add(pendulum, new THREE.BoxGeometry(0.03, 0.03, 0.01), M.steel, 'Suspension', [0, 0, 0]);
  for (const [x, y] of [[-0.11, 1.2], [0, 1.08], [0.11, 1.28]]) {
    add(root, new THREE.CylinderGeometry(0.032, 0.032, 0.2, 20), M.brass, 'Weight', [x, y, -0.11]);
    add(root, new THREE.SphereGeometry(0.032, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.brass, 'WeightCap', [x, y + 0.1, -0.11], [0, 0, 0], [1, 0.4, 1]);
    add(root, new THREE.CylinderGeometry(0.003, 0.003, 1.57 - y - 0.12, 4), M.steelDark, 'WeightCable', [x, (1.57 + y + 0.12) / 2, -0.11]).userData.noShadow = true;
    add(root, new THREE.TorusGeometry(0.012, 0.003, 4, 10), M.steel, 'WeightHook', [x, y + 0.125, -0.11]).userData.noShadow = true;
  }

  const boltMesh = bolts.build(M.brassPolished, 'ClockScrews');
  if (boltMesh) root.add(boltMesh);

  const amplitude = 0.095;
  const escapeStep = (Math.PI * 2) / 30;
  const update = (dt, t) => {
    const phase = (t / PERIOD) * Math.PI * 2;
    const swing = amplitude * Math.sin(phase);
    pendulum.rotation.z = swing;
    anchor.rotation.z = swing * 0.7;
    // escape wheel advances half a tooth each beat, snapping quickly then resting
    const beats = t / (PERIOD / 2) + 0.5;
    const f = beats - Math.floor(beats);
    const e = Math.floor(beats) + Math.min(1, f / 0.06) ** 0.5;
    const escAngle = -e * (escapeStep / 2);
    gears[0].pivot.rotation.z = escape.theta0 + escAngle;
    gears[1].pivot.rotation.z = third.theta0 - escAngle * (escape.teeth / third.teeth);
    gears[2].pivot.rotation.z = pinion.theta0 - escAngle * (escape.teeth / pinion.teeth);
    const now = new Date();
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;
    minuteHand.rotation.z = -(min / 60) * Math.PI * 2;
    hourHand.rotation.z = -(hr / 12) * Math.PI * 2;
  };

  return { object: root, update, anchors: {} };
}
