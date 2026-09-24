import test from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES, challengeById, grade, createBlockStock } from './challenges.js';
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

test('drill: depth from an axial feed; a through hole earns no stars', () => {
  const d = challengeById('drill'), stock = createBlockStock();
  const bore = z => cutHead(stock, { xMm: 45, yMm: 10, zMm: 25 }, { xMm: 45, yMm: 10, zMm: z }, drill, running);
  assert.equal(grade(d, stock).stars, 0);
  assert.equal(grade(d, bore(10)).stars, 3);
  assert.equal(grade(d, bore(9.6)).stars, 2);
  assert.equal(grade(d, bore(11)).stars, 1);
  assert.equal(grade(d, bore(-1)).stars, 0);
  // Sideways motion never drills.
  assert.equal(cutHead(stock, { xMm: 40, yMm: 10, zMm: 25 }, { xMm: 45, yMm: 10, zMm: 10 }, drill, running), stock);
});
