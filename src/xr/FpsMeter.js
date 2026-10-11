import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

// 頭盔裡看得到的效能顯示：固定在視野左下角（掛在相機底下），每秒更新一次（取這一秒的平均）。
//   第 1 行：FPS 與每格毫秒（低於 72 fps＝Quest 基本更新率顯示橘色，低於 60 紅色）
//   第 2 行：draw calls 與三角形數（每格，XR 雙眼與陰影貼圖都算在內）
//   第 3 行：GPU 上的貼圖與幾何數量
//   第 4 行：目前場景開著的燈光數（點光源／全部）與會產生陰影貼圖的燈光數
// 開關：桌機 F、VR 右手 B；開發模式預設開、正式版加 ?fps 開。
export class FpsMeter {
  constructor(camera, { visible = false } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512; this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(new PlaneGeometry(0.15, 0.075), new MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    this.mesh.name = 'FpsMeter';
    this.mesh.position.set(-0.13, -0.1, -0.45);
    this.mesh.renderOrder = 999;
    this.mesh.visible = visible;
    camera.add(this.mesh);
    this.frames = 0; this.time = 0; this.calls = 0; this.triangles = 0;
    this.stats = { fps: 0, ms: 0, calls: 0, triangles: 0, textures: 0, geometries: 0, pointLights: 0, lights: 0, shadows: 0 };
    this.draw();
  }
  get visible() { return this.mesh.visible; }
  toggle() { this.mesh.visible = !this.mesh.visible; }
  /** 每格 render 之後呼叫：累計這一格的 draw calls 與三角形；每秒整理一次並重畫 */
  update(dt, renderer, scene) {
    this.frames++; this.time += dt;
    if (renderer) { this.calls += renderer.info.render.calls; this.triangles += renderer.info.render.triangles; }
    if (this.time < 1) return;
    const n = this.frames, s = this.stats;
    s.fps = Math.round(n / this.time); s.ms = this.time / n * 1000;
    s.calls = Math.round(this.calls / n); s.triangles = Math.round(this.triangles / n);
    if (renderer) { s.textures = renderer.info.memory.textures; s.geometries = renderer.info.memory.geometries; }
    if (scene) {
      let point = 0, all = 0, shadows = 0;
      scene.traverseVisible(o => { if (!o.isLight || o.intensity <= 0) return; all++; if (o.isPointLight) point++; if (o.castShadow && !o.isAmbientLight && !o.isHemisphereLight) shadows++; });
      s.pointLights = point; s.lights = all; s.shadows = renderer?.shadowMap.enabled ? shadows : 0;
    }
    this.frames = 0; this.time = 0; this.calls = 0; this.triangles = 0;
    if (this.mesh.visible) this.draw();
  }
  draw() {
    const { ctx, canvas, stats: s } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20,14,8,.78)';
    ctx.beginPath(); ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18); ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.fps >= 72 ? '#9df0b8' : s.fps >= 60 ? '#ffb85c' : '#ff6b5c';
    ctx.font = 'bold 58px "IBM Plex Mono", monospace';
    ctx.fillText(`${s.fps || '--'} fps`, 24, 48);
    ctx.font = 'bold 34px "IBM Plex Mono", monospace';
    ctx.fillText(`${s.ms ? s.ms.toFixed(1) : '--'} ms`, 330, 50);
    ctx.fillStyle = '#f3e3c3'; ctx.font = '30px "IBM Plex Mono", monospace';
    const k = v => (v >= 10000 ? `${(v / 1000).toFixed(0)}k` : String(v));
    ctx.fillText(`draw ${s.calls}   tri ${k(s.triangles)}`, 24, 112);
    ctx.fillText(`tex ${s.textures}   geo ${s.geometries}`, 24, 160);
    ctx.fillText(`light ${s.pointLights}/${s.lights}   shadow ${s.shadows}`, 24, 208);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
  }
}
