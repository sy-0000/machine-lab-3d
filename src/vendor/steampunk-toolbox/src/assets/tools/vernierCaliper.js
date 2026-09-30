// 150mm 游標卡尺（實尺寸建模）：主尺、外測爪、內測爪、游標框（含觀測窗）、游標刻度 0.02mm、
// 黃銅滾輪、鎖定螺絲、深度桿。讀數停在 37.40 mm。
import * as THREE from 'three';
import { extrudeFlat, flutedCylinderX, mesh } from '../../utils/geometry.js';
import { MM, mm } from '../../utils/units.js';
import { etchedScale, scaleDecal } from '../../materials/scaleTextures.js';

const shape = (pts) => {
  const s = new THREE.Shape();
  s.moveTo(mm(pts[0][0]), mm(pts[0][1]));
  for (let i = 1; i < pts.length; i++) s.lineTo(mm(pts[i][0]), mm(pts[i][1]));
  s.closePath();
  return s;
};

export function createVernierCaliper(mat) {
  const g = new THREE.Group();
  g.name = 'VernierCaliper150';
  const beamT = 3, reading = 37.4;

  // 主尺 + 固定外測爪（向下）+ 固定內測爪（向上）
  const beam = shape([[-14, -4], [-14, 16], [-9, 28], [-3, 28], [0, 16], [212, 16], [212, 0], [0, 0], [0, -38], [-3, -42], [-10, -42], [-14, -30]]);
  g.add(extrudeFlat(beam, mm(beamT), mat.satinSteel, mm(0.4)));

  // 主尺刻度：零點在 x=14 mm（游標零線閉合時對齊）
  const mainTex = etchedScale({
    spanMm: 156, heightMm: 8, pxPerMm: 24,
    marks: [{ from: 3, count: 150, stepMm: 1, edge: 'bottom', long: 10, mid: 5, lenLong: 5, lenMid: 3.8, lenShort: 2.6, labelEvery: 10, label: (i) => String(i / 10), fontMm: 2.6 }],
  });
  const main = scaleDecal(mainTex, mm(156), mm(8));
  main.position.set(mm(11 + 78), mm(beamT + 0.85), -mm(12));
  g.add(main);

  // 游標框：包覆主尺，中間開觀測窗
  const slider = new THREE.Group();
  slider.position.x = mm(reading);
  const frame = shape([[0, -4], [0, -38], [3, -42], [10, -42], [12, -4], [66, -4], [72, 6], [66, 20], [12, 20], [8, 28], [2, 28], [0, 20]]);
  const win = new THREE.Path();
  win.moveTo(mm(13), mm(6.5)); win.lineTo(mm(64), mm(6.5)); win.lineTo(mm(64), mm(16.5)); win.lineTo(mm(13), mm(16.5)); win.closePath();
  frame.holes.push(win);
  const f = extrudeFlat(frame, mm(7), mat.steel, mm(0.5));
  f.position.y = -mm(2);
  slider.add(f);
  // 游標刻度：50 格涵蓋 49 mm
  const vTex = etchedScale({
    spanMm: 54, heightMm: 5, pxPerMm: 40,
    marks: [{ from: 2, count: 50, stepMm: 0.98, edge: 'top', long: 5, lenLong: 3, lenShort: 1.9, labelEvery: 5, label: (i) => String(i / 5), fontMm: 1.5 }],
  });
  const vDecal = scaleDecal(vTex, mm(54), mm(5));
  vDecal.position.set(mm(12 + 27), mm(6.05), -mm(3.8));
  slider.add(vDecal);
  // 鎖定螺絲（黃銅，朝上緣伸出）
  const screw = flutedCylinderX(mm(4), mm(6), 18, 0.15, mat.knurlBrass);
  screw.rotation.y = Math.PI / 2;
  screw.position.set(mm(40), mm(1.5), -mm(24));
  slider.add(screw);
  const stem = mesh(new THREE.CylinderGeometry(mm(1.6), mm(1.6), mm(5), 12), mat.brass);
  stem.rotation.x = Math.PI / 2;
  stem.position.set(mm(40), mm(1.5), -mm(20.5));
  slider.add(stem);
  // 黃銅滾輪（下緣）
  const wheel = flutedCylinderX(mm(5.5), mm(4), 24, 0.18, mat.knurlBrass);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(mm(52), mm(1.5), mm(8));
  slider.add(wheel);
  g.add(slider);

  // 深度桿（由尾端伸出，長度等於讀數）
  const depth = mesh(new THREE.BoxGeometry(mm(reading), mm(1.2), mm(3)), mat.satinSteel);
  depth.position.set(mm(212 + reading / 2), mm(1.5), -mm(8));
  g.add(depth);
  g.userData.mm = MM;
  return g;
}
