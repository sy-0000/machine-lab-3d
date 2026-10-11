// 玄關室內（必要的部分）：木地板、木護牆板與鉚釘、天花板樑、牆上持續轉動的齒輪（InstancedMesh，每種尺寸一個 draw call）、
// 銅管（合併幾何）與三個偶爾噴蒸汽的閥門、兩盞籠罩式吊燈（各一盞點光源，不開陰影）。
// 「可選」的裝飾（衣架、鞋櫃、洗手槽、儲氣罐、傳動軸皮帶…）等 Quest 實機 FPS 確認後再加，見 docs/xr-plan.md。
// 蒸汽沿用工作室的 SteamSystem（未修改）：閥門照它原本的隨機間隔噴發；burst() 讓壓力錶與門栓單次噴發。
import { CylinderGeometry, InstancedMesh, Matrix4, MeshBasicMaterial, Mesh, Object3D, PlaneGeometry, PointLight, SphereGeometry, TorusGeometry, Vector3, BoxGeometry } from 'three';
import { createGearGeometry } from '../../vendor/steampunk-workshop/src/utils/gear.js';
import { createPipe } from '../../vendor/steampunk-workshop/src/utils/pipe.js';
import { createValve } from '../../vendor/steampunk-workshop/src/utils/fixtures.js';
import { RivetSet } from '../../vendor/steampunk-workshop/src/utils/rivets.js';
import { add, group } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { SteamSystem } from '../../vendor/steampunk-workshop/src/effects/steam.js';
import { VEST } from './exterior.js';
import { createDecor } from './decor.js';

const { x: X, z0: Z0, z1: Z1, height: CEIL } = VEST;
const v = (x, y, z) => new Vector3(x, y, z);

// 牆上的齒輪：[牆, 沿牆位置, 高度, 尺寸, 轉向]；牆 N = 北牆（金庫門那面）、W／E = 左右牆、S = 南牆（大門那面）
const GEARS = [
  ['N', -2.3, 3.3, 'L', 1], ['N', -1.5, 3.82, 'S', -1], ['N', 2.3, 3.3, 'L', -1], ['N', 1.5, 3.82, 'S', 1],
  ['W', 11.4, 3.25, 'L', 1], ['W', 12.55, 3.5, 'M', -1], ['W', 13.75, 3.3, 'L', 1], ['W', 14.9, 3.55, 'S', -1],
  ['E', 11.4, 3.3, 'M', -1], ['E', 12.45, 3.3, 'L', 1], ['E', 13.7, 3.55, 'M', -1], ['E', 14.85, 3.25, 'L', 1],
  ['S', -2.35, 3.05, 'L', 1], ['S', -1.55, 3.8, 'S', -1], ['S', 2.35, 3.05, 'L', -1], ['S', 1.55, 3.8, 'S', 1],
];
const SIZES = { L: { teeth: 18, module: 0.05, spokes: 5 }, M: { teeth: 12, module: 0.05, spokes: 4 }, S: { teeth: 10, module: 0.05, spokes: 0 } };
// 牆面上的位置與朝向（齒輪在自己的 XY 平面、繞 +Z 轉；+Z 要朝向室內）
function wallPose(wall, along, y) {
  if (wall === 'N') return { position: v(along, y, Z0 + 0.04), yaw: 0 };
  if (wall === 'S') return { position: v(along, y, Z1 - 0.04), yaw: Math.PI };
  if (wall === 'W') return { position: v(-X + 0.04, y, along), yaw: Math.PI / 2 };
  return { position: v(X - 0.04, y, along), yaw: -Math.PI / 2 };
}

