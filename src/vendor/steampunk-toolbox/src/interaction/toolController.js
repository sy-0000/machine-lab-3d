// 工具動畫控制：懸停浮起、拿起（貝茲曲線路徑 + 旋轉補間）、展示自轉與拖曳旋轉、放回凹槽
import * as THREE from 'three';
import { easeInOutCubic, easeOutCubic } from '../utils/easing.js';

const bezier = (p0, p1, p2, p3, t, out) => {
  const u = 1 - t;
  return out.set(0, 0, 0)
    .addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
};

export class ToolController {
  constructor({ scene, entries, showcasePoint, tweens, puff }) {
    this.scene = scene;
    this.entries = entries; // { object, config, rest:{position, quaternion}, materials:[], mode, hover }
    this.tweens = tweens;
    this.puff = puff;
    this.pivot = new THREE.Group();
    this.pivot.name = 'ShowcasePivot';
    this.pivot.position.copy(showcasePoint);
    scene.add(this.pivot);
    this.spin = 0; this.yaw = 0; this.pitch = 0; this.yawVel = 0; this.pitchVel = 0;
    this.dragging = false;
    this.hovered = -1;
    this.basePivotY = showcasePoint.y;
    this.bobT = 0;
    this.entries.forEach((e) => { e.mode = 'rest'; e.hover = 0; e.envK = 0; });
  }

  setHovered(i) { this.hovered = i; }

  displayQuat(cfg) {
    const [x, y, z] = cfg.display.rotation;
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
  }

  lift(index, duration = 1.3, delay = 0) {
    const e = this.entries[index];
    const obj = e.object;
    e.mode = 'moving';
    this.spin = 0; this.yaw = 0; this.pitch = 0; this.yawVel = 0; this.pitchVel = 0;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.position.y = this.basePivotY;
    this.bobT = 0;
    this.pivot.updateMatrixWorld(true);
    const p0 = obj.position.clone();
    const p3 = this.pivot.position.clone();
    const p1 = p0.clone().add(new THREE.Vector3(0, 0.55, 0.05));
    const p2 = p3.clone().add(new THREE.Vector3(0, 0.18, -0.1));
    const q0 = obj.quaternion.clone(), q1 = this.displayQuat(e.config);
    const s1 = e.config.display.scale;
    const tmp = new THREE.Vector3();
    let puffed = false;
    return this.tweens.to({
      duration, delay, ease: (t) => t,
      onUpdate: (_, k) => {
        if (!puffed) { puffed = true; this.puff?.emit(e.rest.position, 0.1, 40); }
        const t = easeInOutCubic(k);
        obj.position.copy(bezier(p0, p1, p2, p3, t, tmp));
        // 翻轉略晚於位移開始，看起來像先抽出再翻面
        obj.quaternion.slerpQuaternions(q0, q1, easeInOutCubic(Math.min(1, Math.max(0, (k - 0.12) / 0.8))));
        obj.scale.setScalar(1 + (s1 - 1) * easeOutCubic(k));
        e.envK = t;
        if (k >= 1) { this.pivot.attach(obj); e.mode = 'shown'; }
      },
    });
  }

  putBack(index, duration = 1.1) {
    const e = this.entries[index];
    const obj = e.object;
    if (obj.parent !== this.scene) this.scene.attach(obj);
    e.mode = 'moving';
    const p0 = obj.position.clone();
    const p3 = e.rest.position.clone();
    const p1 = p0.clone().add(new THREE.Vector3(0, 0.12, -0.05));
    const p2 = p3.clone().add(new THREE.Vector3(0, 0.45, 0));
    const q0 = obj.quaternion.clone(), q1 = e.rest.quaternion.clone();
    const s0 = obj.scale.x;
    const tmp = new THREE.Vector3();
    return this.tweens.to({
      duration, ease: (t) => t,
      onUpdate: (_, k) => {
        const t = easeInOutCubic(k);
        obj.position.copy(bezier(p0, p1, p2, p3, t, tmp));
        obj.quaternion.slerpQuaternions(q0, q1, easeInOutCubic(Math.min(1, k / 0.85)));
        obj.scale.setScalar(s0 + (1 - s0) * t);
        e.envK = 1 - t;
        if (k >= 1) { e.mode = 'rest'; e.hover = 0; }
      },
    });
  }

  beginDrag() { this.dragging = true; }
  drag(dx, dy) {
    this.yawVel = dx * 0.006;
    this.pitchVel = dy * 0.006;
    this.yaw += this.yawVel;
    this.pitch = THREE.MathUtils.clamp(this.pitch + this.pitchVel, -1.1, 1.1);
  }
  endDrag() { this.dragging = false; }

  update(dt, time, showcasing) {
    // 懸停浮起
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      if (e.mode !== 'rest') continue;
      const target = i === this.hovered ? 0.035 : 0;
      e.hover += (target - e.hover) * Math.min(1, dt * 10);
      e.object.position.y = e.rest.position.y + e.hover;
    }
    // 展示自轉 + 拖曳慣性
    if (showcasing) {
      if (!this.dragging) {
        this.spin += dt * 0.32;
        this.yaw += this.yawVel; this.yawVel *= 0.93;
        this.pitch = THREE.MathUtils.clamp(this.pitch + this.pitchVel, -1.1, 1.1); this.pitchVel *= 0.9;
        this.pitch *= 0.995;
      }
      this.pivot.rotation.set(this.pitch, this.spin + this.yaw, 0, 'XYZ');
      this.bobT += dt;
      this.pivot.position.y = this.basePivotY + Math.sin(this.bobT * 1.1) * 0.012;
    }
    // 工具專屬動態（如壓力錶指針）與環境反射強度
    for (const e of this.entries) {
      e.object.userData.update?.(time);
      const k = 0.35; // 環境反射固定且偏低，展示時不再額外增強
      for (const m of e.materials) m.envMapIntensity = k * (m.userData.baseEnv ?? 1);
    }
  }
}
