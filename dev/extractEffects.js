// 開發用：跑網站工作室的原始建構程式（buildWorld＋createEffects），把匯出時被略過的特效位置算出來（scripts/extract-effects.mjs 呼叫）。
// 光束是依穹頂玻璃的位置在執行期挑出來的，所以必須跑原程式；座標是工作室座標（three.js，公尺）。
import * as THREE from 'three';
import { buildWorld } from '../src/vendor/steampunk-workshop/src/app/world.js';
import { createEffects } from '../src/vendor/steampunk-workshop/src/effects/effects.js';
import { resolveQuality } from '../src/vendor/steampunk-workshop/src/config/quality.js';

const r3 = v => v.toArray().map(x => Math.round(x * 10000) / 10000);
window.__extract = (async () => {
  const quality = resolveQuality('high');
  const root = new THREE.Group();
  const world = await buildWorld(root, quality);
  const renderer = { getDrawingBufferSize: v => v.set(1000, 1000) }, camera = { fov: 70 };
  createEffects(root, renderer, camera, { ...quality, shafts: true }, world);
  root.updateMatrixWorld(true);
  const beams = [];
  root.getObjectByName('LightShafts')?.children.forEach(m => {
    const p = m.geometry.parameters;
    beams.push({ name: m.name, position: r3(m.position), quaternion: m.quaternion.toArray().map(x => Math.round(x * 1e6) / 1e6), radiusTop: p.radiusTop, radiusBottom: p.radiusBottom, height: p.height });
  });
  return {
    source: 'src/vendor/steampunk-workshop（buildWorld＋createEffects，quality high）',
    beams,
    steam: world.anchors.steam.map(e => ({ position: r3(e.position), direction: r3(e.direction.clone().normalize()), strength: e.strength ?? 1 })),
    sparks: world.anchors.sparks ? { position: r3(world.anchors.sparks.position), direction: r3(world.anchors.sparks.direction) } : null,
    fire: world.anchors.fire ? r3(world.anchors.fire) : null,
  };
})();
