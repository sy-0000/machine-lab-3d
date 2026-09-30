// 愛迪生燈泡吊燈：布線、黃銅燈座、梨形玻璃泡、發光鎢絲
import * as THREE from 'three';
import { latheY, mesh } from '../utils/geometry.js';

export function createEdisonBulb(mat) {
  const g = new THREE.Group();
  g.name = 'EdisonBulb';
  const cord = mesh(new THREE.CylinderGeometry(0.006, 0.006, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 }));
  cord.position.y = 1.3;
  g.add(cord);
  const socket = latheY([[0, 0], [0.03, 0], [0.034, 0.02], [0.034, 0.1], [0.02, 0.12], [0.008, 0.14], [0, 0.14]], mat.brass, 32);
  socket.position.y = 0.02;
  g.add(socket);
  for (let i = 0; i < 3; i++) {
    const r = mesh(new THREE.TorusGeometry(0.035, 0.003, 6, 32), mat.brassPolished);
    r.rotation.x = Math.PI / 2; r.position.y = 0.05 + i * 0.022;
    g.add(r);
  }
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffd7a0, roughness: 0.05, transparent: true, opacity: 0.22, emissive: 0xff9a40, emissiveIntensity: 0.25, depthWrite: false });
  const glass = latheY([[0.02, 0.02], [0.045, -0.02], [0.07, -0.09], [0.075, -0.16], [0.06, -0.23], [0.03, -0.27], [0.0, -0.28]], glassMat, 48);
  glass.castShadow = false;
  g.add(glass);
  // 鎢絲：鋸齒狀籠形
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = 0.028 + (i % 2 ? 0.006 : 0);
    pts.push(new THREE.Vector3(Math.cos(a) * r, -0.12 + Math.sin(a * 4) * 0.035, Math.sin(a) * r));
  }
  const filamentMat = new THREE.MeshStandardMaterial({ color: 0x331500, emissive: 0xffa040, emissiveIntensity: 6, toneMapped: true });
  const filament = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.0018, 5, true), filamentMat);
  g.add(filament);
  const stem = mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xffeedd, transparent: true, opacity: 0.4 }));
  stem.position.y = -0.04;
  g.add(stem);
  g.userData = { filamentMat, glassMat, lightLocal: new THREE.Vector3(0, -0.13, 0) };
  return g;
}
