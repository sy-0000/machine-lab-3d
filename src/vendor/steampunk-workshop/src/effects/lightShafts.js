// Sunbeams through the dome: soft additive volumes aligned with the sun direction. Each beam starts
// at a real glazing pane and ends where that pane's light hits the floor, so beams agree with
// the shadow map. A view-dependent falloff makes the cylinders read as soft volumes.
import * as THREE from 'three';
import { SUN_DIRECTION } from '../config/layout.js';
import { mulberry32 } from '../materials/noise.js';

const vertexShader = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vSeed;
  void main() {
    vec3 V = normalize(cameraPosition - vPosW);
    float facing = abs(dot(normalize(vNormalW), V));
    float core = pow(facing, 3.0);
    float along = vUv.y;
    float fade = smoothstep(0.0, 0.1, along) * smoothstep(1.0, 0.6, along);
    float drift = 0.72 + 0.28 * sin(vPosW.y * 1.3 + uTime * 0.25 + vSeed * 17.0) * sin(vPosW.x * 1.9 - vPosW.z * 1.1 - uTime * 0.18);
    float camFade = smoothstep(0.6, 3.0, distance(cameraPosition, vPosW));
    float a = core * fade * drift * camFade * uIntensity * (0.55 + 0.45 * vSeed);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`;

export function createLightShafts(panels, { count = 7, focus = new THREE.Vector3(0.3, 0, -1.0), spread = 5.2 } = {}) {
  const dir = SUN_DIRECTION.clone();
  const rand = mulberry32(77);
  const candidates = [];
  for (const p of panels) {
    if (p.ring < 1 || p.ring > 5) continue;
    const t = p.center.y / dir.y;
    const hit = p.center.clone().addScaledVector(dir, -t);
    const d = Math.hypot(hit.x - focus.x, hit.z - focus.z);
    if (d < spread) candidates.push({ panel: p, hit, score: d + rand() * 2.5 });
  }
  candidates.sort((a, b) => a.score - b.score);
  const chosen = [];
  for (const c of candidates) {
    if (chosen.every((o) => o.hit.distanceTo(c.hit) > 1.3)) chosen.push(c);
    if (chosen.length >= count) break;
  }

  const material = new THREE.ShaderMaterial({
    name: 'LightShaft',
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(1.0, 0.9, 0.74) },
      uIntensity: { value: 0.075 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const root = new THREE.Group();
  root.name = 'LightShafts';
  const beams = [];
  chosen.forEach((c, i) => {
    const r = THREE.MathUtils.clamp(Math.min(c.panel.width, c.panel.height) * 0.14, 0.16, 0.45) * (0.7 + rand() * 0.5);
    const top = c.panel.center.clone().addScaledVector(dir, -0.4);
    const len = top.distanceTo(c.hit);
    const geo = new THREE.CylinderGeometry(r, r * 1.08, len, 28, 1, true);
    const seed = new Float32Array(geo.attributes.position.count).fill(rand());
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `SunBeam_${i}`;
    mesh.position.copy(top).lerp(c.hit, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.renderOrder = 5;
    mesh.frustumCulled = true;
    root.add(mesh);
    beams.push({ origin: c.hit.clone(), radius: r });
  });

  return {
    object: root,
    beams,
    update(dt, t) {
      material.uniforms.uTime.value = t;
    },
  };
}
