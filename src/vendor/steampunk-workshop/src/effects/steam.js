// Intermittent steam puffs from valves and the boiler. CPU-simulated pool rendered as one Points
// draw with soft rotating sprites; puffs rise, widen, slow down and fade out.
import * as THREE from 'three';
import { Noise2D, mulberry32 } from '../materials/noise.js';

function puffTexture() {
  const S = 128;
  const n = new Noise2D(404);
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x - S / 2) / (S / 2);
      const dy = (y - S / 2) / (S / 2);
      const r = Math.hypot(dx, dy);
      const fall = Math.max(0, 1 - r);
      const cloud = n.fbm(x / 24, y / 24, 4, 8);
      const a = Math.pow(fall, 1.6) * (0.45 + cloud * 0.9);
      const i = (y * S + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const vertexShader = /* glsl */ `
  uniform float uScale;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / -mv.z, 512.0);
    vAlpha = aAlpha * smoothstep(0.2, 0.9, -mv.z);
    vRot = aRot;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vRot;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float s = sin(vRot);
    float co = cos(vRot);
    vec2 uv = vec2(co * c.x - s * c.y, s * c.x + co * c.y) + 0.5;
    vec4 tex = texture2D(uMap, uv);
    gl_FragColor = vec4(uColor * (0.85 + 0.15 * tex.r), tex.a * vAlpha);
  }
`;

export class SteamSystem {
  constructor(max = 320) {
    this.max = max;
    this.count = 0;
    this.rand = mulberry32(9);
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.peak = new Float32Array(max);
    this.emitters = [];

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    geo.setAttribute('aRot', this.aRot);
    geo.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      name: 'Steam',
      vertexShader,
      fragmentShader,
      uniforms: { uMap: { value: puffTexture() }, uScale: { value: 800 }, uColor: { value: new THREE.Color(0.86, 0.84, 0.8) } },
      transparent: true,
      depthWrite: false,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.name = 'SteamPuffs';
    this.object.frustumCulled = false;
    this.object.renderOrder = 7;
  }

  addEmitter({ position, direction, strength = 1 }) {
    const r = this.rand;
    this.emitters.push({
      position: position.clone(),
      direction: direction.clone().normalize(),
      strength,
      bursting: false,
      timer: 1 + r() * 5,
      acc: 0,
    });
  }

  spawn(e) {
    if (this.count >= this.max) return;
    const r = this.rand;
    const i = this.count++;
    const s = e.strength;
    const spread = 0.25;
    this.p.set([e.position.x + (r() - 0.5) * 0.03, e.position.y + (r() - 0.5) * 0.03, e.position.z + (r() - 0.5) * 0.03], i * 3);
    const speed = (0.7 + r() * 0.6) * (0.6 + 0.5 * s);
    this.v.set([
      (e.direction.x + (r() - 0.5) * spread) * speed,
      (e.direction.y + (r() - 0.5) * spread) * speed,
      (e.direction.z + (r() - 0.5) * spread) * speed,
    ], i * 3);
    this.age[i] = 0;
    this.life[i] = 2.4 + r() * 2.2;
    this.size0[i] = 0.05 + r() * 0.04;
    this.size1[i] = (0.7 + r() * 0.5) * (0.6 + 0.5 * s);
    this.rot[i] = r() * Math.PI * 2;
    this.spin[i] = (r() - 0.5) * 0.6;
    this.peak[i] = (0.2 + r() * 0.12) * Math.min(1.2, 0.7 + 0.4 * s);
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    for (const arr of [this.p, this.v]) arr.copyWithin(i * 3, j * 3, j * 3 + 3);
    for (const arr of [this.age, this.life, this.size0, this.size1, this.rot, this.spin, this.peak]) arr[i] = arr[j];
  }

  update(dt, t) {
    const r = this.rand;
    for (const e of this.emitters) {
      e.timer -= dt;
      if (e.bursting) {
        e.acc += dt * 22 * e.strength;
        while (e.acc >= 1) {
          this.spawn(e);
          e.acc -= 1;
        }
        if (e.timer <= 0) {
          e.bursting = false;
          e.timer = 3 + r() * 7;
        }
      } else if (e.timer <= 0) {
        e.bursting = true;
        e.timer = 0.6 + r() * 1.8;
      }
    }
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      const k = i * 3;
      const drag = Math.exp(-dt * 1.4);
      this.v[k] = this.v[k] * drag + Math.sin(t * 1.1 + i * 1.7) * 0.05 * dt;
      this.v[k + 1] = this.v[k + 1] * drag + 0.32 * dt;
      this.v[k + 2] = this.v[k + 2] * drag + Math.cos(t * 0.9 + i * 2.3) * 0.05 * dt;
      this.p[k] += this.v[k] * dt;
      this.p[k + 1] += this.v[k + 1] * dt;
      this.p[k + 2] += this.v[k + 2] * dt;
      this.rot[i] += this.spin[i] * dt;
    }
    const pos = this.aPos.array;
    const size = this.aSize.array;
    const alpha = this.aAlpha.array;
    const rot = this.aRot.array;
    for (let i = 0; i < this.count; i++) {
      const u = this.age[i] / this.life[i];
      pos[i * 3] = this.p[i * 3];
      pos[i * 3 + 1] = this.p[i * 3 + 1];
      pos[i * 3 + 2] = this.p[i * 3 + 2];
      const grow = 1 - Math.pow(1 - u, 2.2);
      size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * grow;
      alpha[i] = this.peak[i] * Math.min(1, u / 0.08) * Math.pow(1 - u, 1.6);
      rot[i] = this.rot[i];
    }
    this.object.geometry.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aRot.needsUpdate = true;
  }

  setScale(s) {
    this.material.uniforms.uScale.value = s;
  }
}
