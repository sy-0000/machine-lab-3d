import {Box3,Group,Vector3,Quaternion,Mesh,CylinderGeometry,BoxGeometry,MeshStandardMaterial} from 'three';
import {prepareModel as prepareLathe,disposeModel,disposeHighlights} from '../lathe.js';
import {editSource,createAddition} from './modelEdits.js';
import {createSelectorScale,updateSelectorScales} from './selectorScale.js';
import {createCuttingTool} from './cuttingTools.js';
import {addInteractionTargets} from './interactionTargets.js';
const v=a=>new Vector3(...a);
export const clamp=(x,[lo,hi])=>Math.max(lo,Math.min(hi,Number.isFinite(x)?x:0));
const descendant=(node,parent)=>{for(let n=node;n;n=n.parent)if(n===parent)return true;return false;};
export function prepareMachine(scene,config) {
 for(const def of [...config.axes,...config.wheels,config.spindle,...(config.lever?[config.lever]:[])]){
  if(!Array.isArray(def.axis)||def.axis.length!==3||!def.axis.every(Number.isFinite)||v(def.axis).lengthSq()===0)throw Error(`無效旋轉／移動軸：${def.node}`);
  if(def.pivot&&(!Array.isArray(def.pivot)||def.pivot.length!==3||!def.pivot.every(Number.isFinite)))throw Error(`無效 Pivot：${def.node}`);
  if(def.range&&(!def.range.every(Number.isFinite)||def.range.length!==2||def.range[0]>0||def.range[1]<0))throw Error(`行程必須包含初始原點：${def.node}`);
  if(def.ratio!==null&&def.ratio!==undefined&&(!Number.isFinite(def.ratio)||def.ratio===0))throw Error(`進給比例無效：${def.node}`);
 }
 for(const w of config.wheels)if(!config.axes.some(a=>a.id===w.drives))throw Error(`手輪對應行程不存在：${w.node} → ${w.drives}`);
 // The lathe adapter only reconstructs its already audited mesh hierarchy. All motion uses this shared runtime.
 const retiredNodes=editSource(scene,config);
 const legacy=config.id==='lathe'?prepareLathe(scene,config.raw):null;
 const lookup={};scene.traverse(n=>{if(n.name){if(lookup[n.name])throw Error(`重複節點名稱：${n.name}`);lookup[n.name]=n;}});
 const errors=[],audit=[],controls={},pivots={},initial={},materials=new Map();
 const requireNode=name=>{const node=lookup[name];audit.push({name,found:!!node,parent:node?.parent?.name||null});if(!node)errors.push(`找不到 JSON 節點：${name}`);return node;};
 if(config.neutralMaterials){const old=new Set();scene.traverse(node=>{if(!node.isMesh)return;old.add(node.material);if(!node.geometry.attributes.normal)node.geometry.computeVertexNormals();node.material=new MeshStandardMaterial({color:node.name.startsWith('Table_')?'#87969b':'#63837d',roughness:.55,metalness:.35});});old.forEach(m=>m.dispose());}
 // Explicit, reviewed node lists only. Preserve world pose while rebuilding functional parents.
 for(const def of [...(config.groups||[]),...(config.extraGroups||[])]){
  const group=new Group();group.name=def.name;scene.add(group);group.position.copy(scene.worldToLocal(v(def.pivot||[0,0,0])));group.updateWorldMatrix(true,true);
  if(def.parent){const parent=requireNode(def.parent);if(!parent)throw Error(`缺少群組父節點：${def.parent}`);parent.attach(group);}
  lookup[def.name]=group;
  for(const name of def.objects){const object=requireNode(name);if(!object)continue;object.updateWorldMatrix(true,true);const before=object.matrixWorld.clone();group.attach(object);object.updateWorldMatrix(true,true);const error=Math.max(...before.elements.map((value,index)=>Math.abs(value-object.matrixWorld.elements[index])));audit.push({name,parent:def.name,attachmentError:error});if(error>1e-6)throw Error(`群組掛接改變世界座標：${name}`);}
 }
 for(const spec of config.reparents||[]){const node=requireNode(spec.node),parent=requireNode(spec.parent);if(node&&parent)parent.attach(node);}
 for(const def of config.additions||[]){
  if(def.kind==='cuttingTool'){createCuttingTool(def,scene,lookup);continue;}
  if(def.kind==='selectorScale'){createSelectorScale(def,scene,lookup);continue;}
  if(['handwheel','cloneLever'].includes(def.kind)){createAddition(def,scene,lookup);continue;}
  const group=new Group();group.name=def.name;scene.add(group);lookup[def.name]=group;
  if(def.kind==='pedal'){
   group.position.fromArray(def.position);const bar=new Mesh(new CylinderGeometry(def.radius,def.radius,def.length,32),new MeshStandardMaterial({color:def.color,roughness:.6,metalness:.45}));bar.rotation.z=Math.PI/2;group.add(bar);
   for(const x of [-def.length/2+.08,def.length/2-.08]){const arm=new Mesh(new BoxGeometry(.035,.025,.15),new MeshStandardMaterial({color:'#313c40',metalness:.6,roughness:.6}));arm.position.set(x,0,-.06);group.add(arm);}
  }else if(def.kind==='plate'){
   group.position.fromArray(def.position);group.add(new Mesh(new BoxGeometry(...def.size),new MeshStandardMaterial({color:def.color,metalness:.65,roughness:.38})));
   if(def.parent)lookup[def.parent].attach(group);
  }else if(def.kind==='supportColumn'){
   const length=def.topY-def.position[1];group.position.fromArray(def.position);group.position.y+=length/2;
   const column=new Mesh(new CylinderGeometry(def.radius,def.radius,length,48),new MeshStandardMaterial({color:def.color,metalness:.75,roughness:.35}));group.add(column);
   if(def.parent)lookup[def.parent].attach(group);
  }else if(def.kind==='sleeve'){
   const cylinder=new Mesh(new CylinderGeometry(def.radius,def.radius,1,32),new MeshStandardMaterial({color:def.color,metalness:.75,roughness:.3}));group.add(cylinder);group.userData.sleeve=def;
   const length=def.top[1]-def.bottomY;group.position.set(def.top[0],def.top[1]-length/2,def.top[2]);cylinder.scale.y=length;
  }
 }
 for(const name of new Set(config.references))requireNode(name);
 for(const name of [...(config.safety?[config.safety.tool,...config.safety.targets]:[]),...(config.demoWorkpiece?[config.demoWorkpiece.mount]:[])])requireNode(name);
 for(const {parent,child}of config.relationships||[]){if(lookup[child]&&lookup[parent]&&!descendant(lookup[child],lookup[parent]))errors.push(`階層不符：${child} 應隸屬 ${parent}`);}
 if(legacy?.missing.length)errors.push(...legacy.missing);
 const register=(def,type)=>{
  const node=requireNode(def.node);if(!node)return;
  if(type==='spindle'&&def.required?.some(name=>!lookup[name]))return;
  if(type==='spindle'&&def.exclude?.some(name=>lookup[name]&&descendant(lookup[name],node)))throw Error(`主軸包含禁止旋轉的外殼：${def.node}`);
  if(legacy&&type==='wheel'&&!def.generated&&!legacy.availability[def.id])return;
  if(legacy&&type==='spindle'&&!legacy.availability.spindle)return;
  let pivot=node;
  if(def.pivot && !legacy) {
   // JSON pivots are WORLD coordinates. A wrapper preserves every descendant world transform.
   pivot=new Group();pivot.name=`InteractionPivot_${def.node}`;
   scene.updateWorldMatrix(true,true);scene.add(pivot);pivot.position.copy(scene.worldToLocal(v(def.pivot)));pivot.updateWorldMatrix(true,true);
   const parent=node.parent,before=node.matrixWorld.clone();parent.attach(pivot);pivot.attach(node);node.updateWorldMatrix(true,true);
   const error=Math.max(...before.elements.map((value,index)=>Math.abs(value-node.matrixWorld.elements[index])));
   if(error>1e-6)throw Error(`Pivot 掛接改變世界座標：${def.node}`);
   audit.push({name:def.node,pivot:def.pivot,axis:def.axis,attachmentError:error});
  }
  pivots[def.node]=pivot;
  initial[def.node]={position:pivot.position.clone(),quaternion:pivot.quaternion.clone()};
  if(type!=='spindle'){
   pivot.userData.machineControl=def.id||type;
   controls[def.id||type]={...def,type,object:pivot};
  }
 };
 for(const a of config.axes){if(legacy&&!legacy.availability[a.id])a.enabled=false;const node=requireNode(a.node);if(node)initial[a.node]={position:node.position.clone(),quaternion:node.quaternion.clone()};}
  for(const w of config.wheels)register(w,'wheel');
 for(const action of config.actions||[])register(action,action.type);
 register(config.spindle,'spindle');if(config.lever)register(config.lever,'lever');if(config.toggle)register(config.toggle,'toggle');
 // restOffset relocates an axis's home (offset 0) along its travel; child pivots and tools move with it.
 for(const a of config.axes){const node=lookup[a.node];if(!node||!a.restOffset)continue;node.position.addScaledVector(v(a.axis).normalize(),a.restOffset);initial[a.node].position.copy(node.position);}
 addInteractionTargets(scene,controls,lookup);
 scene.traverse(n=>{if(n.isMesh){n.castShadow=!n.userData.hitbox;n.receiveShadow=!n.userData.hitbox;}});
 scene.updateWorldMatrix(true,true);
 const bounds=new Box3();scene.traverseVisible(n=>{if(n.isMesh)bounds.union(new Box3().setFromObject(n));});const center=bounds.getCenter(new Vector3()),radius=bounds.getSize(new Vector3()).length()/2;
 if(!Number.isFinite(radius)||radius<=0)throw Error('模型沒有有效幾何尺寸');
 const restTransforms=new Map();scene.traverse(node=>restTransforms.set(node,{position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
 const result={scene,config,retiredNodes,lookup,controls,pivots,initial,restTransforms,audit,errors:[...new Set(errors)],legacy,materials,center,radius,floor:bounds.min.y-center.y};
 resetMachine(result);return result;
}
// Modular workpieces are owned by MachineBase; legacy demo objects are runtime-owned.
export function removeDemoWorkpiece(m) {
 if(!m.workpiece || m.workpieceOwner === 'module')return false;
 const object=m.workpiece;object.removeFromParent();disposeModel(object);
 m.workpiece=null;m.workpieceOwner=null;return true;
}
export function resetMachine(m) {
 removeDemoWorkpiece(m);
 for(const [node,s] of m.restTransforms){node.position.copy(s.position);node.quaternion.copy(s.quaternion);node.scale.copy(s.scale);}
 m.offsets=Object.fromEntries(m.config.axes.map(a=>[a.id,0]));m.angles=Object.fromEntries(m.config.wheels.map(w=>[w.id,0]));m.detents={};m.indexSteps=0;m.emergency=false;m.brakeTime=0;m.signedRpm=0;m.direction=1;m.rpm=0;m.spindleAngle=0;m.leverAngle=0;m.running=false;m.moved=false;m.active=null;m.hover=null;
 for(const a of m.config.actions||[])if(a.type==='detent')setDetent(m,a.id,a.homeIndex);
 setHighlight(m,null);m.scene.updateWorldMatrix(true,true);
}
function rotate(m,node,axis,angle){const object=m.pivots[node];if(object)object.quaternion.copy(m.initial[node].quaternion).multiply(new Quaternion().setFromAxisAngle(v(axis).normalize(),angle));}
export function setAxis(m,key,value){
 const a=m.config.axes.find(a=>a.id===key),object=a&&m.lookup[a.node];if(!object||!a.enabled)return;
 const next=clamp(Number(value),a.range);if(next!==m.offsets[key]&&m.rpm>0)m.moved=true;
 m.offsets[key]=next;object.position.copy(m.initial[a.node].position).addScaledVector(v(a.axis).normalize(),next);
 for(const def of m.config.additions||[])if(def.kind==='sleeve'&&def.drives===key){const group=m.lookup[def.name],length=def.top[1]-def.bottomY-next;group.position.y=def.top[1]-length/2;group.children[0].scale.y=length;}
 for(const def of m.config.additions||[])if(def.kind==='supportColumn'&&def.drives===key){const group=m.lookup[def.name],rest=m.restTransforms.get(group),length=def.topY-def.position[1];group.position.y=rest.position.y+next/2;group.children[0].scale.y=(length+next)/length;}
 m.scene.updateWorldMatrix(true,true);
}
export function turnControl(m,key,direction,delta,teaching=false){
 const w=m.controls[key];if(!w||w.type!=='wheel'||(w.needsCalibration&&!teaching))return;
 const a=m.config.axes.find(a=>a.id===w.drives);if(!a?.enabled||!m.lookup[a.node])return;
 // Explicit opt-in demonstration ratios are not claimed as real lead-screw pitches.
 const ratio=w.ratio??(w.angleRange?Math.abs(a.range[0]/w.angleRange[0]):(a.range[1]-a.range[0])/(m.config.lesson.teachingTurnsForFullTravel*2*Math.PI));
 // holdSpeedScale: UI-selected feed rate; feedStop: depth stop (lowest axis value) for a spring-return lever.
 let next=m.angles[key]+direction*w.speed*delta*(m.holdSpeedScale??1);
 if(w.angleRange)next=clamp(next,w.angleRange);
 if(w.angleRange&&m.feedStop?.axis===a.id&&next*ratio<m.feedStop.value)next=m.feedStop.value/ratio;
 if(w.angleRange){setAxis(m,a.id,next*ratio);}else{
  const desired=m.offsets[a.id]+(next-m.angles[key])*ratio;
  const actual=clamp(desired,a.range);next=m.angles[key]+(actual-m.offsets[a.id])/ratio;setAxis(m,a.id,actual);
 }
 m.angles[key]=next;rotate(m,w.node,w.axis,next);
}
export function setAxisAndWheel(m,key,value,teaching=false){
 setAxis(m,key,value);
 for(const w of m.config.wheels.filter(w=>w.drives===key)){
  if(w.needsCalibration&&!teaching)continue;
  const a=m.config.axes.find(a=>a.id===key),ratio=w.ratio??(w.angleRange?Math.abs(a.range[0]/w.angleRange[0]):(a.range[1]-a.range[0])/(m.config.lesson.teachingTurnsForFullTravel*2*Math.PI));
  m.angles[w.id]=m.offsets[key]/ratio;rotate(m,w.node,w.axis,m.angles[w.id]);
 }
}
export function stepMachine(m,running,rpm,dt,direction=1){
 direction=direction===-1?-1:1;m.direction=direction;
 if(m.brakeTime>0){m.brakeTime=Math.max(0,m.brakeTime-dt);const action=m.config.actions.find(a=>a.type==='emergency');if(action)m.lookup[action.node].position.y=m.initial[action.node].position.y-.025*Math.min(1,m.brakeTime/.18);}
 const lever=m.config.lever;let delay=0;
 if(lever){const target=running?lever.runAngle*(lever.bidirectional?direction:1):0,rate=Math.abs(lever.runAngle)/lever.duration,remaining=Math.abs(target-m.leverAngle);if(running)delay=Math.min(dt,remaining/rate);m.leverAngle+=Math.sign(target-m.leverAngle)*Math.min(remaining,dt*rate);rotate(m,lever.node,lever.axis,m.leverAngle);}
 const target=running?clamp(selectorRpm(m)??rpm,[0,m.config.maxRpm])*direction:0,time=Math.max(0,dt-delay),old=m.signedRpm||0;
 const acceleration=m.config.lesson.accelerationRpmPerSecond;
 m.signedRpm=old+Math.sign(target-old)*Math.min(Math.abs(target-old),acceleration*time);m.rpm=Math.abs(m.signedRpm);
 const arrival=Math.min(time,Math.abs(target-old)/acceleration);
 m.spindleAngle+=old*delay*Math.PI/30;
 m.spindleAngle+=((old+m.signedRpm)*arrival/2+m.signedRpm*(time-arrival))*Math.PI/30;
 rotate(m,m.config.spindle.node,m.config.spindle.axis,m.spindleAngle);
 m.running=running;m.scene.updateWorldMatrix(true,true);
}
export function stepReturn(m,heldKey,dt){
 let returning=false;
 for(const w of m.config.wheels){if(!w.springReturn||w.id===heldKey||m.angles[w.id]===0)continue;const current=m.angles[w.id],next=current-Math.sign(current)*Math.min(Math.abs(current),w.springReturn.speed*dt);m.angles[w.id]=next;setAxis(m,w.drives,next*w.ratio);rotate(m,w.node,w.axis,next);returning=returning||next!==0;}
 return returning;
}
export function selectorRpm(m){const s=m.config.speedSelectors;return s?s.baseRpm[m.detents[s.gear]??1]*s.multipliers[m.detents[s.mode]??1]:null;}
export function setDetent(m,key,index){const a=m.config.actions.find(a=>a.id===key&&a.type==='detent');if(!a)return;const next=Math.max(0,Math.min(a.degrees.length-1,Number.isInteger(index)?index:(m.detents[key]??a.homeIndex)-1));m.detents[key]=next;rotate(m,a.node,a.axis,(a.degrees[next]-a.referenceDegrees)*Math.PI/180);m.selectedRpm=selectorRpm(m);updateSelectorScales(m);m.scene.updateWorldMatrix(true,true);}
export function stepDetent(m,key,direction){const a=m.config.actions.find(a=>a.id===key&&a.type==='detent');if(a)setDetent(m,key,(m.detents[key]??a.homeIndex)+(direction===1?1:-1));}
export function indexTool(m,direction=1){const action=m.config.actions?.find(a=>a.type==='index');if(!action)return;const stops=Math.round(2*Math.PI/Math.abs(action.step));m.indexSteps=(m.indexSteps+(direction===-1?-1:1))%stops;rotate(m,action.node,action.axis,m.indexSteps*action.step);m.scene.updateWorldMatrix(true,true);}
export function emergencyStop(m){m.emergency=false;m.running=false;m.brakeTime=.35;const action=m.config.actions?.find(a=>a.type==='emergency');if(action){const n=m.lookup[action.node];n.position.y=m.initial[action.node].position.y-.025;}m.active=null;}
export function releaseEmergency(m){m.emergency=false;const action=m.config.actions?.find(a=>a.type==='emergency');if(action)m.lookup[action.node].position.copy(m.initial[action.node].position);}
export function safetyStatus(m){
 const s=m.config.safety;
 if(!s)return {level:m.rpm>0&&m.moved?'caution':'',text:m.rpm>0&&m.moved?'請注意：主軸正在旋轉，機構已進入操作狀態。':'缺少已確認的刀具／工件／夾具距離設定，接近偵測未啟用。'};
 m.scene.updateWorldMatrix(true,true);
 const a=new Box3().setFromObject(m.lookup[s.tool]);let gap=Infinity;
 for(const object of [...s.targets.map(name=>m.lookup[name]),...(m.workpiece?[m.workpiece]:[])]){const b=new Box3().setFromObject(object);gap=Math.min(gap,Math.hypot(...['x','y','z'].map(k=>Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k]))));}
 return m.rpm>0&&gap<s.danger?{level:'danger',text:'危險：刀具已接近旋轉中的夾頭。',gap}:m.rpm>0&&(gap<s.caution||m.moved)?{level:'caution',text:'請注意：主軸正在旋轉，刀具已進入操作狀態。',gap}:{level:'',text:'● 目前無警告',gap};
}
export function setHighlight(m,key){
 if(m.highlighted===key)return;m.highlighted=key;
 for(const [mesh,{original,copy}]of m.materials)mesh.material=original;
 const root=m.controls[key]?.object;if(!root)return;
 for(const target of m.controls[key].pickRoots||[root])target.traverseVisible(mesh=>{if(!mesh.isMesh||mesh.userData.hitbox)return;if(!m.materials.has(mesh)){const original=mesh.material,copy=(Array.isArray(original)?original:[original]).map(mat=>{const c=mat.clone();c.emissive?.set('#30a888');c.emissiveIntensity=.5;return c;});m.materials.set(mesh,{original,copy});}const {original,copy}=m.materials.get(mesh);mesh.material=Array.isArray(original)?copy:copy[0];});
}
export function isVisibleObject(object){for(let n=object;n;n=n.parent)if(!n.visible)return false;return !!object;}
export function visibleHit(ray,scene){const meshes=[];scene.traverseVisible(n=>{if(n.isMesh)meshes.push(n);});return ray.intersectObjects(meshes,false)[0];}
export function controlFor(object){if(!isVisibleObject(object))return null;for(let n=object;n;n=n.parent)if(n.userData.machineControl)return n.userData.machineControl;return null;}
export function toggleDemoWorkpiece(m,requestedRunning){
 const d=m.config.demoWorkpiece;if(m.workpieceOwner==='module'||!d||requestedRunning||m.rpm>0||m.leverAngle!==0||!m.lookup[d.mount])return false;
 if(m.workpiece)removeDemoWorkpiece(m);
 else {const mesh=new Mesh(new CylinderGeometry(d.radius,d.radius,d.length,32),new MeshStandardMaterial({color:'#adbdc5',metalness:.8,roughness:.3}));mesh.name=d.name;mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),v(d.axis).normalize());mesh.position.fromArray(d.position);mesh.castShadow=true;m.lookup[d.mount].add(mesh);m.workpiece=mesh;m.workpieceOwner='demo';}
 return true;
}
export function disposeMachine(m){for(const [mesh,{original,copy}]of m.materials){mesh.material=original;copy.forEach(mat=>mat.dispose());}if(m.legacy)disposeHighlights(m.legacy);for(const node of m.retiredNodes||[])m.scene.add(node);disposeModel(m.scene);}
