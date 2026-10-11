// 大門口（Machine Yard 入口與玄關）：門外 → 推開大門進玄關 → 讀工安告示板、看完三段切削動畫 → 金庫圓門解鎖 → 進工廠。
// 工作室（穹頂）內部不動；外牆、玄關、金庫門都在這個場景裡（見 src/xr/lobby/）。
// VR 中程式不會自行移動或旋轉視角：換站位一律「淡出 → 固定站位 → 淡入」（SceneManager.moveTo）；桌機 #/world 平滑移鏡頭。
// 進度存在 localStorage（src/xr/progress.js），重新進入時壓力錶與指示燈維持完成狀態。
import { BoxGeometry, DirectionalLight, FogExp2, Group, HemisphereLight, PlaneGeometry, Scene, Vector2, Vector3 } from 'three';
import { createMaterials } from '../../vendor/steampunk-workshop/src/materials/library.js';
import { createSky } from '../../vendor/steampunk-workshop/src/core/sky.js';
import { add } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { prewarmWorkshop, warmUpGpu } from '../../prewarm/prewarm.js';
import { loadGlyphs } from '../ui/canvasText.js';
import rules from '../../data/safety-rules.json';
import { brassButton, buttonFace } from '../ui/buttons.js';
import { disposeTree } from '../dispose.js';
import { createProgress } from '../progress.js';
import { createExterior, FACADE_Z, VEST } from '../lobby/exterior.js';
import { createVestibule } from '../lobby/vestibule.js';
import { createVaultDoor, DOOR_CENTER_Y } from '../lobby/vaultDoor.js';
import { createSafetyBoard } from '../lobby/SafetyBoard.js';
import { createProjectionScreen } from '../lobby/ProjectionScreen.js';

const v = (x, y, z) => new Vector3(x, y, z);
const BOARD_AT = v(-VEST.x + 0.03, 1.62, 13.1);
const SCREEN_AT = v(VEST.x - 0.03, 1.72, 13.1);
// 固定站位：position（地面）、yaw（面向；0 = 北）、view（桌機繞看用的眼睛與注視點）
export const STATIONS = {
  outside: { position: v(0, 0, 19.2), yaw: 0, view: { eye: [0, 1.65, 20.6], target: [0, 2.3, FACADE_Z] } },
  center: { position: v(0, 0, 13.9), yaw: 0, view: { eye: [0, 1.65, 15.2], target: [0, 1.6, VEST.z0] } },
  board: { position: v(-2.0, 0, 13.1), yaw: Math.PI / 2, view: { eye: [-1.2, 1.5, 13.1], target: [BOARD_AT.x, 1.38, 13.1] } },
  screen: { position: v(2.0, 0, 13.1), yaw: -Math.PI / 2, view: { eye: [1.2, 1.5, 13.1], target: [SCREEN_AT.x, 1.42, 13.1] } },
  vault: { position: v(0, 0, 12.1), yaw: 0, view: { eye: [0, 1.6, 12.6], target: [0, 1.4, VEST.z0] } },
};

