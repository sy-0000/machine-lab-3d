// VR 世界（#/world）：單一 WebGLRenderer（vanilla three.js，xr.enabled、local-floor）。
// SceneManager 管理「大門口」與「工作室」兩個區域（各自建場景、離開時釋放），切換時淡出淡入；
// InputManager 把滑鼠與控制器統一成 hover / select。XR 中一律略過後製；桌機直接開 #/world 時用滑鼠繞看。
// 網址參數（除錯用）：?area=lobby|workshop（預設大門口）、?machine=lathe|milling|drill、?fps
import { ACESFilmicToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, SRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resolveQuality } from '../vendor/steampunk-workshop/src/config/quality.js';
import { createScene } from '../vendor/steampunk-workshop/src/core/scene.js';
import { FpsMeter } from './FpsMeter.js';
import { InputManager } from './InputManager.js';
import { SceneManager } from './SceneManager.js';
import { createLobby } from './areas/Lobby.js';
import { createWorkshop, DESK_SPOT } from './areas/Workshop.js';
import { createProgress } from './progress.js';
import { createMenu } from './ui/Menu.js';
import { createLocomotion } from './Locomotion.js';
import { createTeleport } from './Teleport.js';

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
  // 桌機視角：seconds > 0 時平滑移過去（只用在桌機 #/world；VR 一律淡出淡入）
  let viewTween = null;
  const setDesktopView = ({ eye, target }, seconds = 0) => {
    if (!seconds) { viewTween = null; camera.position.set(...eye); orbit.target.set(...target); orbit.update(); return Promise.resolve(); }
    return new Promise(resolve => {
      viewTween = { t: 0, seconds, resolve, fromEye: camera.position.clone(), fromTarget: orbit.target.clone(), eye: new Vector3(...eye), target: new Vector3(...target) };
    });
  };
  const stepViewTween = dt => {
    const tw = viewTween;
    if (!tw) return;
    tw.t = Math.min(1, tw.t + dt / tw.seconds);
    const k = tw.t * tw.t * (3 - 2 * tw.t);
    camera.position.lerpVectors(tw.fromEye, tw.eye, k);
    orbit.target.lerpVectors(tw.fromTarget, tw.target, k);
    if (tw.t >= 1) { viewTween = null; tw.resolve(); }
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
  ctx.moveTo = (station, options) => manager.moveTo(station, options);
  ctx.fadeOut = () => manager.fadeOut();
  // 玄關的進度（大門口與選單共用同一份）
  const progress = createProgress();
  ctx.progress = progress;
  // 回到門外／玄關：已在大門口就換站位，否則切回大門口並出現在那個站位
  const goLobby = station => (manager.currentName === 'lobby' && manager.current?.goStation ? manager.current.goStation(station) : ctx.go('lobby', { station }));
  const goOutside = () => goLobby('outside');
  let lastMachine = params.get('machine') || 'lathe';
  const currentMachine = () => (manager.currentName === 'workshop' ? manager.current?.machineId : null);
  manager.register('lobby', createLobby);
  manager.register('workshop', createWorkshop);

  const machineId = params.get('machine') || 'lathe';
  const startArea = params.get('area') === 'workshop' ? 'workshop' : 'lobby';
  // ?area=workshop 直接進工作室（除錯用）
  const ready = manager.go(startArea, { machineId });
  // 開發模式除錯用：檢查換區域後 GPU 資源有沒有釋放（renderer.info.memory）
  if (import.meta.env.DEV) window.__xrWorld = { renderer, manager };

  // ---- 選單（VR：視野正前方的翻牌板；桌機：WorldPage 的 HTML 選單，用同一份項目）
  const LOCKED = '需先在玄關讀完工安規則並看完切削動畫';
  // 每項：label（翻牌字牌，最多 4 字）、platform（月台號）、group（分組）、current（目前所在地點）
  const menuItems = () => {
    const here = currentMachine(), where = manager.currentName === 'lobby' ? manager.current?.where : null;
    const unlock = item => ({ ...item, enabled: progress.unlocked, reason: LOCKED });
    const machine = (key, label, platform) => here === key
      ? { key, label, platform, group: 1, current: true, enabled: false, reason: `目前就在${label}` }
      : unlock({ key, label, platform, group: 1 });
    return [
      where === 'outside'
        ? { key: 'outside', label: '門外', platform: 'I', group: 0, current: true, enabled: false, reason: '目前就在門外' }
        : { key: 'outside', label: '門外', platform: 'I', group: 0, enabled: true },
      // 在玄關裡但不在中央（面板前、金庫門前）時仍可點，回到玄關中央
      { key: 'vestibule', label: '玄關', platform: 'II', group: 0, current: !!where && where !== 'outside', enabled: where !== 'center', reason: '目前就在玄關' },
      unlock({ key: 'toolbox', label: '工具箱', platform: 'III', group: 1 }),
      machine('lathe', '車床', 'IV'), machine('milling', '銑床', 'V'), machine('drill', '鑽床', 'VI'),
      { key: 'save', label: '存檔', group: 2, enabled: false, reason: '存檔在第 8 階段加入' },
      { key: 'exit', label: '返回首頁', group: 2, enabled: true },
    ];
  };
  const runMenu = key => {
    const item = menuItems().find(i => i.key === key);
    if (!item?.enabled) return item?.reason || '';
    if (key === 'outside') goOutside();
    else if (key === 'vestibule') goLobby('center');
    else if (key === 'toolbox') {
      // 已在工作室：回到工作桌前（第 4 階段工具箱放在桌上）
      if (manager.currentName === 'workshop') manager.moveTo({ position: DESK_SPOT, yaw: 0, view: manager.current.view });
      else ctx.go('workshop', { machineId: lastMachine });
    } else if (['lathe', 'milling', 'drill'].includes(key)) {
      // 暫時：淡出淡入重建工作室；第 7 階段改成蒸汽遮住視線的快速切換
      lastMachine = key;
      ctx.go('workshop', { machineId: key });
    } else if (key === 'exit') {
      if (renderer.xr.isPresenting) renderer.xr.getSession()?.end();
      else location.hash = '#/';
    }
    return '';
  };
  const menu = createMenu({ input, player, camera, items: menuItems, run: runMenu });
  if (import.meta.env.DEV) window.__xrWorld.menu = menu;

  // 搖桿走動（左手移動、右手快速轉向）；換區域或淡出淡入中不動
  // 瞬移：右手搖桿往前推出現拋物線，放開移到指到的圓盤（只在工作室，進過工廠後）
  const teleport = createTeleport({ renderer, player, input, area: () => manager.current, moveTo: station => manager.moveTo(station), onAim: disc => manager.current?.setTeleportTarget?.(disc) });
  const locomotion = createLocomotion({ renderer, player, camera, input, canMove: () => !manager.busy && !teleport.aiming, area: () => manager.current });

  // 右手 B：開關 FPS；左手 Y：叫出／關閉選單
  input.onButton('right', 5, () => fps.toggle());
  input.onButton('left', 5, () => menu.toggle());
  // 桌機：抓住東西時暫停滑鼠繞看
  input.onGrabChange(grabbing => { orbit.enabled = !grabbing && !renderer.xr.isPresenting; });
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'f' || e.key === 'F') fps.toggle();
    if (e.key === 'l' || e.key === 'L') goOutside();
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
    } else { stepViewTween(dt); orbit.update(); }
    teleport.update(!manager.busy);
    locomotion.update(dt);
    input.update();
    menu.update(dt);
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
  const onSessionEnd = () => { menu.hide(); orbit.enabled = true; manager.placePlayer(); resize(); onExitVR(); };
  renderer.xr.addEventListener('sessionstart', onSessionStart);
  renderer.xr.addEventListener('sessionend', onSessionEnd);

  return {
    ready,
    manager,
    menuItems,
    runMenu,
    progress,
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
      menu.dispose();
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
