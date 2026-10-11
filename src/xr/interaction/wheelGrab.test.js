import test from 'node:test';
import assert from 'node:assert/strict';
import { Ray, Vector3 } from 'three';
import { createWheelGrab } from './wheelGrab.js';

// 手繞著中心畫圈：控制器位置在轉動平面上（軸 = +Z），半徑 r，角度 a
const handAt = (a, r = 0.2, z = 0) => ({ kind: 'controller', position: new Vector3(Math.cos(a) * r, Math.sin(a) * r, z), ray: new Ray() });

function setup(options = {}) {
  const turns = [], ticks = [];
  const grab = createWheelGrab({
    center: () => new Vector3(0, 0, 0),
    axis: () => new Vector3(0, 0, 1),
    onTurn: d => turns.push(d),
    onTick: (info, dir) => ticks.push(dir),
    ...options,
  });
  return { grab, turns, ticks, sum: () => turns.reduce((a, b) => a + b, 0) };
}
function sweep(grab, from, to, steps = 72, r = 0.2) {
  grab.onGrab(handAt(from, r));
  for (let i = 1; i <= steps; i++) grab.onDrag(handAt(from + (to - from) * i / steps, r));
}

test('一整圈逆時針（右手定則正向）累計 2π，並跨越 ±180°', () => {
  const { grab, sum } = setup();
  sweep(grab, 0, Math.PI * 2);
  assert.ok(Math.abs(sum() - Math.PI * 2) < 1e-9);
  assert.ok(Math.abs(grab.total() - Math.PI * 2) < 1e-9);
});

test('多圈累計與反向轉動', () => {
  const { grab, sum } = setup();
  sweep(grab, 0.3, 0.3 + Math.PI * 6, 300);
  assert.ok(Math.abs(sum() - Math.PI * 6) < 1e-9);
  const back = setup();
  sweep(back.grab, 1, 1 - Math.PI * 3, 200);
  assert.ok(Math.abs(back.sum() + Math.PI * 3) < 1e-9);
});

test('從 170° 轉到 −170° 只算 +20°（不是 −340°）', () => {
  const { grab, sum } = setup();
  grab.onGrab(handAt(170 * Math.PI / 180));
  grab.onDrag(handAt(-170 * Math.PI / 180));
  assert.ok(Math.abs(sum() - 20 * Math.PI / 180) < 1e-9);
});

test('每轉過一個刻度（預設 10°）觸發一次，方向正確', () => {
  const { grab, ticks } = setup();
  sweep(grab, 0, Math.PI / 2, 90); // 90° → 9 個刻度
  assert.equal(ticks.length, 9);
  assert.ok(ticks.every(d => d === 1));
  const back = setup();
  sweep(back.grab, 0, -Math.PI / 3, 60); // −60° → 6 個刻度
  assert.deepEqual(back.ticks, Array(6).fill(-1));
});

test('手偏離轉動平面（前後移動）不影響角度：只看投影', () => {
  const { grab, sum } = setup();
  grab.onGrab(handAt(0, 0.2, 0));
  grab.onDrag(handAt(Math.PI / 4, 0.2, 0.15));
  grab.onDrag(handAt(Math.PI / 2, 0.2, -0.1));
  assert.ok(Math.abs(sum() - Math.PI / 2) < 1e-9);
});

test('手離得遠時改用射線與轉動平面的交點', () => {
  const { grab, sum } = setup({ reach: 0.6 });
  const far = a => ({ kind: 'controller', position: new Vector3(0, 0, 3), ray: new Ray(new Vector3(0, 0, 3), new Vector3(Math.cos(a) * 0.2, Math.sin(a) * 0.2, -3).normalize()) });
  grab.onGrab(far(0));
  grab.onDrag(far(Math.PI / 2));
  assert.ok(Math.abs(sum() - Math.PI / 2) < 1e-9);
});
