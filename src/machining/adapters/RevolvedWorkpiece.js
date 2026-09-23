import { Group, Mesh, MeshStandardMaterial, LatheGeometry, Vector2 } from 'three';
import { WorkpieceBase } from '../../workpieces/WorkpieceBase.js';
import { cloneWorkpieceState } from '../WorkpieceState.js';

// All profile construction uses mm; the supplied adapter conversion is the only unit boundary.
export function profileGeometry(state, mmToWorld) {
  const { radiusMm, resolutionMm } = state.profile;
  const points = [new Vector2(0, 0)];
  radiusMm.forEach((radius, i) => {
    if (i === 0 || radius !== radiusMm[i - 1]) points.push(new Vector2(radius, i * resolutionMm));
    if (i === radiusMm.length - 1 || radius !== radiusMm[i + 1]) {
      points.push(new Vector2(radius, Math.min((i + 1) * resolutionMm, state.actualLengthMm)));
    }
  });
  points.push(new Vector2(0, state.actualLengthMm));
  const geometry = new LatheGeometry(points, 48);
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
      new MeshStandardMaterial({ color: '#94a3b8', metalness: 0.85, roughness: 0.35 }));
    mesh.name = 'RevolvedProfile'; mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    super({ id: snapshot.id, name: '槌柄工件（可切削）', type: 'cylinder', dimensions: {}, object3D: group });
    this.mesh = mesh; this.mmToWorld = mmToWorld; this.#state = snapshot; this.#dimensions();
  }
  #dimensions() {
    this.dimensions = { radius: this.mmToWorld(Math.max(...this.#state.profile.radiusMm)),
      lengthMeters: this.mmToWorld(this.#state.actualLengthMm) };
  }
  exportState() { return cloneWorkpieceState(this.#state); }
  cut(simulate) {
    const next = simulate(this.#state);
    if (next === this.#state) return false;
    const geometry = profileGeometry(next, this.mmToWorld);
    this.mesh.geometry.dispose(); this.mesh.geometry = geometry;
    this.#state = next; this.#dimensions(); return true;
  }
}
