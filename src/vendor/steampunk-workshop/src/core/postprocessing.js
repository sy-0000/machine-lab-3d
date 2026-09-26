import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Linear-HDR grade before tone mapping: warm shadows, soft vignette, faint film grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb *= mix(vec3(1.05, 0.985, 0.9), vec3(1.0, 1.0, 1.02), smoothstep(0.02, 1.6, l));
      vec2 d = vUv - 0.5;
      d.x *= uResolution.x / uResolution.y;
      float vig = smoothstep(1.05, 0.28, length(d));
      c.rgb *= mix(0.55, 1.0, vig);
      float n = fract(sin(dot(vUv * uResolution + fract(uTime) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb *= 1.0 + (n - 0.5) * 0.035;
      gl_FragColor = c;
    }
  `,
};

export function createPostPipeline(renderer, scene, camera, quality) {
  const size = renderer.getSize(new THREE.Vector2());

  if (!quality.post) {
    return {
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      dispose: () => {},
    };
  }

  const target = new THREE.WebGLRenderTarget(size.x * renderer.getPixelRatio(), size.y * renderer.getPixelRatio(), {
    type: THREE.HalfFloatType,
    samples: quality.msaa,
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));

  let bloom = null;
  if (quality.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.32, 0.55, 1.05);
    composer.addPass(bloom);
  }

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const setSize = (w, h) => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    grade.uniforms.uResolution.value.set(w, h);
  };
  setSize(size.x, size.y);

  return {
    composer,
    render: (dt, t) => {
      grade.uniforms.uTime.value = t;
      composer.render(dt);
    },
    setSize,
    dispose: () => {
      composer.dispose();
      target.dispose();
      bloom?.dispose();
    },
  };
}
