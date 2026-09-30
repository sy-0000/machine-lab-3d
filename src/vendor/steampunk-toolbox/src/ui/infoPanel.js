// 展示資訊面板（HTML/CSS 疊加層，與 3D 場景分離）
export class InfoPanel {
  constructor(root, { onPrev, onNext, onReturn }) {
    this.el = document.createElement('aside');
    this.el.className = 'tool-panel';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <span class="rivet tl"></span><span class="rivet tr"></span><span class="rivet bl"></span><span class="rivet br"></span>
      <div class="tool-panel__inner">
        <p class="tool-panel__index" aria-live="polite"><span class="cur">1</span><span class="sep">/</span><span class="tot">1</span><span class="qty"></span></p>
        <h2 class="tool-panel__name"></h2>
        <div class="tool-panel__rule" aria-hidden="true"></div>
        <p class="tool-panel__desc"></p>
        <div class="tool-panel__nav">
          <button type="button" class="brass-btn" data-act="prev" aria-label="上一項">‹ 上一項</button>
          <button type="button" class="brass-btn" data-act="next" aria-label="下一項">下一項 ›</button>
        </div>
        <button type="button" class="brass-btn brass-btn--wide" data-act="return">放回盒中</button>
        <p class="tool-panel__keys">鍵盤：← → 切換，Esc 放回</p>
      </div>`;
    this.root = root;
    root.appendChild(this.el);
    this.q = (s) => this.el.querySelector(s);
    this.el.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (act === 'prev') onPrev(); else if (act === 'next') onNext(); else if (act === 'return') onReturn();
    });
  }

  fill(tool, index, total) {
    this.q('.tool-panel__name').textContent = tool.name;
    this.q('.tool-panel__desc').textContent = tool.description;
    this.q('.cur').textContent = index + 1;
    this.q('.tot').textContent = total;
    this.q('.qty').textContent = tool.quantity ? `數量 ${tool.quantity}` : '';
  }

  show(tool, index, total) {
    this.fill(tool, index, total);
    this.el.classList.remove('is-swapping');
    this.el.classList.add('is-visible');
    this.el.setAttribute('aria-hidden', 'false');
  }

  // 面板的「靜止」位置（扣除進場位移），供相機避開
  rect() {
    // 以疊加層（與畫布同大小）為原點，嵌入頁面時畫布不在視窗左上角
    const box = this.root.getBoundingClientRect();
    const e = this.el.getBoundingClientRect();
    const r = { left: e.left - box.left, right: e.right - box.left, top: e.top - box.top, bottom: e.bottom - box.top, width: e.width, height: e.height };
    const narrow = box.width <= 760;
    const dx = this.el.classList.contains('is-visible') || narrow ? 0 : 28;
    const dy = !this.el.classList.contains('is-visible') && narrow ? 24 : 0;
    return { left: r.left - dx, right: r.right - dx, top: r.top - dy, bottom: r.bottom - dy, width: r.width, height: r.height };
  }

  swapOut() { this.el.classList.add('is-swapping'); }

  hide() {
    this.el.classList.remove('is-visible', 'is-swapping');
    this.el.setAttribute('aria-hidden', 'true');
    document.activeElement?.blur?.();
  }
}
