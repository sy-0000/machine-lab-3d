import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Group, Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { loadSource } from '../../scripts/model-source.mjs';
import { MachineLoader } from '../machines/core/MachineLoader.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MachineSession } from './MachineSession.js';
import { mmToWorld, worldToMm } from './adapters/MachineV1Adapter.js';
import { createLatheCoordinates, diameterToRadiusMm, radiusToDiameterMm } from './adapters/latheCoordinates.js';
import { WorkpieceRegistry } from '../workpieces/WorkpieceRegistry.js';
import { WorkpieceBase } from '../workpieces/WorkpieceBase.js';
import { WorkpieceLoader } from '../workpieces/WorkpieceLoader.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { resetMachine } from '../machines/runtime.js';

MachineLoader.setCustomLoader(async (id, config) => ({
  rawJson: JSON.parse(readFileSync(new URL('../../public/models/' + config.config, import.meta.url))),
  scene: (await loadSource(new URL('../../public/models/' + config.model, import.meta.url))).scene,
}));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, actual + ' != ' + expected);
async function fixture(id = 'lathe', options) {
  const machine = await MachineRegistry.load(id);
  const session = new MachineSession(machine, options), clock = session.claimClock();
  let frameId = 0;
  return { machine, session, clock, tick: dt => session.update(dt, { clock, frameId: frameId++ }),
    close: async () => { session.dispose(); await MachineRegistry.unload(); } };
}
function send(session, command, input) {
  const result = session.command(command, input);
  assert.equal(result.ok, true, result.reason); return result;
}

test('diameter, radius, signed displacement and explicit unit conversions are deterministic', () => {
  near(diameterToRadiusMm(20 - 16.3), 1.85);
  near(radiusToDiameterMm(8.15), 16.3);
  for (const mm of [-3.7, 0, 0.5, 1, 1.85, 100]) near(worldToMm(mmToWorld(mm)), mm);
  assert.equal(mmToWorld(0.5), 0.0005); assert.equal(mmToWorld(1), 0.001);
  assert.throws(() => mmToWorld(NaN)); assert.throws(() => worldToMm(Infinity));
  const c = createLatheCoordinates({ radialSign: -1, longitudinalSign: -1 });
  near(c.toMachineMm('X', -3.7, 'diameter'), 1.85);
  near(c.toMachineMm('Z', 10), -10);
  assert.throws(() => c.toMachineMm('X', 20));
});

test('player Session commands drive the real lathe and report actual detent speed', async () => {
  const f = await fixture(); try {
    send(f.session, {type:'spindle.speed',rpm:1000});
    send(f.session, {type:'spindle.start',direction:1}); f.tick(2);
    near(f.machine.runtime.rpm, 1000); assert.equal(f.machine.running, true);
    assert.equal(f.session.getState().targetRpm, 1000);
    assert.equal(f.session.command({type:'spindle.speed',rpm:123}).ok, false);
    assert.equal(f.session.getState().targetRpm, 1000);
    send(f.session, {type:'spindle.stop'}); f.tick(2); near(f.machine.runtime.rpm, 0);
    send(f.session, {type:'wheel.hold',key:'carriageHandwheel',direction:-1}); f.tick(0.2);
    assert.ok(f.machine.runtime.offsets.x < 0);
    send(f.session, {type:'wheel.release'}); const x=f.machine.runtime.offsets.x;f.tick(0.2);near(f.machine.runtime.offsets.x,x);
  } finally { await f.close(); }
});

