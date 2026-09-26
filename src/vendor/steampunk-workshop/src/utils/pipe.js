// Pipe runs through a polyline with rounded bends, fitting collars and flanged joints.
import * as THREE from 'three';
import { GeoBatch, mergeGeos, segmentMatrix } from './geometry.js';

export function createPipe(points, opts = {}) {
  const {
    radius = 0.05,
    material,
    fittingMaterial = material,
    bend = radius * 3.2,
    radial = 14,
    fittings = true,
    flangeEvery = 2.4,
    name = 'Pipe',
  } = opts;

  const P = points.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2])));
  const tubes = [];
  const fit = new GeoBatch();
  const collarGeo = new THREE.CylinderGeometry(radius * 1.28, radius * 1.28, 1, radial);
  const flangeGeo = new THREE.CylinderGeometry(radius * 2.0, radius * 2.0, 1, radial + 4);

  const collar = (pos, dir, len, geo = collarGeo) => {
    const a = pos.clone().addScaledVector(dir, -len / 2);
    const b = pos.clone().addScaledVector(dir, len / 2);
    fit.segment(geo, a, b);
  };

  const straight = (a, b) => {
    tubes.push(new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 1, radius, radial, false));
    const len = a.distanceTo(b);
    if (fittings && len > flangeEvery) {
      const dir = b.clone().sub(a).normalize();
      const n = Math.floor(len / flangeEvery);
      for (let i = 1; i <= n; i++) {
        const c = a.clone().lerp(b, i / (n + 1));
        collar(c.clone().addScaledVector(dir, -0.016), dir, 0.026, flangeGeo);
        collar(c.clone().addScaledVector(dir, 0.016), dir, 0.026, flangeGeo);
      }
    }
  };

  let start = P[0];
  for (let i = 1; i < P.length - 1; i++) {
    const p = P[i];
    const dIn = p.clone().sub(P[i - 1]);
    const dOut = P[i + 1].clone().sub(p);
    const r = Math.min(bend, dIn.length() * 0.45, dOut.length() * 0.45);
    dIn.normalize();
    dOut.normalize();
    const a = p.clone().addScaledVector(dIn, -r);
    const b = p.clone().addScaledVector(dOut, r);
    straight(start, a);
    tubes.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, p, b), 10, radius, radial, false));
    if (fittings) {
      collar(a.clone().addScaledVector(dIn, -radius * 0.4), dIn, radius * 0.9);
      collar(b.clone().addScaledVector(dOut, radius * 0.4), dOut, radius * 0.9);
    }
    start = b;
  }
  straight(start, P[P.length - 1]);

  const d0 = P[1].clone().sub(P[0]).normalize();
  const dn = P[P.length - 1].clone().sub(P[P.length - 2]).normalize();
  collar(P[0].clone().addScaledVector(d0, radius * 0.5), d0, radius);
  collar(P[P.length - 1].clone().addScaledVector(dn, -radius * 0.5), dn, radius);

  const root = new THREE.Group();
  root.name = name;
  const tube = new THREE.Mesh(mergeGeos(tubes), material);
  tube.name = `${name}_Tube`;
  root.add(tube);
  const fitMesh = fit.build(fittingMaterial, `${name}_Fittings`);
  if (fitMesh) root.add(fitMesh);
  tubes.forEach((t) => t.dispose());
  return { object: root, points: P };
}

// Point and direction at a fraction along the straight segment i of a pipe polyline.
export function pointOnSegment(points, i, t) {
  const a = points[i];
  const b = points[i + 1];
  return { position: a.clone().lerp(b, t), direction: b.clone().sub(a).normalize() };
}

// Short straight stub between two points (nipples, stems).
export function stub(a, b, radius, material, radial = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, radial), material);
  m.applyMatrix4(segmentMatrix(a, b));
  return m;
}
