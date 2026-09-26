// Hand tools. Each is modelled standing along +Y (as it hangs on the tool wall), flat face toward +Z,
// centred on its origin; `userData.thickness` is used to lay it flat on a surface.
import * as THREE from 'three';
import { add, group, lathe, V } from '../utils/geometry.js';

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

const extrude = (shape, depth, bevel = depth * 0.2) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
  return g;
};

export function createWrench(M, length = 0.22) {
  const L = length;
  const R = L * 0.13;
  const t = Math.max(0.008, L * 0.045);
  const g = group('Wrench');
  add(g, extrude(roundedRect(L * 0.1, L - R * 1.6, L * 0.03), t * 0.72), M.steel, 'WrenchShank');
  // open-end jaw
  const hw = R * 0.42;
  const yTip = Math.sqrt(R * R - hw * hw);
  const open = new THREE.Shape();
  open.moveTo(hw, yTip);
  open.absarc(0, 0, R, Math.PI / 2 - Math.asin(hw / R), Math.PI / 2 + Math.asin(hw / R), true);
  open.lineTo(-hw, yTip - R * 1.05);
  open.lineTo(hw, yTip - R * 1.05);
  open.closePath();
  const head = add(g, extrude(open, t), M.steel, 'OpenEnd', [0, L / 2 - R, 0]);
  head.rotation.z = 0.26;
  // ring end with a hexagonal socket
  const ring = new THREE.Shape();
  ring.absarc(0, 0, R * 0.92, 0, Math.PI * 2, false);
  const hex = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    if (i === 0) hex.moveTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
    else hex.lineTo(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5);
  }
  ring.holes.push(hex);
  add(g, extrude(ring, t), M.steel, 'RingEnd', [0, -L / 2 + R, 0]);
  g.userData.thickness = t;
  return g;
}

export function createPliers(M, open = 0.12) {
  const g = group('Pliers');
  const halves = [1, -1];
  for (const s of halves) {
    const half = group(s > 0 ? 'PliersHalfA' : 'PliersHalfB', g, [0, 0, s * 0.0032]);
    half.rotation.z = s * open * 0.5;
    const jaw = new THREE.Shape();
    jaw.moveTo(0, -0.014);
    jaw.lineTo(s * 0.013, -0.006);
    jaw.lineTo(s * 0.008, 0.05);
    jaw.lineTo(s * 0.003, 0.078);
    jaw.lineTo(0, 0.08);
    jaw.closePath();
    add(half, extrude(jaw, 0.0062, 0.0008), M.steel, 'Jaw');
    const handle = [V(0, -0.01, 0), V(-s * 0.006, -0.05, 0), V(-s * 0.018, -0.12, 0), V(-s * 0.026, -0.19, 0)];
    const curve = new THREE.CatmullRomCurve3(handle);
    add(half, new THREE.TubeGeometry(curve, 16, 0.0055, 8), M.steelDark, 'Handle');
    const grip = new THREE.CatmullRomCurve3(handle.slice(1).map((p) => p.clone()));
    add(half, new THREE.TubeGeometry(grip, 14, 0.0085, 8), M.leatherDark, 'Grip');
  }
  add(g, new THREE.CylinderGeometry(0.009, 0.009, 0.015, 14), M.steelDark, 'PivotRivet', [0, 0, 0], [Math.PI / 2, 0, 0]);
  g.position.y = 0;
  g.userData.thickness = 0.017;
  return g;
}

export function createHammer(M, length = 0.32) {
  const L = length;
  const g = group('Hammer');
  add(g, lathe([[0, -L / 2], [0.014, -L / 2], [0.016, -L / 2 + 0.02], [0.015, -L * 0.1], [0.011, L * 0.3], [0.012, L / 2 - 0.01], [0, L / 2 - 0.01]], 12), M.woodHandle, 'Handle');
  const head = group('Head', g, [0, L / 2 - 0.014, 0]);
  add(head, new THREE.BoxGeometry(0.075, 0.028, 0.028), M.steelDark, 'Cheek', [0.005, 0, 0]);
  add(head, new THREE.CylinderGeometry(0.016, 0.014, 0.03, 16), M.steel, 'Face', [0.055, 0, 0], [0, 0, Math.PI / 2]);
  add(head, new THREE.SphereGeometry(0.015, 14, 10), M.steel, 'Peen', [-0.04, 0, 0]);
  add(head, new THREE.BoxGeometry(0.006, 0.006, 0.022), M.steelDark, 'Wedge', [0, 0.016, 0]);
  g.userData.thickness = 0.028;
  return g;
}

export function createScrewdriver(M, length = 0.24, handleMat = M.woodHandle) {
  const L = length;
  const g = group('Screwdriver');
  const hl = L * 0.42;
  add(g, lathe([[0, -L / 2], [0.011, -L / 2], [0.015, -L / 2 + 0.01], [0.016, -L / 2 + hl * 0.5], [0.013, -L / 2 + hl * 0.9], [0.01, -L / 2 + hl], [0, -L / 2 + hl]], 10), handleMat, 'Handle');
  add(g, new THREE.CylinderGeometry(0.0095, 0.0105, 0.018, 12), M.brass, 'Ferrule', [0, -L / 2 + hl + 0.006, 0]);
  add(g, new THREE.CylinderGeometry(0.0032, 0.0032, L - hl - 0.02, 8), M.steel, 'Shaft', [0, -L / 2 + hl + (L - hl - 0.02) / 2 + 0.01, 0]);
  add(g, new THREE.BoxGeometry(0.0065, 0.014, 0.0015), M.steel, 'Tip', [0, L / 2 - 0.007, 0]);
  g.userData.thickness = 0.032;
  return g;
}

