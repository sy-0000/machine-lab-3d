import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const AXIS_Y = new THREE.Vector3(0, 1, 0);
export const AXIS_Z = new THREE.Vector3(0, 0, 1);
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Add a mesh to `parent` with position / euler rotation in one call.
export function add(parent, geometry, material, name, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new THREE.Mesh(geometry, material);
  if (name) m.name = name;
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (s) (typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(s[0], s[1], s[2]));
  parent.add(m);
  return m;
}

export function group(name, parent = null, p = [0, 0, 0], r = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(p[0], p[1], p[2]);
  g.rotation.set(r[0], r[1], r[2]);
  if (parent) parent.add(g);
  return g;
}

// Lathe from [radius, y] pairs. Faces point away from the axis (increasing-y order) unless `inward`.
export function lathe(profile, segments = 24, phiStart = 0, phiLength = Math.PI * 2, inward = false) {
  let pts = profile;
  const ascending = pts[pts.length - 1][1] >= pts[0][1];
  if (ascending === inward) pts = [...pts].reverse();
  return new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    segments,
    phiStart,
    phiLength,
  );
}

// Matrix that maps a unit-length, Y-aligned primitive centred at the origin onto the segment a→b.
// Local Z is aligned (as closely as possible) to `hint`.
export function segmentMatrix(a, b, hint = AXIS_Z) {
  const y = new THREE.Vector3().subVectors(b, a);
  const len = y.length();
  y.divideScalar(len || 1);
  const z = hint.clone().addScaledVector(y, -hint.dot(y));
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x);
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(y, -y.z);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.scale(new THREE.Vector3(1, len, 1));
  m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
  return m;
}

export function cylinderBetween(a, b, radius, material, radial = 12, name = '') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, radial), material);
  m.name = name;
  m.applyMatrix4(segmentMatrix(a, b));
  return m;
}

export function boxBetween(a, b, w, d, material, hint = AXIS_Z, name = '') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), material);
  m.name = name;
  m.applyMatrix4(segmentMatrix(a, b, hint));
  return m;
}

// Re-map BoxGeometry UVs to metres (1 UV unit = `scale` m) with v running along each face's longer
// side, so wood grain follows the length of boards and tiling textures keep a constant density.
export function metricBoxUV(geometry, scale = 1) {
  if (geometry.userData.metricUV || geometry.type !== 'BoxGeometry') return geometry;
  const { width: w, height: h, depth: d } = geometry.parameters;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geometry.attributes.uv;
  const perFace = uv.count / 6;
  for (let f = 0; f < 6; f++) {
    const [a, b] = dims[f];
    for (let i = 0; i < perFace; i++) {
      const k = f * perFace + i;
      const u = uv.getX(k);
      const v = uv.getY(k);
      if (a > b) uv.setXY(k, (v * b) / scale + f * 0.31, (u * a) / scale);
      else uv.setXY(k, (u * a) / scale + f * 0.31, (v * b) / scale);
    }
  }
  uv.needsUpdate = true;
  geometry.userData.metricUV = true;
  return geometry;
}

// Scale a geometry's UVs so shared tiling textures keep a sensible texel density on large parts.
export function scaleUV(geometry, su, sv = su) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geometry;
}

export function compose(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Matrix4();
  const sc = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(s[0], s[1], s[2]);
  m.compose(new THREE.Vector3(p[0], p[1], p[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])), sc);
  return m;
}

// Merge geometries with compatible attributes (position / normal / uv, optionally color).
export function mergeGeos(list, keepColor = false) {
  const names = keepColor ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
  const allIndexed = list.every((g) => g.index);
  const prepared = list.map((g) => {
    let geo = allIndexed ? g : g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (keepColor && !geo.attributes.color) {
      const c = new Float32Array(geo.attributes.position.count * 3).fill(1);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    }
    for (const key of Object.keys(geo.attributes)) if (!names.includes(key)) geo.deleteAttribute(key);
    geo.morphAttributes = {};
    return geo;
  });
  const merged = mergeGeometries(prepared, false);
  merged.computeBoundingSphere();
  return merged;
}

// Accumulates transformed geometries and emits one merged mesh (one draw call).
export class GeoBatch {
  constructor(keepColor = false) {
    this.parts = [];
    this.keepColor = keepColor;
  }

  addRaw(geometry, matrix = null, color = null) {
    const g = geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (color && this.keepColor) {
      const c = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < c.length; i += 3) {
        c[i] = color.r;
        c[i + 1] = color.g;
        c[i + 2] = color.b;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    }
    this.parts.push(g);
    return this;
  }

  box(w, h, d, p, r = [0, 0, 0], color = null) {
    return this.add(metricBoxUV(new THREE.BoxGeometry(w, h, d)), compose(p, r), color);
  }

  add(geometry, matrix = null, color = null) {
    return this.addRaw(metricBoxUV(geometry), matrix, color);
  }

  segment(geometry, a, b, hint = AXIS_Z) {
    return this.add(geometry, segmentMatrix(a, b, hint));
  }

  get empty() {
    return this.parts.length === 0;
  }

  build(material, name) {
    if (!this.parts.length) return null;
    const m = new THREE.Mesh(mergeGeos(this.parts, this.keepColor), material);
    m.name = name;
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return m;
  }
}

// Smooth tube through points (Catmull-Rom).
export function tubeThrough(points, radius, material, segments = 32, radial = 8, name = '') {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V(...p))), false, 'centripetal');
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, false), material);
  m.name = name;
  return m;
}

// Helix curve along +Y (springs, filaments, coils).
export class HelixCurve extends THREE.Curve {
  constructor(radius, height, turns) {
    super();
    this.radius = radius;
    this.height = height;
    this.turns = turns;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.radius, t * this.height - this.height / 2, Math.sin(a) * this.radius);
  }
}
