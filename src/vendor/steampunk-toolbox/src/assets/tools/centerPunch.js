// 中心沖：平頭打擊端、滾花握身、錐形沖頭（90° 尖）
import * as THREE from 'three';
import { latheAlongX, flutedCylinderX } from '../../utils/geometry.js';
import { mm } from '../../utils/units.js';

export function createCenterPunch(mat) {
  const g = new THREE.Group();
  g.name = 'CenterPunch';
  g.add(latheAlongX([[0, 0], [mm(4), 0], [mm(5), mm(1.2)], [mm(5), mm(12)], [0, mm(12)]], mat.steel, 32));
  const knurl = flutedCylinderX(mm(5), mm(66), 40, 0.1, mat.knurlSteel, 120);
  knurl.position.x = mm(12 + 33);
  g.add(knurl);
  g.add(latheAlongX([[0, mm(78)], [mm(5), mm(78)], [mm(4.5), mm(84)], [mm(2.2), mm(110)], [mm(1.6), mm(114)], [0, mm(116)]], mat.steel, 32));
  return g;
}