function createGears(M, root) {
  const meshes = {}, dummy = new Object3D(), items = [];
  const materials = { L: M.brassAged, M: M.copper, S: M.ironDark };
  for (const [size, spec] of Object.entries(SIZES)) {
    const list = GEARS.filter(g => g[3] === size);
    const mesh = new InstancedMesh(createGearGeometry({ ...spec, thickness: 0.04, bore: 0.03 }), materials[size], list.length);
    mesh.name = `WallGears_${size}`;
    mesh.castShadow = true;
    root.add(mesh);
    meshes[size] = mesh;
    list.forEach(([wall, along, y, , dir], i) => {
      const pose = wallPose(wall, along, y), r = spec.teeth * spec.module / 2;
      items.push({ mesh, i, pose, speed: dir * 0.35 / r, angle: (along * 7.3) % 6.28 });
      // 齒輪軸心（小鐵柱）
      const hub = add(root, new CylinderGeometry(0.035, 0.035, 0.08, 10), M.ironDark, 'GearAxle', pose.position.toArray());
      hub.rotation.set(Math.PI / 2, pose.yaw, 0, 'YXZ');
    });
  }
  return {
    update(dt, boost) {
      for (const it of items) {
        it.angle += dt * it.speed * boost;
        dummy.position.copy(it.pose.position);
        dummy.rotation.set(0, it.pose.yaw, it.angle, 'YXZ');
        dummy.updateMatrix();
        it.mesh.setMatrixAt(it.i, dummy.matrix);
      }
      for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
    },
  };
}

function createPipes(M, root) {
  const runs = [
    [v(-X + 0.12, 3.95, Z0 + 0.15), v(X - 0.12, 3.95, Z0 + 0.15)],
    [v(-X + 0.12, 3.95, Z0 + 0.15), v(-X + 0.12, 3.95, 11.1), v(-X + 0.12, 0.25, 11.1)],
    [v(X - 0.12, 3.95, Z0 + 0.15), v(X - 0.12, 3.95, Z1 - 0.3)],
    [v(-X + 0.12, 3.95, 11.1), v(-X + 0.12, 3.95, Z1 - 0.3)],
  ];
  runs.forEach((points, i) => root.add(createPipe(points, { radius: 0.045, material: M.copper, fittingMaterial: M.brass, name: `CopperPipe_${i}` }).object));
  // 三個閥門（偶爾噴蒸汽）：flow = 管線方向（閥體的 X），wheel = 手輪朝向（閥體的 Y，朝室內）
  const valves = [
    { at: v(-X + 0.12, 2.6, 11.1), flow: v(0, 1, 0), wheel: v(1, 0, 0), steam: v(-X + 0.3, 2.45, 11.25), dir: v(1, 0.3, 0.4) },
    { at: v(X - 0.12, 3.95, 14.4), flow: v(0, 0, 1), wheel: v(-1, 0, 0), steam: v(X - 0.3, 3.8, 14.6), dir: v(-1, -0.1, 0.3) },
    { at: v(0.9, 3.95, Z0 + 0.15), flow: v(1, 0, 0), wheel: v(0, 0, 1), steam: v(1.1, 3.8, Z0 + 0.35), dir: v(0.3, -0.2, 1) },
  ];
  for (const valve of valves) {
    const { object, wheel } = createValve(M, { size: 1.6 });
    object.position.copy(valve.at);
    object.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(valve.flow, valve.wheel, new Vector3().crossVectors(valve.flow, valve.wheel)));
    root.add(object);
    // 閥門手輪可以用 grip 抓住畫圈轉（第 3 階段的抓取測試對象）；加一圈看不見的感應區，比較好指到
    const hit = new Mesh(new CylinderGeometry(0.17, 0.17, 0.07, 16), new MeshBasicMaterial({ visible: false }));
    hit.userData.noHighlight = true;
    wheel.add(hit);
    valve.wheel = wheel;
  }
  return valves;
}

