// VR 世界（#/world）：單一 WebGLRenderer（vanilla three.js，xr.enabled）。
// 第 1 階段：穹頂工作室（src/vendor/steampunk-workshop，未修改）＋ 房間中央的一台機台，可在 Quest 中看到。
// 房間固定不轉，機台正面朝南（+Z，朝大門）；桌機版仍是「轉房間」，兩者互不影響。
// 桌機瀏覽器直接開 #/world 時用滑鼠繞看（方便配合 Immersive Web Emulator 除錯），有後製；XR 中一律略過後製。
import {
  ACESFilmicToneMapping, Box3, BoxGeometry, CanvasTexture, Clock, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resolveQuality } from '../vendor/steampunk-workshop/src/config/quality.js';
import { createScene } from '../vendor/steampunk-workshop/src/core/scene.js';
import { createSky } from '../vendor/steampunk-workshop/src/core/sky.js';
import { createPostPipeline } from '../vendor/steampunk-workshop/src/core/postprocessing.js';
import { buildWorld } from '../vendor/steampunk-workshop/src/app/world.js';
import { createLights } from '../vendor/steampunk-workshop/src/lighting/lights.js';
import { createEffects } from '../vendor/steampunk-workshop/src/effects/effects.js';
import { prewarmWorkshop, warmUpGpu } from '../prewarm/prewarm.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { FpsMeter } from './FpsMeter.js';

// 機台在房間裡的朝向：把各模型的操作側轉到 +Z（南）。車床、鑽床的操作側原本就在 +Z，銑床在 +X。
export const VR_FACING = { lathe: 0, milling: -Math.PI / 2, drill: 0 };
// 桌上型機台站在鐵座上（公尺），與桌機版相同
const PEDESTAL = { drill: 0.72 };
// 第 1 階段的出生點：機台正面（之後改成大門口 / 工作桌前）
const SPAWN = new Vector3(0, 0, 1.6);

function disposeTree(root) {
  const textures = new Set();
  root.traverse(o => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) textures.add(u.value);
      m.dispose();
    }
  });
  textures.forEach(t => t.dispose());
}

// 載入中的提示板（在玩家前方 1.3 m）；第 4 階段改用共用的 3D 面板元件
function createNotice() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d'), texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const mesh = new Mesh(new PlaneGeometry(1, 0.25), new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, fog: false }));
  mesh.position.set(0, 1.5, -1.3);
  const set = text => {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = 'rgba(28,20,12,.88)'; ctx.beginPath(); ctx.roundRect(8, 8, 1008, 240, 28); ctx.fill();
    ctx.strokeStyle = '#c9a25a'; ctx.lineWidth = 6; ctx.stroke();
    ctx.fillStyle = '#f3e3c3'; ctx.font = '500 64px "Noto Sans TC", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 512, 132);
    texture.needsUpdate = true;
  };
  return { mesh, set, dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); texture.dispose(); } };
}

function createPedestal(object, height) {
  const box = new Box3().setFromObject(object), w = box.max.x - box.min.x + 0.12, d = box.max.z - box.min.z + 0.1;
  const iron = new MeshStandardMaterial({ color: '#2e2a26', metalness: 0.65, roughness: 0.55 });
  const brass = new MeshStandardMaterial({ color: '#b38b4c', metalness: 0.9, roughness: 0.35 });
  const g = new Group();
  g.name = 'MachinePedestal';
  const add = (geo, mat, y) => { const m = new Mesh(geo, mat); m.position.y = y; m.castShadow = m.receiveShadow = true; g.add(m); };
  add(new BoxGeometry(w + 0.08, 0.06, d + 0.08), iron, 0.03);
  add(new BoxGeometry(w - 0.04, height - 0.08, d - 0.04), iron, height / 2);
  add(new BoxGeometry(w, 0.05, d), brass, height - 0.025);
  g.position.set((box.min.x + box.max.x) / 2, 0, (box.min.z + box.max.z) / 2);
  return g;
}

/**
 * @param {HTMLElement} container
 * @param {{ machineId?: string, onStatus?: (text: string) => void, onExitVR?: () => void }} options
 */
