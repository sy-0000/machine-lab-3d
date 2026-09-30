// 嵌入入口：取代原本全頁的 main.js，把工具盒場景掛進任意容器（網站的工具盒頁面）。
// 與 main.js 的差別：畫布大小跟著容器（ResizeObserver）、鍵盤只在展示時作用、離開頁面可完整釋放、
// 畫面捲出視窗時暫停繪製，並多了 showTool(i) 讓頁面上的卡片直接拿起某件工具。
import * as THREE from 'three';
import { resolveQuality } from './config/quality.config.js';
import { TOOLS } from './config/tools.config.js';
import { createRenderer } from './core/renderer.js';
import { createWorkshopEnvironment } from './core/environment.js';
import { CameraRig } from './core/cameraRig.js';
import { createPostprocessing } from './core/postprocessing.js';
import { createMaterialLibrary } from './materials/materialLibrary.js';
import { createToolbox, buildInsertAndSlots } from './assets/toolbox.js';
import { createWorkbench } from './assets/workbench.js';
import { createBackdrop } from './assets/backdrop.js';
import { createEdisonBulb } from './assets/edisonBulb.js';
import { LightRig } from './lighting/lightRig.js';
import { createVolumetricCone } from './fx/volumetricCone.js';
import { createDustMotes } from './fx/dustMotes.js';
import { createLiftPuff } from './fx/liftPuff.js';
import { StateMachine, STATES } from './state/stateMachine.js';
import { ToolController } from './interaction/toolController.js';
import { PointerInput } from './interaction/pointerInput.js';
import { InfoPanel } from './ui/infoPanel.js';
import { TweenManager } from './utils/tween.js';
import { easeInOutSine } from './utils/easing.js';

export { TOOLS };

const SHOWCASE_POINT = new THREE.Vector3(-0.05, 1.1, 1.3);

// 讓出主執行緒一下（建場景分段做，每段之間瀏覽器可以處理捲動與動畫，不會整段卡住）。
// 不用 setTimeout：分頁在背景時會被限速到每秒一次。
const breathe = () => globalThis.scheduler?.yield?.() ?? new Promise((resolve) => {
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = () => resolve();
  port2.postMessage(0);
});

/**
 * 分段建好場景、預先編譯著色器後才開始繪製；回傳控制物件（Promise）。
 * @param {HTMLElement} container 畫布容器（需有明確尺寸）
 * @param {HTMLElement} uiRoot    與容器同大小的疊加層，資訊面板放在這裡
 * @param {{ onReady?: () => void, onChange?: (index: number) => void }} options
 *        onChange：展示中的工具索引（-1 = 回到瀏覽）
 */
