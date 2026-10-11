import { BackSide, Color, Mesh, MeshBasicMaterial, PlaneGeometry, Scene, SphereGeometry, Vector3 } from 'three';
import { canvasTexture } from './ui/canvasText.js';
import { drawNotice, loadSignFonts } from './ui/theme.js';

// 場景管理：大門口、工作室等「區域」各是一個模組，提供
//   enter(options) → Promise<{ spawn: Vector3, yaw, view? }>     建場景，回傳玩家出生點（地面座標）、面向與桌機視角
//   exit()                                                  dispose 幾何、材質、貼圖
//   update(dt, elapsed)、render(xr, dt, elapsed)（可省略，預設直接繪製 area.scene）
//   scene、view: { eye, target }（桌機直接開 #/world 時的滑鼠繞看視角）
// 切換時先淡出成全黑 → 換場景 → 淡入，避免 VR 中瞬間跳切造成不適；載入較久時黑幕上顯示提示。
// 同一區域內換站位用 moveTo()：VR 中程式絕不自行移動或旋轉視角，一律「淡出 → 移到固定站位 → 淡入」；
// 桌機直接開 #/world（除錯）時改成平滑移動鏡頭。

const FADE_SECONDS = 0.35;

export class SceneManager {
  #factories = new Map();
  #busy = null;
  #pending = null;

