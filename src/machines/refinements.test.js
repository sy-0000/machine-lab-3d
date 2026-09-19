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

test('HIGH/LOW and four RPM stops clamp independently and drive all eight speeds',async()=>{
 const m=await load('lathe');try{
  for(const key of ['gearSelector','speedMode']){
   resetMachine(m);setDetent(m,key,1);const other=m.controls[key==='gearSelector'?'speedMode':'gearSelector'].object,rest=other.quaternion.clone();
   const before=m.controls[key].object.quaternion.clone();stepDetent(m,key,-1);assert.equal(m.detents[key],0);near(before.angleTo(m.controls[key].object.quaternion),Math.PI/4);
   const end=m.controls[key].object.quaternion.clone();stepDetent(m,key,-1);near(end.angleTo(m.controls[key].object.quaternion),0);
   const max=key==='gearSelector'?3:1;for(let i=0;i<5;i++)stepDetent(m,key,1);assert.equal(m.detents[key],max);near(end.angleTo(m.controls[key].object.quaternion),max*Math.PI/4);near(rest.angleTo(other.quaternion),0);
  }
  for(let g=0;g<4;g++)for(let mode=0;mode<2;mode++){setDetent(m,'gearSelector',g);setDetent(m,'speedMode',mode);const target=[250,500,750,1000][g]*[1,2][mode];near(selectorRpm(m),target);stepMachine(m,true,500,4);near(m.rpm,target);}
  resetMachine(m);near(selectorRpm(m),500);assert.equal(m.detents.speedMode,0);
 }finally{disposeMachine(m);}
});

test('foot brake coasts to rest without latching, is frame independent and permits restart',async()=>{
 const m=await load('lathe');try{
  const runs=[];for(const fps of [30,144]){resetMachine(m);stepMachine(m,true,500,2);emergencyStop(m);near(m.rpm,500);assert.equal(m.emergency,false);const start=m.spindleAngle;for(let i=0;i<fps;i++)stepMachine(m,false,500,1/fps);near(m.rpm,0);near(m.brakeTime,0);runs.push(m.spindleAngle-start);stepMachine(m,true,500,2);near(m.rpm,500);}near(runs[0],runs[1]);
 }finally{disposeMachine(m);}
});

