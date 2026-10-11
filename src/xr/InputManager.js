import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Raycaster, Ray, SphereGeometry, Vector2, Vector3, Matrix4 } from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// 輸入抽象層：各區域只登記「可互動物件」與它的回呼，不直接處理滑鼠或控制器。
//   hover / select：滑鼠移過與點一下（沒拖曳）、控制器射線指著與 trigger（按下與放開都指著同一物件才算）
//   grab / drag / release：控制器 grip 按住、移動、放開；滑鼠在可抓物件上按住拖曳也走同一組事件
// 兩手控制器都有射線；指到可互動物件時物件高亮（同一物件被兩手同時指到也只亮一次）。
// 回呼收到的 info：{ kind: 'mouse' | 'controller', hand, ray（世界座標）, position（控制器位置；滑鼠為 null）, uv（射線命中點的貼圖座標）, pulse(強度, 毫秒) }
// onMove(info)：指著物件期間每次更新命中點都會呼叫（例如選單用 uv 判斷指到哪一列）
// 手部追蹤目前不支援：指標都包成「來源（source）」，日後加入 hand 只要多一種來源、產生同樣的 info。

const RAY_LENGTH = 4;
const HIGHLIGHT = 0x5a3c10;

// 把物件裡的網格材質複製一份（只複製一次），之後改 emissive 不會影響共用材質的其他物件
function prepareHighlight(object) {
  const meshes = [];
  object.traverse(o => {
    if (!o.isMesh || o.userData.noHighlight) return;
    if (!o.userData.ownMaterial) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      o.userData.ownMaterial = true;
    }
    meshes.push(o);
  });
  return meshes;
}
function setHighlight(meshes, on) {
  for (const mesh of meshes) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
    if (!m.emissive) continue;
    m.userData.baseEmissive ??= m.emissive.getHex();
    m.emissive.setHex(on ? HIGHLIGHT : m.userData.baseEmissive);
  }
}

export class InputManager {
  #targets = new Map();   // object → { onSelect, onHover, onMove, onGrab, onDrag, onRelease, enabled, persistent, meshes }
  #occluders = new Set(); // 牆面等：射線先打到它就不算指到後面的物件
  #sources = [];          // 指標：滑鼠與兩支控制器
  #hoverCount = new Map();
  #buttons = [];          // { hand, index, fn, down }
  #grabListeners = new Set();
  #raycaster = new Raycaster();
  #matrix = new Matrix4();

  constructor({ renderer, camera, player }) {
    this.renderer = renderer; this.camera = camera; this.player = player;
    this.#setupMouse();
    this.#setupControllers();
  }