  constructor(ctx) {
    this.ctx = ctx; // { renderer, camera, player, input, quality, setDesktopView }
    this.current = null;
    this.currentName = '';
    // 沒有區域時（第一次載入、切換中）畫這個全黑場景
    this.limbo = new Scene();
    this.limbo.background = new Color(0x050302);
    this.limbo.add(ctx.player);

    // 黑幕：貼在相機上的小球（內側），淡入淡出改透明度；永遠畫在最上層
    this.fade = new Mesh(new SphereGeometry(0.25, 24, 12), new MeshBasicMaterial({ color: 0x000000, side: BackSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    this.fade.name = 'Fade';
    this.fade.renderOrder = 9999;
    this.fadeValue = 1; this.fadeTarget = 1;
    ctx.camera.add(this.fade);

    // 載入提示：在黑幕之上，眼前 1.2 m
    this.label = canvasTexture(1024, 192);
    this.loading = new Mesh(new PlaneGeometry(0.9, 0.169), new MeshBasicMaterial({ map: this.label.texture, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
    this.loading.position.set(0, -0.05, -1.2);
    this.loading.renderOrder = 10000;
    this.loading.visible = false;
    ctx.camera.add(this.loading);
  }

  register(name, factory) { this.#factories.set(name, factory); }

  /** 顯示載入提示（區域在 enter 中可呼叫 ctx.status(text) 更新進度） */
  status(text) {
    const { ctx, canvas, texture } = this.label;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (text) {
      drawNotice(ctx, canvas.width, canvas.height, text, { size: 56 });
      // 字型分片還沒下載的字：下載好後若仍是同一句就重畫
      loadSignFonts(text).then(() => { if (this.statusText === text) { drawNotice(ctx, canvas.width, canvas.height, text, { size: 56 }); texture.needsUpdate = true; } });
    }
    this.statusText = text;
    texture.needsUpdate = true;
    this.loading.visible = !!text;
    this.ctx.onStatus?.(text);
  }

  get busy() { return !!this.#busy; }

  /** 切換到區域 name。切換中再呼叫時，只保留最後一次要求。 */
  go(name, options = {}) {
    if (this.#busy) { this.#pending = [name, options]; return this.#busy; }
    this.#busy = this.#switch(name, options).finally(() => {
      this.#busy = null;
      if (this.#pending) { const [n, o] = this.#pending; this.#pending = null; this.go(n, o); }
    });
    return this.#busy;
  }

  async #switch(name, options) {
    const factory = this.#factories.get(name);
    if (!factory) throw new Error('未知的區域：' + name);
    await this.#fadeTo(1);
    const { player, input } = this.ctx;
    input.clear();
    if (this.current) {
      this.limbo.add(player);
      this.current.exit();
      this.current = null;
    }
    this.currentName = name;
    const slow = setTimeout(() => this.status('載入中…'), 300);
    const area = factory(this.ctx);
    try {
      const { spawn, yaw = 0, view } = await area.enter(options);
      this.current = area;
      area.scene.add(player);
      this.spawn = { position: spawn.clone(), yaw, view };
      this.placePlayer();
    } catch (error) {
      clearTimeout(slow);
      console.error('區域載入失敗', error);
      this.status('載入失敗：' + error.message);
      throw error;
    }
    clearTimeout(slow);
    this.status('');
    await this.#fadeTo(0);
  }

  /** XR 中把玩家放到目前站位；桌機改設滑鼠繞看視角 */
  placePlayer() {
    const { player, renderer, setDesktopView } = this.ctx;
    if (renderer.xr.isPresenting && this.spawn) {
      player.position.copy(this.spawn.position);
      player.rotation.set(0, this.spawn.yaw, 0);
    } else {
      player.position.set(0, 0, 0);
      player.rotation.set(0, 0, 0);
      const view = this.spawn?.view || this.current?.view;
      if (view) setDesktopView(view);
    }
  }

  /**
   * 在目前區域內換站位。station = { position: 地面座標, yaw, view?: { eye, target } }（view 給桌機用）。
   * VR：淡出 → 移過去 → 淡入；桌機：鏡頭在 seconds 秒內平滑移到 view。回傳 Promise；忙碌中回傳 null。
   */
  moveTo(station, { seconds = 1.2 } = {}) {
    if (this.#busy) return null; // 正在換站位或換區域：不接受（呼叫端據此判斷沒有移動）
    const { renderer, setDesktopView } = this.ctx;
    const run = (async () => {
      this.spawn = { position: station.position.clone(), yaw: station.yaw ?? 0, view: station.view };
      if (renderer.xr.isPresenting) {
        await this.#fadeTo(1);
        this.placePlayer();
        await this.#fadeTo(0);
      } else if (station.view) await setDesktopView(station.view, seconds);
    })();
    this.#busy = run.finally(() => { this.#busy = null; });
    return this.#busy;
  }

  /** 只淡出（不換站位）：例如開金庫門後再切換到工作室，讓黑幕銜接 */
  fadeOut() { return this.#fadeTo(1); }

  // 淡出／淡入：回傳到達目標時完成的 Promise。另一個要求改了目標時，先前在等的立刻完成（不會永遠卡住，
  // 否則 moveTo／go 的 #busy 不會清掉，之後的換區域會一直排隊，畫面停在黑幕）
  #fadeTo(value) {
    if (this.fadeTarget !== value) this.#settleFades();
    this.fadeTarget = value;
    if (this.fadeValue === value) return Promise.resolve();
    return new Promise(resolve => this.#fadeWaiters.push(resolve));
  }
  #settleFades() { const list = this.#fadeWaiters; this.#fadeWaiters = []; list.forEach(resolve => resolve()); }
  #fadeWaiters = [];

  update(dt, elapsed) {
    if (this.fadeValue !== this.fadeTarget) {
      const step = dt / FADE_SECONDS;
      this.fadeValue = this.fadeTarget > this.fadeValue ? Math.min(this.fadeTarget, this.fadeValue + step) : Math.max(this.fadeTarget, this.fadeValue - step);
      if (this.fadeValue === this.fadeTarget) this.#settleFades();
    }
    this.fade.material.opacity = this.fadeValue;
    this.fade.visible = this.fadeValue > 0.001;
    this.current?.update?.(dt, elapsed);
  }

  render(xr, dt, elapsed) {
    const { renderer, camera } = this.ctx;
    if (!this.current) return renderer.render(this.limbo, camera);
    if (this.current.render) this.current.render(xr, dt, elapsed);
    else renderer.render(this.current.scene, camera);
  }

  dispose() {
    this.#pending = null;
    this.ctx.input.clear();
    if (this.current) { this.limbo.add(this.ctx.player); this.current.exit(); this.current = null; }
    this.fade.removeFromParent(); this.fade.geometry.dispose(); this.fade.material.dispose();
    this.loading.removeFromParent(); this.loading.geometry.dispose(); this.loading.material.dispose(); this.label.texture.dispose();
  }
}

export const yawFacing = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
export const v3 = (x, y, z) => new Vector3(x, y, z);