test('teaching X/Z, work datum and radial moves preserve legacy X/Z semantics', async () => {
  const f = await fixture(); try {
    const s=f.session,m=f.machine;
    // The cross slide's home is its operator-side limit; feed in 10 mm so X can also back off.
    m.setAxisPosition('y',0.01);
    send(s,{type:'workOffset.set',axis:'X',representation:'diameter',valueMm:20});
    near(m.runtime.offsets.y,0.01); near(s.getState().lathe.xDiameterMm,20);
    send(s,{type:'axis.move',axis:'X',representation:'diameter',valueMm:16.3});
    near(m.runtime.offsets.y,0.00815);near(s.getState().lathe.xRadialMm,8.15);near(m.runtime.offsets.z,0);
    send(s,{type:'axis.move',axis:'Z',valueMm:30});near(m.runtime.offsets.x,0.03);
    send(s,{type:'workOffset.zero',axis:'Z'});near(m.runtime.offsets.x,0.03);near(s.getState().lathe.zMm,0);
    send(s,{type:'axis.move',axis:'Z',valueMm:-10,mode:'relative'});near(m.runtime.offsets.x,0.02);
    send(s,{type:'axis.move',axis:'X',representation:'radial',valueMm:1,mode:'relative'});near(m.runtime.offsets.y,0.00915);near(s.getState().lathe.xDiameterMm,18.3);
    assert.equal(s.command({type:'axis.move',axis:'X',valueMm:1}).ok,false);
    send(s,{type:'axis.move',axis:'Z',valueMm:9999});near(s.getState().machineAxesMm.x,380);
    // Old external callers still move longitudinal X and tool-height Z in metres.
    m.setX(0.01);m.setZ(0.02);near(m.runtime.offsets.x,0.01);near(m.runtime.offsets.z,0.02);near(m.runtime.offsets.y,0.00915);
  } finally { await f.close(); }
});

test('explicit mm workpieces cover submillimetre values; no-unit v1 callers retain compatibility', async () => {
  const tiny=WorkpieceLoader.create({type:'cylinder',units:'mm',diameter:0.5,length:1});
  near(tiny.dimensions.radius,0.00025);near(tiny.dimensions.lengthMeters,0.001);tiny.dispose();
  const meters=WorkpieceLoader.create({type:'cylinder',units:'m',diameter:0.02,length:0.1});near(meters.dimensions.radius,0.01);meters.dispose();
  const old=WorkpieceLoader.create({type:'cylinder',diameter:0.02,length:0.1});near(old.dimensions.radius,0.01);old.dispose();
  assert.throws(()=>WorkpieceLoader.create({type:'cylinder',units:'cm',diameter:1,length:1}));
  const f=await fixture();try {
    assert.equal((await f.session.command({type:'workpiece.mount',spec:{type:'cylinder',diameter:0.5,length:1}})).ok,true);
    near(f.session.getState().workpiece.dimensionsMm.radiusMm,0.25);
    assert.equal((await f.session.command({type:'workpiece.mount',spec:{type:'cylinder',units:'m',diameter:0.02,length:0.1}})).ok,false);
  }finally{await f.close();}
});

test('Group workpiece reset, demo isolation, unmount and unload preserve ownership', async () => {
  const f=await fixture();try {
    const group=new Group(),mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());group.add(mesh);
    let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);
    const wp=new WorkpieceBase({id:'group',type:'block',dimensions:{},object3D:group});
    await f.machine.mountWorkpiece(wp);
    assert.doesNotThrow(()=>resetMachine(f.machine.runtime));
    assert.equal(group.parent,f.machine.workpieceMount);assert.equal(disposed,0);
    assert.doesNotThrow(()=>f.machine.reset());
    assert.equal(f.machine.toggleDemoWorkpiece(),false);
    const returned=await f.machine.unmountWorkpiece();assert.equal(returned,wp);assert.equal(group.parent,null);assert.equal(disposed,0);
    wp.dispose();assert.equal(disposed,1);
    assert.equal(f.machine.toggleDemoWorkpiece(),true);
    const modular=await WorkpieceRegistry.load('cylinder_30x100');await f.machine.mountWorkpiece(modular);
    assert.equal(f.machine.runtime.scene.getObjectByName('DemoWorkpiece'),undefined);
    send(f.session,{type:'machine.reset'});assert.equal(f.machine.currentWorkpiece,modular);
  }finally{await f.close();}
});

