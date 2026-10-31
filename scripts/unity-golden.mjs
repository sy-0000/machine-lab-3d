// 產生 C# 核心（unity/MachineYard/Assets/Scripts/Core）的標準答案：用網站的 JS 實作跑一組固定輸入，輸出到
// unity/MachineYard.CoreTests/golden.json，由 dotnet 測試專案比對。用法：node scripts/unity-golden.mjs
import fs from 'node:fs';
import { Object3D, Vector3, Quaternion } from 'three';
import { normalizeConfig } from '../src/machines/config.js';
import { createHandleState } from '../src/machining/WorkpieceState.js';
import { cutRevolvedProfile, cutFacing, entersChuck } from '../src/machining/CuttingSimulation.js';
import { LATHE_MACHINING } from '../src/machining/latheMachining.config.js';
import { stepMachine, turnControlBy, setAxis, wheelRatio, selectorRpm } from '../src/machines/runtime.js';

const raw = JSON.parse(fs.readFileSync('public/models/lathe_parts.json', 'utf8'));
const config = normalizeConfig('lathe', raw);
const out = { config: { axes: config.axes.map(a => ({ id: a.id, range: a.range, enabled: a.enabled })), wheels: config.wheels.map(w => ({ id: w.id, drives: w.drives, ratio: w.ratio ?? null, needsCalibration: !!w.needsCalibration })), lesson: config.lesson, lever: config.lever, speedSelectors: config.speedSelectors, maxRpm: config.maxRpm },
  handle: createHandleState(), machining: LATHE_MACHINING, cutting: [], facing: [], chuck: [], spindle: [], axes: [] };

// ---- 切削：從工件外側下刀到半徑 8，再沿 Z 車過去；再下刀到 5 車一段；最後把刀退出
{
  let state = createHandleState();
  const path = [];
  const add = (z, u, v) => path.push({ zMm: z, uMm: u, vMm: v });
  add(100, 0, 15); add(100, 0, 8); for (let z = 100; z <= 250; z += 3.7) add(z, 0, 8);
  add(250, 0, 5); for (let z = 250; z >= 120; z -= 2.3) add(z, 0, 5); add(120, 0, 14);
  add(150, 0.5, 9); add(160, 0.5, 3); // 刀尖偏離軸心高度 0.5 mm
  add(60, 0, 14); for (let z = 60; z >= 28; z -= 1.3) add(z, 0, 2); // 靠近夾頭：夾持區（Z < 40）不可被切
  add(45, 0, 12); add(36.2, 0, 1); add(39.9, 0, 0.5); add(40.1, 0, 0.5); add(-5, 0, 5); add(400, 0, 5); // 邊界與超出兩端
  let prev = path[0];
  for (const p of path.slice(1)) {
    const next = cutRevolvedProfile(state, prev, p, { rpm: 500, toolId: 't' });
    out.cutting.push({ from: prev, to: p, rpm: 500, changed: next !== state, radii: next === state ? null : [...next.profile.radiusMm] });
    state = next; prev = p;
  }
  // 不轉就不切
  const still = cutRevolvedProfile(state, path[1], path[2], { rpm: 0, toolId: 't' });
  out.cutting.push({ from: path[1], to: path[2], rpm: 0, changed: still !== state, radii: null });
}

// ---- 車端面：先把工件前端留長 300，從外側沿 V 徑向進到中心（Z = 長度 − 1）
{
  let state = createHandleState();
  const facing = LATHE_MACHINING.facing;
  const cases = [
    [{ zMm: 299, uMm: 0, vMm: 14 }, { zMm: 299, uMm: 0, vMm: 0 }],
    [{ zMm: 298.5, uMm: 0, vMm: 12 }, { zMm: 298.5, uMm: 0, vMm: 4 }],
    [{ zMm: 299.2, uMm: 0, vMm: 6 }, { zMm: 299.2, uMm: 0, vMm: -1 }],
    [{ zMm: 290, uMm: 0, vMm: 14 }, { zMm: 290, uMm: 0, vMm: 0 }], // 太深：不切
  ];
  for (const [from, to] of cases) {
    const next = cutFacing(state, from, to, { rpm: 500, toolId: 't', facing });
    out.facing.push({ from, to, changed: next !== state, lengthMm: next.lengthMm, radii: next === state ? null : [...next.profile.radiusMm] });
    state = next;
  }
}

