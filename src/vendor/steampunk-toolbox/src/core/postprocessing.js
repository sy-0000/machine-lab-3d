// 後處理：MSAA 渲染目標 + 黃銅描邊（懸停）+ 輕度泛光（燈絲）+ 色調映射輸出（+ 低階 FXAA）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export function createPostprocessing(renderer, scene, camera, quality) {
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: quality.msaaSamples });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));

  let outline = null;
  if (quality.outline) {
    outline = new OutlinePass(size.clone(), scene, camera);
    Object.assign(outline, { edgeStrength: 2.4, edgeGlow: 0.9, edgeThickness: 1.6, pulsePeriod: 0 });
    outline.visibleEdgeColor.set(0xd9a441);
    outline.hiddenEdgeColor.set(0x3a2508);
    composer.addPass(outline);
  }
  let bloom = null;
  if (quality.bloom) {
    bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.18, 0.4, 0.97);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  let fxaa = null;
  if (quality.fxaa) {
    fxaa = new ShaderPass(FXAAShader);
    composer.addPass(fxaa);
  }

  return {
    composer,
    setHover(objects) { if (outline) outline.selectedObjects = objects; },
    setOutlineStrength(k) { if (outline) outline.edgeStrength = 2.4 * k; },
    resize(w, h) {
      composer.setSize(w, h);
      if (fxaa) {
        const pr = renderer.getPixelRatio();
        fxaa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      }
    },
    render(dt) { composer.render(dt); },
  };
}