test('one active cutting tool: modular mount hides default and unmount restores it', async () => {
  const f=await fixture();try {
    const before=f.session.getState().activeCuttingTool;
    assert.equal(before.source,'default');
    assert.equal((await f.session.command({type:'tool.select',toolId:'threading_tool'})).ok,true);
    assert.equal(f.machine.runtime.lookup.TurningTool.visible,false);
    assert.equal(f.session.getState().activeCuttingTool.id,'threading_tool');
    send(f.session,{type:'machine.reset'});assert.equal(f.machine.runtime.lookup.TurningTool.visible,false);
    assert.equal((await f.session.command({type:'tool.select',toolId:'caliper'})).ok,false);
    assert.equal((await f.session.command({type:'tool.select',toolId:'end_mill'})).ok,false);
    assert.equal((await f.session.command({type:'tool.select',toolId:null})).ok,true);
    assert.equal(f.machine.runtime.lookup.TurningTool.visible,true);
    assert.deepEqual(f.session.getState().activeCuttingTool,before);
  }finally{await f.close();}
});

test('exclusive input leases block player/demo interference and clear held inputs on handoff', async () => {
  const f=await fixture();try {
    const s=f.session,demo=s.createInput('demo');
    send(s,{type:'wheel.hold',key:'carriageHandwheel',direction:-1});f.tick(0.1);
    const x=f.machine.runtime.offsets.x,lease=s.lockInput(demo);
    assert.equal(s.command({type:'spindle.start'}).ok,false);f.tick(0.1);near(f.machine.runtime.offsets.x,x);
    send(s,{type:'axis.move',axis:'Z',valueMm:20},demo);
    assert.equal(s.command({type:'axis.move',axis:'Z',valueMm:90}).ok,false);near(f.machine.runtime.offsets.x,0.02);
    assert.equal(s.unlockInput({}),false);
    assert.throws(()=>s.lockInput(s.player));assert.equal(s.unlockInput(lease),true);
    const playerLease=s.lockInput(s.player);
    assert.equal(s.command({type:'spindle.start'},demo).ok,false);
    send(s,{type:'spindle.start'});s.unlockInput(playerLease);assert.equal(s.getState().running,false);
    const blocked=s.lockInput();assert.equal(s.command({type:'machine.reset'}).ok,false);assert.equal(s.command({type:'machine.reset'},demo).ok,false);s.unlockInput(blocked);
  }finally{await f.close();}
});

test('single clock lease and monotonic frame IDs prevent double updates', async () => {
  const f=await fixture();try {
    send(f.session,{type:'spindle.start'});
    assert.throws(()=>new MachineSession(f.machine),/claimed/);
    assert.throws(()=>f.session.claimClock(),/claimed/);
    assert.throws(()=>f.machine.step(1),/owned/);
    assert.throws(()=>f.session.update(1,{clock:{},frameId:0}),/owner/);
    f.tick(1);const before=f.machine.runtime.spindleAngle;
    assert.equal(f.session.update(1,{clock:f.clock,frameId:0}).advanced,false);
    near(f.machine.runtime.spindleAngle,before);assert.equal(f.session.getState().updateCount,1);
    f.tick(1);assert.equal(f.session.getState().updateCount,2);near(f.session.getState().elapsedSeconds,2);
    f.session.dispose();assert.doesNotThrow(()=>f.machine.step(0));
  }finally{await f.close();}
});

test('drill held feed excludes spring return until input release', async () => {
  const f=await fixture('drill');try {
    send(f.session,{type:'wheel.hold',key:'feed',direction:-1});f.tick(0.3);
    assert.ok(f.machine.runtime.offsets.quill < -0.01);
    send(f.session,{type:'wheel.release'});f.tick(1);near(f.machine.runtime.offsets.quill,0);
    send(f.session,{type:'axis.move',axis:'table',valueMm:10});near(f.machine.runtime.offsets.table,0.01);
  }finally{await f.close();}
});

