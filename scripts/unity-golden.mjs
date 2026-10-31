// 產生 C# 核心（unity/MachineYard/Assets/Scripts/Core）的標準答案：用網站的 JS 實作跑一組固定輸入，輸出到
// unity/MachineYard.CoreTests/golden.json，由 dotnet 測試專案比對。用法：node scripts/unity-golden.mjs
import fs from 'node:fs';
import { Object3D, Vector3, Quaternion } from 'three';
import { normalizeConfig } from '../src/machines/config.js';
import { createHandleState } from '../src/machining/WorkpieceState.js';
import { cutRevolvedProfile, cutFacing, entersChuck } from '../src/machining/CuttingSimulation.js';
import { LATHE_MACHINING } from '../src/machining/latheMachining.config.js';
import { stepMachine, turnControlBy, setAxis, wheelRatio, selectorRpm, stepReturn } from '../src/machines/runtime.js';
import { createHeadState } from '../src/machining/HeadWorkpieceState.js';
import { cutHead } from '../src/machining/HeadCuttingSimulation.js';
import { createDrillStock, createBlockStock, measureTop } from '../src/levels/challenges.js';
import { TOOL_DEFINITIONS } from '../src/tools/tool.config.js';
import { surfaceAt } from '../src/machining/HeadWorkpieceState.js';

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

