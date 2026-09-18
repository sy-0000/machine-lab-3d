import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {Vector3,Box3} from 'three';
import {loadSource,readGLB} from '../../scripts/model-source.mjs';import {MACHINES} from './catalog.js';import {normalizeConfig} from './config.js';import {prepareMachine,disposeMachine,setAxis,turnControl,stepMachine,setDetent,resetMachine} from './runtime.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),point=n=>new Box3().setFromObject(n).getCenter(new Vector3());
async function load(id){const c=MACHINES.find(m=>m.id===id);return prepareMachine((await loadSource(new URL('../../public/models/'+c.model,import.meta.url))).scene,normalizeConfig(id,JSON.parse(fs.readFileSync(new URL('../../public/models/'+c.config,import.meta.url)))));}
test('v3 lathe removals, four detents, rear wheel, exact limits, lever and spindle reverse',async()=>{
 const m=await load('lathe');try{
  for(const name of m.config.removeNodes)assert.equal(m.scene.getObjectByName(name),undefined);
  setAxis(m,'x',-100);near(m.offsets.x,-.14);setAxis(m,'tail',-100);near(m.offsets.tail,-.278);setAxis(m,'quill',-100);near(m.offsets.quill,-.11);resetMachine(m);
  const original=point(m.lookup.Object_135);stepMachine(m,true,500,2,1);assert.ok(point(m.lookup.Object_135).z>original.z);assert.ok(m.signedRpm>0);
  stepMachine(m,true,500,3,-1);assert.ok(point(m.lookup.Object_135).z<original.z);assert.ok(m.signedRpm<0);const angle=m.spindleAngle;stepMachine(m,true,500,.2,-1);assert.ok(m.spindleAngle<angle);resetMachine(m);
  const initial=m.lookup.LeftSelectorPivot.quaternion.clone();for(let i=0;i<4;i++){setDetent(m,'gearSelector',i);near(initial.angleTo(m.lookup.LeftSelectorPivot.quaternion),Math.abs([60,90,120,150][i]-90)*Math.PI/180);const ball=point(m.lookup.LeftSelectorPivot.getObjectByName('LeftSelectorPivot_Object_30')),pivot=m.lookup.LeftSelectorPivot.getWorldPosition(new Vector3());near(Math.atan2(ball.y-pivot.y,ball.x-pivot.x)*180/Math.PI,[60,90,120,150][i]);}resetMachine(m);assert.equal(m.detents.gearSelector,1);
  turnControl(m,'tailTravel',-1,1);assert.ok(m.offsets.tail<0);near(m.angles.tailstockHandwheel,0);assert.equal(m.lookup.TailTravelWheel.parent.name,'TailstockAssembly');
 }finally{disposeMachine(m);}
});
test('v3 drill clamp and table detail follow table; head and cable remain fixed',async()=>{
 const m=await load('drill');try{const names=['TableClampHandle','TableSurfaceDetail','WorkTableCasting'],before=names.map(n=>point(m.lookup[n])),head=point(m.lookup.HeadInternalSupport),cable=point(m.lookup.PowerCableAndWiring);setAxis(m,'table',.12);names.forEach((n,i)=>near(point(m.lookup[n]).y-before[i].y,.12));near(point(m.lookup.HeadInternalSupport).distanceTo(head),0);near(point(m.lookup.PowerCableAndWiring).distanceTo(cable),0);const clamp=m.lookup.TableClampHandle;assert.equal(clamp.geometry.attributes.position.count/3,390);resetMachine(m);near(point(clamp).distanceTo(before[0]),0);}finally{disposeMachine(m);}
});
test('v3 milling retains original UV/PBR and supports added Z wheel and start lever',async()=>{
 const c=MACHINES.find(m=>m.id==='milling'),{json}=readGLB(new URL('../../public/models/'+c.model,import.meta.url));assert.ok(json.images.length>0);assert.ok(json.materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture));assert.ok(json.meshes.every(m=>m.primitives.every(p=>p.attributes.TEXCOORD_0!==undefined&&p.attributes.NORMAL!==undefined)));
 const m=await load('milling');try{assert.deepEqual(m.errors,[]);const before=point(m.lookup.X_Axis_Table),head=m.lookup.Head_Part_001.quaternion.clone();turnControl(m,'zLift',1,1);near(point(m.lookup.X_Axis_Table).y-before.y,.009*2.4);stepMachine(m,true,500,1);assert.ok(m.leverAngle>0);near(m.lookup.Head_Part_001.quaternion.angleTo(head),0);resetMachine(m);near(m.leverAngle,0);}finally{disposeMachine(m);}
});