function createShell(M, root) {
  const floor = M.woodPlanks.clone();
  const geo = new PlaneGeometry(2 * X, Z1 - Z0);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 3.4);
  add(root, geo, floor, 'VestibuleFloor', [0, 0.003, (Z0 + Z1) / 2]).receiveShadow = true;
  // 木護牆板（左右牆與南牆，高 0.95 m）＋上緣黃銅壓條與鉚釘
  const rivets = new RivetSet(0.012);
  for (const side of [-1, 1]) {
    add(root, new BoxGeometry(0.03, 0.95, Z1 - Z0), M.woodPlanks, 'Wainscot', [side * (X - 0.015), 0.475, (Z0 + Z1) / 2]).receiveShadow = true;
    add(root, new BoxGeometry(0.05, 0.05, Z1 - Z0), M.brassAged, 'WainscotRail', [side * (X - 0.03), 0.97, (Z0 + Z1) / 2]);
    rivets.line(v(side * (X - 0.056), 0.97, Z0 + 0.15), v(side * (X - 0.056), 0.97, Z1 - 0.15), 0.3, v(-side, 0, 0));
  }
  for (const side of [-1, 1]) {
    const w = X - 1.45, cx = side * (1.45 + w / 2);
    add(root, new BoxGeometry(w, 0.95, 0.03), M.woodPlanks, 'WainscotSouth', [cx, 0.475, Z1 - 0.015]).receiveShadow = true;
    add(root, new BoxGeometry(w, 0.05, 0.05), M.brassAged, 'WainscotRailSouth', [cx, 0.97, Z1 - 0.03]);
  }
  root.add(rivets.build(M.ironDark, 'WainscotRivets'));
}

function createLamps(M, root) {
  const lights = [];
  const bulbMat = new MeshBasicMaterial({ color: 0xffd08a, toneMapped: false });
  for (const z of [12.1, 14.55]) {
    const g = group('CageLamp', root, [0, CEIL, z]);
    add(g, new CylinderGeometry(0.006, 0.006, 0.9, 6), M.ironDark, 'Cord', [0, -0.45, 0]);
    add(g, new CylinderGeometry(0.06, 0.14, 0.1, 12), M.brass, 'Shade', [0, -0.92, 0]);
    const bulb = add(g, new SphereGeometry(0.05, 12, 8), bulbMat, 'Bulb', [0, -1.02, 0]);
    bulb.userData.noHighlight = true;
    for (let i = 0; i < 3; i++) add(g, new TorusGeometry(0.1, 0.006, 4, 14), M.ironDark, 'Cage', [0, -1.02, 0], [0, i * Math.PI / 3, 0]);
    add(g, new TorusGeometry(0.1, 0.006, 4, 14), M.ironDark, 'CageRing', [0, -1.02, 0], [Math.PI / 2, 0, 0]);
    const light = new PointLight(0xffc27a, 7, 9, 2);
    light.position.set(0, -1.05, 0);
    g.add(light);
    lights.push(light);
  }
  return lights;
}

export function createVestibule(M) {
  const root = group('Vestibule');
  createShell(M, root);
  const gears = createGears(M, root);
  const valves = createPipes(M, root);
  const lights = createLamps(M, root);
  const decor = createDecor(M, root);

  const steam = new SteamSystem(220);
  for (const valve of valves) steam.addEmitter({ position: valve.steam, direction: valve.dir, strength: 0.35 });
  root.add(steam.object);
  const oneShots = [];

  return {
    object: root,
    lights,
    textures: decor.textures,
    valveWheels: valves.map(v => v.wheel),
    /** 單次噴蒸汽（壓力錶打滿、門栓收回） */
    burst(position, direction = v(0, 1, 0), seconds = 0.8, strength = 0.5) {
      steam.addEmitter({ position, direction, strength });
      const e = steam.emitters[steam.emitters.length - 1];
      e.bursting = true; e.timer = seconds;
      oneShots.push(e);
    },
    setSteamScale(s) { steam.setScale(s); },
    update(dt, elapsed, boost = 1) {
      gears.update(dt, boost);
      decor.update();
      steam.update(dt, elapsed);
      // 單次噴發結束後不再自動噴（SteamSystem 原本會隨機重噴）
      for (let i = oneShots.length - 1; i >= 0; i--) {
        const e = oneShots[i];
        if (!e.bursting) { steam.emitters.splice(steam.emitters.indexOf(e), 1); oneShots.splice(i, 1); }
      }
      for (const [i, l] of lights.entries()) l.intensity = 7 * (1 + Math.sin(elapsed * 1.7 + i * 2) * 0.03);
    },
  };
}
