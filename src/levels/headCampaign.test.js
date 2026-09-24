import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadSource} from '../../scripts/model-source.mjs';
import {MachineLoader} from '../machines/core/MachineLoader.js';
import {MachineRegistry} from '../machines/core/MachineRegistry.js';
import {MachineSession} from '../machining/MachineSession.js';
import {createHeadStock,HEAD_LEVELS,measureHeadStage,headDimension} from './headCampaign.js';
import {cloneHeadState,headBounds} from '../machining/HeadWorkpieceState.js';
import {cutHead} from '../machining/HeadCuttingSimulation.js';
import {headGeometry} from '../machining/adapters/PrismaticWorkpiece.js';
import {HeadCampaignStore,HEAD_CAMPAIGN_KEY} from './HeadCampaignStore.js';
import {HeadCampaignSession} from './HeadCampaignSession.js';
import {CampaignStore} from './CampaignStore.js';
import {DemoSequence} from './DemoSequence.js';
import {headDemoCommands} from './headDemoCommands.js';
MachineLoader.setCustomLoader(async(id,config)=>({rawJson:JSON.parse(readFileSync(new URL('../../public/models/'+config.config,import.meta.url))),scene:(await loadSource(new URL('../../public/models/'+config.model,import.meta.url))).scene}));
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
async function fixture(id){const m=await MachineRegistry.load(id),s=new MachineSession(m),clock=s.claimClock();let frameId=0;
  return {s,m,tick:(dt=1)=>s.update(dt,{clock,frameId:frameId++}),close:async()=>{s.dispose();await MachineRegistry.unload();}};}
