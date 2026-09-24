import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MachineRegistry} from '../machines/core/MachineRegistry.js';
import {MachineLoader} from '../machines/core/MachineLoader.js';
import {loadSource} from '../../scripts/model-source.mjs';
import {MachineSession} from '../machining/MachineSession.js';
import {HandleCampaignSession} from './HandleCampaignSession.js';
import {CampaignStore,CAMPAIGN_KEY} from './CampaignStore.js';
import {HANDLE_LEVELS,taperRange} from './handleCampaign.js';
import {measureTaper} from './measureTaper.js';
import {measureHandleStage} from './measureHandleStage.js';
import {createHandleState} from '../machining/WorkpieceState.js';
MachineLoader.setCustomLoader(async(id,c)=>({rawJson:JSON.parse(readFileSync(new URL('../../public/models/'+c.config,import.meta.url))),
  scene:(await loadSource(new URL('../../public/models/'+c.model,import.meta.url))).scene}));
async function fixture(){
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
  const machine=await MachineRegistry.load('lathe'),session=new MachineSession(machine),store=new CampaignStore(storage);
  const campaign=new HandleCampaignSession(session,store),clock=session.claimClock();let frame=0;
  const tick=()=>session.update(2,{clock,frameId:frame++});
  const send=async c=>{const r=await session.command(c);assert.equal(r.ok,true,r.reason);};
  const move=(axis,physical)=>{const m=session.getState().machining;return send({type:'machining.move',axis,valueMm:physical-(axis==='X'?2*m.datumMm.X:m.datumMm.Z),...(axis==='X'?{representation:'diameter'}:{})});};
  const line=(diameter,z)=>{const m=session.getState().machining;return send({type:'machining.line',xDiameterMm:diameter-2*m.datumMm.X,zMm:z-m.datumMm.Z});};
  return {map,storage,session,campaign,store,tick,send,move,line,
    close:async()=>{campaign.dispose();session.dispose();await MachineRegistry.unload();}};
}
async function setup(f){
  await f.campaign.level.mount();const length=f.session.exportWorkpieceState().lengthMm;
  await f.move('X',24);await f.move('Z',100);await f.send({type:'spindle.start'});f.tick();await f.move('X',20);
  await f.send({type:'machining.datum',axis:'X',representation:'diameter'});
  await f.move('X',24);await f.move('Z',length+1);await f.move('X',20);await f.move('Z',length);
  await f.send({type:'machining.datum',axis:'Z'});assert.equal(f.campaign.level.getState().currentStep,7);
}
async function basic(f){
  await setup(f);await f.move('X',24);await f.send({type:'machining.mode',mode:'facing'});await f.move('Z',299);await f.move('X',0);
  await f.move('X',24);await f.send({type:'machining.mode',mode:'turning'});await f.move('Z',150);await f.move('X',19.6);await f.move('Z',155);
  await f.send({type:'spindle.stop'});f.tick();assert.equal(f.campaign.level.inspect().operationsComplete,true);
}
test('actual revisions inherit errors; retry restores current input; reload resumes; free save is untouched',async()=>{
  const f=await fixture();try{
    f.map.set('machine-lab.machining.handle.v1','sentinel');await basic(f);
    const actual=f.session.exportWorkpieceState();assert.equal(actual.lengthMm,299);
    await f.campaign.next();assert.deepEqual(f.campaign.level.exportWorkingCopy(),actual);
    assert.equal(f.campaign.data.currentLevel,1);assert.equal(f.campaign.data.revisions[1].measurements.complete,false);
    await setup(f);const range=taperRange(actual,HANDLE_LEVELS[1].taper);
    await f.move('X',24);await f.move('Z',range[0]);await f.move('X',16.3);await f.line(9.3,range[1]);
    const cut=f.session.exportWorkpieceState();assert.notDeepEqual(cut.profile,actual.profile);
    const t=measureTaper(cut,{...HANDLE_LEVELS[1].taper,rangeMm:range});
    assert.equal(t.status,'draft');assert.equal(t.coverageMm,100);assert.ok(t.linearDeviationMm<=0.036);
    await f.line(6,range[1]-1);const over=f.session.exportWorkpieceState();await f.line(9.3,range[1]);
    assert.ok(f.session.exportWorkpieceState().profile.radiusMm.every((r,i)=>r<=over.profile.radiusMm[i]));
    f.campaign.persist();const loaded=f.store.load();assert.deepEqual(loaded.working,f.session.exportWorkpieceState());
    assert.equal(loaded.specVersion,'hammer-photo-v1');assert.equal(loaded.currentLevel,1);
    await f.campaign.retry();assert.deepEqual(f.campaign.level.exportWorkingCopy(),actual);await f.campaign.level.mount();
    assert.deepEqual(f.session.exportWorkpieceState(),actual);assert.equal(f.map.get('machine-lab.machining.handle.v1'),'sentinel');
    assert.throws(()=>f.store.validate({...loaded,specVersion:'old'}));
  }finally{await f.close();}
});
test('taper measurement checks every cell and confirmed tolerances; drafts and overcut are never repaired',()=>{
  const stock=createHandleState();const target={rangeMm:[100,200],largeDiameterMm:16.3,smallDiameterMm:9.3,toleranceMm:0.04,toleranceStatus:'confirmed'};
  for(let i=200;i<400;i++)stock.profile.radiusMm[i]=(16.3-7*((i+1)*0.5-100)/100)/2;
  assert.equal(measureTaper(stock,target).status,'within-tolerance');
  stock.profile.radiusMm[300]=10;assert.equal(measureTaper(stock,target).status,'not-yet-to-size');
  stock.profile.radiusMm[300]=2;const before=JSON.stringify(stock);assert.equal(measureTaper(stock,target).status,'overcut');assert.equal(JSON.stringify(stock),before);
  assert.equal(measureTaper(stock,{...target,toleranceStatus:'unknown'}).status,'draft');
  assert.equal(measureHandleStage(HANDLE_LEVELS[3],stock,stock).operationsComplete,false);
  assert.equal(measureHandleStage(HANDLE_LEVELS[3],stock,stock).machiningComplete,false);
  const basicDef={...HANDLE_LEVELS[0],targets:{...HANDLE_LEVELS[0].targets,lengthToleranceMm:0.1,
    confirmation:{...HANDLE_LEVELS[0].targets.confirmation,lengthToleranceMm:'confirmed'}}};
  assert.equal(measureHandleStage(basicDef,stock,stock).status,'fail');
  stock.lengthMm=240;stock.profile.radiusMm.length=480;
  const measured=measureHandleStage(basicDef,stock,stock);
  assert.equal(measured.status,'pass');assert.equal(measured.machiningComplete,false);
});
test('demo uses shared physical cuts on a clone, pauses, locks player input and restores player geometry/setup',async()=>{
  const f=await fixture();try{
    await basic(f);const before=f.session.exportWorkpieceState(),pose=f.session.getState().machining;
    const saved=f.map.get(CAMPAIGN_KEY);await f.campaign.demoStart();
    assert.equal(f.session.command({type:'spindle.start'}).ok,false);
    f.campaign.demo.pause();const index=f.campaign.demo.index;f.tick();await Promise.resolve();assert.equal(f.campaign.demo.index,index);
    f.campaign.demo.resume();let sawCut=false;
    for(let i=0;i<600&&f.campaign.demo.lease;i++){
      f.tick();await new Promise(resolve=>setImmediate(resolve));
      if(f.session.getState().machining?.lengthMm===240)sawCut=true;
    }
    assert.equal(f.campaign.demo.error,null);assert.equal(f.campaign.demo.status,'finished');assert.equal(sawCut,true);
    assert.deepEqual(f.session.exportWorkpieceState(),before);assert.equal(f.session.getState().machining.xDiameterMm,pose.xDiameterMm);
    assert.equal(f.map.get(CAMPAIGN_KEY),saved);assert.equal(f.session.canCommand(),true);
    await f.campaign.demoStart();f.campaign.demo.pause();await f.campaign.demo.stop();assert.deepEqual(f.session.exportWorkpieceState(),before);
  }finally{await f.close();}
});
test('demo can be watched before mounting and returns to the unmounted player attempt',async()=>{
  const f=await fixture();try{await f.campaign.demoStart();f.campaign.demo.pause();await f.campaign.demo.stop();
    assert.equal(f.session.getState().machining,null);assert.equal(f.campaign.level.getState().mounted,false);
  }finally{await f.close();}
});

