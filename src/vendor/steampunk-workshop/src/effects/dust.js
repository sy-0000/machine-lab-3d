// Floating dust motes. Fully GPU-animated (drift + wrap in a box); motes inside a sunbeam light up.
import * as THREE from 'three';
import { SUN_DIRECTION } from '../config/layout.js';
import { mulberry32 } from '../materials/noise.js';

const MAX_BEAMS = 8;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uSize;
  uniform vec3 uSunDir;
  uniform vec4 uBeams[${MAX_BEAMS}];
  uniform int uBeamCount;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxSize;
  attribute float aSeed;
  attribute vec3 aDrift;
  varying float vAlpha;
  void main() {
    vec3 p = position + aDrift * uTime;
    p.x += sin(uTime * 0.21 + aSeed * 19.0) * 0.18;
    p.z += cos(uTime * 0.17 + aSeed * 13.0) * 0.18;
    p.y += sin(uTime * 0.29 + aSeed * 7.0) * 0.09;
    p = uBoxMin + mod(p - uBoxMin, uBoxSize);
    float lit = 0.0;
    for (int i = 0; i < ${MAX_BEAMS}; i++) {
      if (i >= uBeamCount) break;
      vec3 d = p - uBeams[i].xyz;
      float along = dot(d, uSunDir);
      float dist = length(d - uSunDir * along);
      lit = max(lit, smoothstep(uBeams[i].w * 1.15, uBeams[i].w * 0.3, dist) * step(0.0, along));
    }
    vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = uSize * (0.5 + aSeed);
    gl_PointSize = clamp(size * uScale / -mv.z, 1.0, 9.0);
    float twinkle = 0.75 + 0.25 * sin(uTime * (0.8 + aSeed * 2.0) + aSeed * 40.0);
    vAlpha = (0.05 + lit * 0.95) * twinkle * smoothstep(0.25, 1.2, -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(uColor * a * vAlpha, 1.0);
  }
`;

export function createDust(count, beams) {
  const rand = mulberry32(5);
  const boxMin = new THREE.Vector3(-7.5, 0.15, -8.5);
  const boxSize = new THREE.Vector3(15, 11, 15);
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const drift = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // bias half of the motes into the beams so they are dense where the light is
    let p;
    if (beams.length && i % 2 === 0) {
      const b = beams[Math.floor(rand() * beams.length)];
      const along = rand() * 12;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * b.radius;
      const side = new THREE.Vector3(1, 0, 0).cross(SUN_DIRECTION).normalize();
      const up = SUN_DIRECTION.clone().cross(side).normalize();
      p = b.origin.clone().addScaledVector(SUN_DIRECTION, along).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
    } else {
      p = new THREE.Vector3(boxMin.x + rand() * boxSize.x, boxMin.y + rand() * boxSize.y, boxMin.z + rand() * boxSize.z);
    }
    pos.set([p.x, p.y, p.z], i * 3);
    seed[i] = rand();
    drift.set([(rand() - 0.5) * 0.03, (rand() - 0.35) * 0.02, (rand() - 0.5) * 0.03], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aDrift', new THREE.BufferAttribute(drift, 3));

  const beamUniform = [];
  for (let i = 0; i < MAX_BEAMS; i++) {
    const b = beams[i];
    beamUniform.push(b ? new THREE.Vector4(b.origin.x, b.origin.y, b.origin.z, b.radius) : new THREE.Vector4());
  }
  const material = new THREE.ShaderMaterial({
    name: 'DustMotes',
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 800 },
      uSize: { value: 0.012 },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uBeams: { value: beamUniform },
      uBeamCount: { value: Math.min(beams.length, MAX_BEAMS) },
      uBoxMin: { value: boxMin },
      uBoxSize: { value: boxSize },
      uColor: { value: new THREE.Color(1.0, 0.93, 0.8).multiplyScalar(1.4) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, material);
  points.name = 'DustMotes';
  points.frustumCulled = false;
  points.renderOrder = 6;
  return {
    object: points,
    update(dt, t) {
      material.uniforms.uTime.value = t;
    },
    setScale(s) {
      material.uniforms.uScale.value = s;
    },
  };
}
