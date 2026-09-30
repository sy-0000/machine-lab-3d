// 墊片（數片）：不同厚度的鋼／黃銅長條墊片，略成扇形疊放，端部打印厚度
import * as THREE from 'three';
import { extrudeFlat, roundedRectShape } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';
import { makeCanvas, toTexture } from '../../materials/textures.js';

function label(text) {
  const c = makeCanvas(128, 64), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(20,15,10,0.85)';
  ctx.font = 'bold 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 34);
  return toTexture(c, { srgb: true });
}

export function createShimSet(mat) {
  const g = new THREE.Group();
  g.name = 'ShimSet';
  const sizes = [5, 4, 3, 2, 1.5, 1];
  let y = 0;
  sizes.forEach((t, i) => {
    const s = new THREE.Group();
    const m = i % 2 ? mat.brass : mat.satinSteel;
    const bar = extrudeFlat(roundedRectShape(mm(100), mm(16), mm(1.5), mm(50), 0), mm(t), m, mm(0.2));
    s.add(bar);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(mm(12), mm(6)), new THREE.MeshStandardMaterial({ map: label(t.toFixed(1)), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 }));
    tag.rotation.x = -Math.PI / 2;
    tag.position.set(mm(90), mm(t + 0.45), 0);
    s.add(tag);
    s.position.y = y;
    s.rotation.y = i * 0.075;
    y += mm(t + 0.45);
    g.add(s);
  });
  return g;
}
