// Spur-gear geometry and meshing maths.
// Tooth k is centred on angle k·2π/z in the gear's local XY plane; the gear turns about +Z.
import * as THREE from 'three';

const cache = new Map();

export function pitchRadius(teeth, module) {
  return (module * teeth) / 2;
}

export function createGearGeometry({ teeth, module: m, thickness = 0.03, bore = 0, spokes = 0, rimWidth = null, hubRadius = null, bevel = null }) {
  const key = JSON.stringify(arguments[0]);
  if (cache.has(key)) return cache.get(key);

  const rp = pitchRadius(teeth, m);
  const ra = rp + m;
  const rd = rp - 1.25 * m;
  const step = (Math.PI * 2) / teeth;
  const shape = new THREE.Shape();
  const profile = [
    [-0.5, rd],
    [-0.3, rd],
    [-0.24, rp],
    [-0.15, ra],
    [0.15, ra],
    [0.24, rp],
    [0.3, rd],
  ];
  let first = true;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [f, r] of profile) {
      const ang = a + f * step;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();

  if (bore > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, bore, 0, Math.PI * 2, true);
    shape.holes.push(h);
  }

  const rimIn = rd - (rimWidth ?? Math.max(m * 1.6, rp * 0.14));
  const hubR = hubRadius ?? Math.max(bore * 1.8, rp * 0.24);
  if (spokes > 0 && rimIn - hubR > m * 2) {
    const spokeW = Math.max(m * 1.4, rp * 0.12);
    for (let j = 0; j < spokes; j++) {
      const a0 = (j / spokes) * Math.PI * 2 + step / 2;
      const a1 = ((j + 1) / spokes) * Math.PI * 2 + step / 2;
      const ho = spokeW / 2 / rimIn;
      const hi = spokeW / 2 / hubR;
      if (a1 - a0 - 2 * hi < 0.15) continue;
      const w = new THREE.Path();
      w.moveTo(Math.cos(a0 + ho) * rimIn, Math.sin(a0 + ho) * rimIn);
      w.absarc(0, 0, rimIn, a0 + ho, a1 - ho, false);
      w.lineTo(Math.cos(a1 - hi) * hubR, Math.sin(a1 - hi) * hubR);
      w.absarc(0, 0, hubR, a1 - hi, a0 + hi, true);
      w.closePath();
      shape.holes.push(w);
    }
  }

  // tiny watch / scatter gears skip the bevel and use coarser arcs: they are a few pixels wide
  const tiny = rp < 0.03;
  const b = tiny ? 0 : bevel ?? Math.min(thickness * 0.15, m * 0.2);
  const depth = Math.max(0.0005, thickness - 2 * b);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b * 0.8,
    bevelSegments: 1,
    curveSegments: tiny ? 4 : Math.max(6, Math.min(24, Math.round(rp * 60))),
  });
  geo.translate(0, 0, -depth / 2);
  // ExtrudeGeometry UVs are in metres; scale so metal textures read at a sensible density.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  cache.set(key, geo);
  return geo;
}

// Place `child` in mesh with `parent` along direction `phi` (radians, in the plane).
// Both are plain objects: { teeth, module, x, y, theta0, omega }.
export function meshWith(parent, child, phi) {
  if (parent.module !== child.module) throw new Error('Meshing gears must share a module');
  const d = pitchRadius(parent.teeth, parent.module) + pitchRadius(child.teeth, child.module);
  child.x = parent.x + Math.cos(phi) * d;
  child.y = parent.y + Math.sin(phi) * d;
  child.omega = (-parent.omega * parent.teeth) / child.teeth;
  // When a parent tooth points along phi, a child tooth gap must point back along phi + π.
  child.theta0 = phi + Math.PI - Math.PI / child.teeth - ((parent.theta0 - phi) * parent.teeth) / child.teeth;
  return child;
}

// Coaxial (compound) gear: same shaft, same angular velocity.
export function coaxialWith(parent, child, phase = 0) {
  child.x = parent.x;
  child.y = parent.y;
  child.omega = parent.omega;
  child.theta0 = parent.theta0 + phase;
  return child;
}
