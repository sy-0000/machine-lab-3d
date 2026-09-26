// Rolling library ladder: a brass rail on standoff brackets across the bookcase front and an oak
// ladder hooked over it, running on floor wheels. Every so often it glides to a new bay.
import * as THREE from 'three';
import { add, group, V, GeoBatch } from '../utils/geometry.js';

export function createLibraryLadder(M, { railLength = 4.8, railY = 4.45, railZ = 0.67, footZ = 1.6, stops = [-1.55, 0.05, 1.5], caseFront = 0.5 } = {}) {
  const root = group('LibraryLadder');

  // rail + brackets (static)
  add(root, new THREE.CylinderGeometry(0.02, 0.02, railLength, 16), M.brassPolished, 'Rail', [0, railY, railZ], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) add(root, new THREE.SphereGeometry(0.032, 14, 10), M.brassPolished, 'RailFinial', [s * (railLength / 2 + 0.02), railY, railZ]);
  const brackets = new GeoBatch();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = -railLength / 2 + 0.15 + (i * (railLength - 0.3)) / (n - 1);
    brackets.segment(new THREE.CylinderGeometry(0.012, 0.012, 1, 10), V(x, railY, caseFront), V(x, railY, railZ));
    brackets.add(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 16).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(x, railY, caseFront + 0.006));
  }
  root.add(brackets.build(M.brassAged, 'RailBrackets'));

  // ladder (moves along X)
  const ladder = group('Ladder', root, [stops[0], 0, 0]);
  ladder.userData.dynamic = true;
  const top = V(0, railY - 0.04, railZ + 0.03);
  const foot = V(0, 0.07, footZ);
  const halfW = 0.24;
  const stiles = new GeoBatch();
  for (const s of [-1, 1]) {
    stiles.segment(new THREE.BoxGeometry(0.05, 1, 0.085), foot.clone().setX(s * halfW), top.clone().setX(s * halfW), V(0, 0, 1));
  }
  const rungs = new GeoBatch();
  const len = foot.distanceTo(top);
  const count = Math.floor(len / 0.3);
  for (let i = 1; i <= count; i++) {
    const p = foot.clone().lerp(top, i / (count + 1));
    rungs.segment(new THREE.CylinderGeometry(0.018, 0.018, 1, 10), p.clone().setX(-halfW), p.clone().setX(halfW));
  }
  ladder.add(stiles.build(M.woodWorn, 'Stiles'));
  ladder.add(rungs.build(M.woodHandle, 'Rungs'));
  for (const s of [-1, 1]) {
    add(ladder, new THREE.TorusGeometry(0.035, 0.009, 8, 16, Math.PI * 1.3), M.brassPolished, 'RailHook', [s * halfW, railY + 0.005, railZ - 0.005], [0, Math.PI / 2, Math.PI * 0.95]);
    add(ladder, new THREE.BoxGeometry(0.03, 0.12, 0.03), M.brassAged, 'HookPlate', [s * halfW, railY - 0.05, railZ + 0.035]);
    add(ladder, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 18), M.castIron, 'Wheel', [s * halfW, 0.045, footZ + 0.02], [0, 0, Math.PI / 2]);
    add(ladder, new THREE.BoxGeometry(0.02, 0.07, 0.07), M.brassAged, 'WheelFork', [s * (halfW - 0.025), 0.07, footZ + 0.02]);
  }

  // glide between stops: hold ~22 s, travel ~6 s with ease in/out
  const hold = 22;
  const travel = 6;
  const cycle = hold + travel;
  const update = (dt, t) => {
    const k = Math.floor(t / cycle);
    const f = t - k * cycle;
    const a = stops[k % stops.length];
    const b = stops[(k + 1) % stops.length];
    const u = f < hold ? 0 : (f - hold) / travel;
    const e = u * u * (3 - 2 * u);
    ladder.position.x = a + (b - a) * e;
  };

  return { object: root, update };
}
