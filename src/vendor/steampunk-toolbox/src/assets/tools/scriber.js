// 劃線針（雙頭）：滾花握身，一端直尖、一端 90° 彎尖
import * as THREE from 'three';
import { latheAlongX, flutedCylinderX, taperTube } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createScriber(mat) {
  const g = new THREE.Group();
  g.name = 'Scriber';
  const knurl = flutedCylinderX(mm(3.6), mm(70), 28, 0.12, mat.knurlSteel, 96);
  knurl.position.x = mm(35);
  g.add(knurl);
  // 直尖端
  g.add(latheAlongX([[0, mm(70)], [mm(2.2), mm(70)], [mm(2), mm(100)], [mm(0.6), mm(118)], [0, mm(120)]], mat.steel, 24));
  // 彎尖端
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(mm(-2), 0, 0), new THREE.Vector3(mm(-20), 0, 0), new THREE.Vector3(mm(-28), 0, mm(2)),
    new THREE.Vector3(mm(-31), 0, mm(8)), new THREE.Vector3(mm(-31.5), 0, mm(16)),
  ]);
  g.add(taperTube(curve, mm(2.2), mm(0.25), mat.steel, 48, 16));
  return g;
}
