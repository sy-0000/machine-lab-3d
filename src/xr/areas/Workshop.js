// 工作室（穹頂工作室內部）：現有的 steampunk-workshop 場景（未修改）＋ 房間中央的一台機台。
// 房間固定不轉，機台正面朝南（+Z，朝大門與工作桌）。
// 從玄關的金庫門進來，站在工作桌前 (0, 0, 6.7) 面向北；工作桌上只放工具箱（src/xr/toolbox/DeskToolbox.js）。
// 拿起工具展示時，工作室其他燈光與反射環境漸暗到約 15%，放回後恢復。
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { createSky } from '../../vendor/steampunk-workshop/src/core/sky.js';
import { createPostPipeline } from '../../vendor/steampunk-workshop/src/core/postprocessing.js';
import { buildWorld } from '../../vendor/steampunk-workshop/src/app/world.js';
import { createLights } from '../../vendor/steampunk-workshop/src/lighting/lights.js';
import { createEffects } from '../../vendor/steampunk-workshop/src/effects/effects.js';
import { prewarmWorkshop, warmUpGpu } from '../../prewarm/prewarm.js';
import { MachineRegistry } from '../../machines/core/MachineRegistry.js';
import { MachineSession } from '../../machining/MachineSession.js';
import { attachMachineControls } from '../machine/vrMachineControls.js';
import { MachineSounds } from '../../audio/MachineSounds.js';
import { disposeTree } from '../dispose.js';
import { createDeskToolbox } from '../toolbox/DeskToolbox.js';
import { createTeleportDiscs, discStations } from '../workshop/teleportDiscs.js';
import { ROOM } from '../../vendor/steampunk-workshop/src/config/layout.js';

// 機台在房間裡的朝向：把各模型的操作側轉到 +Z（南）。車床、鑽床的操作側原本就在 +Z，銑床在 +X。
export const VR_FACING = { lathe: 0, milling: -Math.PI / 2, drill: 0 };
// 桌上型機台站在鐵座上（公尺），與桌機版相同
const PEDESTAL = { drill: 0.72 };
// 工作桌前（docs/xr-plan.md）
export const DESK_SPOT = new Vector3(0, 0, 6.7);

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

// 展示工具時其他燈光剩下的比例
const DIM_TO = 0.15;
// 搖桿走動的範圍：八角牆內縮 0.6 m；機台鋼板（2.2 × 1.6，外加 0.1）與工作桌（外加 0.3）不能穿過。其他擺設暫不擋。
// 瞬移圓盤都在鋼板外（正面 z 1.05、兩側 x ±1.35），所以鋼板只留 0.1 m 餘量。
const WALL_LIMIT = ROOM.apothem - 0.6;
const BLOCKS = [
  { x0: -1.2, x1: 1.2, z0: -0.9, z1: 0.9 },
  { x0: -1.2, x1: 1.2, z0: 5.1, z1: 6.45 },
];
export function canStandInWorkshop(x, z) {
  for (let k = 0; k < ROOM.sides; k++) {
    const t = k * Math.PI * 2 / ROOM.sides;
    if (x * Math.sin(t) - z * Math.cos(t) > WALL_LIMIT) return false;
  }
  return !BLOCKS.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
}

// 操作位附近（按 Y 預設打開「機台」頁）：離機台鋼板（2.2 × 1.6）1.2 m 以內
export const nearMachine = (x, z) => Math.abs(x) < 1.1 + 1.2 && Math.abs(z) < 0.8 + 1.2;

