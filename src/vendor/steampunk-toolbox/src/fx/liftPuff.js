// 工具升起時從凹槽揚起的少量細塵（CPU 粒子，固定容量池）
import * as THREE from 'three';

export function createLiftPuff(capacity = 90) {
  const pos = new Float32Array(capacity * 3);
  const alpha = new Float32Array(capacity);
  const vel = new Float32Array(capacity * 3);
  const life = new Float32Array(capacity);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uPixel: { value: 1 }, uColor: { value: new THREE.Color(0xcdb597) } },
    vertexShader: /* glsl */`
      attribute float aAlpha; varying float vA; uniform float uPixel;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + (1.0 - aAlpha) * 5.0) * uPixel * (1.6 / -mv.z); }`,
    fragmentShader: /* glsl */`
      varying float vA; uniform vec3 uColor;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.1, d) * vA * 0.45; gl_FragColor = vec4(uColor, a); }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'LiftPuff';
  let cursor = 0;
  return {
    points,
    setPixelRatio(pr, height) { mat.uniforms.uPixel.value = pr * height / 900 * 3.2; },
    emit(origin, spread = 0.12, n = 36) {
      for (let k = 0; k < n; k++) {
        const i = cursor; cursor = (cursor + 1) % capacity;
        pos[i * 3] = origin.x + (Math.random() - 0.5) * spread * 2;
        pos[i * 3 + 1] = origin.y + Math.random() * 0.02;
        pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread * 2.5;
        vel[i * 3] = (Math.random() - 0.5) * 0.08;
        vel[i * 3 + 1] = 0.05 + Math.random() * 0.12;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
        life[i] = 0.9 + Math.random() * 0.8;
        alpha[i] = 1;
      }
    },
    update(dt) {
      for (let i = 0; i < capacity; i++) {
        if (life[i] <= 0) { alpha[i] = 0; continue; }
        life[i] -= dt;
        vel[i * 3 + 1] *= 0.985;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        alpha[i] = Math.max(0, Math.min(1, life[i] / 0.8));
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
    },
  };
}