export function createSaw(M) {
  const g = group('HandSaw');
  const blade = new THREE.Shape();
  blade.moveTo(-0.055, 0.1);
  blade.lineTo(0.035, 0.1);
  blade.lineTo(0.02, -0.4);
  const teeth = 38;
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const x = 0.02 - t * (0.02 + 0.07);
    const y = -0.4 + t * 0.5;
    blade.lineTo(x - (i % 2 ? 0.006 : 0), y);
  }
  blade.closePath();
  add(g, extrude(blade, 0.0016, 0.0003), M.steel, 'Blade');
  const handle = new THREE.Shape();
  handle.moveTo(-0.07, 0.07);
  handle.quadraticCurveTo(-0.08, 0.2, -0.02, 0.23);
  handle.quadraticCurveTo(0.05, 0.24, 0.055, 0.17);
  handle.lineTo(0.05, 0.06);
  handle.lineTo(-0.07, 0.07);
  const grip = new THREE.Path();
  grip.moveTo(-0.035, 0.12);
  grip.quadraticCurveTo(-0.04, 0.2, 0.0, 0.2);
  grip.quadraticCurveTo(0.03, 0.2, 0.025, 0.12);
  grip.closePath();
  handle.holes.push(grip);
  add(g, extrude(handle, 0.022, 0.004), M.woodHandle, 'Handle');
  for (const [x, y] of [[-0.05, 0.09], [0.035, 0.09], [0.04, 0.155]]) {
    add(g, new THREE.CylinderGeometry(0.006, 0.006, 0.026, 10), M.brassPolished, 'SawNut', [x, y, 0], [Math.PI / 2, 0, 0]);
  }
  g.userData.thickness = 0.022;
  return g;
}

export function createFile(M, length = 0.3) {
  const g = group('File');
  const s = new THREE.Shape();
  s.moveTo(-0.011, -0.05);
  s.lineTo(0.011, -0.05);
  s.lineTo(0.008, length * 0.6);
  s.lineTo(-0.008, length * 0.6);
  s.closePath();
  add(g, extrude(s, 0.005, 0.001), M.steelDark, 'FileBlade', [0, -length * 0.12, 0]);
  add(g, lathe([[0, -length / 2], [0.011, -length / 2], [0.013, -length * 0.35], [0.009, -length * 0.2], [0, -length * 0.2]], 10), M.woodHandle, 'FileHandle');
  add(g, new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 10), M.brass, 'FileFerrule', [0, -length * 0.2, 0]);
  g.userData.thickness = 0.026;
  return g;
}

export function createCalipers(M) {
  const g = group('Calipers');
  for (const s of [-1, 1]) {
    const leg = add(g, new THREE.TorusGeometry(0.075, 0.0035, 6, 20, Math.PI * 0.75), M.steel, 'CaliperLeg', [s * 0.07, 0.02, s * 0.002]);
    leg.rotation.z = s > 0 ? Math.PI * 0.55 : Math.PI * -0.3;
    leg.scale.x = s;
  }
  add(g, new THREE.CylinderGeometry(0.013, 0.013, 0.01, 16), M.brassPolished, 'CaliperJoint', [0, 0.09, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(0.01, 0.003, 6, 12), M.steel, 'CaliperRing', [0, 0.11, 0]);
  g.userData.thickness = 0.012;
  return g;
}

export function createMallet(M) {
  const g = group('Mallet');
  add(g, lathe([[0, -0.15], [0.013, -0.15], [0.014, 0.1], [0, 0.1]], 10), M.woodHandle, 'MalletHandle');
  add(g, new THREE.CylinderGeometry(0.036, 0.036, 0.13, 18), M.woodPine, 'MalletHead', [0, 0.12, 0], [0, 0, Math.PI / 2]);
  for (const x of [-0.055, 0.055]) add(g, new THREE.CylinderGeometry(0.037, 0.037, 0.012, 18), M.copper, 'MalletBand', [x, 0.12, 0], [0, 0, Math.PI / 2]);
  g.userData.thickness = 0.072;
  return g;
}

export function createBraceDrill(M) {
  const g = group('BraceDrill');
  const path = [V(0, 0.17, 0), V(0, 0.1, 0), V(0.08, 0.07, 0), V(0.085, 0.0, 0), V(0.08, -0.07, 0), V(0, -0.1, 0), V(0, -0.15, 0)];
  add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.1), 40, 0.0065, 8), M.steel, 'Crank');
  add(g, lathe([[0, 0], [0.035, 0], [0.04, 0.012], [0.03, 0.03], [0, 0.034]], 16), M.woodHandle, 'HeadKnob', [0, 0.17, 0]);
  add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12), M.woodHandle, 'CrankGrip', [0.085, 0, 0]);
  add(g, lathe([[0, 0], [0.016, 0], [0.018, 0.02], [0.012, 0.045], [0, 0.05]], 14), M.brass, 'Chuck', [0, -0.15, 0], [Math.PI, 0, 0]);
  add(g, new THREE.CylinderGeometry(0.003, 0.002, 0.08, 6), M.steel, 'Bit', [0, -0.23, 0]);
  g.userData.thickness = 0.08;
  return g;
}

// Lays a standing tool flat on a surface at height y (face up), turned by `yaw`.
export function layFlat(tool, x, y, z, yaw = 0) {
  const holder = new THREE.Group();
  holder.name = `${tool.name}_Placed`;
  tool.rotation.x = -Math.PI / 2;
  holder.add(tool);
  holder.position.set(x, y + (tool.userData.thickness ?? 0.02) / 2, z);
  holder.rotation.y = yaw;
  return holder;
}
