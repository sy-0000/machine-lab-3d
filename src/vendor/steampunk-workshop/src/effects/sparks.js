// Occasional sparks drifting out of the firebox: brief upward lift from the heat, then a slow
// fall, cooling from yellow-white to deep orange. Additive HDR so bloom catches them.
import * as THREE from 'three';
import { mulberry32 } from '../materials/noise.js';

const vertexShader = /* glsl */ `
  uniform float uScale;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / -mv.z, 1.0, 14.0);
    vColor = aColor;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * core * core, 1.0);
  }
`;

export class SparkSystem {
  constructor(max, origin, direction) {
    this.max = max;
    this.origin = origin.clone();
    this.direction = direction.clone().normalize();
    this.rand = mulberry32(33);
    this.count = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.heat = new Float32Array(max);
    this.nextBurst = 1.5;
    this.nextSingle = 0.5;

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aColor', this.aColor);
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      name: 'Sparks',
      vertexShader,
      fragmentShader,
      uniforms: { uScale: { value: 800 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.name = 'FireboxSparks';
    this.object.frustumCulled = false;
    this.object.renderOrder = 8;
  }

  spawn() {
    if (this.count >= this.max) return;
    const r = this.rand;
    const i = this.count++;
    const d = this.direction;
    this.p.set([this.origin.x + (r() - 0.5) * 0.4, this.origin.y + r() * 0.15, this.origin.z + (r() - 0.5) * 0.1], i * 3);
    const speed = 0.5 + r() * 1.0;
    this.v.set([d.x * speed + (r() - 0.5) * 0.5, d.y * speed + 0.4 + r() * 0.6, d.z * speed + (r() - 0.5) * 0.3], i * 3);
    this.age[i] = 0;
    this.life[i] = 0.8 + r() * 1.8;
    this.heat[i] = 0.7 + r() * 0.3;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.p.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.v.copyWithin(i * 3, j * 3, j * 3 + 3);
    this.age[i] = this.age[j];
    this.life[i] = this.life[j];
    this.heat[i] = this.heat[j];
  }

  update(dt, t) {
    const r = this.rand;
    this.nextBurst -= dt;
    this.nextSingle -= dt;
    if (this.nextBurst <= 0) {
      const n = 3 + Math.floor(r() * 10);
      for (let k = 0; k < n; k++) this.spawn();
      this.nextBurst = 2 + r() * 5;
    }
    if (this.nextSingle <= 0) {
      this.spawn();
      this.nextSingle = 0.3 + r() * 1.2;
    }
    const pos = this.aPos.array;
    const size = this.aSize.array;
    const col = this.aColor.array;
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      const k = i * 3;
      const lift = 1.3 * Math.exp(-this.age[i] * 1.6) - 0.75;
      const drag = Math.exp(-dt * 0.9);
      this.v[k] = this.v[k] * drag + Math.sin(t * 7 + i * 3.1) * 0.6 * dt;
      this.v[k + 1] = this.v[k + 1] * drag + lift * dt;
      this.v[k + 2] = this.v[k + 2] * drag + Math.cos(t * 6 + i * 1.3) * 0.4 * dt;
      this.p[k] += this.v[k] * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += this.v[k + 2] * dt;
      if (this.p[k + 1] < 0.01) this.age[i] = this.life[i];
    }
    for (let i = 0; i < this.count; i++) {
      const u = this.age[i] / this.life[i];
      const flick = 0.7 + 0.3 * Math.sin(t * 40 + i * 7.7);
      const h = this.heat[i] * (1 - u) * flick;
      pos.set([this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]], i * 3);
      col[i * 3] = 6 * h;
      col[i * 3 + 1] = 6 * h * (0.2 + 0.55 * h);
      col[i * 3 + 2] = 6 * h * 0.12 * h;
      size[i] = 0.018 * (0.6 + 0.4 * (1 - u));
    }
    this.object.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }

  setScale(s) {
    this.material.uniforms.uScale.value = s;
  }
}