async function send(s,c){const r=await s.command(c);assert.equal(r.ok,true,r.reason);}
const running={running:true,rpm:500};
const mill={id:'mill',type:'milling',diameterMm:8,cuttingLengthMm:35};
test('head stock, clone, deterministic swept milling, overcut and geometry reload',()=>{
  const s=createHeadStock();assert.deepEqual([s.stock.widthMm,s.stock.heightMm,s.stock.lengthMm],[20,20,90]);
  const from={xMm:10,yMm:10,zMm:18},to={xMm:20,yMm:10,zMm:17};
  assert.equal(cutHead(s,from,to,mill,{...running,running:false}),s);
  const cut=cutHead(s,from,to,mill,running);assert.ok(cut.surface.topMm.some(h=>h<18));assert.equal(cut.surface.topMm[0],20);assert.ok(s.surface.topMm.every(h=>h===20));
  assert.equal(cutHead(cut,{...from,zMm:19},{...to,zMm:19},mill,running),cut);
  assert.deepEqual(cloneHeadState(cut),cut);
  const a=headGeometry(cut,x=>x/1000),b=headGeometry(cloneHeadState(cut),x=>x/1000);assert.deepEqual(a.attributes.position.array,b.attributes.position.array);a.dispose();b.dispose();
});
test('holes require actual axial feed; M10 requires valid pilot; depth is bounded by source hole',()=>{
  const s=createHeadStock(),a={xMm:40,yMm:10,zMm:21},b={...a,zMm:15};
  const drill={id:'drill85',type:'drilling',diameterMm:8.5,cuttingLengthMm:49},tap={id:'tap',type:'tapping',diameterMm:10,pilotDiameterMm:8.5,designation:'M10',cuttingLengthMm:49};
  assert.equal(cutHead(s,a,b,tap,running),s);assert.equal(cutHead(s,a,{...b,xMm:41},drill,running),s);
  const drilled=cutHead(s,a,b,drill,running);assert.equal(drilled.features[0].diameterMm,8.5);assert.equal(drilled.features[0].depthMm,5);assert.equal(drilled.features[0].through,false);
  const tapped=cutHead(drilled,a,{...b,zMm:0},tap,running);assert.equal(tapped.features[0].thread.tappedDepthMm,5);assert.equal(tapped.features[0].thread.sourceHole,'hole-1');
  const result=measureHeadStage(HEAD_LEVELS[3],tapped,drilled);assert.equal(result.status,'draft');assert.equal(result.rows[0].status,'pass');
  assert.equal(headDimension('length',86,{status:'confirmed',value:86}).status,'draft');
  assert.equal(headDimension('length',85,{status:'confirmed',value:86},{status:'confirmed',value:0.1}).status,'overcut');
});
test('continuous swept milling is frame independent and actual face/side passes produce 18.5×18.5×86',()=>{
  const stock=createHeadStock(),from={xMm:5,yMm:10,zMm:19},to={xMm:35,yMm:10,zMm:17},middle={xMm:20,yMm:10,zMm:18};
  const once=cutHead(stock,from,to,mill,running),split=cutHead(cutHead(stock,from,middle,mill,running),middle,to,mill,running);
  once.surface.topMm.forEach((h,i)=>assert.ok(Math.abs(h-split.surface.topMm[i])<1e-9));
  let s=stock;
  for(const y of [4,10,16])s=cutHead(s,{xMm:0,yMm:y,zMm:18.5},{xMm:90,yMm:y,zMm:18.5},mill,running);
  s=cutHead(s,{xMm:-4,yMm:22.5,zMm:0},{xMm:94,yMm:22.5,zMm:0},mill,running);
  s=cutHead(s,{xMm:90,yMm:-4,zMm:0},{xMm:90,yMm:24,zMm:0},mill,running);
  assert.deepEqual(headBounds(s),{minX:0,lengthMm:86,widthMm:18.5,heightMm:18.5});
});
test('later face milling shortens saved hole/thread depth; edge-broken pilots cannot be tapped',()=>{
  const drill={id:'drill85',type:'drilling',diameterMm:8.5,cuttingLengthMm:49},tap={id:'tap',type:'tapping',diameterMm:10,pilotDiameterMm:8.5,designation:'M10',cuttingLengthMm:49};
  const a={xMm:40,yMm:10,zMm:21},b={...a,zMm:15},stock=createHeadStock();
  assert.equal(cutHead(stock,{...a,xMm:1},{...b,xMm:1},drill,running),stock);
  const drilled=cutHead(stock,a,b,drill,running),tapped=cutHead(drilled,a,{...b,zMm:16},tap,running);
  assert.equal(cutHead(tapped,{xMm:40,yMm:10,zMm:19},{xMm:40,yMm:10,zMm:18},{...mill,diameterMm:2},running),tapped);
  const milled=cutHead(tapped,{xMm:30,yMm:10,zMm:18},{xMm:50,yMm:10,zMm:18},{...mill,diameterMm:12},running);
  assert.equal(milled.features[0].entryZMm,18);assert.equal(milled.features[0].depthMm,3);assert.equal(milled.features[0].thread.tappedDepthMm,2);
});
test('real milling Session tip, XYZ sweep, immutable checkpoint and stage retry',async()=>{
  const f=await fixture('milling'),store=new HeadCampaignStore(storage()),c=new HeadCampaignSession(f.s,store);
  try{
    await c.start();let p=f.s.getState().headMachining.tipMm;assert.ok(Math.abs(p.zMm-25)<1e-6,JSON.stringify(p));
    await send(f.s,{type:'head.move',xMm:10,yMm:10,zMm:21});
    await send(f.s,{type:'spindle.start'});f.tick(2);
    await send(f.s,{type:'head.move',xMm:10,yMm:10,zMm:18});
    await send(f.s,{type:'head.move',xMm:20,yMm:10,zMm:17});
    assert.ok(f.s.exportWorkpieceState().surface.topMm.some(h=>h<18));
    await send(f.s,{type:'spindle.stop'});f.tick(2);c.inspect();c.next();c.dispose();
    const next=new HeadCampaignSession(f.s,store);await next.start();const input=next.data.revisions[1].state;
    assert.deepEqual(next.data.working,input);await next.retry();assert.deepEqual(next.data.working,input);assert.notDeepEqual(input,createHeadStock());
    const reload=new HeadCampaignStore(store.storage).load();assert.equal(reload.currentLevel,1);assert.deepEqual(reload.working,input);next.dispose();
  }finally{c.dispose();await f.close();}
});
test('milling to drill preserves actual geometry; real quill feed creates hole then tapped state',async()=>{
  let state=cutHead(createHeadStock(),{xMm:5,yMm:5,zMm:18},{xMm:15,yMm:5,zMm:18},mill,running);
  const f=await fixture('drill');try{
    await send(f.s,{type:'tool.select',toolId:'head_drill_85'});await send(f.s,{type:'workpiece.mountState',state});assert.deepEqual(f.s.exportWorkpieceState(),state);
    await send(f.s,{type:'head.setup',xMm:40,yMm:10});await send(f.s,{type:'spindle.start'});f.tick(2);
    const before=f.s.getState();await send(f.s,{type:'head.move',zMm:15});assert.ok(f.s.exportWorkpieceState().features.length,JSON.stringify({before,after:f.s.getState()}));assert.equal(f.s.exportWorkpieceState().features[0].depthMm,5);
    await send(f.s,{type:'head.move',zMm:25});await send(f.s,{type:'spindle.stop'});f.tick(2);
    await send(f.s,{type:'tool.select',toolId:'head_tap_m10'});await send(f.s,{type:'spindle.start'});f.tick(2);
    await send(f.s,{type:'head.move',zMm:17});assert.equal(f.s.exportWorkpieceState().features[0].thread.designation,'M10');
  }finally{await f.close();}
});
test('head demo shares Session/cutting, locks player, restores clone and isolates handle save',async()=>{
  const mem=storage(),store=new HeadCampaignStore(mem),handle=new CampaignStore(mem);handle.save(handle.fresh());const original=mem.getItem('machine-lab.campaign.handle.v1');
  const f=await fixture('milling'),c=new HeadCampaignSession(f.s,store);try{
    await c.start();const initial=cloneHeadState(c.data.working),saved=mem.getItem(HEAD_CAMPAIGN_KEY);await c.demoStart();
    assert.equal(f.s.command({type:'head.move',zMm:0}).ok,false);
    for(let i=0;i<60&&c.demo.lease;i++){f.tick(0.2);await new Promise(r=>setImmediate(r));}
    assert.equal(c.demo.error,null);assert.equal(c.demo.status,'finished');assert.deepEqual(c.data.working,initial);assert.deepEqual(f.s.exportWorkpieceState(),initial);
    assert.equal(mem.getItem(HEAD_CAMPAIGN_KEY),saved);assert.equal(mem.getItem('machine-lab.campaign.handle.v1'),original);
  }finally{c.dispose();await f.close();}
});
test('profile/drill/tap demos use actual checkpoint surface and restore both geometry and machine axes',async()=>{
  let input=createHeadStock();
  for(const y of [4,10,16])input=cutHead(input,{xMm:0,yMm:y,zMm:18.5},{xMm:90,yMm:y,zMm:18.5},mill,running);
  for(const index of [1,2,3]){
    const def=HEAD_LEVELS[index],f=await fixture(def.machine);
    const demo=new DemoSequence(f.s,{createCommands:headDemoCommands,prepareCommands:d=>[{type:'tool.select',toolId:d.tool}]});
    try{
      await send(f.s,{type:'tool.select',toolId:def.tool});await send(f.s,{type:'workpiece.mountState',state:input});
      await send(f.s,{type:'head.move',zMm:17});const pose=f.s.getState();
      await demo.start(def,input);let output=input;
      for(let k=0;k<70&&demo.lease;k++){f.tick(0.2);await new Promise(r=>setImmediate(r));if(demo.lease)output=f.s.exportWorkpieceState();}
      assert.equal(demo.error,null);assert.equal(demo.status,'finished');assert.ok(output.operationHistory.length>input.operationHistory.length,'demo must actually remove material / tap');
      assert.deepEqual(f.s.exportWorkpieceState(),input);
      for(const [key,value] of Object.entries(pose.machineAxesMm))assert.ok(Math.abs(f.s.getState().machineAxesMm[key]-value)<1e-6);
      assert.deepEqual(f.s.getState().headMachining.tipMm,pose.headMachining.tipMm);
      if(index===2){assert.equal(output.features[0].entryZMm,18.5);assert.equal(output.features[0].depthMm,2);input=output;}
      if(index===3)assert.equal(output.features[0].thread.tappedDepthMm,2);
    }finally{demo.dispose();await f.close();}
  }
});
