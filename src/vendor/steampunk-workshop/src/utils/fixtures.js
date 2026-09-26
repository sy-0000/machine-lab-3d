// Reusable small fittings shared by several assets: pressure gauges, valves, handwheels, bulbs.
import * as THREE from 'three';
import { add, group, lathe, V } from './geometry.js';

const GAUGE_START = (225 * Math.PI) / 180;
const GAUGE_SWEEP = (270 * Math.PI) / 180;

// Pressure gauge facing +Z, centred at the origin. Returns { object, needle }.
export function createGauge(M, { radius = 0.1, depth = 0.05, caseMaterial = M.brass } = {}) {
  const g = group('PressureGauge');
  const r = radius;
  add(g, new THREE.CylinderGeometry(r, r * 1.02, depth, 32), caseMaterial, 'Case', [0, 0, 0], [Math.PI / 2, 0, 0]);
  add(g, new THREE.TorusGeometry(r * 0.97, r * 0.075, 8, 40), M.brassPolished, 'Bezel', [0, 0, depth / 2]);
  add(g, new THREE.CircleGeometry(r * 0.92, 40), M.gaugeDial, 'Dial', [0, 0, depth / 2 - 0.004]);
  const needle = group('Needle', g, [0, 0, depth / 2 + 0.002]);
  const shape = new THREE.Shape();
  shape.moveTo(-r * 0.035, -r * 0.18);
  shape.lineTo(r * 0.035, -r * 0.18);
  shape.lineTo(r * 0.012, r * 0.78);
  shape.lineTo(-r * 0.012, r * 0.78);
  shape.closePath();
  add(needle, new THREE.ShapeGeometry(shape), M.steelBlued, 'NeedleBlade');
  add(needle, new THREE.CylinderGeometry(r * 0.07, r * 0.07, 0.006, 12), M.brassPolished, 'NeedleHub', [0, 0, 0.002], [Math.PI / 2, 0, 0]);
  needle.userData.dynamic = true;
  const glass = add(g, new THREE.SphereGeometry(r * 0.93, 24, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 'Glass', [0, 0, depth / 2], [Math.PI / 2, 0, 0], [1, 0.2, 1]);
  glass.userData.noShadow = true;
  return { object: g, needle };
}

export function setGaugeValue(needle, v) {
  needle.rotation.z = GAUGE_START - GAUGE_SWEEP * v - Math.PI / 2;
}

// Spoked handwheel lying in the XZ plane, axis +Y.
export function createHandwheel(M, radius = 0.08, material = M.paintRed, spokes = 4) {
  const g = group('Handwheel');
  add(g, new THREE.TorusGeometry(radius, radius * 0.14, 8, 28), material, 'Rim', [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI;
    add(g, new THREE.CylinderGeometry(radius * 0.06, radius * 0.06, radius * 2, 6), material, 'Spoke', [0, 0, 0], [Math.PI / 2, 0, a]);
  }
  add(g, new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, radius * 0.35, 12), M.brass, 'Hub');
  add(g, new THREE.CylinderGeometry(radius * 0.09, radius * 0.09, radius * 0.1, 6), M.steelDark, 'Nut', [0, radius * 0.22, 0]);
  return g;
}

// Globe valve: flow along X, bonnet and handwheel on +Y.
export function createValve(M, { size = 1, wheelMaterial = M.paintRed, bodyMaterial = M.brass } = {}) {
  const s = size;
  const g = group('GlobeValve');
  add(g, new THREE.SphereGeometry(0.055 * s, 18, 12), bodyMaterial, 'Body', [0, 0, 0], [0, 0, 0], [1.25, 1, 1]);
  for (const side of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.05 * s, 6), bodyMaterial, 'EndNut', [side * 0.07 * s, 0, 0], [0, 0, Math.PI / 2]);
  }
  add(g, lathe([[0, 0], [0.034, 0], [0.034, 0.03], [0.026, 0.04], [0.026, 0.07], [0.03, 0.075], [0.03, 0.09], [0, 0.09]].map(([r, y]) => [r * s, y * s]), 16), bodyMaterial, 'Bonnet', [0, 0.035 * s, 0]);
  add(g, new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.1 * s, 8), M.steel, 'Stem', [0, 0.16 * s, 0]);
  const wheel = createHandwheel(M, 0.075 * s, wheelMaterial);
  wheel.position.y = 0.2 * s;
  g.add(wheel);
  return { object: g, wheel };
}

// Edison bulb hanging down from its socket at the origin. Returns the group.
export function createEdisonBulb(M, { scale = 1, glass = M.bulbGlass, filament = M.filament } = {}) {
  const g = group('EdisonBulb');
  g.scale.setScalar(scale);
  add(g, lathe([[0.004, 0.06], [0.012, 0.058], [0.016, 0.05], [0.017, 0.02], [0.019, 0.016], [0.019, 0.004], [0.015, 0], [0.013, -0.002]], 18), M.brassAged, 'Socket', [0, 0, 0]);
  const thread = [];
  for (let i = 0; i <= 8; i++) thread.push([i % 2 ? 0.0135 : 0.0125, -0.002 - i * 0.0025]);
  thread.push([0.009, -0.024]);
  add(g, lathe(thread, 16), M.brass, 'Base');
  add(g, lathe([[0.009, -0.024], [0.014, -0.03], [0.022, -0.05], [0.034, -0.08], [0.038, -0.105], [0.035, -0.135], [0.026, -0.155], [0.012, -0.166], [0, -0.168]], 24), glass, 'Glass').userData.noShadow = true;
  // squirrel-cage filament
  const pts = [];
  const loops = 7;
  for (let i = 0; i <= loops * 2; i++) {
    const a = (i / (loops * 2)) * Math.PI * 2;
    const top = i % 2 === 0;
    pts.push(new THREE.Vector3(Math.cos(a) * (top ? 0.009 : 0.014), top ? -0.07 : -0.118, Math.sin(a) * (top ? 0.009 : 0.014)));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.2);
  add(g, new THREE.TubeGeometry(curve, 90, 0.0009, 4, true), filament, 'Filament').userData.noShadow = true;
  add(g, new THREE.CylinderGeometry(0.0012, 0.0012, 0.05, 4), M.steel, 'Stem', [0, -0.05, 0]).userData.noShadow = true;
  return g;
}

// Hanging fabric cable between two points with a gentle sag.
export function createCable(a, b, material, radius = 0.006, sag = 0.08) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, radius, 6, false), material);
  m.name = 'Cable';
  m.userData.noShadow = true;
  return m;
}

export { V };
