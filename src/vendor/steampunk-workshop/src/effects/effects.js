// Creates and drives every particle / volumetric effect from world anchors.
import * as THREE from 'three';
import { createLightShafts } from './lightShafts.js';
import { createDust } from './dust.js';
import { SteamSystem } from './steam.js';
import { SparkSystem } from './sparks.js';

export function createEffects(scene, renderer, camera, quality, world) {
  const root = new THREE.Group();
  root.name = 'Effects';
  scene.add(root);
  const systems = [];

  let beams = [];
  if (quality.shafts && world.panels) {
    const shafts = createLightShafts(world.panels);
    root.add(shafts.object);
    systems.push(shafts);
    beams = shafts.beams;
  }

  const dust = createDust(quality.dustCount, beams);
  root.add(dust.object);
  systems.push(dust);

  const steam = new SteamSystem(quality.steamParticles);
  for (const e of world.anchors.steam) steam.addEmitter(e);
  root.add(steam.object);
  systems.push(steam);

  if (world.anchors.sparks) {
    const sparks = new SparkSystem(quality.sparkParticles, world.anchors.sparks.position, world.anchors.sparks.direction);
    root.add(sparks.object);
    systems.push(sparks);
  }

  // world-size → pixel factor for point sprites: viewport height / (2·tan(fov/2))
  const size = new THREE.Vector2();
  const resize = () => {
    renderer.getDrawingBufferSize(size);
    const scale = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const s of systems) s.setScale?.(scale);
  };
  resize();

  return {
    update(dt, t) {
      for (const s of systems) s.update(dt, t);
    },
    resize,
  };
}
