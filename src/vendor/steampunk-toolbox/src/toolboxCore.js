// 工具盒的可重用核心：工具盒與 13 件工具（資料驅動）、拿起／切換／放回的狀態流程與燈光混合值。
// 不含 renderer、相機、HTML 面板與指標輸入——這些由外層提供：
//   mount.js：網站工具盒頁面（桌機，行為與拆開前相同）
//   src/xr/toolbox/：VR 工作室的工作桌（射線點選、3D 說明面板）
import * as THREE from 'three';
import { TOOLS } from './config/tools.config.js';
import { createToolbox, buildInsertAndSlots } from './assets/toolbox.js';
import { StateMachine, STATES } from './state/stateMachine.js';
import { ToolController } from './interaction/toolController.js';
import { easeInOutSine } from './utils/easing.js';

export { TOOLS, STATES };

/**
 * 建好工具盒與工具（加進 parent）。breathe() 在各段之間讓出主執行緒。
 * @returns {Promise<{ toolbox: THREE.Group, entries: Array }>}
 */
export async function buildToolbox(parent, mat, { envMap = null, breathe = async () => {} } = {}) {
  const toolbox = createToolbox(mat);
  parent.add(toolbox);
  await breathe();
  const entries = [];
  for (const [index, config] of TOOLS.entries()) {
    if (index % 3 === 0) await breathe();
    const inner = config.model(mat, config);
    const center = new THREE.Box3().setFromObject(inner).getCenter(new THREE.Vector3());
    inner.position.sub(center);
    const object = new THREE.Group();
    object.add(inner);
    object.userData.toolIndex = index;
    object.name = `Tool_${config.id}`;
    const cache = new Map();
    object.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (!cache.has(o.material)) {
        const m = o.material.clone();
        if (m.isMeshStandardMaterial) { m.envMap = envMap; m.userData.baseEnv = m.metalness > 0.5 ? 1 : 0.35; }
        cache.set(o.material, m);
      }
      o.material = cache.get(o.material);
    });
    const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) / 2 * config.display.scale;
    entries.push({ object, config, radius, materials: [...cache.values()].filter((m) => m.isMeshStandardMaterial) });
  }
  await breathe();
  const rests = buildInsertAndSlots(toolbox, entries.map((e) => ({ object: e.object, slot: e.config.slot })), mat);
  entries.forEach((e, i) => { e.rest = rests[i]; parent.add(e.object); });
  return { toolbox, entries };
}

/**
 * 拿起 → 展示 ⇄ 切換 → 放回 的流程。scene：工具與展示支點所在的物件（工具的座標系）。
 * view：外層的配合動作（都可省略）
 *   setMode('busy' | 'showcase' | 'browse')、onSelect(i)、onSwitch(prev, next)、onPutAway()
 *   onSelect／onPutAway 可回傳 Promise（例如相機移動），流程會等它完成。
 * blend.value：0 = 瀏覽燈光、1 = 展示燈光（拿起時 1.4 秒漸變）。
 */
export function createToolFlow({ scene, entries, showcasePoint, tweens, puff, view = {}, onChange }) {
  const sm = new StateMachine();
  const controller = new ToolController({ scene, entries, showcasePoint, tweens, puff });
  const blend = { value: 0 };
  let current = -1;
  const setMode = (m) => view.setMode?.(m);
  const setCurrent = (i) => { current = i; onChange?.(i); };
  const tweenBlend = (to, duration) => {
    const from = blend.value;
    return tweens.to({ duration, ease: easeInOutSine, onUpdate: (k) => { blend.value = from + (to - from) * k; } });
  };

  async function select(i) {
    if (!sm.go(STATES.LIFTING)) return;
    setCurrent(i);
    setMode('busy');
    controller.setHovered(-1);
    const extra = view.onSelect?.(i);
    await Promise.all([controller.lift(i, 1.3), extra, tweenBlend(1, 1.4)]);
    sm.go(STATES.SHOWCASE);
    setMode('showcase');
  }

  // 展示中換成另一件工具（上一項／下一項，或直接指定）
  async function switchTo(next) {
    if (next === current || !sm.go(STATES.SWITCHING)) return;
    setMode('busy');
    const prev = current;
    setCurrent(next);
    view.onSwitch?.(prev, next);
    const back = controller.putBack(prev, 1.0);
    const up = controller.lift(next, 1.2, 0.3);
    await Promise.all([back, up]);
    sm.go(STATES.SHOWCASE);
    setMode('showcase');
  }
  const step = (dir) => switchTo((current + dir + TOOLS.length) % TOOLS.length);

  async function putAway() {
    if (!sm.go(STATES.RETURNING)) return;
    setMode('busy');
    const extra = view.onPutAway?.();
    await Promise.all([controller.putBack(current, 1.2), extra, tweenBlend(0, 1.4)]);
    setCurrent(-1);
    sm.go(STATES.BROWSE);
    setMode('browse');
  }

  return {
    sm, controller, blend, select, switchTo, step, putAway,
    get current() { return current; },
    /** 瀏覽中直接拿起，展示中換成它；動畫進行中則忽略 */
    show(i) {
      if (sm.is(STATES.BROWSE)) select(i);
      else if (sm.is(STATES.SHOWCASE)) switchTo(i);
    },
  };
}
