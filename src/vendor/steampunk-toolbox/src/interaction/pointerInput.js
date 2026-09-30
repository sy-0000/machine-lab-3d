// 指標輸入：瀏覽時射線偵測懸停／點擊工具；展示時拖曳旋轉工具
import * as THREE from 'three';

export class PointerInput {
  constructor(dom, camera, getPickables, handlers) {
    this.dom = dom; this.camera = camera; this.getPickables = getPickables; this.h = handlers;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.down = null;
    this.mode = 'browse';
    this.listeners = [
      [dom, 'pointermove', (e) => this.onMove(e)],
      [dom, 'pointerdown', (e) => this.onDown(e)],
      [window, 'pointerup', (e) => this.onUp(e)],
      [dom, 'pointerleave', () => { if (this.mode === 'browse') this.h.onHover(-1); }],
    ];
    for (const [target, type, fn] of this.listeners) target.addEventListener(type, fn);
  }
  dispose() { for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn); }
  setMode(m) { this.mode = m; this.dom.style.cursor = m === 'showcase' ? 'grab' : m === 'busy' ? 'default' : ''; }

  pick(e) {
    const r = this.dom.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hits = this.ray.intersectObjects(this.getPickables(), true);
    for (const h of hits) {
      let o = h.object;
      while (o && o.userData.toolIndex === undefined) o = o.parent;
      if (o) return o.userData.toolIndex;
      return -1; // 先被其他物體擋住
    }
    return -1;
  }

  onMove(e) {
    if (this.mode === 'browse') {
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) this.down.moved = true;
      if (e.pointerType === 'mouse' || !this.down) {
        const i = this.pick(e);
        this.h.onHover(i);
        this.dom.style.cursor = i >= 0 ? 'pointer' : '';
      }
    } else if (this.mode === 'showcase' && this.down) {
      this.h.onDrag(e.clientX - this.down.lx, e.clientY - this.down.ly);
      this.down.lx = e.clientX; this.down.ly = e.clientY;
    }
  }
  onDown(e) {
    this.down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    if (this.mode === 'showcase') { this.h.onDragStart(); this.dom.style.cursor = 'grabbing'; this.dom.setPointerCapture?.(e.pointerId); }
  }
  onUp(e) {
    const d = this.down; this.down = null;
    if (!d) return;
    if (this.mode === 'showcase') { this.h.onDragEnd(); this.dom.style.cursor = 'grab'; return; }
    if (this.mode === 'browse' && !d.moved && e.target === this.dom) {
      const i = this.pick(e);
      if (i >= 0) this.h.onSelect(i);
    }
  }
}
