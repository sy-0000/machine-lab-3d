// 極簡補間管理器：以 update(dt) 驅動，回傳 Promise 方便串接狀態流程。
import { clamp01 } from './easing.js';

export class TweenManager {
  constructor() { this.items = new Set(); }
  to({ duration, ease = (t) => t, onUpdate, delay = 0 }) {
    return new Promise((resolve) => {
      this.items.add({ t: -delay, duration, ease, onUpdate, resolve });
    });
  }
  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      if (it.t < 0) continue;
      const k = clamp01(it.t / it.duration);
      it.onUpdate(it.ease(k), k);
      if (k >= 1) { this.items.delete(it); it.resolve(); }
    }
  }
}