// ---- 夾頭碰撞
{
  const danger = { ...LATHE_MACHINING.chuckDanger, endZMm: 40 };
  const c = (a, b) => out.chuck.push({ from: a, to: b, danger, enters: entersChuck(a, b, danger) });
  c({ zMm: 100, uMm: 0, vMm: 20 }, { zMm: 100, uMm: 0, vMm: 10 });
  c({ zMm: 60, uMm: 0, vMm: 60 }, { zMm: 20, uMm: 0, vMm: 30 });
  c({ zMm: 60, uMm: 0, vMm: 60 }, { zMm: 20, uMm: 0, vMm: 41 });
  c({ zMm: -20, uMm: 0, vMm: 50 }, { zMm: -20, uMm: 0, vMm: 39 });
  c({ zMm: -40, uMm: 0, vMm: 0 }, { zMm: -35, uMm: 0, vMm: 0 });
  c({ zMm: 10, uMm: 0, vMm: 39.9 }, { zMm: 10, uMm: 0, vMm: 39.9 });
}

// ---- 主軸：stepMachine（拉桿延遲、加速度、角度累計）。用最小的假機台，只留邏輯要用的欄位
{
  const node = () => { const o = new Object3D(); return o; };
  const m = {
    config, pivots: { [config.spindle.node]: node(), [config.lever.node]: node() }, initial: {}, lookup: {},
    scene: { updateWorldMatrix() {} }, brakeTime: 0, leverAngle: 0, signedRpm: 0, rpm: 0, spindleAngle: 0, detents: {},
  };
  for (const a of config.actions) if (a.type === 'detent') m.detents[a.id] = a.homeIndex;
  for (const n of Object.keys(m.pivots)) m.initial[n] = { quaternion: m.pivots[n].quaternion.clone() };
  const dt = 1 / 72;
  const steps = [];
  const run = (n, running, direction, rpm) => {
    for (let i = 0; i < n; i++) {
      stepMachine(m, running, rpm, dt, direction);
      steps.push({ running, direction, rpm, signedRpm: m.signedRpm, outRpm: m.rpm, spindleAngle: m.spindleAngle, leverAngle: m.leverAngle });
    }
  };
  run(40, true, 1, 500); run(60, true, 1, 500); run(30, false, 1, 500); run(40, true, -1, 500); run(50, false, 1, 500);
  m.detents.gearSelector = 3; m.detents.speedMode = 1; run(80, true, 1, 500);
  out.spindle = { dt, selectorRpm: selectorRpm(m), steps };
}

// ---- 軸與手輪：turnControlBy 的行程限制與比例（用真的 Object3D 當節點）
{
  const axisNodes = {}, controls = {}, initial = {}, pivots = {}, lookup = {}, angles = {}, offsets = {};
  for (const a of config.axes) { const o = new Object3D(); axisNodes[a.node] = o; lookup[a.node] = o; initial[a.node] = { position: o.position.clone(), quaternion: o.quaternion.clone() }; offsets[a.id] = 0; }
  for (const w of config.wheels) { const o = new Object3D(); pivots[w.node] = o; initial[w.node] = { position: o.position.clone(), quaternion: o.quaternion.clone() }; controls[w.id] = { ...w, type: 'wheel' }; angles[w.id] = 0; }
  // 不含外觀附屬件（立柱／套筒隨軸伸縮是純視覺，Unity 端另外處理）
  const m = { config: { ...config, additions: [] }, controls, initial, pivots, lookup, angles, offsets, rpm: 0, scene: { updateWorldMatrix() {} } };
  const steps = [];
  const turn = (key, delta) => { const r = turnControlBy(m, key, delta, false); steps.push({ key, delta, result: r, offsets: { ...m.offsets }, angles: { ...m.angles } }); };
  const tick = 10 * Math.PI / 180;
  for (let i = 0; i < 12; i++) turn('carriageHandwheel', 0.1 / 1000 / wheelRatio(m, 'carriageHandwheel') * (i % 3 === 2 ? -1 : 1));
  for (let i = 0; i < 40; i++) turn('crossSlideHandwheel', tick);                // 超過行程上限
  for (let i = 0; i < 70; i++) turn('crossSlideHandwheel', -tick);               // 退到下限
  for (let i = 0; i < 30; i++) turn('heightHandwheel', tick * 2);
  for (let i = 0; i < 10; i++) turn('tailstockHandwheel', -tick * 3);
  for (let i = 0; i < 150; i++) turn('carriageHandwheel', -tick);                 // 負向到底
  out.axes = { ratios: Object.fromEntries(config.wheels.map(w => [w.id, wheelRatio(m, w.id)])), steps };
}

fs.writeFileSync('unity/MachineYard.CoreTests/golden.json', JSON.stringify(out));
console.log('golden.json:', Object.keys(out).map(k => `${k}=${Array.isArray(out[k]) ? out[k].length : typeof out[k]}`).join(' '));
