// 安全護目鏡 ×2（實驗室型）：一體式弧形透明鏡片、軟質 PVC 密合框、
// 兩側間接通氣孔、鬆緊頭帶與調節扣。收納時鏡片朝上、兩副疊放。
import * as THREE from 'three';
import { mesh } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

const R = 80;          // 鏡片圓柱半徑（mm）
const A = 72 / R;      // 半寬對應角度
const H = 27;          // 半高
const SEG = 96;

// 鏡片輪廓（u: 弧長 mm, v: 高 mm），底部中央有鼻樑缺口
function outlineUV(scaleU = 1, scaleV = 1) {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const t = (i / SEG) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    let u = 72 * Math.sign(c) * Math.pow(Math.abs(c), 2 / 4);
    let v = H * Math.sign(s) * Math.pow(Math.abs(s), 2 / 4);
    if (v < 0) v += 13 * Math.exp(-Math.pow(u / 16, 2)); // 鼻樑缺口
    pts.push([u * scaleU, v * scaleV]);
  }
  return pts;
}

// (u, v) → 3D：圓柱面，正面中心在 z = 0，朝 +Z
const front = (u, v, lift = 0) => {
  const a = u / R, r = R + lift;
  return new THREE.Vector3(mm(r * Math.sin(a)), mm(v), mm(r * Math.cos(a) - R));
};

// 由輪廓向中心縮放的環狀網格填滿鏡片
function lensGeometry(rings = 14) {
  const loop = outlineUV();
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const k = i / rings;
    for (const [u, v] of loop) { const p = front(u * k, v * k); pos.push(p.x, p.y, p.z); }
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < SEG; j++) {
    const a = i * SEG + j, b = i * SEG + (j + 1) % SEG, c = (i + 1) * SEG + j, d = (i + 1) * SEG + (j + 1) % SEG;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// 兩圈同點數的 3D 輪廓之間放樣成帶狀曲面
function loft(loopA, loopB) {
  const pos = [], idx = [];
  for (const p of [...loopA, ...loopB]) pos.push(p.x, p.y, p.z);
  const n = loopA.length;
  for (let j = 0; j < n; j++) {
    const a = j, b = (j + 1) % n, c = n + j, d = n + (j + 1) % n;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function goggle(mat) {
  const g = new THREE.Group();
  const lens = new THREE.Mesh(lensGeometry(), mat.goggleLens);
  lens.renderOrder = 3;
  g.add(lens);

  // 軟框：鏡片邊緣壓條 + 向後延伸貼合臉部的裙邊
  const edgeIn = outlineUV(0.94, 0.9).map(([u, v]) => front(u, v, 1.6));
  const edgeOut = outlineUV(1.02, 1.04).map(([u, v]) => front(u, v, 1.6));
  const backLoop = outlineUV(1.08, 1.14).map(([u, v]) => {
    const p = front(u, v, 4);
    p.z -= mm(24 + 6 * Math.abs(u) / 72);
    return p;
  });
  const lip = mesh(loft(edgeIn, edgeOut), mat.goggleFrame);
  const skirt = mesh(loft(edgeOut, backLoop), mat.goggleFrame);
  lip.renderOrder = skirt.renderOrder = 2;
  g.add(lip, skirt);
  // 裙邊後緣加厚的貼臉唇
  const sealCurve = new THREE.CatmullRomCurve3(backLoop, true);
  g.add(mesh(new THREE.TubeGeometry(sealCurve, 160, mm(1.8), 8, true), mat.goggleSeal));

  // 兩側間接通氣孔（各 4 個）
  for (const side of [-1, 1]) {
    for (const v of [-13, -4.5, 4.5, 13]) {
      const u = side * 72 * 1.05;
      const pF = front(u, v * 1.06, 1.6), pB = front(u * 1.03, v * 1.1, 4);
      pB.z -= mm(24 + 6);
      const p = pF.lerp(pB, 0.55);
      const a = u / R;
      const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a) * 0.35).normalize();
      const vent = mesh(new THREE.CylinderGeometry(mm(3.4), mm(3.8), mm(2.2), 20), mat.goggleVent);
      vent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      vent.position.copy(p).addScaledVector(n, mm(0.6));
      g.add(vent);
      const cap = mesh(new THREE.CylinderGeometry(mm(2.2), mm(2.2), mm(0.8), 16), mat.goggleSeal);
      cap.quaternion.copy(vent.quaternion);
      cap.position.copy(vent.position).addScaledVector(n, mm(1.4));
      g.add(cap);
    }
  }

  // 鬆緊頭帶：由兩側扣環貼著框後方收攏（收納狀態）
  const attach = (side) => {
    const p = front(side * 72 * 1.1, 0, 4);
    p.z -= mm(20);
    return p;
  };
  const L = attach(-1), Rt = attach(1);
  const pts = [L, new THREE.Vector3(L.x * 0.8, mm(-4), mm(-40)), new THREE.Vector3(0, mm(-6), mm(-44)), new THREE.Vector3(Rt.x * 0.8, mm(-4), mm(-40)), Rt];
  const curve = new THREE.CatmullRomCurve3(pts);
  const strapPos = [], strapIdx = [];
  const N = 60, w = mm(9);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPoint(t), tan = curve.getTangent(t);
    const side = new THREE.Vector3(0, 1, 0).cross(tan).normalize().cross(tan).normalize(); // 帶面寬度方向 ≈ 垂直
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, s * w); strapPos.push(q.x, q.y, q.z); }
    if (i < N) { const a = i * 2; strapIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.Float32BufferAttribute(strapPos, 3));
  sg.setIndex(strapIdx);
  sg.computeVertexNormals();
  g.add(mesh(sg, mat.goggleStrap));
  // 調節扣
  for (const p of [L, Rt]) {
    const buckle = mesh(new THREE.BoxGeometry(mm(6), mm(22), mm(12)), mat.goggleVent);
    buckle.position.copy(p);
    buckle.rotation.y = Math.sign(p.x) * 0.6;
    g.add(buckle);
  }

  g.rotation.x = -Math.PI / 2; // 鏡片朝上收納
  return g;
}

export function createSafetyGlasses(mat, config = {}) {
  const g = new THREE.Group();
  g.name = 'LabGogglesPair';
  const n = config.count || 2;
  for (let i = 0; i < n; i++) {
    const one = goggle(mat);
    one.position.y = mm(i * 18);
    one.position.z = mm(i * 4);
    g.add(one);
  }
  return g;
}
