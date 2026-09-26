// Collects rivet / bolt-head placements and emits a single InstancedMesh.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();

const domeCache = new Map();
const hexCache = new Map();

function domeGeometry(radius) {
  if (!domeCache.has(radius)) domeCache.set(radius, new THREE.SphereGeometry(radius, 7, 2, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1));
  return domeCache.get(radius);
}

function hexGeometry(radius) {
  if (!hexCache.has(radius)) {
    const g = new THREE.CylinderGeometry(radius, radius, radius * 0.8, 6);
    g.translate(0, radius * 0.4, 0);
    hexCache.set(radius, g);
  }
  return hexCache.get(radius);
}

export class RivetSet {
  constructor(radius = 0.012, kind = 'dome') {
    this.radius = radius;
    this.kind = kind;
    this.matrices = [];
  }

  add(position, normal, scale = 1) {
    _q.setFromUnitVectors(UP, _n.copy(normal).normalize());
    this.matrices.push(new THREE.Matrix4().compose(position.clone(), _q.clone(), _s.set(scale, scale, scale)));
    return this;
  }

  // Ring around the local Y axis at height y (normals point radially outward).
  ring(radius, y, count, phase = 0, center = new THREE.Vector3()) {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      const n = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      this.add(new THREE.Vector3(center.x + n.x * radius, center.y + y, center.z + n.z * radius), n);
    }
    return this;
  }

  // Ring in a plane facing `normal`, centred at `center` (flanges, door frames).
  circle(center, normal, radius, count, phase = 0) {
    const n = normal.clone().normalize();
    const t = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, t).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      const p = center.clone().addScaledVector(u, Math.cos(a) * radius).addScaledVector(v, Math.sin(a) * radius);
      this.add(p, n);
    }
    return this;
  }

  line(a, b, spacing, normal) {
    const len = a.distanceTo(b);
    const count = Math.max(2, Math.floor(len / spacing) + 1);
    for (let i = 0; i < count; i++) this.add(a.clone().lerp(b, i / (count - 1)), normal);
    return this;
  }

  // Rectangle outline on a plane (normal must be ±X/±Y/±Z aligned).
  rect(center, halfW, halfH, normal, spacing) {
    const n = normal.clone().normalize();
    const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, n).normalize();
    const c = (sx, sy) => center.clone().addScaledVector(right, sx * halfW).addScaledVector(up, sy * halfH);
    this.line(c(-1, -1), c(1, -1), spacing, n);
    this.line(c(-1, 1), c(1, 1), spacing, n);
    this.line(c(-1, -1), c(-1, 1), spacing, n);
    this.line(c(1, -1), c(1, 1), spacing, n);
    return this;
  }

  build(material, name = 'Rivets') {
    if (!this.matrices.length) return null;
    const geo = this.kind === 'hex' ? hexGeometry(this.radius) : domeGeometry(this.radius);
    const mesh = new THREE.InstancedMesh(geo, material, this.matrices.length);
    mesh.name = name;
    this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.noShadow = true;
    return mesh;
  }
}
