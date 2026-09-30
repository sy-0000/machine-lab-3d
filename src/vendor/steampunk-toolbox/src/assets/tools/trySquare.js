// 直角規（100 mm）：淬火鋼規片（附刻度）以黃銅鉚釘固定於黃銅規座，內角有清角孔
import * as THREE from 'three';
import { extrudeFlat, mesh, circlePath } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';
import { etchedScale, scaleDecal } from '../../materials/scaleTextures.js';

export function createTrySquare(mat) {
  const g = new THREE.Group();
  g.name = 'TrySquare100';
  const stockT = 10, bladeT = 2.5;
  // 規座（黃銅），內角清角孔
  const stock = new THREE.Shape();
  stock.moveTo(mm(-20), mm(0)); stock.lineTo(mm(0), mm(0)); stock.lineTo(mm(0), mm(48));
  stock.lineTo(mm(-20), mm(48)); stock.closePath();
  const st = extrudeFlat(stock, mm(stockT), mat.brass, mm(0.6));
  g.add(st);
  // 規座上段（夾住規片的部分）
  const upper = new THREE.Shape();
  upper.moveTo(mm(-20), mm(48)); upper.lineTo(mm(0), mm(48)); upper.lineTo(mm(0), mm(72)); upper.lineTo(mm(-20), mm(72)); upper.closePath();
  upper.holes.push(circlePath(mm(-10), mm(56), mm(0.01)));
  const up = extrudeFlat(upper, mm(stockT), mat.brass, mm(0.6));
  g.add(up);
  // 規片（鋼）：由規座內伸出 100 mm
  const blade = new THREE.Shape();
  blade.moveTo(mm(-16), mm(52)); blade.lineTo(mm(100), mm(52)); blade.lineTo(mm(100), mm(72)); blade.lineTo(mm(-16), mm(72)); blade.closePath();
  const bl = extrudeFlat(blade, mm(bladeT), mat.satinSteel, mm(0.2));
  bl.position.y = mm((stockT - bladeT) / 2);
  g.add(bl);
  // 清角孔（深色圓）
  const relief = mesh(new THREE.CylinderGeometry(mm(1.8), mm(1.8), mm(stockT + 1.4), 16), mat.blackPaint);
  relief.position.set(mm(0.4), mm(stockT / 2 + 0.6), -mm(52));
  g.add(relief);
  // 黃銅鉚釘
  for (const x of [-14, -6]) {
    const r = mesh(new THREE.CylinderGeometry(mm(2.4), mm(2.4), mm(stockT + 1.4), 20), mat.brassPolished);
    r.position.set(mm(x), mm(stockT / 2 + 0.6), -mm(62));
    g.add(r);
  }
  // 規片刻度
  const tex = etchedScale({
    spanMm: 98, heightMm: 20, pxPerMm: 24,
    marks: [{ from: 1, count: 95, stepMm: 1, edge: 'top', long: 10, mid: 5, lenLong: 4.5, lenMid: 3.2, lenShort: 2, labelEvery: 10, label: (i) => (i ? String(i) : null), fontMm: 2.4 }],
  });
  const d = scaleDecal(tex, mm(98), mm(20));
  d.position.set(mm(2 + 49), mm((stockT + bladeT) / 2 + 0.45), -mm(62));
  g.add(d);
  return g;
}
