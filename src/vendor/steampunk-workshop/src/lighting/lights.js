// All scene lights: dome sunlight (key, shadowed), sky/bounce fill, boiler fire and Edison bulbs.
import * as THREE from 'three';
import { SUN_DIRECTION } from '../config/layout.js';
import { fireFlicker, lampBreath } from './flicker.js';

export function createLights(scene, quality, anchors = {}) {
  const root = new THREE.Group();
  root.name = 'Lights';
  scene.add(root);

  const sun = new THREE.DirectionalLight(0xfff0d8, 3.1);
  sun.name = 'DomeSun';
  sun.target.position.set(0, 5, 0);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(40).add(sun.target.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
  const sc = sun.shadow.camera;
  sc.left = -15;
  sc.right = 15;
  sc.top = 15;
  sc.bottom = -15;
  sc.near = 10;
  sc.far = 75;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  root.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xaec6ea, 0x4a2e1c, 0.6);
  hemi.name = 'SkyBounce';
  root.add(hemi);

  const flickers = [];

  if (anchors.fire) {
    const fire = new THREE.PointLight(0xff6a24, 9, 11, 2);
    fire.name = 'BoilerFire';
    fire.position.copy(anchors.fire);
    root.add(fire);
    flickers.push((t) => {
      fire.intensity = 9 * fireFlicker(t);
    });
  }

  for (const [i, lamp] of (anchors.lamps || []).entries()) {
    const light = new THREE.PointLight(lamp.color ?? 0xffae5c, lamp.intensity ?? 12, lamp.distance ?? 10, 2);
    light.name = `EdisonLamp_${i}`;
    light.position.copy(lamp.position);
    root.add(light);
    const base = light.intensity;
    const seed = lamp.seed ?? i;
    flickers.push((t) => {
      light.intensity = base * lampBreath(t, seed);
    });
  }

  return {
    sun,
    update(t) {
      for (const f of flickers) f(t);
    },
  };
}