export function createWorld(container, { machineId = 'lathe', onStatus = () => {}, onExitVR = () => {} } = {}) {
  const quality = resolveQuality();
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  container.appendChild(renderer.domElement);

  const scene = createScene(renderer);
  // 玩家（dolly）：XR 中頭盔姿勢相對於它；瞬移時移動它
  const player = new Group();
  player.name = 'Player';
  scene.add(player);
  const camera = new PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.05, 200);
  camera.position.set(2.4, 1.7, 3.4);
  player.add(camera);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 0.9, 0);
  orbit.enableDamping = true;
  orbit.update();
  const notice = createNotice();
  player.add(notice.mesh);
  notice.set('正在搭建蒸汽工作室…');

  const params = new URLSearchParams(location.search);
  const fps = new FpsMeter(camera, { visible: import.meta.env.DEV || params.has('fps') });
  const post = createPostPipeline(renderer, scene, camera, quality);

  let room = null, machine = null, disposed = false, elapsed = 0, frame = 0, fpsButton = false;
  const machineRoot = new Group();
  machineRoot.name = 'MachineSlot';

  // 只在建好之後才加入場景（與桌機版相同：先上傳貼圖、編譯著色器，第一次畫出來才不會卡住）
  const ready = (async () => {
    await prewarmWorkshop();
    if (disposed) return;
    const root = new Group();
    root.name = 'SteampunkWorkshop';
    const sky = createSky(root);
    const world = await buildWorld(root, quality);
    if (disposed) return disposeTree(root);
    const lights = createLights(root, quality, world.anchors);
    const effects = world.panels ? createEffects(root, renderer, camera, quality, world) : null;
    await warmUpGpu(renderer, root, camera, scene);
    if (disposed) return disposeTree(root);
    scene.add(root);
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    room = { root, world, lights, effects, sky };

    notice.set('下載機台模型…');
    const instance = await MachineRegistry.load(machineId, { onProgress: p => notice.set(`下載機台模型 ${Math.round(p)}%`) });
    if (disposed) return;
    const m = instance.runtime;
    // 機台中心對齊房間中央，底部（或鐵座底）對齊地板，操作側朝 +Z
    const lift = PEDESTAL[machineId] || 0;
    const offset = new Group();
    offset.position.set(-m.center.x, -m.center.y - m.floor + lift, -m.center.z);
    offset.add(m.scene);
    machineRoot.rotation.y = VR_FACING[machineId] ?? 0;
    machineRoot.add(offset);
    if (lift) machineRoot.add(createPedestal(offset, lift));
    await warmUpGpu(renderer, machineRoot, camera, scene);
    if (disposed) return;
    scene.add(machineRoot);
    machine = { instance, runtime: m }; // 第 6 階段起接上 MachineSession
    renderer.shadowMap.needsUpdate = true;
    notice.dispose();
    onStatus('');
  })().catch(error => {
    if (disposed) return;
    console.error('VR 世界載入失敗', error);
    notice.set('載入失敗：' + error.message);
    onStatus('載入失敗：' + error.message);
  });

  const onKey = e => {
    if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') fps.toggle();
  };
  addEventListener('keydown', onKey);

  // 右手 B 鍵開關 FPS（第 3 階段起改由 InputManager 處理按鍵）
  function pollButtons() {
    const session = renderer.xr.getSession();
    let pressed = false;
    for (const source of session?.inputSources || []) if (source.handedness === 'right') pressed = !!source.gamepad?.buttons[5]?.pressed;
    if (pressed && !fpsButton) fps.toggle();
    fpsButton = pressed;
  }

  const clock = new Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), xr = renderer.xr.isPresenting;
    elapsed += dt;
    fps.update(dt);
    if (xr) {
      pollButtons();
      // 先套用這一格的頭盔姿勢，掛在相機上的 FPS 顯示才不會慢一格
      renderer.xr.updateCamera(camera);
      camera.updateMatrixWorld(true);
    } else orbit.update();
    if (room) {
      if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
      room.world.update(dt, elapsed, camera);
      room.lights.update(elapsed);
      room.effects?.update(dt, elapsed);
      room.sky.update(dt, elapsed);
    }
    if (xr) renderer.render(scene, camera);
    else post.render(dt, elapsed);
  });

  const resize = () => {
    if (renderer.xr.isPresenting || !container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    post.setSize(container.clientWidth, container.clientHeight);
    room?.effects?.resize();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const onSessionStart = () => {
    orbit.enabled = false;
    player.position.copy(SPAWN);
    player.rotation.set(0, 0, 0);
  };
  const onSessionEnd = () => {
    orbit.enabled = true;
    player.position.set(0, 0, 0);
    camera.position.set(2.4, 1.7, 3.4);
    resize();
    onExitVR();
  };
  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  return {
    ready,
    /** 接手一個已開啟的 immersive-vr session（首頁按鈕或本頁按鈕開的） */
    enterVR: session => renderer.xr.setSession(session),
    exitVR: () => renderer.xr.getSession()?.end(),
    dispose() {
      disposed = true;
      renderer.xr.removeEventListener('sessionstart', onSessionStart);
      renderer.xr.removeEventListener('sessionend', onSessionEnd);
      renderer.xr.getSession()?.end().catch(() => {});
      renderer.setAnimationLoop(null);
      observer.disconnect();
      removeEventListener('keydown', onKey);
      orbit.dispose();
      post.dispose();
      fps.dispose();
      notice.dispose();
      machineRoot.removeFromParent();
      MachineRegistry.unload(); // 也會取消還在下載的機台
      for (const child of machineRoot.children.slice()) if (child.name === 'MachinePedestal') disposeTree(child);
      if (room) { scene.remove(room.root); disposeTree(room.root); }
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
