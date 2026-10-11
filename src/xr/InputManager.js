import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Raycaster, SphereGeometry, Vector2, Matrix4 } from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

// 輸入抽象層：滑鼠點擊與控制器 trigger 統一成 hover / select；各區域只登記「可互動物件」與它的回呼，
// 不直接處理滑鼠或控制器。第 3 階段會再加上 grip 的 grab / drag / release 與震動。
// 兩手控制器都有射線；指到可互動物件時物件高亮（同一物件被兩手同時指到也只亮一次）。
// 手部追蹤目前不支援：來源都以 XRInputSource 處理，日後加入 hand 只需在 #sources 增加一種指標。

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
  #targets = new Map(); // object → { onSelect, onHover, enabled, meshes }
  #sources = [];        // 指標：{ kind, ray(raycaster) , hovered, pressed }
  #hoverCount = new Map();
  #buttons = [];        // { hand, index, fn, down }
  #raycaster = new Raycaster();
  #matrix = new Matrix4();

  constructor({ renderer, camera, player }) {
    this.renderer = renderer; this.camera = camera; this.player = player;
    this.#setupMouse();
    this.#setupControllers();
  }

  /**
   * 登記可互動物件。回傳移除函式。
   * @param {import('three').Object3D} object
   * @param {{ onSelect?: Function, onHover?: (on: boolean) => void, enabled?: () => boolean, highlight?: boolean }} handlers
   */
  add(object, handlers = {}) {
    const meshes = handlers.highlight === false ? [] : prepareHighlight(object);
    this.#targets.set(object, { ...handlers, meshes });
    return () => this.remove(object);
  }
  remove(object) {
    for (const s of this.#sources) { if (s.hovered === object) this.#hover(s, null); if (s.pressed === object) s.pressed = null; }
    this.#targets.delete(object);
  }
  /** 換區域時清空 */
  clear() { for (const object of [...this.#targets.keys()]) this.remove(object); }

  /** 控制器按鈕（xr-standard：4 = A/X、5 = B/Y）按下的瞬間呼叫 fn。回傳移除函式。 */
  onButton(hand, index, fn) {
    const entry = { hand, index, fn, down: false };
    this.#buttons.push(entry);
    return () => { this.#buttons = this.#buttons.filter(b => b !== entry); };
  }

  #pick(raycaster) {
    const objects = [...this.#targets.keys()].filter(o => o.visible && this.#targets.get(o).enabled?.() !== false);
    const hit = raycaster.intersectObjects(objects, true)[0];
    if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) if (this.#targets.has(o)) return { object: o, distance: hit.distance, point: hit.point };
    return null;
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
  #select(object) { const t = this.#targets.get(object); if (t && t.enabled?.() !== false) t.onSelect?.(); }

  // ---- 滑鼠（桌機直接開 #/world 時）：移動 = hover；按下放開且沒拖曳 = select（拖曳留給視角控制）
  #setupMouse() {
    const dom = this.renderer.domElement, ndc = new Vector2();
    const source = { kind: 'mouse', hovered: null, pressed: null, at: null, active: false };
    this.#sources.push(source);
    this.mouse = source;
    const cast = e => {
      const r = dom.getBoundingClientRect();
      ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      this.#raycaster.setFromCamera(ndc, this.camera);
      return this.#pick(this.#raycaster);
    };
    const move = e => {
      if (this.renderer.xr.isPresenting) return;
      if (source.at && Math.hypot(e.clientX - source.at[0], e.clientY - source.at[1]) > 6) source.pressed = null;
      const hit = cast(e);
      this.#hover(source, hit?.object || null);
      dom.style.cursor = hit ? 'pointer' : '';
    };
    const down = e => { if (e.button !== 0 || this.renderer.xr.isPresenting) return; source.at = [e.clientX, e.clientY]; source.pressed = cast(e)?.object || null; };
    const up = e => {
      if (e.button !== 0 || !source.at) return;
      const pressed = source.pressed; source.at = null; source.pressed = null;
      if (pressed && cast(e)?.object === pressed) this.#select(pressed);
    };
    const leave = () => { this.#hover(source, null); dom.style.cursor = ''; };
    const listeners = [['pointermove', move], ['pointerdown', down], ['pointerup', up], ['pointerleave', leave]];
    for (const [type, fn] of listeners) dom.addEventListener(type, fn);
    this.#disposeMouse = () => { for (const [type, fn] of listeners) dom.removeEventListener(type, fn); };
  }
  #disposeMouse = () => {};

  // ---- 控制器：每手一條射線；trigger 按下記住指到的物件，放開時仍指著同一個才算 select（避免誤觸）
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
      const source = { kind: 'controller', index: i, controller, grip, line, dot, inputSource: null, hovered: null, pressed: null, active: false };
      controller.addEventListener('connected', e => { source.inputSource = e.data; source.active = !e.data.hand; controller.visible = source.active; });
      controller.addEventListener('disconnected', () => { this.#hover(source, null); source.inputSource = null; source.active = false; });
      controller.addEventListener('selectstart', () => { source.pressed = source.hovered; });
      controller.addEventListener('selectend', () => { const p = source.pressed; source.pressed = null; if (p && p === source.hovered) this.#select(p); });
      this.#sources.push(source);
      this.controllers.push(source);
    }
  }

  /** 每格呼叫一次（XR 中） */
  update() {
    const presenting = this.renderer.xr.isPresenting;
    if (presenting && this.mouse.hovered) this.#hover(this.mouse, null);
    for (const s of this.controllers) {
      if (!presenting || !s.active) { if (s.hovered) this.#hover(s, null); continue; }
      s.controller.updateMatrixWorld(true);
      this.#matrix.identity().extractRotation(s.controller.matrixWorld);
      this.#raycaster.ray.origin.setFromMatrixPosition(s.controller.matrixWorld);
      this.#raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.#matrix);
      const hit = this.#pick(this.#raycaster);
      this.#hover(s, hit?.object || null);
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
    this.clear();
    this.#disposeMouse();
    for (const s of this.controllers) {
      s.controller.removeFromParent(); s.grip.removeFromParent();
      s.line.geometry.dispose(); s.line.material.dispose(); s.dot.geometry.dispose(); s.dot.material.dispose();
    }
  }
}
