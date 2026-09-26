// Grey-green stand-ins for a lathe, a drill press and a milling machine (real proportions, metres),
// only to preview the machine slot before your own models are loaded.
import * as THREE from 'three';

const paint = new THREE.MeshStandardMaterial({ name: 'MachinePaint', color: 0x4f6a5a, roughness: 0.55, metalness: 0.3 });
const steel = new THREE.MeshStandardMaterial({ name: 'MachineSteel', color: 0xb8b8bc, roughness: 0.3, metalness: 1 });
const dark = new THREE.MeshStandardMaterial({ name: 'MachineDark', color: 0x222222, roughness: 0.6, metalness: 0.5 });

function part(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}

export function placeholderLathe() {
  const g = new THREE.Group();
  g.name = 'PlaceholderLathe';
  for (const x of [-0.9, 0.9]) part(g, new THREE.BoxGeometry(0.35, 0.8, 0.45), paint, x, 0.4, 0);
  part(g, new THREE.BoxGeometry(2.4, 0.18, 0.4), paint, 0, 0.89, 0);
  part(g, new THREE.BoxGeometry(0.5, 0.45, 0.45), paint, -0.95, 1.2, 0);
  part(g, new THREE.CylinderGeometry(0.11, 0.11, 0.1, 24), steel, -0.65, 1.15, 0, 0, 0, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.28, 0.2, 0.35), paint, 0.1, 1.08, 0);
  part(g, new THREE.BoxGeometry(0.3, 0.3, 0.3), paint, 0.95, 1.13, 0);
  part(g, new THREE.CylinderGeometry(0.02, 0.02, 2.2, 8), steel, 0, 0.82, 0.22, 0, 0, Math.PI / 2);
  return g;
}

export function placeholderDrillPress() {
  const g = new THREE.Group();
  g.name = 'PlaceholderDrillPress';
  part(g, new THREE.BoxGeometry(0.55, 0.08, 0.7), dark, 0, 0.04, 0);
  part(g, new THREE.CylinderGeometry(0.05, 0.05, 1.7, 16), steel, 0, 0.9, -0.2);
  part(g, new THREE.BoxGeometry(0.4, 0.04, 0.4), paint, 0, 0.8, 0.05);
  part(g, new THREE.BoxGeometry(0.3, 0.35, 0.55), paint, 0, 1.6, -0.05);
  part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.25, 12), steel, 0, 1.3, 0.1);
  for (let i = 0; i < 3; i++) part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), steel, 0.2, 1.5, 0.1, (i / 3) * Math.PI * 2, 0, Math.PI / 2);
  return g;
}

export function placeholderMill() {
  const g = new THREE.Group();
  g.name = 'PlaceholderMill';
  part(g, new THREE.BoxGeometry(0.7, 1.2, 0.7), paint, 0, 0.6, -0.2);
  part(g, new THREE.BoxGeometry(0.55, 0.9, 0.55), paint, 0, 1.65, -0.25);
  part(g, new THREE.BoxGeometry(1.3, 0.1, 0.35), steel, 0, 1.05, 0.3);
  part(g, new THREE.BoxGeometry(0.5, 0.2, 0.4), paint, 0, 0.9, 0.3);
  part(g, new THREE.CylinderGeometry(0.06, 0.04, 0.3, 16), steel, 0, 1.38, 0.1);
  return g;
}
