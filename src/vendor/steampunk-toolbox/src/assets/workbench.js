// 工作台：厚實舊木桌面（刀痕、燒痕、油漬）、粗腳與橫檔、前緣鐵片包邊
import * as THREE from 'three';
import { workbenchCanvases, toTexture } from '../materials/textures.js';
import { mesh } from '../utils/geometry.js';

export function createWorkbench(mat, quality) {
  const g = new THREE.Group();
  g.name = 'Workbench';
  const S = Math.min(quality.textureSize, 1024);
  const { color, rough } = workbenchCanvases(S);
  const topMat = new THREE.MeshStandardMaterial({
    map: toTexture(color, { srgb: true, repeat: [2, 1.4] }), roughnessMap: toTexture(rough, { repeat: [2, 1.4] }), roughness: 1, metalness: 0,
    bumpMap: toTexture(rough, { repeat: [2, 1.4] }), bumpScale: 0.6,
  });
  const W = 3.6, D = 2.2, T = 0.12;
  const top = mesh(new THREE.BoxGeometry(W, T, D), topMat);
  top.position.y = -T / 2;
  top.name = 'Workbench_Top';
  g.add(top);

  const legMat = mat.woodDark;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), legMat);
    leg.position.set(sx * (W / 2 - 0.18), -T - 0.55, sz * (D / 2 - 0.18));
    g.add(leg);
  }
  for (const sz of [-1, 1]) {
    const apron = mesh(new THREE.BoxGeometry(W - 0.3, 0.16, 0.05), legMat);
    apron.position.set(0, -T - 0.08, sz * (D / 2 - 0.16));
    g.add(apron);
    const rail = mesh(new THREE.BoxGeometry(W - 0.3, 0.08, 0.06), legMat);
    rail.position.set(0, -0.95, sz * (D / 2 - 0.18));
    g.add(rail);
  }
  // 前緣鐵片包邊與鉚釘
  const edge = mesh(new THREE.BoxGeometry(W + 0.01, T * 0.55, 0.008), mat.castIron);
  edge.position.set(0, -T / 2, D / 2 + 0.004);
  g.add(edge);
  const rivGeo = new THREE.SphereGeometry(0.008, 10, 6);
  const rivets = new THREE.InstancedMesh(rivGeo, mat.brassDark, 18);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    m4.makeTranslation(-W / 2 + 0.1 + i * ((W - 0.2) / 17), -T / 2, D / 2 + 0.009);
    rivets.setMatrixAt(i, m4);
  }
  g.add(rivets);
  return g;
}