export async function mountToolbox(container, uiRoot, { onReady, onChange } = {}) {
  const quality = resolveQuality();
  const renderer = createRenderer(container, quality);
  const tweens = new TweenManager();

  // ---- 場景 ----
  const scene = new THREE.Scene();
  const bgBrowse = new THREE.Color(0x120c08), bgShow = new THREE.Color(0x030202);
  scene.background = bgBrowse.clone();
  scene.fog = new THREE.FogExp2(0x120c08, 0.07);
  const envMap = createWorkshopEnvironment(renderer);
  scene.environment = envMap;
  scene.environmentIntensity = 0.45;

  const mat = createMaterialLibrary(quality);
  scene.add(createWorkbench(mat, quality));
  scene.add(createBackdrop(mat, quality));
  const bulb = createEdisonBulb(mat);
  bulb.position.set(0.55, 2.3, -0.35);
  scene.add(bulb);
  bulb.updateMatrixWorld(true);

  const toolbox = createToolbox(mat);
  scene.add(toolbox);
  await breathe();

  // ---- 工具（資料驅動）----
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
  entries.forEach((e, i) => { e.rest = rests[i]; scene.add(e.object); });

  // ---- 燈光與特效 ----
  const lights = new LightRig(scene, quality, bulb, SHOWCASE_POINT);
  const cone = createVolumetricCone(lights.showSpot.position, SHOWCASE_POINT.clone().add(new THREE.Vector3(0, -0.35, 0)), 0.62);
  scene.add(cone.mesh);
  const dust = createDustMotes(quality.dustCount, lights.showSpot.position, SHOWCASE_POINT.clone().add(new THREE.Vector3(0, -0.3, 0)), 0.55);
  scene.add(dust.points);
  const puff = createLiftPuff();
  scene.add(puff.points);

  // ---- 相機、後處理 ----
  const rig = new CameraRig(renderer, tweens);
  const post = createPostprocessing(renderer, scene, rig.camera, quality);

  // ---- 狀態、互動、UI ----
  const sm = new StateMachine();
  const controller = new ToolController({ scene, entries, showcasePoint: SHOWCASE_POINT, tweens, puff });
  let current = -1;
  const blend = { value: 0 };
  const tweenBlend = (to, duration) => {
    const from = blend.value;
    return tweens.to({ duration, ease: easeInOutSine, onUpdate: (k) => { blend.value = from + (to - from) * k; } });
  };
  const setCurrent = (i) => { current = i; onChange?.(i); };

  const panel = new InfoPanel(uiRoot, {
    onPrev: () => step(-1), onNext: () => step(1), onReturn: () => putAway(),
  });

  const input = new PointerInput(renderer.domElement, rig.camera, () => [toolbox, ...entries.filter((e) => e.mode === 'rest').map((e) => e.object)], {
    onHover: (i) => {
      if (!sm.is(STATES.BROWSE)) return;
      controller.setHovered(i);
      post.setHover(i >= 0 ? [entries[i].object] : []);
    },
    onSelect: (i) => select(i),
    onDragStart: () => controller.beginDrag(),
    onDrag: (dx, dy) => controller.drag(dx, dy),
    onDragEnd: () => controller.endDrag(),
  });

  async function select(i) {
    if (!sm.go(STATES.LIFTING)) return;
    setCurrent(i);
    input.setMode('busy');
    controller.setHovered(-1);
    post.setHover([]);
    panel.fill(TOOLS[i], i, TOOLS.length);
    setTimeout(() => panel.show(TOOLS[i], i, TOOLS.length), 650);
    await Promise.all([controller.lift(i, 1.3), rig.enterShowcase(SHOWCASE_POINT, entries[i].radius, panel.rect(), 1.35), tweenBlend(1, 1.4)]);
    sm.go(STATES.SHOWCASE);
    input.setMode('showcase');
  }

  // 展示中換成另一件工具（上一項／下一項，或從頁面卡片直接指定）
  async function switchTo(next) {
    if (next === current || !sm.go(STATES.SWITCHING)) return;
    input.setMode('busy');
    const prev = current;
    setCurrent(next);
    panel.swapOut();
    const back = controller.putBack(prev, 1.0);
    const up = controller.lift(next, 1.2, 0.3);
    setTimeout(() => {
      panel.show(TOOLS[next], next, TOOLS.length);
      rig.reframe(SHOWCASE_POINT, entries[next].radius, panel.rect(), 0.9);
    }, 600);
    await Promise.all([back, up]);
    sm.go(STATES.SHOWCASE);
    input.setMode('showcase');
  }
  const step = (dir) => switchTo((current + dir + TOOLS.length) % TOOLS.length);

  async function putAway() {
    if (!sm.go(STATES.RETURNING)) return;
    input.setMode('busy');
    panel.hide();
    await Promise.all([controller.putBack(current, 1.2), rig.exitShowcase(1.35), tweenBlend(0, 1.4)]);
    setCurrent(-1);
    sm.go(STATES.BROWSE);
    input.setMode('browse');
  }

  // 只在展示狀態攔截方向鍵與 Esc，平常不影響頁面捲動
  const onKey = (e) => {
    if (!sm.is(STATES.SHOWCASE) || e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); putAway(); }
  };
  window.addEventListener('keydown', onKey);

  // ---- 尺寸 ----
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    rig.resize(w, h);
    post.resize(w, h);
    if (sm.is(STATES.SHOWCASE) && current >= 0) rig.reframe(SHOWCASE_POINT, entries[current].radius, panel.rect(), 0.4);
    const pr = renderer.getPixelRatio();
    dust.setPixelRatio(pr, h);
    puff.setPixelRatio(pr, h);
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // ---- 主迴圈（捲出畫面時暫停）----
  const clock = new THREE.Clock();
  let time = 0, frames = 0;
  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    time += dt;
    tweens.update(dt);
    const s = blend.value;
    lights.setBlend(s);
    lights.update(time);
    scene.background.copy(bgBrowse).lerp(bgShow, s);
    scene.fog.color.copy(scene.background);
    scene.fog.density = 0.07 + s * 0.12;
    scene.environmentIntensity = 0.45 * (1 - s) + 0.04 * s;
    cone.update(time, s);
    dust.update(time, s);
    puff.update(dt);
    controller.update(dt, time, sm.is(STATES.SHOWCASE));
    rig.update();
    post.render(dt);
    if (++frames === 3) onReady?.();
  }
  let running = false;
  const setRunning = (on) => {
    if (on === running) return;
    running = on;
    if (on) clock.getDelta(); // 恢復時不要一次補上暫停的時間
    renderer.setAnimationLoop(on ? frame : null);
  };
  // 第一次繪製前先把貼圖分批上傳到顯示卡、把著色器編好（支援平行編譯的瀏覽器會在背景編），
  // 否則第一格畫面要一次做完，會卡住半秒以上
  const textures = new Set();
  scene.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    }
  });
  let uploaded = 0;
  for (const t of textures) {
    renderer.initTexture(t);
    if (++uploaded % 4 === 0) await breathe();
  }
  await breathe();
  await renderer.compileAsync(scene, rig.camera).catch(() => {});
  const visibility = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting));
  visibility.observe(container);
  setRunning(true);

  return {
    tools: TOOLS,
    /** 拿起第 i 件工具展示（瀏覽中直接拿起，展示中換成它）；動畫進行中則忽略 */
    showTool(i) {
      if (sm.is(STATES.BROWSE)) select(i);
      else if (sm.is(STATES.SHOWCASE)) switchTo(i);
    },
    putAway,
    resize,
    /** 滾輪縮放：嵌在頁面裡時關掉，讓滾輪照常捲動頁面；全螢幕再打開 */
    setZoom(on) { rig.controls.enableZoom = on; },
    dispose() {
      setRunning(false);
      visibility.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('keydown', onKey);
      input.dispose();
      rig.controls.dispose();
      panel.el.remove();
      post.composer.passes.forEach((pass) => pass.dispose?.());
      post.composer.dispose();
      const textures = new Set([envMap]);
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) textures.add(u.value);
          m.dispose();
        }
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
