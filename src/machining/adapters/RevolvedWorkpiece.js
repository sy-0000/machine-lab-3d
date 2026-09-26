import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector2 } from 'three';
import { WorkpieceBase } from '../../workpieces/WorkpieceBase.js';
import { cloneWorkpieceState } from '../WorkpieceState.js';

// All profile construction uses mm; the supplied adapter conversion is the only unit boundary.
const SEGMENTS = 96;
// A faint layout line plus a slight tint drift around the bar, so the stock visibly turns with the chuck.
const shade = theta => 1 - 0.4 * Math.exp(-((Math.atan2(Math.sin(theta), Math.cos(theta)) / 0.12) ** 2)) - 0.05 * (1 + Math.sin(3 * theta)) / 2;
function profilePoints(state) {
  const { radiusMm, resolutionMm } = state.profile;
  const points = [new Vector2(0, 0)];
  radiusMm.forEach((radius, i) => {
    if (i === 0 || radius !== radiusMm[i - 1]) points.push(new Vector2(radius, i * resolutionMm));
    if (i === radiusMm.length - 1 || radius !== radiusMm[i + 1]) {
      points.push(new Vector2(radius, Math.min((i + 1) * resolutionMm, state.lengthMm)));
    }
  });
  points.push(new Vector2(0, state.lengthMm));
  return points;
}
export function profileGeometry(state, mmToWorld) {
  const points = profilePoints(state), position = [], normal = [], color = [], uv = [], index = [];
  // Every profile segment (end face, shoulder, cylinder, taper) is its own strip with its own normals,
  // so the edges between them stay crisp instead of being smoothed together.
  for (let s = 0; s < points.length - 1; s++) {
    const a = points[s], b = points[s + 1], dr = b.x - a.x, dz = b.y - a.y, length = Math.hypot(dr, dz);
    if (length === 0) continue;
    const nr = dz / length, nz = -dr / length, base = position.length / 3;
    for (let j = 0; j <= SEGMENTS; j++) {
      const theta = j / SEGMENTS * Math.PI * 2, sin = Math.sin(theta), cos = Math.cos(theta), c = shade(theta);
      for (const [p, t] of [[a, 0], [b, 1]]) {
        position.push(p.x * sin, p.y, p.x * cos); normal.push(nr * sin, nz, nr * cos); color.push(c, c, c); uv.push(j / SEGMENTS, t);
      }
    }
    for (let j = 0; j < SEGMENTS; j++) {
      const i0 = base + j * 2, i1 = i0 + 1, i2 = i0 + 2, i3 = i0 + 3;
      index.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(color, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  // Teaching Z is the lathe's existing local +X spindle axis, starting at the chuck face.
  geometry.rotateZ(-Math.PI / 2);
  const scale = mmToWorld(1); geometry.scale(scale, scale, scale);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
export class RevolvedWorkpiece extends WorkpieceBase {
  #state;
  constructor(state, mmToWorld) {
    const snapshot = cloneWorkpieceState(state), group = new Group();
    const mesh = new Mesh(profileGeometry(snapshot, mmToWorld),
      new MeshStandardMaterial({ color: '#94a3b8', metalness: 0.85, roughness: 0.35, vertexColors: true }));
    mesh.name = 'RevolvedProfile'; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    super({ id: snapshot.id, name: '槌柄工件（可切削）', type: 'cylinder', dimensions: {}, object3D: group });
    this.mesh = mesh; this.mmToWorld = mmToWorld; this.#state = snapshot; this.#dimensions();
  }
  #dimensions() {
    this.dimensions = { radius: this.mmToWorld(Math.max(...this.#state.profile.radiusMm)),
      lengthMeters: this.mmToWorld(this.#state.lengthMm) };
  }
  inspect(read) { return read(this.#state); }
  exportState() { return cloneWorkpieceState(this.#state); }
  cut(simulate) {
    const next = simulate(this.#state);
    if (next === this.#state) return false;
    const geometry = profileGeometry(next, this.mmToWorld);
    this.mesh.geometry.dispose(); this.mesh.geometry = geometry;
    this.#state = next; this.#dimensions(); return true;
  }
}
