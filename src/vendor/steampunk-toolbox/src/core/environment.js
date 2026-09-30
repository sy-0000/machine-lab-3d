// 自製暖色工坊環境貼圖：讓金屬在展示時有層次的反光（暖色主燈箱、冷色側窗、細長亮條）
import * as THREE from 'three';

export function createWorkshopEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 20), new THREE.MeshBasicMaterial({ color: 0x1a120c, side: THREE.BackSide }));
  env.add(room);
  const panel = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  panel(8, 3, 0xffc07a, 2, [0, 5.8, 0], [0, 0, 0]);           // 頂部暖色燈箱
  panel(3, 5, 0x9fc2ff, 1, [-9.8, 2, 2], [0, 2, 2]);        // 冷色側窗
  panel(6, 1.2, 0x7a4a22, 2, [0, -3, -9.8], [0, -3, 0]);      // 下方暖色反射
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
}
