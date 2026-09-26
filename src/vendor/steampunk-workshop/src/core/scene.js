import * as THREE from 'three';
import { SUN_DIRECTION } from '../config/layout.js';

// Warm interior light-probe used for metal reflections (PMREM filtered).
function createEnvironment(renderer) {
  const env = new THREE.Scene();
  const geo = new THREE.SphereGeometry(40, 48, 24);
  const pos = geo.attributes.position;
  const colors = [];
  const floor = new THREE.Color(0.1, 0.065, 0.04);
  const wall = new THREE.Color(0.32, 0.16, 0.1);
  const sky = new THREE.Color(1.5, 1.45, 1.35);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 40;
    if (y < 0) tmp.copy(floor).lerp(wall, Math.pow(1 + y, 3));
    else if (y < 0.45) tmp.copy(wall).lerp(new THREE.Color(0.45, 0.3, 0.2), y / 0.45);
    else tmp.copy(new THREE.Color(0.45, 0.3, 0.2)).lerp(sky, Math.min(1, (y - 0.45) / 0.3));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  // a few warm "bulbs" and the fire, so brass picks up coloured glints
  const glow = (color, x, y, z, s) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z);
    env.add(m);
  };
  glow(new THREE.Color(8, 4.2, 1.6), 0, 6, 12, 2.2);
  glow(new THREE.Color(6, 3.2, 1.2), -20, 4, -8, 2);
  glow(new THREE.Color(6, 3.2, 1.2), 18, 6, -14, 1.8);
  glow(new THREE.Color(9, 3, 0.6), 0, -4, -30, 3);
  const sun = SUN_DIRECTION.clone().multiplyScalar(36);
  glow(new THREE.Color(30, 28, 24), sun.x, sun.y, sun.z, 3.5);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.03);
  pmrem.dispose();
  geo.dispose();
  return rt.texture;
}

export function createScene(renderer) {
  const scene = new THREE.Scene();
  scene.name = 'SteampunkWorkshop';
  scene.environment = createEnvironment(renderer);
  scene.environmentIntensity = 0.62;
  scene.fog = new THREE.FogExp2(0x5e4d3c, 0.008);
  return scene;
}
