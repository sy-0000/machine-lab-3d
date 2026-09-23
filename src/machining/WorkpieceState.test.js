import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandleState, cloneWorkpieceState, validateWorkpieceState } from './WorkpieceState.js';
import { cutRevolvedProfile } from './CuttingSimulation.js';
import { WorkpieceStore, WORKPIECE_SAVE_KEY } from './WorkpieceStore.js';
import { profileGeometry } from './adapters/RevolvedWorkpiece.js';
import { mmToWorld, worldToMm } from './adapters/MachineV1Adapter.js';
import { radiusToDiameterMm, diameterToRadiusMm } from './adapters/latheCoordinates.js';
import { MachineSession } from './MachineSession.js';
import { MachineLoader } from '../machines/core/MachineLoader.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { loadSource } from '../../scripts/model-source.mjs';
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`);
const tip = (zMm, radius, height = 0) => ({zMm,uMm:height,vMm:radius});
const cut = (s,a,b,opts={}) => cutRevolvedProfile(s,a,b,{rpm:500,toolId:'turning',...opts});
function memoryStorage() {
  const values = new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}

test('handle stock is diameter 20, blank length 300, mm-only radius cells and deep-cloneable',()=>{
  const s=createHandleState();assert.equal(s.units,'mm');assert.equal(s.axis,'Z');
  assert.equal(s.stock.radiusMm,10);assert.equal(s.stock.lengthMm,300);assert.equal(s.actualLengthMm,300);
  assert.equal(s.profile.resolutionMm,0.5);assert.equal(s.profile.radiusMm.length,600);
  assert.ok(s.profile.radiusMm.every(r=>r===10));
  assert.deepEqual(JSON.parse(JSON.stringify(s)),s);
  const copy=cloneWorkpieceState(s);copy.profile.radiusMm[0]=2;copy.features.push({kind:'reserved'});
  assert.equal(s.profile.radiusMm[0],10);assert.deepEqual(s.features,[]);
  near(diameterToRadiusMm(16.3),8.15);near(radiusToDiameterMm(10-8.15),3.7);
  for(const mm of [0.5,1,8.15,300])near(worldToMm(mmToWorld(mm)),mm);
});
test('swept axial cells only: no target-region clipping, including reverse travel',()=>{
  const s=createHandleState(),a=tip(40,8.15),b=tip(50,8.15);
  const result=cut(s,a,b);assert.deepEqual(result.profile,cut(s,b,a).profile);
  result.profile.radiusMm.forEach((r,i)=>assert.equal(r,i>=80&&i<100?8.15:10));
  assert.equal(s.profile.radiusMm[80],10);
  assert.equal(result.operationHistory.length,1);
  const wrongPlace=cut(result,tip(200,7),tip(201,7));
  assert.equal(wrongPlace.profile.radiusMm[400],7);assert.equal(wrongPlace.profile.radiusMm[300],10);
});
test('air, stopped spindle, missing/unsupported tools and out-of-stock moves do not cut',()=>{
  const s=createHandleState();
  for(const result of [cut(s,tip(0,12),tip(300,12)),cut(s,tip(-10,2),tip(-1,2)),
    cut(s,tip(300,2),tip(350,2)),cut(s,tip(20,2),tip(30,2),{rpm:0}),
    cut(s,tip(20,2),tip(30,2),{toolId:null}),cut(s,tip(20,2),tip(30,2),{cutting:false})])assert.equal(result,s);
});
test('overcut is permanent; returning to a larger radius cannot add material',()=>{
  const s=cut(createHandleState(),tip(20,5),tip(30,5));
  assert.equal(cut(s,tip(20,8.15),tip(30,8.15)),s);
  assert.equal(cut(s,tip(20,10),tip(30,10)),s);
  assert.equal(s.profile.radiusMm[40],5);
});
test('diagonal/height-aware sweep is deterministic under subdivision, including a radial crossing',()=>{
  const s=createHandleState(),a=tip(20,9,1),b=tip(40,5,3),middle=tip(30,7,2);
  assert.deepEqual(cut(s,a,b).profile,cut(cut(s,a,middle),middle,b).profile);
  const crossed=cut(s,tip(10,-8,3),tip(10,8,3));
  near(crossed.profile.radiusMm[20],3);assert.equal(crossed.profile.radiusMm[19],10);
  assert.notEqual(cut(s,a,b).profile.radiusMm[40],cut(s,a,b).profile.radiusMm[79]);
});
test('save/reload preserves geometry, actual length and reserved surface/history data',()=>{
  const s=cut(createHandleState(),tip(20,8.15),tip(60,8.15));
  s.surfaceMarks.push({zMm:25,kind:'reserved'});s.features.push({kind:'reserved'});
  const store=new WorkpieceStore(memoryStorage());store.save(s);const restored=store.load();
  assert.deepEqual(restored,s);restored.profile.radiusMm[0]=1;assert.equal(store.load().profile.radiusMm[0],10);
  const a=profileGeometry(s,mmToWorld),b=profileGeometry(store.load(),mmToWorld);
  assert.deepEqual(a.attributes.position.array,b.attributes.position.array);assert.deepEqual(a.index.array,b.index.array);
  near(a.boundingBox.max.x,0.3);near(a.boundingBox.min.x,0);a.dispose();b.dispose();
  // Schema is ready to retain an actual faced length; no facing operation/target is implemented yet.
  const shorter=cloneWorkpieceState(s);shorter.actualLengthMm=299.7;
  store.save(shorter);assert.equal(store.load().actualLengthMm,299.7);
  const geometry=profileGeometry(store.load(),mmToWorld);near(geometry.boundingBox.max.x,0.2997);geometry.dispose();
});
test('invalid/versioned/corrupt saves and storage failures are explicit',()=>{
  const valid=createHandleState();
  for(const invalid of [{...valid,version:2},{...valid,units:'m'},
    {...valid,actualLengthMm:301},{...valid,profile:{...valid.profile,radiusMm:[NaN]}},
    {...valid,profile:{...valid.profile,radiusMm:Array(600)}},
    {...valid,profile:{...valid.profile,radiusMm:valid.profile.radiusMm.map(()=>11)}},
    {...valid,features:[{bad:Infinity}]}])assert.throws(()=>validateWorkpieceState(invalid));
  const storage=memoryStorage(),store=new WorkpieceStore(storage);
  assert.throws(()=>store.load(),/No saved/);storage.setItem(WORKPIECE_SAVE_KEY,'bad JSON');assert.throws(()=>store.load());
  assert.throws(()=>new WorkpieceStore({setItem(){throw Error('quota');}}).save(valid),/quota/);
});

MachineLoader.setCustomLoader(async(id,config)=>({
  rawJson:JSON.parse(readFileSync(new URL('../../public/models/'+config.config,import.meta.url))),
  scene:(await loadSource(new URL('../../public/models/'+config.model,import.meta.url))).scene,
}));
async function fixture(store) {
  const machine=await MachineRegistry.load('lathe'),session=new MachineSession(machine,{workpieceStore:store});
  const clock=session.claimClock();let frameId=0;
  const send=async command=>{const result=await session.command(command);assert.equal(result.ok,true,result.reason);};
  return {machine,session,send,tick:dt=>session.update(dt,{clock,frameId:frameId++}),
    close:async()=>{session.dispose();await MachineRegistry.unload();}};
}
async function positionTip(f,zMm,radiusMm) {
  let p=f.session.getState().cuttingTipMm;
  assert.ok(radiusMm>=Math.abs(p.uMm),'requested radius must clear the actual tool height');
  // The existing lathe feeds runtime X along scene +X, and runtime Y along scene +Z.
  const v=-Math.sqrt(radiusMm**2-p.uMm**2);
  await f.send({type:'axis.move',axis:'X',representation:'radial',mode:'relative',valueMm:v-p.vMm});
  p=f.session.getState().cuttingTipMm;
  await f.send({type:'axis.move',axis:'Z',mode:'relative',valueMm:zMm-p.zMm});
  p=f.session.getState().cuttingTipMm;near(p.zMm,zMm);near(Math.hypot(p.uMm,p.vMm),radiusMm);
}
test('real Session mounts, cuts at physical tip, saves, reloads into a new Session and continues cutting',async()=>{
  const store=new WorkpieceStore(memoryStorage());let f=await fixture(store);
  try {
    await f.send({type:'workpiece.createHandle'});
    assert.equal(f.machine.currentWorkpiece.object3D.isGroup,true);
    await positionTip(f,100,8.15); // Stopped positioning leaves the entire stock intact.
    assert.ok(f.session.exportWorkpieceState().profile.radiusMm.every(r=>r===10));
    await f.send({type:'spindle.start'});f.tick(2);
    await positionTip(f,110.25,8.15);
    const cutState=f.session.exportWorkpieceState();near(cutState.profile.radiusMm[205],8.15);
    assert.equal(cutState.profile.radiusMm[190],10);assert.equal(cutState.profile.radiusMm[225],10);
    const historyCount=cutState.operationHistory.length;
    f.tick(0.1);f.tick(0.1); // Spindle rotation itself must never generate a fictitious transverse chord.
    assert.equal(f.session.exportWorkpieceState().operationHistory.length,historyCount);
    await f.send({type:'workOffset.set',axis:'X',representation:'diameter',valueMm:999});
    assert.deepEqual(f.session.exportWorkpieceState(),cutState);
    assert.equal((await f.session.command({type:'workpiece.load'})).ok,false);
    await f.send({type:'workpiece.save'});const positions=f.machine.currentWorkpiece.mesh.geometry.attributes.position.array.slice();
    await f.close();f=await fixture(store);
    await f.send({type:'workpiece.load'});
    assert.deepEqual(f.session.exportWorkpieceState(),cutState);
    assert.deepEqual(f.machine.currentWorkpiece.mesh.geometry.attributes.position.array,positions);
    await positionTip(f,120,7);await f.send({type:'spindle.start'});f.tick(2);await positionTip(f,130,7);
    const continued=f.session.exportWorkpieceState();near(continued.profile.radiusMm[245],7);near(continued.profile.radiusMm[205],8.15);
    await f.send({type:'machine.reset'});assert.deepEqual(f.session.exportWorkpieceState(),continued);
    await f.send({type:'workpiece.save'});await f.send({type:'workpiece.unmount'});assert.equal(f.session.getState().workpiece,null);
    await f.send({type:'workpiece.load'});assert.deepEqual(f.session.exportWorkpieceState(),continued);
    const exported=f.session.exportWorkpieceState();exported.profile.radiusMm[0]=0;
    assert.equal(f.session.exportWorkpieceState().profile.radiusMm[0],10);
  }finally{await f.close();}
});
test('only the active calibrated turning tool cuts, and lock/invalid loads preserve mounted workpiece',async()=>{
  const store=new WorkpieceStore(memoryStorage()),f=await fixture(store);
  try{
    await f.send({type:'workpiece.createHandle'});
    await f.send({type:'tool.select',toolId:'turning_tool'});
    assert.equal(f.session.getState().activeCuttingTool.source,'module');
    assert.equal(f.machine.runtime.lookup.TurningTool.visible,false);
    await positionTip(f,100,8.15);await f.send({type:'spindle.start'});f.tick(2);await positionTip(f,105,8.15);
    near(f.session.exportWorkpieceState().profile.radiusMm[202],8.15);
    await f.send({type:'machine.reset'});
    const before=f.session.exportWorkpieceState();
    await f.send({type:'tool.select',toolId:'threading_tool'});assert.equal(f.session.getState().cuttingTipMm,null);
    await f.send({type:'spindle.start'});f.tick(2);
    await f.send({type:'axis.move',axis:'Z',mode:'relative',valueMm:-50});f.tick(0.1);
    assert.deepEqual(f.session.exportWorkpieceState(),before);
    await f.send({type:'machine.reset'});
    assert.equal((await f.session.command({type:'workpiece.mountState',state:{...before,units:'m'}})).ok,false);
    assert.deepEqual(f.session.exportWorkpieceState(),before);
    const lease=f.session.lockInput(f.session.createInput('demo'));
    assert.equal((await f.session.command({type:'workpiece.createHandle'})).ok,false);
    assert.equal((await f.session.command({type:'workpiece.save'})).ok,false);
    assert.equal(f.session.unlockInput(lease),true);
  }finally{await f.close();}
});

test('handwheel feeds cut only their swept cells; scene transforms and stopped travel cannot invent cuts',async()=>{
  const f=await fixture(new WorkpieceStore(memoryStorage()));
  try{
    await f.send({type:'workpiece.createHandle'});await positionTip(f,150.25,8.15);
    const originalTip=f.session.getState().cuttingTipMm;
    f.machine.rootScene.position.set(4,2,-3);f.machine.rootScene.rotation.set(0.2,0.3,-0.1);f.machine.rootScene.scale.setScalar(2);
    assert.deepEqual(f.session.getState().cuttingTipMm,originalTip);
    await f.send({type:'spindle.start'});f.tick(2);
    await f.send({type:'wheel.hold',key:'carriageHandwheel',direction:-1});f.tick(0.1);
    await f.send({type:'wheel.release'});
    const tipAfter=f.session.getState().cuttingTipMm,state=f.session.exportWorkpieceState();
    near(tipAfter.zMm,145.93);near(state.profile.radiusMm[294],8.15);
    assert.equal(state.profile.radiusMm[290],10);assert.equal(state.profile.radiusMm[302],10);
    await f.send({type:'spindle.stop'});f.tick(2);
    const stopped=f.session.exportWorkpieceState();
    await positionTip(f,250.25,8.15);assert.deepEqual(f.session.exportWorkpieceState(),stopped);
    await f.send({type:'spindle.start'});f.tick(2);
    const restarted=f.session.exportWorkpieceState();near(restarted.profile.radiusMm[500],8.15);
    assert.equal(restarted.profile.radiusMm[400],10); // No segment spanning stopped positioning.
  }finally{await f.close();}
});
