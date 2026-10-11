// VR 用手轉手輪：wheel.turnBy（角度 → 行程 → 上下限）走和桌機按住手輪相同的切削路徑。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSource } from '../../scripts/model-source.mjs';
import { MachineLoader } from '../machines/core/MachineLoader.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MachineSession } from './MachineSession.js';

MachineLoader.setCustomLoader(async (id, config) => ({
  rawJson: JSON.parse(readFileSync(new URL('../../public/models/' + config.config, import.meta.url))),
  scene: (await loadSource(new URL('../../public/models/' + config.model, import.meta.url))).scene,
}));
const near = (actual, expected, eps = 1e-8) => assert.ok(Math.abs(actual - expected) < eps, actual + ' != ' + expected);
async function fixture(id = 'lathe') {
  const machine = await MachineRegistry.load(id);
  const session = new MachineSession(machine), clock = session.claimClock();
  let frameId = 0;
  return { machine, session, tick: dt => session.update(dt, { clock, frameId: frameId++ }),
    close: async () => { session.dispose(); await MachineRegistry.unload(); } };
}
const send = (session, command) => { const r = session.command(command); assert.equal(r.ok, true, r.reason); return r; };

test('wheel.turnBy 與按住手輪同一套比例：轉 Δθ 行程 = Δθ × ratio，手輪角度同步', async () => {
  // 先量按住手輪（turnControl：速度 × 時間）轉 1 弧度的結果（機台一次只載入一台，所以分開量）
  const held = await fixture();
  let heldX, ratio;
  try {
    const w = held.machine.runtime.controls.carriageHandwheel;
    ratio = w.ratio;
    held.session.command({ type: 'wheel.hold', key: 'carriageHandwheel', direction: -1 });
    for (let i = 0; i < 10; i++) held.tick(1 / w.speed / 10);
    heldX = held.machine.getState().offsets.x;
  } finally { await held.close(); }
  const { machine, session, close } = await fixture();
  try {
    const x0 = machine.getState().offsets.x, a0 = machine.getState().angles.carriageHandwheel;
    const r = send(session, { type: 'wheel.turnBy', key: 'carriageHandwheel', deltaAngle: -1 });
    assert.equal(r.atLimit, false);
    near(machine.getState().offsets.x - x0, -ratio);
    near(machine.getState().angles.carriageHandwheel - a0, -1);
    near(machine.getState().offsets.x, heldX, 1e-6);
  } finally { await close(); }
});

test('wheel.turnBy 碰到行程上下限時回報 atLimit，軸停在極限', async () => {
  const { machine, session, close } = await fixture();
  try {
    const axis = machine.runtime.config.axes.find(a => a.id === 'x');
    const r = send(session, { type: 'wheel.turnBy', key: 'carriageHandwheel', deltaAngle: -1000 });
    assert.equal(r.atLimit, true);
    near(machine.getState().offsets.x, axis.range[0]);
    const again = send(session, { type: 'wheel.turnBy', key: 'carriageHandwheel', deltaAngle: -0.2 });
    assert.equal(again.atLimit, true);
    near(machine.getState().offsets.x, axis.range[0]);
    assert.equal(session.command({ type: 'wheel.turnBy', key: 'noSuchWheel', deltaAngle: 1 }).ok, false);
    assert.equal(session.command({ type: 'wheel.turnBy', key: 'carriageHandwheel', deltaAngle: NaN }).ok, false);
  } finally { await close(); }
});

test('wheel.turnBy 在主軸運轉時會切削（與桌機同一條路徑）', async () => {
  const { session, tick, close } = await fixture();
  try {
    assert.equal((await session.command({ type: 'workpiece.createHandle' })).ok, true);
    const m0 = session.getState().machining;
    send(session, { type: 'machining.move', axis: 'Z', valueMm: m0.lengthMm + 2 - m0.physicalZMm, mode: 'relative' });
    send(session, { type: 'machining.move', axis: 'X', valueMm: 16 - session.getState().machining.xDiameterMm - 2 * session.getState().machining.datumMm.X, mode: 'relative', representation: 'diameter' });
    send(session, { type: 'spindle.start', direction: 1 });
    for (let i = 0; i < 240; i++) tick(1 / 60);
    const before = session.getState();
    // 手轉縱向手輪往夾頭方向，每次 5°（像 VR 每格送出的小角度）
    for (let i = 0; i < 40; i++) { send(session, { type: 'wheel.turnBy', key: 'carriageHandwheel', deltaAngle: -5 * Math.PI / 180 }); tick(1 / 60); }
    const after = session.getState();
    assert.ok(before.machining.physicalZMm - after.machining.physicalZMm > 5, '溜板往夾頭移動');
    assert.ok(after.cutCount > before.cutCount, '有切削');
    const w = session.exportWorkpieceState(), res = w.profile.resolutionMm;
    assert.ok(2 * w.profile.radiusMm[Math.floor((w.lengthMm - 1) / res)] < 20, '外徑被車小');
  } finally { await close(); }
});

test('wheel.grip：手握著鑽床進給手柄時不會回彈，放開（wheel.release）才回彈', async () => {
  const { machine, session, tick, close } = await fixture('drill');
  try {
    send(session, { type: 'wheel.grip', key: 'feed' });
    send(session, { type: 'wheel.turnBy', key: 'feed', deltaAngle: -0.6 });
    const down = machine.getState().offsets.quill;
    assert.ok(down < 0, '套筒往下');
    for (let i = 0; i < 60; i++) tick(1 / 60);
    near(machine.getState().offsets.quill, down);
    send(session, { type: 'wheel.release' });
    for (let i = 0; i < 180; i++) tick(1 / 60);
    near(machine.getState().offsets.quill, 0, 1e-6);
  } finally { await close(); }
});
