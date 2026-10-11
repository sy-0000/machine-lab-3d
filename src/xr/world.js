// VR 世界（#/world）：單一 WebGLRenderer（vanilla three.js，xr.enabled、local-floor）。
// SceneManager 管理「大門口」與「工作室」兩個區域（各自建場景、離開時釋放），切換時淡出淡入；
// InputManager 把滑鼠與控制器統一成 hover / select。XR 中一律略過後製；桌機直接開 #/world 時用滑鼠繞看。
// 網址參數（除錯用）：?area=lobby|workshop（預設大門口）、?machine=lathe|milling|drill、?fps
import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resolveQuality } from '../vendor/steampunk-workshop/src/config/quality.js';
import { createScene } from '../vendor/steampunk-workshop/src/core/scene.js';
import { FpsMeter } from './FpsMeter.js';
import { InputManager } from './InputManager.js';
import { SceneManager } from './SceneManager.js';
import { createLobby } from './areas/Lobby.js';
import { createWorkshop } from './areas/Workshop.js';

/**
 * @param {HTMLElement} container
 * @param {{ onStatus?: (text: string) => void, onExitVR?: () => void }} options
 */
export function createWorld(container, { onStatus = () => {}, onExitVR = () => {} } = {}) {
  const params = new URLSearchParams(location.search);
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

  // 玩家（dolly）：XR 中頭盔與控制器的姿勢都相對於它；換區域、之後的瞬移都是移動它
  const player = new Group();
  player.name = 'Player';
  const camera = new PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.05, 300);
  player.add(camera);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  const setDesktopView = ({ eye, target }) => {
    camera.position.set(...eye);
    orbit.target.set(...target);
    orbit.update();
  };

  // 工作室的暖色反射環境（PMREM）只建一次、各區域共用：createScene() 每次呼叫都會留下幾個沒釋放的小幾何
  const shared = createScene(renderer);
  const environment = { texture: shared.environment, intensity: shared.environmentIntensity, fog: shared.fog };

  const fps = new FpsMeter(camera, { visible: import.meta.env.DEV || params.has('fps') });
  const input = new InputManager({ renderer, camera, player });
  const manager = new SceneManager({ renderer, camera, player, input, quality, environment, setDesktopView, onStatus });
  const ctx = manager.ctx;
  ctx.status = text => manager.status(text);
  ctx.go = (name, options) => manager.go(name, options).catch(() => {});
  manager.register('lobby', createLobby);
  manager.register('workshop', createWorkshop);

  const machineId = params.get('machine') || 'lathe';
  const startArea = params.get('area') === 'workshop' ? 'workshop' : 'lobby';
  const ready = manager.go(startArea, { machineId });
  // 開發模式除錯用：檢查換區域後 GPU 資源有沒有釋放（renderer.info.memory）
  if (import.meta.env.DEV) window.__xrWorld = { renderer, manager };

  // 右手 B：開關 FPS；左手 Y：暫時用來回到大門口（第 3 階段改成叫出選單）
  input.onButton('right', 5, () => fps.toggle());
  input.onButton('left', 5, () => ctx.go('lobby'));
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') fps.toggle();
    if (e.key === 'l' || e.key === 'L') ctx.go('lobby');
  };
  addEventListener('keydown', onKey);

  const clock = new Clock();
  let elapsed = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05), xr = renderer.xr.isPresenting;
    elapsed += dt;
    fps.update(dt);
    if (xr) {
      // 先套用這一格的頭盔姿勢，掛在相機上的黑幕、提示與 FPS 才不會慢一格
      renderer.xr.updateCamera(camera);
      camera.updateMatrixWorld(true);
    } else orbit.update();
    input.update();
    manager.update(dt, elapsed);
    manager.render(xr, dt, elapsed);
  });

  const resize = () => {
    if (renderer.xr.isPresenting || !container.clientWidth || !container.clientHeight) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    manager.current?.resize?.(container.clientWidth, container.clientHeight);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const onSessionStart = () => { orbit.enabled = false; manager.placePlayer(); };
  const onSessionEnd = () => { orbit.enabled = true; manager.placePlayer(); resize(); onExitVR(); };
  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  return {
    ready,
    manager,
    /** 接手一個已開啟的 immersive-vr session（首頁按鈕或本頁按鈕開的） */
    enterVR: session => renderer.xr.setSession(session),
    exitVR: () => renderer.xr.getSession()?.end(),
    dispose() {
      renderer.xr.removeEventListener('sessionstart', onSessionStart);
      renderer.xr.removeEventListener('sessionend', onSessionEnd);
      renderer.xr.getSession()?.end().catch(() => {});
      renderer.setAnimationLoop(null);
      observer.disconnect();
      removeEventListener('keydown', onKey);
      manager.dispose();
      input.dispose();
      orbit.dispose();
      fps.dispose();
      environment.texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
