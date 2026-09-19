import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Box3,Vector3,Raycaster,Quaternion} from 'three';
import {loadSource} from '../../scripts/model-source.mjs';
import {MACHINES} from './catalog.js';
import {normalizeConfig} from './config.js';
import {prepareMachine,disposeMachine,resetMachine,setAxis,setDetent,stepDetent,selectorRpm,stepMachine,emergencyStop,indexTool,turnControl,stepReturn,controlFor,visibleHit,setHighlight} from './runtime.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const bounds=n=>new Box3().setFromObject(n);
async function load(id){const c=MACHINES.find(m=>m.id===id);return prepareMachine((await loadSource(new URL('../../public/models/'+c.model,import.meta.url))).scene,normalizeConfig(id,JSON.parse(fs.readFileSync(new URL('../../public/models/'+c.config,import.meta.url)))));}

test('both cam switches stop at endpoints, move independently by 45°, and drive all 16 RPM combinations',async()=>{
 const m=await load('lathe');try{
  for(const key of ['gearSelector','speedMode']){
   resetMachine(m);const other=m.controls[key==='gearSelector'?'speedMode':'gearSelector'].object,rest=other.quaternion.clone();
   const before=m.controls[key].object.quaternion.clone();stepDetent(m,key,-1);assert.equal(m.detents[key],0);near(before.angleTo(m.controls[key].object.quaternion),Math.PI/4);
   const end=m.controls[key].object.quaternion.clone();stepDetent(m,key,-1);near(end.angleTo(m.controls[key].object.quaternion),0);
   for(let i=0;i<5;i++)stepDetent(m,key,1);assert.equal(m.detents[key],3);near(end.angleTo(m.controls[key].object.quaternion),3*Math.PI/4);near(rest.angleTo(other.quaternion),0);
  }
  for(let g=0;g<4;g++)for(let mode=0;mode<4;mode++){setDetent(m,'gearSelector',g);setDetent(m,'speedMode',mode);const target=[125,250,375,500][g]*[1,2,3,4][mode];near(selectorRpm(m),target);stepMachine(m,true,500,4);near(m.rpm,target);}
  resetMachine(m);near(selectorRpm(m),500);
 }finally{disposeMachine(m);}
});

test('foot brake coasts to rest without latching, is frame independent and permits restart',async()=>{
 const m=await load('lathe');try{
  const runs=[];for(const fps of [30,144]){resetMachine(m);stepMachine(m,true,500,2);emergencyStop(m);near(m.rpm,500);assert.equal(m.emergency,false);const start=m.spindleAngle;for(let i=0;i<fps;i++)stepMachine(m,false,500,1/fps);near(m.rpm,0);near(m.brakeTime,0);runs.push(m.spindleAngle-start);stepMachine(m,true,500,2);near(m.rpm,500);}near(runs[0],runs[1]);
 }finally{disposeMachine(m);}
});

test('fixed tool base stays unselected and stationary; narrower support spans full lift and follows slides',async()=>{
 const m=await load('lathe');try{
  const base=m.lookup.ToolPostFixedBase,rest=base.matrixWorld.clone(),before=bounds(m.lookup.Object_103);assert.equal(controlFor(base),null);
  setHighlight(m,'toolIndex');assert.equal(m.materials.has(base),false);
  for(const height of [.02,.06]){setAxis(m,'z',height);indexTool(m);assert.deepEqual(base.matrixWorld.elements,rest.elements);const support=bounds(m.lookup.ToolPostColumn),bottom=bounds(base),top=bounds(m.lookup.Object_103);assert.ok(support.min.y<bottom.max.y);assert.ok(support.max.y>before.min.y+height);assert.ok(support.max.y>top.min.y);assert.ok(support.max.x-support.min.x<bottom.max.x-bottom.min.x);}
  const prior=bounds(m.lookup.ToolPostColumn).getCenter(new Vector3());setAxis(m,'x',.1);setAxis(m,'y',.04);const next=bounds(m.lookup.ToolPostColumn).getCenter(new Vector3());near(next.x-prior.x,.1);near(next.z-prior.z,.04);
  for(const name of ['DetailItem_Air_Blower','Object_162']){assert.ok(m.lookup[name]);assert.equal(m.lookup[name].visible,false);}
  const ray=new Raycaster(new Vector3(.989,1,1),new Vector3(0,0,-1));assert.notEqual(visibleHit(ray,m.scene)?.object.name,'Object_162');
 }finally{disposeMachine(m);}
});

test('drill switch body alone picks; feed shaft follows reversed handle and spring return',async()=>{
 const m=await load('drill');try{
  assert.equal(controlFor(m.lookup.SwitchBody),'toggle');assert.equal(controlFor(m.lookup.SwitchLever),null);assert.equal(controlFor(m.lookup.FeedShaft),'feed');
  const original=m.lookup.FeedShaft.getWorldQuaternion(new Quaternion());
  turnControl(m,'feed',-1,.4);assert.ok(m.offsets.quill<0);assert.ok(m.pivots.FeedHandlePivot.rotation.x>0);near(m.lookup.FeedShaft.getWorldQuaternion(original.clone()).angleTo(original),.4);
  stepReturn(m,null,1);near(m.offsets.quill,0);near(m.lookup.FeedShaft.getWorldQuaternion(original.clone()).angleTo(original),0);
  setHighlight(m,'toggle');assert.equal(m.materials.has(m.lookup.SwitchLever),false);assert.equal(m.materials.has(m.lookup.SwitchBody),true);
 }finally{disposeMachine(m);}
});

test('milling old lever is retained hidden and right black lever controls spindle',async()=>{
 const m=await load('milling');try{assert.equal(m.lookup.Head_Part_023.visible,false);assert.equal(controlFor(m.lookup.Head_Part_023),null);assert.equal(controlFor(m.lookup.Head_Part_021),'lever');stepMachine(m,true,500,2);near(m.rpm,500);assert.ok(m.leverAngle>0);stepMachine(m,false,500,2);near(m.rpm,0);near(m.leverAngle,0);}finally{disposeMachine(m);}
});
