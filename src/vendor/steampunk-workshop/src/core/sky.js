// Sky seen through the dome: three.js physical Sky (sun disc placed on SUN_DIRECTION so it matches
// the key light) plus a 2.5D cloud layer — fbm density on a high plane with a cheap sun-ward
// shadow sample for volume — drifting slowly with the wind. Both render at the far plane.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { SUN_DIRECTION } from '../config/layout.js';

const cloudVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    vec4 p = projectionMatrix * viewMatrix * wp;
    gl_Position = p.xyww;
  }
`;

const cloudFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec2 uWind;
  uniform float uCoverage;
  uniform float uBrightness;
  varying vec3 vDir;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 6; i++) {
      s += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return s;
  }
  float density(vec2 p) {
    float base = fbm(p * 0.0022 + uWind * uTime);
    float detail = fbm(p * 0.009 - uWind * uTime * 1.6);
    float d = base * 0.78 + detail * 0.32;
    return smoothstep(uCoverage, uCoverage + 0.26, d);
  }
  void main() {
    vec3 dir = normalize(vDir);
    if (dir.y < 0.02) discard;
    vec2 p = dir.xz * (1400.0 / dir.y);
    float d = density(p);
    if (d < 0.004) discard;
    vec2 toSun = normalize(uSunDir.xz + 1e-4) * 220.0;
    float shadow = density(p + toSun);
    float lit = exp(-shadow * 1.8);
    vec3 shade = vec3(0.56, 0.62, 0.74);
    vec3 sun = vec3(1.0, 0.96, 0.88) * 1.35;
    vec3 col = mix(shade, sun, lit * 0.8 + 0.2);
    float mu = max(dot(dir, uSunDir), 0.0);
    col += vec3(1.0, 0.88, 0.7) * pow(mu, 10.0) * 0.8 * (1.0 - d);
    float horizon = smoothstep(0.02, 0.22, dir.y);
    gl_FragColor = vec4(col * uBrightness, d * 0.92 * horizon);
  }
`;

export function createSky(scene) {
  const sky = new Sky();
  sky.name = 'ProceduralSky';
  sky.scale.setScalar(100);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.6;
  u.rayleigh.value = 1.1;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(SUN_DIRECTION).multiplyScalar(1000);
  // Sky is authored for ~0.5 exposure; scale it into this scene's exposure before tone mapping.
  u.uSkyIntensity = { value: 0.42 };
  sky.material.fragmentShader = sky.material.fragmentShader
    .replace('void main() {', 'uniform float uSkyIntensity;\nvoid main() {')
    .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= uSkyIntensity;\n\t#include <tonemapping_fragment>');
  sky.material.needsUpdate = true;
  sky.frustumCulled = false;
  scene.add(sky);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(80, 32, 16),
    new THREE.ShaderMaterial({
      name: 'CloudLayer',
      vertexShader: cloudVertex,
      fragmentShader: cloudFragment,
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: SUN_DIRECTION.clone() },
        uWind: { value: new THREE.Vector2(0.006, 0.0022) },
        uCoverage: { value: 0.5 },
        uBrightness: { value: 0.95 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
  clouds.name = 'CloudLayer';
  clouds.frustumCulled = false;
  clouds.renderOrder = -10;
  scene.add(clouds);

  return {
    update(dt, t) {
      clouds.material.uniforms.uTime.value = t;
    },
  };
}