test('taper and chamfer are actual cuts; stage 4 remains draft; a new campaign instance reloads stage input',async()=>{
  const f=await fixture();let resumed;
  try {
    await basic(f);await f.campaign.next();await setup(f);
    const range=taperRange(f.session.exportWorkpieceState(),HANDLE_LEVELS[1].taper);
    await f.move('X',24);await f.move('Z',range[0]);await f.move('X',16.3);
    await f.line(16.23,range[0]+1);assert.equal(f.campaign.level.getState().measurements.operationsComplete,false);
    await f.line(9.3,range[1]);await f.send({type:'spindle.stop'});f.tick();
    assert.equal(f.campaign.level.inspect().operationsComplete,true);await f.campaign.next();await setup(f);
    const input=f.campaign.data.revisions.at(-1).state,length=input.lengthMm;
    await f.move('X',24);await f.move('Z',length-1);await f.move('X',20);await f.line(18,length);
    await f.send({type:'spindle.stop'});f.tick();const result=f.campaign.level.inspect();
    assert.equal(result.operationsComplete,true);assert.equal(result.complete,false);assert.ok(result.chamfer.linearDeviationMm<=1.000001);
    const actual=f.session.exportWorkpieceState();assert.equal(actual.profile.radiusMm.at(-1),9);
    await f.campaign.next();assert.equal(f.campaign.data.currentLevel,3);assert.deepEqual(f.campaign.level.exportWorkingCopy(),actual);
    assert.equal(f.campaign.level.inspect().operationsComplete,false);await assert.rejects(()=>f.campaign.next());
    f.campaign.dispose();resumed=new HandleCampaignSession(f.session,f.store);
    assert.equal(resumed.data.currentLevel,3);await resumed.level.mount();assert.deepEqual(f.session.exportWorkpieceState(),actual);
    assert.equal(resumed.level.inspect().status,'draft');await resumed.retry();assert.deepEqual(resumed.level.exportWorkingCopy(),actual);
  }finally{resumed?.dispose();await f.close();}
});