export function createLobby({ renderer, camera, quality, environment, input, go, status, moveTo, fadeOut }) {
  let scene = null, sky = null, exterior = null, vestibule = null, vault = null, board = null, screen = null, disposed = false;
  let where = 'outside';
  const progress = createProgress(), offs = [], textures = [], bufferSize = new Vector2();

  const station = name => { where = name; return moveTo(STATIONS[name]); };

  return {
    get scene() { return scene; },
    view: STATIONS.outside.view,
    /** 左手 Y／L 鍵：回到門外 */
    goOutside() { return station('outside'); },

    async enter() {
      const alive = () => { if (disposed) throw new Error('cancelled'); };
      status('正在前往 Machine Yard…');
      scene = new Scene();
      scene.environment = environment.texture; // 沿用工作室的暖色反射環境，讓黃銅看起來像黃銅
      scene.environmentIntensity = 0.45;
      scene.fog = new FogExp2(0xd8cbb4, 0.006);
      // 告示板、按鈕、提示會畫到的字先下載（見 loadGlyphs）
      const text = JSON.stringify(rules) + '第頁已讀到最後一頁請按「下一頁」繼續閱讀上一頁下一頁退後上一段下一段暫停播放工安規則切削動畫需先閱讀工安規則並觀看切削動畫（續）0123456789' + (import.meta.env.DEV ? '直接解鎖重置進度' : '');
      await Promise.all([prewarmWorkshop(), loadGlyphs(text)]);
      alive();
      const M = createMaterials(quality);
      const root = new Group();
      root.name = 'Lobby';
      sky = createSky(root);

      // 天光＋西南斜陽（照亮南面入口；天空的太陽在北邊，入口原本是背光面）。玄關屋頂會擋住陽光
      root.add(new HemisphereLight(0xdfe9f5, 0x6b5a46, 0.75));
      const sun = new DirectionalLight(0xffe2b8, 2.4);
      sun.position.set(-7, 12, 24);
      sun.target.position.set(0, 0, 14);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -6, near: 1, far: 45 });
      sun.shadow.bias = -0.0004;
      root.add(sun, sun.target);
      const ground = new PlaneGeometry(140, 140);
      ground.rotateX(-Math.PI / 2);
      const guv = ground.attributes.uv;
      for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 35, guv.getY(i) * 35);
      add(root, ground, M.stone, 'Ground').receiveShadow = true;
      const apron = M.concrete.clone();
      apron.vertexColors = false;
      apron.color.set(0xcfc6b8);
      add(root, new BoxGeometry(7, 0.04, 4), apron, 'Apron', [0, 0.02, FACADE_Z + 2]).receiveShadow = true;

      exterior = createExterior(M, root);
      textures.push(...exterior.textures);
      vestibule = createVestibule(M);
      root.add(vestibule.object);

      // 金庫圓門與兩支壓力錶
      vault = createVaultDoor(M);
      vault.object.position.set(0, 0, VEST.z0);
      root.add(vault.object);

      // 左牆：工安告示板
      board = createSafetyBoard(M);
      board.object.position.copy(BOARD_AT);
      board.object.rotation.y = Math.PI / 2;
      root.add(board.object);

      // 右牆：放映幕
      status('準備切削動畫…');
      screen = await createProjectionScreen(M);
      alive();
      screen.object.position.copy(SCREEN_AT);
      screen.object.rotation.y = -Math.PI / 2;
      root.add(screen.object);

      // ---- 互動（牆與屋頂擋住射線；玄關裡的物件在門外時也不能點）
      exterior.occluders.forEach(o => input.addOccluder(o));
      const inside = () => where !== 'outside';
      input.add(exterior.doors, {
        enabled: () => where === 'outside',
        onSelect: async () => { await exterior.openDoors(); station('center'); },
      });
      input.add(board.paper, { enabled: inside, onSelect: () => { if (where !== 'board') station('board'); progress.readPage(board.page, board.pages); } });
      input.add(board.buttons.prev, { onSelect: () => board.prev() });
      input.add(board.buttons.next, { onSelect: () => board.next() });
      input.add(board.buttons.back, { onSelect: () => station('center') });
      offs.push(board.onPage((page, pages) => progress.readPage(page, pages)));
      input.add(screen.picture, { enabled: inside, onSelect: () => { if (where !== 'screen') station('screen'); } });
      input.add(screen.buttons.prev, { onSelect: () => screen.screen.prev() });
      input.add(screen.buttons.play, { onSelect: () => screen.screen.togglePlay() });
      input.add(screen.buttons.next, { onSelect: () => screen.screen.next() });
      input.add(screen.buttons.back, { onSelect: () => station('center') });
      offs.push(screen.screen.onComplete(id => progress.clipWatched(id)));
      input.add(vault.wheelTarget, {
        enabled: () => !vault.opening && where !== 'outside',
        onSelect: async () => {
          if (!progress.unlocked) return vault.rattle();
          await vault.open({ onBolts: () => {
            for (let i = 0; i < 6; i++) {
              const a = i / 6 * Math.PI * 2;
              vestibule.burst(v(Math.cos(a) * 1.25, DOOR_CENTER_Y + Math.sin(a) * 1.25, VEST.z0 + 0.25), v(Math.cos(a), Math.sin(a) + 0.4, 0.6), 0.7, 0.45);
            }
          } });
          await fadeOut();
          go('workshop');
        },
      });

      // ---- 進度 → 壓力錶與指示燈（已完成的直接打滿，不噴蒸汽）
      let last = { safety: progress.safetyRatio, clips: progress.clipsRatio };
      const sync = (initial = false) => {
        const now = { safety: progress.safetyRatio, clips: progress.clipsRatio };
        for (const key of ['safety', 'clips']) {
          vault.setProgress(key, now[key]);
          if (initial) vault.gauges[key].value = now[key];
          else if (now[key] >= 1 && last[key] < 1) vestibule.burst(vault.gauges[key].steamAt, v(0, 1, 0.3), 1.0, 0.5);
        }
        vault.setUnlocked(progress.unlocked);
        last = now;
      };
      sync(true);
      offs.push(progress.onChange(() => sync()));

      // ---- 開發用：直接解鎖／重置進度（正式建置不會出現）
      if (import.meta.env.DEV) {
        const faces = [buttonFace('直接解鎖'), buttonFace('重置進度')];
        textures.push(...faces.map(f => f.texture));
        faces.forEach((face, i) => {
          const b = brassButton(face, { width: 0.34, height: 0.11 });
          b.object.position.set(2.55, 0.62 - i * 0.16, VEST.z0 + 0.04);
          b.object.name = i === 0 ? 'DevUnlock' : 'DevReset';
          root.add(b.object);
          input.add(b.object, { onSelect: () => (i === 0 ? progress.unlockAll() : progress.reset()) });
        });
      }

      await warmUpGpu(renderer, root, camera, scene);
      alive();
      scene.add(root);
      where = 'outside';
      return { spawn: STATIONS.outside.position.clone(), yaw: STATIONS.outside.yaw, view: STATIONS.outside.view };
    },

    update(dt, elapsed) {
      if (!scene) return;
      sky?.update(dt, elapsed);
      exterior?.update(dt, elapsed);
      screen?.update(dt);
      vault?.update(dt);
      vestibule?.update(dt, elapsed, vault?.gearBoost ?? 1);
      // 蒸汽粒子的像素大小（與工作室 effects 相同的算法；XR 用固定值）
      if (vestibule) {
        renderer.getDrawingBufferSize(bufferSize);
        vestibule.setSteamScale(renderer.xr.isPresenting ? 800 : bufferSize.y / (2 * Math.tan(camera.fov * Math.PI / 360)));
      }
    },

    exit() {
      if (disposed) return;
      disposed = true;
      offs.forEach(off => off());
      if (scene) disposeTree(scene); // 共用的反射環境不在這裡釋放
      board?.dispose(); screen?.dispose(); vault?.dispose();
      textures.forEach(t => t.dispose());
      scene = null; exterior = null; vestibule = null; vault = null; board = null; screen = null;
    },
  };
}
