// 燈光：瀏覽（愛迪生燈泡暖光＋冷色補光）與展示（單一聚光燈＋極弱輪廓光）之間以混合值 s 平滑過渡
import * as THREE from 'three';

export class LightRig {
  constructor(scene, quality, bulb, showcasePoint) {
    this.scene = scene;
    this.s = 0;
    const shadowSize = quality.shadowMapSize;
    const bulbPos = bulb.localToWorld(bulb.userData.lightLocal.clone());
    this.bulb = bulb;

    // --- 瀏覽燈光 ---
    this.bulbSpot = new THREE.SpotLight(0xffb065, 38, 0, 1.05, 0.85, 2);
    this.bulbSpot.position.copy(bulbPos);
    this.bulbSpot.target.position.set(-0.1, 0, 0.2);
    this.bulbSpot.castShadow = quality.shadows;
    this.bulbSpot.shadow.mapSize.set(shadowSize, shadowSize);
    this.bulbSpot.shadow.bias = -0.0004;
    this.bulbSpot.shadow.normalBias = 0.02;
    this.bulbSpot.shadow.radius = 4;
    this.bulbSpot.shadow.camera.near = 0.5; this.bulbSpot.shadow.camera.far = 6;
    this.bulbGlow = new THREE.PointLight(0xff9a45, 5, 0, 2); // 照亮磚牆與周圍
    this.bulbGlow.position.copy(bulbPos);
    this.coolFill = new THREE.HemisphereLight(0x6f8fb8, 0x1a1008, 0.55);
    this.coolKey = new THREE.DirectionalLight(0x88a8d8, 0.45);
    this.coolKey.position.set(-3, 2.5, 3);
    scene.add(this.bulbSpot, this.bulbSpot.target, this.bulbGlow, this.coolFill, this.coolKey);

    // --- 展示燈光 ---
    const sp = showcasePoint;
    this.showSpot = new THREE.SpotLight(0xfff0d8, 0, 0, 0.32, 0.55, 2);
    this.showSpot.position.set(sp.x, sp.y + 2.3, sp.z - 0.05);
    this.showSpot.target.position.copy(sp);
    this.showSpot.castShadow = quality.shadows;
    this.showSpot.shadow.mapSize.set(shadowSize, shadowSize);
    this.showSpot.shadow.bias = -0.0003;
    this.showSpot.shadow.normalBias = 0.01;
    this.showSpot.shadow.camera.near = 1; this.showSpot.shadow.camera.far = 5;
    this.rim = new THREE.SpotLight(0x9fb8ff, 0, 0, 0.5, 0.8, 2);
    this.rim.position.set(sp.x - 0.9, sp.y + 0.5, sp.z - 1.6);
    this.rim.target.position.copy(sp);
    this.rim2 = new THREE.SpotLight(0xffc890, 0, 0, 0.5, 0.8, 2);
    this.rim2.position.set(sp.x + 1.1, sp.y + 0.2, sp.z - 1.3);
    this.rim2.target.position.copy(sp);
    scene.add(this.showSpot, this.showSpot.target, this.rim, this.rim.target, this.rim2, this.rim2.target);

    this.base = { bulbSpot: 28, bulbGlow: 4, fill: 0.5, key: 0.4, show: 100, rim: 5, rim2: 2.8 };
    this.flicker = 1;
  }

  setBlend(s) { this.s = s; }

  update(time) {
    // 燈泡微弱呼吸閃爍
    const f = 1 + Math.sin(time * 1.3) * 0.035 + Math.sin(time * 7.1) * 0.012 + (Math.sin(time * 23.7) > 0.985 ? -0.06 : 0);
    this.flicker = f;
    const s = this.s, b = 1 - s;
    const dim = b + s * 0.04; // 展示時背景幾乎全暗
    this.bulbSpot.intensity = this.base.bulbSpot * f * dim;
    this.bulbGlow.intensity = this.base.bulbGlow * f * (b + s * 0.12);
    this.coolFill.intensity = this.base.fill * (b + s * 0.08);
    this.coolKey.intensity = this.base.key * b;
    this.showSpot.intensity = this.base.show * s;
    this.rim.intensity = this.base.rim * s;
    this.rim2.intensity = this.base.rim2 * s;
    const fm = this.bulb.userData.filamentMat;
    fm.emissiveIntensity = 6 * f * (b * 0.85 + 0.15);
    this.bulb.userData.glassMat.emissiveIntensity = 0.25 * f * (b + s * 0.2);
  }
}
