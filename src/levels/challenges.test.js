import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES, challengeById, grade, createBlockStock, createDrillStock } from './challenges.js';
import { cutHead } from '../machining/HeadCuttingSimulation.js';
import { createHandleState } from '../machining/WorkpieceState.js';

const running = { running: true, rpm: 800, direction: 1 };
const faceMill = { type: 'milling', id: 'head_face_mill', diameterMm: 58, cuttingLengthMm: 32 };
const drill = { type: 'drilling', id: 'head_drill_85', diameterMm: 8.5, cuttingLengthMm: 49 };

test('three independent challenges, one per machine', () => {
  assert.deepEqual(CHALLENGES.map(c => c.machine), ['lathe', 'milling', 'drill']);
  for (const c of CHALLENGES) assert.ok(challengeById(c.id).createStock());
});

test('lathe: stars follow diameter and turned length', () => {
  const lathe = challengeById('lathe'), turned = (diameter, length) => {
    const s = createHandleState(), r = s.profile.resolutionMm, n = s.profile.radiusMm.length;
    for (let i = n - Math.round(length / r); i < n; i++) s.profile.radiusMm[i] = diameter / 2;
    return s;
  };
  assert.equal(grade(lathe, createHandleState()).stars, 0);
  assert.equal(grade(lathe, turned(16, 50)).stars, 3);
  assert.equal(grade(lathe, turned(16.2, 50)).stars, 2);
  assert.equal(grade(lathe, turned(16, 52)).stars, 1);
  assert.equal(grade(lathe, turned(14, 50)).stars, 0);
});

test('milling: a real face-mill pass decides the stars; untouched stock earns none', () => {
  const mill = challengeById('milling'), stock = createBlockStock();
  assert.equal(grade(mill, stock).stars, 0);
  const pass = z => cutHead(stock, { xMm: -40, yMm: 10, zMm: z }, { xMm: 130, yMm: 10, zMm: z }, faceMill, running);
  assert.equal(grade(mill, pass(18.5)).stars, 3);
  assert.equal(grade(mill, pass(18.3)).stars, 2);
  assert.equal(grade(mill, pass(17.8)).stars, 1);
  // A stopped spindle never removes material.
  assert.equal(cutHead(stock, { xMm: -40, yMm: 10, zMm: 18 }, { xMm: 130, yMm: 10, zMm: 18 }, faceMill, { running: false, rpm: 0 }), stock);
});

test('drill: two positioned holes, the right drills, and an M10 thread decide the stars', () => {
  const d = challengeById('drill'), tap = { type: 'tapping', id: 'head_tap_m10', diameterMm: 10, cuttingLengthMm: 49, designation: 'M10', pilotDiameterMm: 8.5 };
  const drill10 = { ...drill, id: 'head_drill_10', diameterMm: 10 };
  const bore = (s, tool, x, depth) => cutHead(s, { xMm: x, yMm: 10, zMm: 25 }, { xMm: x, yMm: 10, zMm: 20 - depth }, tool, running);
  const part = ({ ax = 25, bx = 65, aTool = drill, bTool = drill10, aDepth = 15, tapDepth = 10, bDepth = 8 } = {}) => {
    let s = bore(createDrillStock(), aTool, ax, aDepth);
    if (tapDepth) s = bore(s, tap, ax, tapDepth);
    return bore(s, bTool, bx, bDepth);
  };
  assert.equal(createDrillStock().surfaceMarks.length, 2);
  assert.equal(grade(d, createDrillStock()).stars, 0);
  assert.equal(grade(d, part()).stars, 3);
  assert.equal(grade(d, part({ tapDepth: 14 })).stars, 3); // a deeper thread is fine
  assert.equal(grade(d, part({ ax: 25.4 })).stars, 2);
  assert.equal(grade(d, part({ bDepth: 9 })).stars, 1);
  assert.equal(grade(d, part({ tapDepth: 0 })).stars, 0);
  assert.equal(grade(d, part({ bTool: drill })).stars, 0); // wrong drill for hole B
  assert.equal(grade(d, part({ aTool: drill10 })).stars, 0); // Ø10 pilot cannot be tapped M10
  assert.equal(grade(d, part({ bDepth: 20 })).stars, 0); // through hole
  // Sideways motion never drills.
  const block = createBlockStock();
  assert.equal(cutHead(block, { xMm: 40, yMm: 10, zMm: 25 }, { xMm: 45, yMm: 10, zMm: 10 }, drill, running), block);
});

test('drill: a tap still finds its pilot hole after the stock slid away and back', () => {
  const stock = cutHead(createDrillStock(), { xMm: 25, yMm: 10, zMm: 25 }, { xMm: 25, yMm: 10, zMm: 5 }, drill, running);
  const tap = { type: 'tapping', id: 'head_tap_m10', diameterMm: 10, cuttingLengthMm: 49, designation: 'M10', pilotDiameterMm: 8.5 };
  const tapped = cutHead(stock, { xMm: 25.0000004, yMm: 10, zMm: 25 }, { xMm: 25.0000004, yMm: 10, zMm: 10 }, tap, running);
  assert.equal(tapped.features[0].thread.tappedDepthMm, 10);
});

test('live readouts show the original stock and the current size', () => {
  for (const c of CHALLENGES) assert.match(c.live(c.createStock())[0][1], /20/);
  assert.match(challengeById('drill').live(createDrillStock()).at(-1)[1], /尚未鑽孔/);
});
