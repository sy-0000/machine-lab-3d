import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Quaternion} from 'three';
import {loadSource} from '../../scripts/model-source.mjs';
import {MACHINES} from './catalog.js';
import {normalizeConfig} from './config.js';
import {prepareMachine,disposeMachine,resetMachine,setAxis,turnControl,stepMachine,safetyStatus,setHighlight,toggleDemoWorkpiece,stepReturn,indexTool,emergencyStop,releaseEmergency} from './runtime.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const world=n=>n.getWorldPosition(new Vector3());
const orientation=n=>n.getWorldQuaternion(new Quaternion());
for(const machine of MACHINES)test(`${machine.id}: real GLB + supplied JSON, pivots, feed, ownership, spindle, reset`,async()=>{
 const raw=JSON.parse(readFileSync(new URL('../../public/models/'+machine.config,import.meta.url)));
 const {scene}=await loadSource(new URL('../../public/models/'+machine.model,import.meta.url));
 const m=prepareMachine(scene,normalizeConfig(machine.id,raw));
 try{
  assert.deepEqual(m.errors,[]);
  assert.equal(new Set(Object.values(m.pivots)).size,Object.keys(m.pivots).length);
  for(const audit of m.audit.filter(a=>a.attachmentError!==undefined))assert.ok(audit.attachmentError<1e-6);
  for(const wheel of m.config.wheels){
   resetMachine(m);const obj=m.pivots[wheel.node],other=m.config.wheels.filter(w=>w.id!==wheel.id).map(w=>[m.pivots[w.node],orientation(m.pivots[w.node])]);
   const mesh=[];obj.traverse(n=>{if(n.isMesh)mesh.push(n);});assert.ok(mesh.length>0);
   const relative=mesh.map(n=>obj.worldToLocal(world(n)));
   const direction=m.config.axes.find(a=>a.id===wheel.drives).range[0]<0?-1:1;turnControl(m,wheel.id,direction,.2,true);assert.ok(Math.abs(m.angles[wheel.id])>0);assert.ok(Math.abs(m.offsets[wheel.drives])>0);
   for(let i=0;i<mesh.length;i++)assert.ok(obj.worldToLocal(world(mesh[i])).distanceTo(relative[i])<1e-6);
   for(const [node,q]of other)assert.ok(orientation(node).angleTo(q)<1e-6,'other wheel rotated');
   turnControl(m,wheel.id,-direction,.2,true);near(m.angles[wheel.id],0);
   if(wheel.needsCalibration){resetMachine(m);turnControl(m,wheel.id,-1,1,false);near(m.angles[wheel.id],0);}
  }
  for(const a of m.config.axes){resetMachine(m);const node=m.lookup[a.node],before=node.position.clone();setAxis(m,a.id,-1e6);near(m.offsets[a.id],a.enabled?a.range[0]:0);if(a.enabled)assert.ok(node.position.distanceTo(before.addScaledVector(new Vector3(...a.axis).normalize(),a.range[0]))<1e-6);setAxis(m,a.id,1e6);near(m.offsets[a.id],a.enabled?a.range[1]:0);}
  resetMachine(m);if(machine.id==='lathe')assert.equal(toggleDemoWorkpiece(m,false),true);const housing=m.lookup[machine.id==='lathe'?'Object_22':machine.id==='milling'?'Head_Assembly':'HeadHousing'],fixed=orientation(housing),spindle=m.pivots[m.config.spindle.node];
  const children=[];spindle.traverse(n=>{if(n.isMesh)children.push([n,spindle.worldToLocal(world(n))]);});
  for(let i=0;i<120;i++)stepMachine(m,true,600,1/60);assert.ok(m.spindleAngle>0);assert.ok(orientation(housing).angleTo(fixed)<1e-6);if(machine.id==='lathe')assert.equal(toggleDemoWorkpiece(m,true),false);
  for(const [node,p]of children)assert.ok(spindle.worldToLocal(world(node)).distanceTo(p)<1e-6);
  for(let i=0;i<120;i++)stepMachine(m,false,600,1/60);near(m.rpm,0);const angle=m.spindleAngle;stepMachine(m,false,600,1);near(m.spindleAngle,angle);
  const first=m.config.wheels[0];setHighlight(m,first.id);setHighlight(m,null);resetMachine(m);near(m.spindleAngle,0);for(const value of Object.values(m.offsets))near(value,0);for(const [name,s]of Object.entries(m.initial)){const n=m.pivots[name]||m.lookup[name];assert.ok(n.position.distanceTo(s.position)<1e-6);assert.ok(n.quaternion.angleTo(s.quaternion)<1e-6);}
  if(machine.id==='lathe'){setAxis(m,'x',-.24);stepMachine(m,true,500,2);assert.equal(safetyStatus(m).level,'danger');const gap=safetyStatus(m).gap;m.scene.position.add(new Vector3(5,2,1));near(safetyStatus(m).gap,gap);}
  if(machine.id==='milling'){resetMachine(m);const work=m.lookup.Table_Part_038,before=world(work);setAxis(m,'X_Axis_Table',.2);near(world(work).z-before.z,.2);}
  if(machine.id==='lathe'){resetMachine(m);const lower=world(m.lookup.Object_103),base=world(m.lookup.Object_101);setAxis(m,'z',.04);near(world(m.lookup.Object_103).y-lower.y,.04);near(world(m.lookup.Object_101).distanceTo(base),0);const q=m.lookup.ToolIndexPivot.quaternion.clone();indexTool(m);near(q.angleTo(m.lookup.ToolIndexPivot.quaternion),Math.PI/4);for(let i=0;i<7;i++)indexTool(m);near(q.angleTo(m.lookup.ToolIndexPivot.quaternion),0);stepMachine(m,true,500,2);const angle=m.spindleAngle;emergencyStop(m);stepMachine(m,true,500,1);near(m.rpm,0);near(m.spindleAngle,angle);releaseEmergency(m);assert.equal(m.emergency,false);}
  if(machine.id==='drill'){resetMachine(m);const bit=m.lookup.DrillBit,before=world(bit);setAxis(m,'quill',-.04);near(world(bit).y-before.y,-.04);const table=m.lookup.TableAssembly,q=orientation(table);stepMachine(m,true,500,1);assert.ok(orientation(table).angleTo(q)<1e-6);turnControl(m,'feed',-1,.4);assert.ok(m.offsets.quill<0);for(let i=0;i<120;i++)stepReturn(m,null,1/60);near(m.offsets.quill,0);near(m.angles.feed,0);setAxis(m,'table',.1);assert.ok(m.offsets.table>0);}
 }finally{disposeMachine(m);}
});
test('invalid JSON axes fail explicitly',async()=>{const raw=JSON.parse(readFileSync(new URL('../../public/models/drill_press_parts.json',import.meta.url)));raw.interactions.FeedHandlePivot.axis=[0,0,0];const {scene}=await loadSource(new URL('../../public/models/drill_press_interactive.glb',import.meta.url));assert.throws(()=>prepareMachine(scene,normalizeConfig('drill',raw)),/無效旋轉／移動軸/);});
test('shared runtime animation is frame independent at 30 and 144 FPS',async()=>{
 const raw=JSON.parse(readFileSync(new URL('../../public/models/drill_press_parts.json',import.meta.url)));const {scene}=await loadSource(new URL('../../public/models/drill_press_interactive.glb',import.meta.url));const m=prepareMachine(scene,normalizeConfig('drill',raw));
 for(let i=0;i<60;i++){stepMachine(m,true,500,1/30);turnControl(m,'feed',-1,1/30,true);}const angle=m.spindleAngle,feed=m.offsets.quill;resetMachine(m);
 for(let i=0;i<288;i++){stepMachine(m,true,500,1/144);turnControl(m,'feed',-1,1/144,true);}near(m.spindleAngle,angle);near(m.offsets.quill,feed);disposeMachine(m);
});
test('missing referenced spindle child is reported rather than inferred',async()=>{
 const raw=JSON.parse(readFileSync(new URL('../../public/models/drill_press_parts.json',import.meta.url)));const {scene}=await loadSource(new URL('../../public/models/drill_press_interactive.glb',import.meta.url));scene.getObjectByName('DrillBit').name='UnidentifiedBit';const m=prepareMachine(scene,normalizeConfig('drill',raw));assert.ok(m.errors.includes('找不到 JSON 節點：DrillBit'));disposeMachine(m);
});
