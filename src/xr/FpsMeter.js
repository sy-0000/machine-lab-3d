import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

// 頭盔裡看得到的 FPS 顯示：固定在視野左下角（掛在相機底下），每半秒更新一次。
// 低於 72 fps（Quest 的基本更新率）顯示橘色，低於 60 顯示紅色。
export class FpsMeter {
  constructor(camera, { visible = false } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.mesh = new Mesh(new PlaneGeometry(0.1, 0.0375), new MeshBasicMaterial({ map: this.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false }));
    this.mesh.name = 'FpsMeter';
    this.mesh.position.set(-0.11, -0.09, -0.4);
    this.mesh.renderOrder = 999;
    this.mesh.visible = visible;
    camera.add(this.mesh);
    this.frames = 0; this.time = 0; this.fps = 0;
    this.draw();
  }
  get visible() { return this.mesh.visible; }
  toggle() { this.mesh.visible = !this.mesh.visible; }
  update(dt) {
    this.frames++; this.time += dt;
    if (this.time < 0.5) return;
    this.fps = Math.round(this.frames / this.time);
    this.frames = 0; this.time = 0;
    if (this.mesh.visible) this.draw();
  }
  draw() {
    const { ctx, canvas } = this, f = this.fps;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20,14,8,.72)';
    ctx.beginPath(); ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 14); ctx.fill();
    ctx.fillStyle = f >= 72 ? '#9df0b8' : f >= 60 ? '#ffb85c' : '#ff6b5c';
    ctx.font = 'bold 54px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${f || '--'} fps`, 22, canvas.height / 2 + 2);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
  }
}