// ---- 槌頭工件：銑削（面銑、立銑）、鑽孔（Ø8.5、Ø10）、攻牙、孔邊再銑
{
  const toolOf = id => { const d = TOOL_DEFINITIONS[id]; return { id, type: d.type, diameterMm: d.dimensions.radius * 2000, cuttingLengthMm: d.dimensions.cuttingLength * 1000, designation: d.designation, pilotDiameterMm: d.pilotDiameterMm }; };
  const tools = ['head_face_mill', 'head_end_mill', 'head_drill_85', 'head_drill_10', 'head_tap_m10'].map(toolOf);
  const P = (x, y, z) => ({ xMm: x, yMm: y, zMm: z });
  const snapshot = s => ({ tops: [...s.surface.topMm], features: s.features.map(h => ({ ...h, thread: h.thread ? { ...h.thread } : null })), ops: s.operationHistory.length });
  const scenarios = [];
  const run = (name, makeState, steps) => {
    let state = makeState();
    const rec = [];
    for (const st of steps) {
      const tool = tools.find(t => t.id === st.tool);
      const next = cutHead(state, st.from, st.to, tool, { running: st.running ?? true, rpm: st.rpm ?? 500, direction: st.direction ?? 1 });
      rec.push({ ...st, changed: next !== state, state: next !== state ? snapshot(next) : null });
      state = next;
    }
    scenarios.push({ name, scribes: (state.surfaceMarks || []).map(m => [m.xMm, m.yMm]), steps: rec, final: snapshot(state), measureTop: measureTop(state), surfaceUnder: [] });
    return state;
  };
  // 面銑：刀從左側外面下到 z=18.5，沿 X 走過整個工件；再走第二條（Y 偏移）與回頭
  const face = [{ tool: 'head_face_mill', from: P(-37, 10, 25), to: P(-37, 10, 18.5) }];
  for (let x = -37; x <= 130; x += 4.1) face.push({ tool: 'head_face_mill', from: P(x, 10, 18.5), to: P(x + 4.1, 10, 18.5) });
  face.push({ tool: 'head_face_mill', from: P(130, 10, 18.5), to: P(130, 10, 17.2) });
  for (let x = 130; x >= -40; x -= 6.3) face.push({ tool: 'head_face_mill', from: P(x, 14, 17.2), to: P(x - 6.3, 14, 17.2) });
  face.push({ tool: 'head_face_mill', from: P(40, 10, 17), to: P(40, 10, 5), running: false }); // 不轉不切
  face.push({ tool: 'head_face_mill', from: P(40, 10, 17), to: P(40, 10, 5), rpm: 0 });
  run('face', createBlockStock, face);
  // 立銑：切溝（深 3 mm，沿 X），斜向，超過刀刃長度的深度不切
  const slot = [{ tool: 'head_end_mill', from: P(-12, 10, 25), to: P(-12, 10, 17) }, { tool: 'head_end_mill', from: P(-12, 10, 17), to: P(-12, 10, 5) }];
  for (let x = -12; x < 100; x += 1.7) slot.push({ tool: 'head_end_mill', from: P(x, 10, 17), to: P(x + 1.7, 10 + (x > 40 ? 3 : 0), 17) });
  slot.push({ tool: 'head_end_mill', from: P(20, 3, 17), to: P(60, 17, 12) }); // 斜向切下
  run('slot', createBlockStock, slot);
  // 鑽床：孔 A（X=25）先 Ø8.5 底孔、再攻牙；孔 B（X=65）Ø10；中途嘗試各種不合法動作
  const drill = [];
  const dz = (x, y, z0, z1, tool, extra = {}) => { for (let i = 0; i <= 12; i++) drill.push({ tool, from: P(x, y, i ? z0 + (z1 - z0) * (i - 1) / 12 : z0), to: P(x, y, z0 + (z1 - z0) * i / 12), ...extra }); };
  dz(25, 10, 25, 5, 'head_drill_85');
  drill.push({ tool: 'head_drill_85', from: P(25, 10, 22), to: P(25.5, 10, 18) });      // 橫向拖曳：不能鑽
  drill.push({ tool: 'head_drill_85', from: P(26, 10, 22), to: P(26, 10, 10) });          // 與孔 A 重疊（距離 1 < 8.5）：不能鑽
  dz(25, 10, 25, 3, 'head_tap_m10');                                                      // 攻牙
  dz(25, 10, 25, 15, 'head_tap_m10', { direction: -1 });                                  // 反轉：不能攻
  dz(65, 10, 25, 8, 'head_drill_10');
  dz(65, 10, 25, -5, 'head_drill_10');                                                    // 鑽穿
  dz(2, 10, 25, 5, 'head_drill_10');                                                      // 孔邊緣：孔緣不受支撐（x=2, r=5）
  dz(45, 10, 25, 5, 'head_tap_m10');                                                      // 沒有底孔：不能攻牙
  drill.push({ tool: 'head_drill_10', from: P(45, 10, 10), to: P(45, 10, 5) });           // 實心料中瞬間下刀：不能鑽
  drill.push({ tool: 'head_drill_10', from: P(55, 10, 18.5), to: P(55, 10, 17) });         // 下刀落差 1.5 mm（> 1）：不能鑽
  drill.push({ tool: 'head_drill_10', from: P(55, 10, 18.5), to: P(55, 10, 17.8) });       // 落差 0.7 mm：可鑽（連續進給）
  run('drill', createDrillStock, drill);
  // 孔邊再銑：先鑽 Ø10 孔，面銑切掉 2 mm（孔入口降低、牙深縮短）
  const mix = [];
  mix.push({ tool: 'head_drill_85', from: P(45, 10, 25), to: P(45, 10, 12) });
  mix.push({ tool: 'head_tap_m10', from: P(45, 10, 25), to: P(45, 10, 12) });
  mix.push({ tool: 'head_face_mill', from: P(0, 10, 22), to: P(0, 10, 18) });
  for (let x = 0; x < 80; x += 5) mix.push({ tool: 'head_face_mill', from: P(x, 10, 18), to: P(x + 5, 10, 18) });
  mix.push({ tool: 'head_tap_m10', from: P(45, 10, 25), to: P(45, 10, 12) });
  run('mix', createDrillStock, mix);
  // 接觸與刀尖下方表面
  const s = createBlockStock();
  const probes = [];
  for (const [x, y, z, d] of [[10, 10, 25, 8], [10, 10, 20, 8], [10, 10, 20.04, 58], [-20, 10, 20, 8], [45, 10, 19.9, 58], [88, 10, 20, 8], [-3, 10, 20, 8], [95, 20.5, 20, 8]]) probes.push({ x, y, z, d, top: surfaceAtMax(s, x, y, d) });
  function surfaceAtMax(st, x, y, d) { // 與 HeadMachiningAdapter.surfaceUnder 相同
    const { nx, ny, resolutionMm: res, topMm } = st.surface, reach = d / 2 + 0.05; let top = 0;
    for (let iy = Math.max(0, Math.floor((y - reach) / res)); iy <= Math.min(ny - 1, Math.floor((y + reach) / res)); iy++)
      for (let ix = Math.max(0, Math.floor((x - reach) / res)); ix <= Math.min(nx - 1, Math.floor((x + reach) / res)); ix++)
        if (Math.hypot((ix + .5) * res - x, (iy + .5) * res - y) <= reach + res * .71) top = Math.max(top, topMm[iy * nx + ix]);
    return top;
  }
  out.head = { scenarios, probes, surfaceAt: [[10, 10], [0, 0], [89.9, 19.9], [90, 5], [-1, 3]].map(([x, y]) => ({ x, y, v: surfaceAt(s, x, y) })), tools };
}

