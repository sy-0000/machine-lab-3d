// 150mm 鋼尺：170 × 20 × 0.8 mm 不鏽鋼，正面上緣公制（1mm / 0.5mm）、下緣英制（1/16"），尾端吊孔
import * as THREE from 'three';
import { extrudeFlat, roundedRectShape, circlePath } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';
import { etchedScale, scaleDecal } from '../../materials/scaleTextures.js';

export function createSteelRuler(mat) {
  const g = new THREE.Group();
  g.name = 'SteelRuler150';
  const L = 170, W = 20, T = 0.9;
  const s = roundedRectShape(mm(L), mm(W), mm(1.2), mm(L / 2), 0);
  s.holes.push(circlePath(mm(L - 7), 0, mm(2.6)));
  g.add(extrudeFlat(s, mm(T), mat.satinSteel, mm(0.15)));

  const tex = etchedScale({
    spanMm: 158, heightMm: W, pxPerMm: 24,
    marks: [
      { from: 4, count: 300, stepMm: 0.5, edge: 'top', long: 20, mid: 10, lenLong: 5.2, lenMid: 3.8, lenShort: 1.6, labelEvery: 20, label: (i) => (i === 0 ? null : String(i / 2)), fontMm: 2.4, labelOffsetMm: 0 },
      { from: 4, count: 95, stepMm: 25.4 / 16, edge: 'bottom', long: 16, mid: 8, lenLong: 4.6, lenMid: 3.2, lenShort: 1.8, labelEvery: 16, label: (i) => (i === 0 ? null : String(i / 16)), fontMm: 2.4 },
    ],
    texts: [{ text: 'STAINLESS  ·  150 mm', xMm: 80, yMm: 10, sizeMm: 1.9 }],
  });
  const d = scaleDecal(tex, mm(158), mm(W));
  d.position.set(mm(79), mm(T + 0.36), 0);
  g.add(d);
  return g;
}
