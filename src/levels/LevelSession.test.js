import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVEL_1 } from './level1.js';
import { LevelSession } from './LevelSession.js';
import { defineLevel } from './LevelDefinition.js';
import { MachineSession } from '../machining/MachineSession.js';
import { WorkpieceStore } from '../machining/WorkpieceStore.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MachineLoader } from '../machines/core/MachineLoader.js';
import { loadSource } from '../../scripts/model-source.mjs';
// Synthetic acceptance fixtures only, NOT confirmed drawing dimensions.
const confirmed=defineLevel({...LEVEL_1,targets:{status:'confirmed',diameterMm:16.3,diameterToleranceMm:0.01,
  machiningZRange:[200,210],finalLengthMm:299,lengthToleranceMm:0.01}});

MachineLoader.setCustomLoader(async(id,c)=>({rawJson:JSON.parse(readFileSync(new URL('../../public/models/'+c.config,import.meta.url))),
  scene:(await loadSource(new URL('../../public/models/'+c.model,import.meta.url))).scene}));
async function fixture(definition=LEVEL_1) {
  const machine=await MachineRegistry.load('lathe');
  const saved=new Map(),store=new WorkpieceStore({getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)});
  const session=new MachineSession(machine,{workpieceStore:store}),level=new LevelSession(definition,session);
  const clock=session.claimClock();let frame=0;
  const send=async c=>{const result=await session.command(c);assert.equal(result.ok,true,result.reason);};
  return {session,level,store,saved,send,
    tick:()=>session.update(2,{clock,frameId:frame++}),
    move:(axis,valueMm)=>send({type:'machining.move',axis,valueMm,...(axis==='X'?{representation:'diameter'}:{})}),
    zero:axis=>send({type:'machining.datum',axis,...(axis==='X'?{representation:'diameter'}:{})}),
    close:async()=>{level.dispose();session.dispose();await MachineRegistry.unload();}};
}
async function setup(f) {
  await f.level.mount();await f.send({type:'spindle.start'});f.tick();
  await f.move('X',20);await f.zero('X');await f.move('X',4);await f.move('Z',301);
  await f.move('X',0);await f.move('Z',300);await f.zero('Z');
  assert.equal(f.level.getState().currentStep,7);
}
async function face(f) {
  await f.move('X',4);await f.send({type:'machining.mode',mode:'facing'});
  await f.move('Z',-1);await f.move('X',-20);
  assert.equal(f.session.exportWorkpieceState().lengthMm,299);
  await f.move('X',4);await f.send({type:'machining.mode',mode:'turning'});await f.move('Z',-100);
}
test('definition and each attempt have independent Ø20 × 300 working copies, with TODO drawing dimensions',async()=>{
  const f=await fixture();try{
    assert.equal(LEVEL_1.targets.finalLengthMm,240);assert.equal(LEVEL_1.targets.machiningZRange,null);
    assert.equal(f.level.getState().currentStep,0);
    const copy=f.level.exportWorkingCopy();assert.equal(copy.lengthMm,300);assert.ok(copy.profile.radiusMm.every(r=>r===10));
    copy.profile.radiusMm[200]=1;assert.equal(f.level.exportWorkingCopy().profile.radiusMm[200],10);
    await f.level.mount();assert.equal(f.level.getState().currentStep,2);
    assert.equal(f.session.getState().machining.centerAligned,true);
    assert.deepEqual(f.session.exportWorkpieceState(),LEVEL_1.initialWorkpiece);
    assert.throws(()=>defineLevel({...LEVEL_1,targets:{...LEVEL_1.targets,diameterMm:30}}));
  }finally{await f.close();}
});
test('spindle must rotate and X/Z zero must happen at real surface contact, not in air or out of order',async()=>{
  const f=await fixture();try{
    await f.level.mount();await f.zero('X');await f.zero('Z');
    assert.equal(f.level.getState().currentStep,2);
    await f.send({type:'machining.clearDatum'});
    await f.send({type:'spindle.start'});assert.equal(f.level.getState().currentStep,2);
    f.tick();assert.equal(f.level.getState().currentStep,3);
    await f.move('X',20);assert.equal(f.level.getState().currentStep,4);
    const tip=f.session.getState().cuttingTipMm;
    await f.zero('X');assert.equal(f.level.getState().currentStep,5);
    assert.deepEqual(f.session.getState().cuttingTipMm,tip);
    await f.zero('Z');assert.equal(f.level.getState().currentStep,5);
    await f.send({type:'machining.clearDatum'});assert.equal(f.level.getState().currentStep,4);
    await f.zero('X');await f.move('X',4);await f.move('Z',301);await f.move('X',0);await f.move('Z',300);
    assert.equal(f.level.getState().currentStep,6);await f.zero('Z');assert.equal(f.level.getState().currentStep,7);
    assert.equal(f.level.inspect().complete,false);
  }finally{await f.close();}
});
test('real facing and profile removal are required, stopped motion cannot complete; inspection requires a stopped spindle',async()=>{
  const f=await fixture(confirmed);try{
    await setup(f);
    await f.send({type:'spindle.stop'});f.tick();
    await f.move('X',4);await f.move('Z',-100);await f.move('X',-3.7);
    assert.equal(f.level.getState().measurements.turned,false);assert.equal(f.level.getState().currentStep,7);
    await f.move('X',4);await f.send({type:'spindle.start'});f.tick();await f.move('X',-3.7);
    assert.equal(f.level.getState().measurements.turned,true);assert.equal(f.level.getState().currentStep,7);
    await face(f);await f.move('X',-3.7);await f.move('Z',-90);
    assert.equal(f.level.getState().currentStep,8);
    assert.equal(f.level.inspect().complete,false);
    await f.send({type:'spindle.stop'});f.tick();assert.equal(f.level.getState().currentStep,9);
    const result=f.level.inspect();assert.equal(result.complete,true);assert.equal(result.diameter.actual.minMm,16.3);assert.equal(result.length.actualMm,299);
    assert.equal(f.level.getState().currentStep,-1);
    assert.ok(f.session.exportWorkpieceState().profile.radiusMm.some(r=>r===8.15));
    assert.equal(LEVEL_1.initialWorkpiece.profile.radiusMm[400],10);
  }finally{await f.close();}
});
test('overcut remains in actual stock and prevents completion; Retry clears failed state, offsets and progress',async()=>{
  const f=await fixture(confirmed);try{
    await setup(f);await face(f);await f.move('X',-6);await f.move('X',-3.7);
    assert.equal(f.level.getState().measurements.overcut,true);
    assert.equal(f.session.exportWorkpieceState().profile.radiusMm[400],7);
    assert.equal(f.level.inspect().complete,false);
    await f.level.retry();assert.equal(f.level.getState().currentStep,0);assert.equal(f.level.getState().attempt,2);
    assert.deepEqual(f.level.exportWorkingCopy(),LEVEL_1.initialWorkpiece);
    await f.level.mount();assert.deepEqual(f.session.exportWorkpieceState(),LEVEL_1.initialWorkpiece);
    assert.deepEqual(f.session.getState().machining.datumMm,{X:0,Z:0});assert.equal(f.session.getState().rpm,0);
    assert.equal(f.level.getState().result,null);
    assert.equal(f.level.getState().measurements.diameter.actual.minMm,20);
    assert.equal(f.level.getState().measurements.overcut,false);
  }finally{await f.close();}
});
test('configured length/range is checked when supplied; pending configuration is never guessed',async()=>{
  const def=defineLevel({...confirmed,targets:{...confirmed.targets,finalLengthMm:298}});
  const f=await fixture(def);try{
    await setup(f);await face(f);await f.move('X',-3.7);await f.move('Z',-90);
    assert.equal(f.level.getState().measurements.diameter.status,'within-tolerance');
    assert.equal(f.level.getState().measurements.length.status,'not-yet-to-size');
    assert.equal(f.level.inspect().complete,false);
  }finally{await f.close();}
});
test('draft drawings cannot pass even after real setup, facing and turning; inspection snapshots are independent',async()=>{
  const f=await fixture();try{
    await setup(f);await face(f);await f.move('X',-3.7);await f.move('Z',-90);
    await f.send({type:'spindle.stop'});f.tick();
    const result=f.level.inspect();assert.equal(result.complete,false);assert.equal(result.status,'draft');
    assert.equal(result.diameter.actual,null);assert.equal(result.diameter.error,null);
    assert.equal(result.observedCutDiameter.minMm,16.3);assert.equal(result.length.actualMm,299);
    assert.equal(f.level.getState().currentStep,9);
    result.length.actualMm=1;assert.equal(f.level.getState().result.length.actualMm,299);
    await f.level.retry();assert.equal(f.level.getState().result,null);
    assert.equal(f.level.getState().measurements.observedCutDiameter,null);
    assert.equal(f.level.getState().measurements.length.actualMm,300);
  }finally{await f.close();}
});
test('disposing a level removes observers; free machining and its local save remain independent',async()=>{
  const f=await fixture();try{
    await f.send({type:'workpiece.createHandle'});await f.send({type:'workpiece.save'});
    const saved=JSON.stringify([...f.saved]);await setup(f);await face(f);await f.move('X',-3.7);
    assert.equal(JSON.stringify([...f.saved]),saved);
    const snapshot=f.level.getState();f.level.dispose();
    await f.send({type:'machine.reset'});await f.send({type:'workpiece.load'});
    assert.equal(f.session.exportWorkpieceState().lengthMm,300);
    assert.deepEqual(f.level.getState(),snapshot);
    await f.move('X',16);await f.send({type:'spindle.start'});f.tick();
    assert.ok(f.session.exportWorkpieceState().profile.radiusMm.some(r=>r===8));
  }finally{await f.close();}
});