test('whole tool post and lower block rotate by ±10°, lift with tool, and remain supported',async()=>{
 const m=await load('lathe');try{
  const base=m.lookup.Object_101,fixed=base.matrixWorld.clone(),lower=m.lookup.ToolPostLowerBlock,tool=m.lookup.TurningTool,shim=m.lookup.TurningTool_Shim_Bottom;
  const initialLower=bounds(lower),initialTool=tool.matrixWorld.clone();assert.equal(controlFor(lower),'toolIndex');assert.equal(controlFor(tool),'toolIndex');
  assert.ok(bounds(shim).min.y<=bounds(lower).max.y+.0001);assert.equal(controlFor(shim),'toolIndex');
  const q=lower.getWorldQuaternion(new Quaternion());indexTool(m,-1);assert.equal(m.indexSteps,-1);near(lower.getWorldQuaternion(new Quaternion()).angleTo(q),Math.PI/18);indexTool(m,1);near(lower.getWorldQuaternion(new Quaternion()).angleTo(q),0);
  const relative=m.lookup.ToolIndexPivot.worldToLocal(tool.getWorldPosition(new Vector3()));
  for(const height of [.02,.06]){setAxis(m,'z',height);indexTool(m,1);assert.deepEqual(base.matrixWorld.elements,fixed.elements);const support=bounds(m.lookup.ToolPostColumn);assert.ok(support.min.y<bounds(base).max.y);assert.ok(support.max.y>initialLower.min.y+height);near(m.lookup.ToolIndexPivot.worldToLocal(tool.getWorldPosition(new Vector3())).distanceTo(relative),0);}
  const prior=bounds(m.lookup.ToolPostColumn).getCenter(new Vector3());setAxis(m,'x',.1);setAxis(m,'y',.04);const next=bounds(m.lookup.ToolPostColumn).getCenter(new Vector3());near(next.x-prior.x,.1);near(next.z-prior.z,.04);
  resetMachine(m);tool.matrixWorld.elements.forEach((v,i)=>near(v,initialTool.elements[i]));near(bounds(lower).min.y,initialLower.min.y);
  for(const name of ['DetailItem_Air_Blower','Object_162','Object_40','Object_42'])assert.equal(m.lookup[name].visible,false);
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
 const m=await load('milling');try{assert.equal(m.lookup.Head_Part_023.visible,false);assert.equal(controlFor(m.lookup.Head_Part_023),null);assert.equal(controlFor(m.lookup.Head_Part_009),'lever');stepMachine(m,true,500,2);near(m.rpm,500);assert.ok(m.leverAngle>0);stepMachine(m,false,500,2);near(m.rpm,0);near(m.leverAngle,0);}finally{disposeMachine(m);}
});

test('selector handle, rod and base share a control; padded picking never changes visible size',async()=>{
 const m=await load('lathe');try{
  for(const [key,baseName,prefix] of [['gearSelector','Object_32','LeftSelectorPivot'],['speedMode','Object_26','RightSelectorPivot']]){
   const base=m.lookup[baseName];assert.equal(controlFor(base),key);
   for(const name of ['Object_28','Object_30'])assert.equal(controlFor(m.lookup[prefix].getObjectByName(prefix+'_'+name)),key);
   base.geometry.computeBoundingBox();const b=base.geometry.boundingBox.clone().applyMatrix4(base.matrixWorld),ray=new Raycaster(new Vector3(b.max.x+.004,(b.min.y+b.max.y)/2,b.max.z+.2),new Vector3(0,0,-1));
   const hit=visibleHit(ray,m.scene);assert.equal(hit.object.userData.hitbox,true);assert.equal(controlFor(hit.object),key);
   setHighlight(m,key);assert.ok(m.materials.has(base));assert.equal(m.materials.has(hit.object),false);assert.equal(hit.object.material.opacity,0);assert.equal(hit.object.castShadow,false);
  }
 }finally{disposeMachine(m);}
});

test('milling Z moves only the table slides; Y controls and gearbox stay outside its hierarchy',async()=>{
 const m=await load('milling');try{
  const fixed=m.lookup.MillingYControlsFixed,rest=new Map();fixed.traverse(n=>rest.set(n,n.matrixWorld.clone()));
  const table=m.lookup.X_Axis_Table,start=table.getWorldPosition(new Vector3());
  for(const z of [-.15,.18]){setAxis(m,'Knee_Z_Slide',z);near(table.getWorldPosition(new Vector3()).y-start.y,z);for(const [n,matrix] of rest)n.matrixWorld.elements.forEach((v,i)=>near(v,matrix.elements[i]));}
  const afterZ=table.getWorldPosition(new Vector3());turnControl(m,'Y_Handwheel_Group',1,.5);assert.ok(table.getWorldPosition(new Vector3()).x>afterZ.x);near(table.getWorldPosition(new Vector3()).y,afterZ.y);
  assert.equal(m.lookup.Y_Handwheel_Group.parent.parent.name,'MillingYControlsFixed');
  resetMachine(m);near(table.getWorldPosition(new Vector3()).distanceTo(start),0);
 }finally{disposeMachine(m);}
});

for(const [id,name] of [['milling','FaceMill'],['milling','EndMill'],['drill','TwistDrill']])test(`${id} ${name}: cutting tool is coaxial, follows spindle/feed and resets with housing fixed`,async()=>{
 const m=await load(id);try{
  const tool=m.lookup[name],spindle=m.pivots[m.config.spindle.node],initial=tool.matrixWorld.clone(),housing=m.lookup[id==='milling'?'Head_Assembly':'HeadHousing'],fixed=housing.matrixWorld.clone();
  const mount=tool.getWorldPosition(new Vector3()),pivot=spindle.getWorldPosition(new Vector3());near(mount.x,pivot.x);near(mount.z,pivot.z);
  const local=spindle.worldToLocal(mount.clone()),q=tool.getWorldQuaternion(new Quaternion());stepMachine(m,true,500,.73);assert.ok(tool.getWorldQuaternion(new Quaternion()).angleTo(q)>.01);near(spindle.worldToLocal(tool.getWorldPosition(new Vector3())).distanceTo(local),0);
  housing.matrixWorld.elements.forEach((v,i)=>near(v,fixed.elements[i]));
  if(id==='drill'){const top=tool.getWorldPosition(new Vector3());turnControl(m,'feed',-1,1);assert.ok(tool.getWorldPosition(new Vector3()).y<top.y);stepReturn(m,null,2);near(tool.getWorldPosition(new Vector3()).y,top.y);}
  resetMachine(m);tool.matrixWorld.elements.forEach((v,i)=>near(v,initial.elements[i]));
 }finally{disposeMachine(m);}
});