test('milling teaching axes use mm and keep the v1 table mapping', async () => {
  const f=await fixture('milling');try {
    for(const [axis,id] of [['X','X_Axis_Table'],['Y','Y_Axis_Saddle'],['Z','Knee_Z_Slide']]) {
      send(f.session,{type:'axis.move',axis,valueMm:10});near(f.machine.runtime.offsets[id],0.01);
    }
    send(f.session,{type:'spindle.speed',rpm:1200});send(f.session,{type:'spindle.start'});f.tick(2);near(f.session.getState().rpm,1200);
  }finally{await f.close();}
});

test('asynchronous tool load cannot mount after input handoff or session disposal', async () => {
  let resolveLoad,disposed=0;
  const pending=new Promise(resolve=>{resolveLoad=resolve;});
  const f=await fixture('lathe',{tools:{get:id=>ToolRegistry.get(id),load:()=>pending}});
  try {
    const result=f.session.command({type:'tool.select',toolId:'turning_tool'});
    assert.equal(f.session.command({type:'spindle.start'}).ok,false);
    const lease=f.session.lockInput(f.session.createInput('demo'));
    const tool=await ToolRegistry.load('turning_tool');const dispose=tool.dispose.bind(tool);tool.dispose=()=>{disposed++;dispose();};
    resolveLoad(tool);assert.equal((await result).ok,false);assert.equal(disposed,1);assert.equal(f.machine.currentTool,null);
    f.session.unlockInput(lease);
  }finally{await f.close();}
});

test('taper attachment: feeding Z alone (jog or held carriage wheel) cuts a taper at the set half-angle', async () => {
  const { session, tick, close } = await fixture();
  try {
    assert.equal((await session.command({ type: 'workpiece.createHandle' })).ok, true);
    const angle = 4, slope = 2 * Math.tan(angle * Math.PI / 180); // diameter change per mm of Z
    const m0 = session.getState().machining;
    send(session, { type: 'machining.move', axis: 'Z', valueMm: m0.lengthMm + 2 - m0.physicalZMm, mode: 'relative' });
    send(session, { type: 'machining.move', axis: 'X', valueMm: 16 - session.getState().machining.xDiameterMm - 2 * session.getState().machining.datumMm.X, mode: 'relative', representation: 'diameter' });
    send(session, { type: 'machining.taperAttachment', enabled: true, angleDeg: angle });
    send(session, { type: 'spindle.start', direction: 1 });
    for (let i = 0; i < 240; i++) tick(1 / 60);
    const start = session.getState().machining;
    for (let i = 0; i < 20; i++) send(session, { type: 'machining.move', axis: 'Z', valueMm: -.5, mode: 'relative' });
    // Held carriage handwheel toward the chuck: the attachment follows every frame.
    send(session, { type: 'wheel.hold', key: 'carriageHandwheel', direction: -1 });
    for (let i = 0; i < 60; i++) tick(1 / 60);
    send(session, { type: 'wheel.release' });
    const end = session.getState().machining;
    assert.ok(start.physicalZMm - end.physicalZMm > 12, 'carriage fed toward the chuck');
    near(end.xDiameterMm - start.xDiameterMm, slope * (start.physicalZMm - end.physicalZMm));
    const w = session.exportWorkpieceState(), res = w.profile.resolutionMm, dia = z => 2 * w.profile.radiusMm[Math.floor(z / res)];
    // Sample inside the cut: the taper leaves the Ø20 stock after (20 − 16) / slope ≈ 28.6 mm.
    const z1 = w.lengthMm - 1, z2 = w.lengthMm - 20;
    assert.ok(Math.abs((dia(z2) - dia(z1)) / (z1 - z2) - slope) < .01, 'profile slope matches the attachment angle');
    assert.ok(dia(z1) < 20 && dia(z1) > 15.5, 'small end was cut');
    send(session, { type: 'spindle.stop' });
    assert.equal(session.command({ type: 'machining.taperAttachment', enabled: true, angleDeg: 15 }).ok, false);
  } finally { await close(); }
});