  /**
   * 登記可互動物件。回傳移除函式。persistent: true 的物件（例如選單）換區域時不會被清掉。
   * @param {import('three').Object3D} object
   * @param {{ onSelect?, onHover?, onMove?, onGrab?, onDrag?, onRelease?, enabled?: () => boolean, highlight?: boolean, persistent?: boolean }} handlers
   */
  add(object, handlers = {}) {
    const meshes = handlers.highlight === false ? [] : prepareHighlight(object);
    this.#targets.set(object, { ...handlers, meshes });
    return () => this.remove(object);
  }
  remove(object) {
    for (const s of this.#sources) {
      if (s.grabbed === object) this.#release(s);
      if (s.hovered === object) this.#hover(s, null);
      if (s.pressed === object) s.pressed = null;
    }
    this.#targets.delete(object);
  }
  /** 擋住射線的物件（牆、屋頂）：隔著牆指不到後面的面板 */
  addOccluder(object) { this.#occluders.add(object); }
  /** 換區域時清空（persistent 的物件保留） */
  clear() {
    for (const [object, t] of [...this.#targets]) if (!t.persistent) this.remove(object);
    this.#occluders.clear();
  }

  /** 控制器按鈕（xr-standard：4 = A/X、5 = B/Y）按下的瞬間呼叫 fn。回傳移除函式。 */
  onButton(hand, index, fn) {
    const entry = { hand, index, fn, down: false };
    this.#buttons.push(entry);
    return () => { this.#buttons = this.#buttons.filter(b => b !== entry); };
  }
  /** 有東西被抓住／放開時呼叫 fn(grabbing)（桌機用來暫停滑鼠繞看） */
  onGrabChange(fn) { this.#grabListeners.add(fn); return () => this.#grabListeners.delete(fn); }
  get grabbing() { return this.#sources.some(s => s.grabbed); }

  /** 控制器震動；source 可以是 info 或 'left' / 'right' */
  pulse(source, intensity = 0.3, ms = 20) {
    const s = typeof source === 'string' ? this.controllers.find(c => c.inputSource?.handedness === source) : source;
    const gamepad = s?.inputSource?.gamepad;
    try {
      const actuator = gamepad?.hapticActuators?.[0];
      if (actuator?.pulse) actuator.pulse(intensity, ms);
      else gamepad?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: intensity, weakMagnitude: intensity });
    } catch { /* 不支援震動 */ }
  }
  /** 左／右手控制器的 grip 空間（選單掛在左手腕上） */
  grip(hand) { return this.controllers.find(c => c.inputSource?.handedness === hand && c.active)?.grip || null; }

  #pick(raycaster) {
    const objects = [...this.#targets.keys()].filter(o => this.#isVisible(o) && this.#targets.get(o).enabled?.() !== false);
    const hit = raycaster.intersectObjects([...objects, ...this.#occluders], true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) {
      if (this.#targets.has(o)) return { object: o, distance: hit.distance, point: hit.point, uv: hit.uv || null };
      if (this.#occluders.has(o)) return null;
    }
    return null;
  }
  #isVisible(object) { for (let o = object; o; o = o.parent) if (!o.visible) return false; return true; }
  /** 更新指標指到的物件與命中點；有 onMove 的物件每次都通知 */
  #point(source, hit) {
    source.uv = hit?.uv || null;
    this.#hover(source, hit?.object || null);
    const t = hit && this.#targets.get(hit.object);
    t?.onMove?.(this.#info(source));
  }
  #hover(source, object) {
    if (source.hovered === object) return;
    const leave = source.hovered;
    source.hovered = object;
    if (leave) {
      const n = (this.#hoverCount.get(leave) || 1) - 1;
      if (n <= 0) { this.#hoverCount.delete(leave); const t = this.#targets.get(leave); if (t) { setHighlight(t.meshes, false); t.onHover?.(false); } }
      else this.#hoverCount.set(leave, n);
    }
    if (object) {
      const n = (this.#hoverCount.get(object) || 0) + 1;
      this.#hoverCount.set(object, n);
      if (n === 1) { const t = this.#targets.get(object); setHighlight(t.meshes, true); t.onHover?.(true); }
    }
  }
  #select(object, source) {
    const t = this.#targets.get(object);
    if (t && t.enabled?.() !== false) t.onSelect?.(this.#info(source));
  }
  /** 測試用：等同點擊這個已登記的物件（只在開發模式有作用） */
  _debugSelect(object) { if (import.meta.env.DEV) this.#select(object, this.mouse); }

  #info(source) {
    const info = source.info ??= { kind: source.kind, hand: null, ray: new Ray(), position: null, pulse: (i, ms) => this.pulse(source, i, ms) };
    info.hand = source.inputSource?.handedness || null;
    info.uv = source.uv || null;
    if (source.kind === 'controller') {
      source.controller.updateMatrixWorld(true);
      info.position ??= new Vector3();
      info.position.setFromMatrixPosition(source.controller.matrixWorld);
      this.#matrix.identity().extractRotation(source.controller.matrixWorld);
      info.ray.origin.copy(info.position);
      info.ray.direction.set(0, 0, -1).applyMatrix4(this.#matrix);
    } else {
      info.ray.copy(source.ray || this.#raycaster.ray);
    }
    return info;
  }
  #grab(source, object) {
    const t = this.#targets.get(object);
    if (!t?.onGrab || t.enabled?.() === false) return false;
    if (t.onGrab(this.#info(source)) === false) return false;
    source.grabbed = object;
    this.#grabListeners.forEach(fn => fn(true));
    return true;
  }
  #release(source) {
    const object = source.grabbed;
    if (!object) return;
    source.grabbed = null;
    this.#targets.get(object)?.onRelease?.(this.#info(source));
    if (!this.grabbing) this.#grabListeners.forEach(fn => fn(false));
  }

  // ---- 滑鼠（桌機直接開 #/world 時）：移動 = hover；點一下且沒拖曳 = select；在可抓物件上按住拖曳 = grab / drag / release
  #setupMouse() {
    const dom = this.renderer.domElement, ndc = new Vector2();
    const source = { kind: 'mouse', hovered: null, pressed: null, grabbed: null, at: null, ray: new Ray() };
    this.#sources.push(source);
    this.mouse = source;
    const cast = e => {
      const r = dom.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      this.#raycaster.setFromCamera(ndc, this.camera);
      source.ray.copy(this.#raycaster.ray);
      return this.#pick(this.#raycaster);
    };
    const move = e => {
      if (this.renderer.xr.isPresenting) return;
      if (source.grabbed) { cast(e); this.#targets.get(source.grabbed)?.onDrag?.(this.#info(source)); return; }
      if (source.at && Math.hypot(e.clientX - source.at[0], e.clientY - source.at[1]) > 6) source.pressed = null;
      const hit = cast(e);
      this.#point(source, hit);
      dom.style.cursor = hit ? (this.#targets.get(hit.object)?.onGrab ? 'grab' : 'pointer') : '';
    };
    // 捕獲階段：抓住物件時攔下事件，滑鼠繞看（OrbitControls）就不會一起轉
    const down = e => {
      if (e.button !== 0 || this.renderer.xr.isPresenting) return;
      const hit = cast(e);
      if (hit && this.#targets.get(hit.object)?.onGrab && this.#grab(source, hit.object)) {
        e.stopImmediatePropagation();
        dom.setPointerCapture?.(e.pointerId);
        dom.style.cursor = 'grabbing';
        return;
      }
      source.at = [e.clientX, e.clientY]; source.pressed = hit?.object || null;
    };
    const up = e => {
      if (e.button !== 0) return;
      if (source.grabbed) { this.#release(source); dom.style.cursor = ''; return; }
      if (!source.at) return;
      const pressed = source.pressed; source.at = null; source.pressed = null;
      const hit = cast(e);
      if (pressed && hit?.object === pressed) { source.uv = hit.uv; this.#select(pressed, source); }
    };
    const leave = () => { if (!source.grabbed) { this.#hover(source, null); dom.style.cursor = ''; } };
    const listeners = [['pointermove', move], ['pointerdown', down, true], ['pointerup', up], ['pointerleave', leave]];
    for (const [type, fn, capture] of listeners) dom.addEventListener(type, fn, !!capture);
    this.#disposeMouse = () => { for (const [type, fn, capture] of listeners) dom.removeEventListener(type, fn, !!capture); };
  }
  #disposeMouse = () => {};

  // ---- 控制器：每手一條射線；trigger 按下記住指到的物件，放開時仍指著同一個才算 select；grip 抓住指到的物件
  #setupControllers() {
    const xr = this.renderer.xr, factory = new XRControllerModelFactory();
    this.controllers = [];
    for (let i = 0; i < 2; i++) {
      const controller = xr.getController(i), grip = xr.getControllerGrip(i);
      const line = new Line(new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)),
        new LineBasicMaterial({ color: 0xffd58a, transparent: true, opacity: 0.85, depthWrite: false, fog: false, toneMapped: false }));
      line.name = 'Ray';
      line.scale.z = RAY_LENGTH;
      line.renderOrder = 998;
      const dot = new Mesh(new SphereGeometry(0.008, 12, 8), new MeshBasicMaterial({ color: 0xfff1c9, fog: false, toneMapped: false }));
      dot.visible = false;
      controller.add(line, dot);
      grip.add(factory.createControllerModel(grip));
      this.player.add(controller, grip);
      const source = { kind: 'controller', index: i, controller, grip, line, dot, inputSource: null, hovered: null, pressed: null, grabbed: null, grabDistance: 0, active: false };
      controller.addEventListener('connected', e => { source.inputSource = e.data; source.active = !e.data.hand; controller.visible = source.active; });
      controller.addEventListener('disconnected', () => { this.#release(source); this.#hover(source, null); source.inputSource = null; source.active = false; });
      controller.addEventListener('selectstart', () => { source.pressed = source.hovered; });
      controller.addEventListener('selectend', () => { const p = source.pressed; source.pressed = null; if (p && p === source.hovered) this.#select(p, source); });
      controller.addEventListener('squeezestart', () => {
        if (source.hovered && this.#grab(source, source.hovered)) source.grabDistance = source.line.scale.z;
      });
      controller.addEventListener('squeezeend', () => this.#release(source));
      this.#sources.push(source);
      this.controllers.push(source);
    }
  }

  /** 每格呼叫一次 */
  update() {
    const presenting = this.renderer.xr.isPresenting;
    if (presenting && this.mouse.hovered) this.#hover(this.mouse, null);
    for (const s of this.controllers) {
      if (!presenting || !s.active) { if (s.hovered) this.#hover(s, null); this.#release(s); continue; }
      if (s.grabbed) {
        // 抓住時射線固定長度，持續送出 drag
        this.#targets.get(s.grabbed)?.onDrag?.(this.#info(s));
        s.line.scale.z = s.grabDistance;
        continue;
      }
      s.controller.updateMatrixWorld(true);
      this.#matrix.identity().extractRotation(s.controller.matrixWorld);
      this.#raycaster.ray.origin.setFromMatrixPosition(s.controller.matrixWorld);
      this.#raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.#matrix);
      const hit = this.#pick(this.#raycaster);
      this.#point(s, hit);
      s.line.scale.z = hit ? hit.distance : RAY_LENGTH;
      s.dot.visible = !!hit;
      if (hit) s.dot.position.set(0, 0, -hit.distance);
    }
    if (!presenting) return;
    for (const b of this.#buttons) {
      const source = this.controllers.find(s => s.inputSource?.handedness === b.hand);
      const pressed = !!source?.inputSource?.gamepad?.buttons[b.index]?.pressed;
      if (pressed && !b.down) b.fn();
      b.down = pressed;
    }
  }

  dispose() {
    for (const object of [...this.#targets.keys()]) this.remove(object);
    this.#occluders.clear();
    this.#disposeMouse();
    for (const s of this.controllers) {
      s.controller.removeFromParent(); s.grip.removeFromParent();
      s.line.geometry.dispose(); s.line.material.dispose(); s.dot.geometry.dispose(); s.dot.material.dispose();
    }
  }
}
