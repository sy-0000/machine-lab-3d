import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Vector3, Quaternion } from 'three';
import { loadSource } from '../../scripts/model-source.mjs';
import { MachineLoader } from './core/MachineLoader.js';
import { MachineRegistry } from './core/MachineRegistry.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { WorkpieceRegistry } from '../workpieces/WorkpieceRegistry.js';

// Setup offline loader for Node test runner
MachineLoader.setCustomLoader(async (id, moduleConfig) => {
  const configUrl = new URL(`../../public/models/${moduleConfig.config}`, import.meta.url);
  const rawJson = JSON.parse(readFileSync(configUrl, 'utf-8'));
  const candidatePaths = [moduleConfig.model, moduleConfig.legacyModel].filter(Boolean);
  let loadedScene = null;
  let modelUsed = '';
  for (const p of candidatePaths) {
    try {
      const modelUrl = new URL(`../../public/models/${p}`, import.meta.url);
      const res = await loadSource(modelUrl);
      loadedScene = res.scene;
      modelUsed = p;
      break;
    } catch (e) {}
  }
  if (!loadedScene) {
    throw new Error(`[Test] Failed to load model: ${moduleConfig.model}`);
  }
  return { scene: loadedScene, rawJson, modelUsed };
});

const near = (a, b, eps = 1e-5) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b} (diff: ${Math.abs(a - b)})`);
const worldPos = n => n.getWorldPosition(new Vector3());
const worldQuat = n => n.getWorldQuaternion(new Quaternion());

test('Machine System v1.0: Full Lifecycle, Mount Points, Tool & Workpiece Integration', async () => {
  // 1. LATHE TEST: Load, Mount Workpiece & Turning Tool, Spindle Rotation & Tool Post Indexing
  const lathe = await MachineRegistry.load('lathe');
  assert.equal(MachineRegistry.getCurrentMachine(), lathe);
  assert.ok(lathe.toolMount, 'Lathe must establish ToolMount');
  assert.ok(lathe.workpieceMount, 'Lathe must establish WorkpieceMount');

  // Verify mount hierarchy
  assert.equal(lathe.toolMount.parent.name, 'ToolIndexPivot');
  assert.equal(lathe.workpieceMount.parent.name, 'ChuckAssembly');

  // Load and mount Workpiece
  const workpiece = await WorkpieceRegistry.load('cylinder_30x100');
  assert.equal(workpiece.id, 'cylinder_30x100');
  await lathe.mountWorkpiece(workpiece);
  assert.equal(workpiece.object3D.parent, lathe.workpieceMount);
  assert.equal(lathe.currentWorkpiece, workpiece);

  // Load and mount Tool
  const tool = await ToolRegistry.load('turning_tool');
  assert.equal(tool.id, 'turning_tool');
  await lathe.mountTool(tool);
  assert.equal(tool.object3D.parent, lathe.toolMount);
  assert.equal(lathe.currentTool, tool);

  // Test ToolPost rotation: indexToolPost rotates ToolMount and Tool naturally
  const initialToolQuat = worldQuat(tool.object3D);
  lathe.indexToolPost(1); // 10 degrees
  const indexedToolQuat = worldQuat(tool.object3D);
  assert.ok(initialToolQuat.angleTo(indexedToolQuat) > 0.05, 'Tool must rotate naturally when tool post indexes');

  // Test Spindle rotation: ChuckAssembly, WorkpieceMount, and Workpiece rotate together
  const initialWpQuat = worldQuat(workpiece.object3D);
  const chuckQuatBefore = worldQuat(lathe.runtime.lookup.ChuckAssembly);
  lathe.startSpindle(1);
  for (let i = 0; i < 60; i++) lathe.step(1 / 60);

  const chuckQuatAfter = worldQuat(lathe.runtime.lookup.ChuckAssembly);
  const finalWpQuat = worldQuat(workpiece.object3D);
  assert.ok(chuckQuatBefore.angleTo(chuckQuatAfter) > 0.1, 'Chuck must rotate');
  assert.ok(initialWpQuat.angleTo(finalWpQuat) > 0.1, 'Mounted workpiece must rotate with chuck');
  near(finalWpQuat.angleTo(chuckQuatAfter), initialWpQuat.angleTo(chuckQuatBefore), 1e-4);

  // Test Unmount
  const unmountedTool = await lathe.unmountTool();
  assert.equal(unmountedTool, tool);
  assert.equal(lathe.currentTool, null);
  assert.equal(tool.object3D.parent, null);

  const unmountedWp = await lathe.unmountWorkpiece();
  assert.equal(unmountedWp, workpiece);
  assert.equal(lathe.currentWorkpiece, null);
  assert.equal(workpiece.object3D.parent, null);

  // Test Unload Lathe
  await MachineRegistry.unload();
  assert.equal(MachineRegistry.getCurrentMachine(), null);
  assert.equal(lathe.runtime, null);

  // 2. MILLING TEST: Load Milling, Mount End Mill & Block Workpiece, Table Feed
  const milling = await MachineRegistry.load('milling');
  assert.equal(MachineRegistry.getCurrentMachine(), milling);
  assert.ok(milling.toolMount, 'Milling must establish ToolMount');
  assert.ok(milling.workpieceMount, 'Milling must establish WorkpieceMount');

  assert.equal(milling.toolMount.parent.name, 'Spindle_Rotor_Group');
  assert.equal(milling.workpieceMount.parent.name, 'X_Axis_Table');

  const endMill = await ToolRegistry.load('end_mill');
  await milling.mountTool(endMill);
  assert.equal(endMill.object3D.parent, milling.toolMount);

  const blockWp = await WorkpieceRegistry.load('block_100x60x40');
  await milling.mountWorkpiece(blockWp);
  assert.equal(blockWp.object3D.parent, milling.workpieceMount);

  // Table movement along X must translate workpiece naturally
  const initialWpPos = worldPos(blockWp.object3D);
  milling.moveX(0.05); // move table by 50mm
  const movedWpPos = worldPos(blockWp.object3D);
  near(Math.abs(movedWpPos.z - initialWpPos.z), 0.05, 1e-4);

  // Spindle rotation must spin end mill naturally
  const toolBeforeSpin = worldQuat(endMill.object3D);
  milling.startSpindle(1);
  for (let i = 0; i < 60; i++) milling.step(1 / 60);
  const toolAfterSpin = worldQuat(endMill.object3D);
  assert.ok(toolBeforeSpin.angleTo(toolAfterSpin) > 0.1, 'End mill must spin with milling spindle');

  // 3. DRILL TEST: Automatic Unload & Load Drill, Mount Drill Bit
  const drill = await MachineRegistry.load('drill');
  assert.equal(MachineRegistry.getCurrentMachine(), drill);
  assert.equal(milling.runtime, null, 'Previous machine must be disposed automatically');

  assert.ok(drill.toolMount, 'Drill must establish ToolMount');
  assert.ok(drill.workpieceMount, 'Drill must establish WorkpieceMount');
  assert.equal(drill.toolMount.parent.name, 'SpindleAssembly');
  assert.equal(drill.workpieceMount.parent.name, 'TableAssembly');

  const drillBit = await ToolRegistry.load('drill_bit');
  await drill.mountTool(drillBit);
  assert.equal(drillBit.object3D.parent, drill.toolMount);

  // Quill feed downward must move drill bit downward naturally
  const drillBitBefore = worldPos(drillBit.object3D);
  drill.feedSpindle(-0.03); // feed quill down 30mm
  const drillBitAfter = worldPos(drillBit.object3D);
  near(drillBitAfter.y - drillBitBefore.y, -0.03, 1e-4);

  // Unload Drill
  await MachineRegistry.unload();
  assert.equal(MachineRegistry.getCurrentMachine(), null);
});
