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
import { disposeTree } from '../dispose.js';
import { createDeskToolbox } from '../toolbox/DeskToolbox.js';
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
// 搖桿走動的範圍：八角牆內縮 0.6 m；機台鋼板（2.2 × 1.6，外加 0.3）與工作桌（外加 0.3）不能穿過。其他擺設暫不擋。
const WALL_LIMIT = ROOM.apothem - 0.6;
const BLOCKS = [
  { x0: -1.4, x1: 1.4, z0: -1.1, z1: 1.1 },
  { x0: -1.2, x1: 1.2, z0: 5.1, z1: 6.45 },
];
export function canStandInWorkshop(x, z) {
  for (let k = 0; k < ROOM.sides; k++) {
    const t = k * Math.PI * 2 / ROOM.sides;
    if (x * Math.sin(t) - z * Math.cos(t) > WALL_LIMIT) return false;
  }
  return !BLOCKS.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
}

export function createWorkshop({ renderer, camera, quality, environment, status, input }) {
  let scene = null, post = null, room = null, machine = null, desk = null, frame = 0, disposed = false;
  let roomLights = [];
  const machineRoot = new Group();
  machineRoot.name = 'MachineSlot';

  return {
    get scene() { return scene; },
    view: { eye: [0, 1.65, 7.6], target: [0, 1.0, 0] },
    machine: () => machine,
    get machineId() { return machine?.id || null; },
    get toolbox() { return desk; },
    canStand: canStandInWorkshop,

    async enter({ machineId = 'lathe' } = {}) {
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
      machine = { id: machineId, instance, runtime: m }; // 第 6 階段起接上 MachineSession

      // 工作室靜態，陰影每兩格更新一次（與桌機版相同）
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      return { spawn: DESK_SPOT.clone(), yaw: 0 };
    },

    update(dt, elapsed) {
      if (!room) return;
      if (frame++ % 2 === 0) renderer.shadowMap.needsUpdate = true;
      room.world.update(dt, elapsed, camera);
      room.lights.update(elapsed);
      desk?.update(dt);
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
      MachineRegistry.unload(); // 也會取消還在下載的機台
      for (const child of machineRoot.children) if (child.name === 'MachinePedestal') disposeTree(child);
      desk?.dispose();
      if (scene) disposeTree(scene); // 共用的反射環境不在這裡釋放
      scene = null; room = null; machine = null; desk = null; roomLights = [];
    },
  };
}