// ---- 鑽床：進給手柄彈簧回位（stepReturn）
{
  const drillRaw = JSON.parse(fs.readFileSync('public/models/drill_press_parts.json', 'utf8'));
  const dcfg = normalizeConfig('drill', drillRaw);
  const nodes = {}, initial = {}, angles = {}, offsets = {}, controls = {};
  for (const a of dcfg.axes) { nodes[a.node] = new Object3D(); initial[a.node] = { position: new Vector3(), quaternion: new Quaternion() }; offsets[a.id] = 0; }
  for (const w of dcfg.wheels) { nodes[w.node] = new Object3D(); initial[w.node] = { position: new Vector3(), quaternion: new Quaternion() }; controls[w.id] = { ...w, type: 'wheel' }; angles[w.id] = 0; }
  const m = { config: { ...dcfg, additions: [] }, controls, initial, pivots: nodes, lookup: nodes, angles, offsets, rpm: 0, scene: { updateWorldMatrix() {} } };
  const steps = [];
  const w = dcfg.wheels[0];
  const turn = d => { const r = turnControlBy(m, w.id, d, false); steps.push({ op: 'turn', delta: d, result: r, offsets: { ...m.offsets }, angles: { ...m.angles } }); };
  const ret = (held, dt) => { const r = stepReturn(m, held, dt); steps.push({ op: 'return', held, dt, returning: r, offsets: { ...m.offsets }, angles: { ...m.angles } }); };
  for (let i = 0; i < 8; i++) turn(-0.2);
  for (let i = 0; i < 5; i++) ret(w.id, 1 / 72);            // 握住：不回彈
  for (let i = 0; i < 60; i++) ret(null, 1 / 72);            // 放開：回彈
  for (let i = 0; i < 30; i++) turn(-0.15);                  // 壓到底（行程限制）
  for (let i = 0; i < 10; i++) turn(0.1);
  for (let i = 0; i < 80; i++) ret(null, 1 / 72);
  out.springDrill = { wheel: { id: w.id, drives: w.drives, ratio: w.ratio, angleRange: w.angleRange, springReturn: w.springReturn, needsCalibration: !!w.needsCalibration }, axes: dcfg.axes.map(a => ({ id: a.id, range: a.range, enabled: a.enabled })), lesson: dcfg.lesson, steps };
}

fs.writeFileSync('unity/MachineYard.CoreTests/golden.json', JSON.stringify(out));
console.log('golden.json:', Object.keys(out).map(k => `${k}=${Array.isArray(out[k]) ? out[k].length : typeof out[k]}`).join(' '));