export function createWorkshop({ renderer, camera, quality, environment, status, input, progress, moveTo, audio }) {
  let scene = null, post = null, room = null, machine = null, desk = null, discs = null, frame = 0, disposed = false;
  let session = null, clock = null, sessionFrame = 0, detachControls = null, sounds = null, unobserve = null;
  // 切削回饋：上一格的切削次數、接觸狀態，震動節流
  let lastCut = 0, lastLevel = 'none', buzzT = 0, cutRate = 0;
  // 手輪每格（10°）的進給量（mm），儀表板切換；換機台時保留
  const feed = { mm: 0.1 };
  let roomLights = [];
  const machineRoot = new Group();
  machineRoot.name = 'MachineSlot';

  // 切削回饋：切削中握著手輪的控制器持續輕震（強度隨切削量增加）；刀尖壓入或撞到夾頭：較強震動＋警告聲
  function cuttingFeedback(dt) {
    const st = session.getState();
    const cuts = st.cutCount || 0, delta = cuts - lastCut;
    lastCut = cuts;
    cutRate = cutRate * Math.exp(-dt * 6) + delta; // 近似「最近每秒的切削次數」
    const hands = input.grabbingHands();
    if ((buzzT -= dt) <= 0 && st.rpm > 0 && cutRate > 0.05 && hands.length) {
      buzzT = 0.09;
      const strength = Math.min(0.6, 0.12 + cutRate * 0.08);
      for (const hand of hands) input.pulse(hand, strength, 80);
    }
    const head = st.headMachining, mm = st.machining;
    const overshoot = !!head?.contact && st.rpm === 0 && head.embedMm > 0.05;
    const level = mm?.unsafe ? 'unsafe' : overshoot ? 'overshoot' : 'ok';
    if (level !== 'ok' && level !== lastLevel) {
      for (const hand of hands.length ? hands : ['left', 'right']) input.pulse(hand, 0.9, 140);
      audio?.warn();
    }
    lastLevel = level;
  }

  return {
    get scene() { return scene; },
    view: { eye: [0, 1.65, 7.6], target: [0, 1.0, 0] },
    machine: () => machine,
    get machineId() { return machine?.id || null; },
    get toolbox() { return desk; },
    /** 選單「機台」頁用：目前機台的 session、每格進給量 */
    machineContext: () => (session ? { session, machineId: machine.id, feed, maxRpm: machine.runtime.config.maxRpm } : null),
    nearMachine,
    get session() { return session; },
    canStand: canStandInWorkshop,
    /** 瞬移圓盤（進過工廠後才能用）；Teleport.js 的拋物線與高亮用 */
    teleportDiscs: () => (discs && progress?.factoryEntered ? discs.discs : []),
    setTeleportTarget(disc) { discs?.setTarget(disc); },

    /** 換機台前記住站在哪個圓盤附近（0.6 m 內；兩側圓盤的位置依機台不同）；沒有就回傳 null */
    discNear(x, z) {
      const list = discStations(machine?.id || 'lathe');
      return list.find(s => Math.hypot(s.position.x - x, s.position.z - z) < 0.6)?.name || null;
    },

    async enter({ machineId = 'lathe', disc = null } = {}) {
      // 建到一半就離開（例如關掉頁面）：停在下一個等待點
      const alive = () => { if (disposed) throw new Error('cancelled'); };
      // 與工作室原本的 createScene() 相同：暖色反射環境（全世界共用一份）與煙霧
      scene = new Scene();
      scene.environment = environment.texture;
      scene.environmentIntensity = environment.intensity;
      scene.fog = environment.fog.clone();
      post = createPostPipeline(renderer, scene, camera, quality);
      status('正在搭建蒸汽工作室…');
      await prewarmWorkshop();
      alive();
      const root = new Group();
      root.name = 'SteampunkWorkshop';
      const sky = createSky(root);
      // 天空在不透明物件之後才畫（它不寫深度）：被牆與穹頂框架擋住的像素不必算天空著色器
      root.getObjectByName('ProceduralSky').renderOrder = 100;
      const world = await buildWorld(root, quality);
      if (disposed) { disposeTree(root); alive(); }
      const lights = createLights(root, quality, world.anchors);
      const effects = world.panels ? createEffects(root, renderer, camera, quality, world) : null;
      await warmUpGpu(renderer, root, camera, scene);
      if (disposed) { disposeTree(root); alive(); }
      scene.add(root);
      room = { root, world, lights, effects, sky };
      // 燈光漸暗用：記住每盞燈的原始強度（爐火與燈泡每格會重設強度，其餘固定）
      roomLights = [];
      root.traverse(o => { if (o.isLight) roomLights.push({ light: o, base: o.intensity, animated: /^(BoilerFire|EdisonLamp_)/.test(o.name) }); });

      status('擺放工作桌與工具箱…');
      desk = await createDeskToolbox({ input, camera, envMap: environment.texture, alive });
      await warmUpGpu(renderer, desk.object, camera, scene);
      if (disposed) { desk.dispose(); disposeTree(desk.object); desk = null; alive(); }
      scene.add(desk.object);

      status('下載機台模型…');
      const instance = await MachineRegistry.load(machineId, { onProgress: p => status(`下載機台模型 ${Math.round(p)}%`) });
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
      alive();
      scene.add(machineRoot);
      // 機台操作：和桌機同一個 MachineSession（指令、切削、行程上下限）；時間由 VR 迴圈提供
      session = new MachineSession(instance);
      clock = session.claimClock();
      sessionFrame = 0;
      machine = { id: machineId, instance, runtime: m, session };
      // 銑床手輪沒有提供真實比例（需要教學比例）：VR 用每格進給量，直接開啟教學比例
      if (m.config.wheels.some(w => w.needsCalibration)) session.command({ type: 'teaching.set', enabled: true });
      detachControls = attachMachineControls({ session, runtime: m, input, feed });
      // 加工音效：沿用桌機的 MachineSounds，聲音從機台位置發出（3D）
      if (audio?.context) {
        sounds = new MachineSounds({ context: audio.context, output: audio.machineOutput(new Vector3(0, 1.0, 0)) });
        sounds.setMachine(machineId);
        sounds.unlock();
        unobserve = session.observe(() => sounds.update(session.getState()));
      }

      // 瞬移圓盤（打開金庫門、進入工廠後解鎖）：拋物線或射線點圓盤都可以移過去；桌機點圓盤平滑移鏡頭
      progress?.enterFactory();
      discs = createTeleportDiscs(machineId);
      scene.add(discs.object);
      for (const d of discs.discs) input.add(d.group, {
        enabled: () => !!progress?.factoryEntered,
        onSelect: info => { info?.pulse?.(0.2, 15); moveTo(d.station); },
      });

      // 工作室靜態，陰影每兩格更新一次（與桌機版相同）
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      // 從選單換機台：站回同一個圓盤（新機台的位置）；否則（從金庫門進來）站在工作桌前
      const at = disc && discStations(machineId).find(s => s.name === disc);
      if (at) return { spawn: at.position.clone(), yaw: at.yaw, view: at.view };
      return { spawn: DESK_SPOT.clone(), yaw: 0 };
    },

    update(dt, elapsed) {
      if (!room) return;
      if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
      room.world.update(dt, elapsed, camera);
      room.lights.update(elapsed);
      session?.update(dt, { clock, frameId: sessionFrame++ });
      if (session) cuttingFeedback(dt);
      desk?.update(dt);
      discs?.update(elapsed);
      // 展示工具時其他燈光漸暗
      const k = 1 - (1 - DIM_TO) * (desk?.dim || 0);
      for (const l of roomLights) l.light.intensity = (l.animated ? l.light.intensity : l.base) * k;
      scene.environmentIntensity = environment.intensity * k;
      room.effects?.update(dt, elapsed);
      room.sky.update(dt, elapsed);
    },

    render(xr, dt, elapsed) {
      if (xr) renderer.render(scene, camera);
      else post.render(dt, elapsed);
    },
    resize(width, height) { post?.setSize(width, height); room?.effects?.resize(); },

    exit() {
      if (disposed) return;
      disposed = true;
      renderer.shadowMap.autoUpdate = true;
      post?.dispose();
      machineRoot.removeFromParent();
      detachControls?.(); detachControls = null;
      unobserve?.(); unobserve = null;
      sounds?.dispose(); sounds = null;
      session?.dispose(); session = null; clock = null;
      MachineRegistry.unload(); // 也會取消還在下載的機台
      for (const child of machineRoot.children) if (child.name === 'MachinePedestal') disposeTree(child);
      desk?.dispose();
      discs?.dispose();
      if (scene) disposeTree(scene); // 共用的反射環境不在這裡釋放
      scene = null; room = null; machine = null; desk = null; discs = null; roomLights = [];
    },
  };
}
