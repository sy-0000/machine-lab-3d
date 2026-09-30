// 相機：瀏覽狀態使用 OrbitControls（阻尼、限距、限俯角）；展示狀態以補間推近至展示視角
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeInOutCubic } from '../utils/easing.js';

export const BROWSE_VIEW = { position: new THREE.Vector3(0.2, 2.0, 2.9), target: new THREE.Vector3(0, 0.34, 0.0) };

export class CameraRig {
  constructor(renderer, tweens) {
    this.tweens = tweens;
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 40);
    this.camera.position.copy(BROWSE_VIEW.position);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.07, enablePan: false,
      minDistance: 1.35, maxDistance: 4.4, minPolarAngle: 0.25, maxPolarAngle: 1.28,
      minAzimuthAngle: -1.1, maxAzimuthAngle: 1.1, rotateSpeed: 0.6, zoomSpeed: 0.7,
    });
    this.controls.target.copy(BROWSE_VIEW.target);
    this.controls.update();
    this.savedView = null;
    this.viewW = 1; this.viewH = 1; // 畫布大小（嵌入頁面時不等於視窗大小）
  }

  resize(w, h) {
    this.viewW = w; this.viewH = h;
    this.camera.aspect = w / h;
    // 窄螢幕時拉寬視野，避免工具盒被裁切
    this.camera.fov = w / h < 1 ? 52 : 38;
    this.camera.updateProjectionMatrix();
  }

  // 依資訊面板實際位置計算展示視角：
  // 取畫面上「未被面板覆蓋」的區域，讓工具置中於該區並完整容納（桌機在面板左側、手機在面板上方）
  showcaseView(focus, radius = 0.3, panelRect = null) {
    const w = this.viewW, h = this.viewH;
    const free = { x0: 24, x1: w - 24, y0: 28, y1: h - 28 };
    if (panelRect && panelRect.width > 0) {
      const sideBySide = panelRect.left > w * 0.4;
      if (sideBySide) free.x1 = Math.min(free.x1, panelRect.left - 28);
      else free.y1 = Math.min(free.y1, panelRect.top - 16);
    }
    const nx = ((free.x0 + free.x1) / w) - 1;
    const ny = 1 - ((free.y0 + free.y1) / h);
    const halfX = (free.x1 - free.x0) / w, halfY = (free.y1 - free.y0) / h; // NDC 半寬
    const aspect = w / h;
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    // 工具半徑 + 浮動餘量，須同時放得進自由區的寬與高
    const fit = Math.min(halfY, halfX * aspect) * tanH * 0.82;
    const d = THREE.MathUtils.clamp((radius + 0.03) / fit, 0.85, 4.2);
    const dir = new THREE.Vector3(0.1, 0.24, 1.55).normalize();
    const forward = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward);
    const target = focus.clone()
      .addScaledVector(right, -nx * d * tanH * aspect)
      .addScaledVector(up, -ny * d * tanH);
    return { position: target.clone().addScaledVector(dir, d), target };
  }

  flyTo({ position, target }, duration = 1.25) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    return this.tweens.to({
      duration, ease: easeInOutCubic,
      onUpdate: (k) => {
        this.camera.position.lerpVectors(p0, position, k);
        this.controls.target.lerpVectors(t0, target, k);
        this.camera.lookAt(this.controls.target);
      },
    });
  }

  enterShowcase(focus, radius, panelRect, duration) {
    this.savedView = { position: this.camera.position.clone(), target: this.controls.target.clone() };
    this.controls.enabled = false;
    return this.flyTo(this.showcaseView(focus, radius, panelRect), duration);
  }

  reframe(focus, radius, panelRect, duration = 0.9) {
    return this.flyTo(this.showcaseView(focus, radius, panelRect), duration);
  }

  async exitShowcase(duration) {
    const back = this.savedView || BROWSE_VIEW;
    await this.flyTo(back, duration);
    this.controls.enabled = true;
  }

  update() { if (this.controls.enabled) this.controls.update(); }
}
