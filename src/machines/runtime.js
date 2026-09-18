import {Box3,Group,Vector3,Quaternion,Mesh,CylinderGeometry,MeshStandardMaterial} from 'three';
import {prepareModel as prepareLathe,disposeModel,disposeHighlights} from '../lathe.js';
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
 const legacy=config.id==='lathe'?prepareLathe(scene,config.raw):null;
 const lookup={};scene.traverse(n=>{if(n.name){if(lookup[n.name])throw Error(`重複節點名稱：${n.name}`);lookup[n.name]=n;}});
 const errors=[],audit=[],controls={},pivots={},initial={},materials=new Map();
 const requireNode=name=>{const node=lookup[name];audit.push({name,found:!!node,parent:node?.parent?.name||null});if(!node)errors.push(`找不到 JSON 節點：${name}`);return node;};
 for(const name of new Set(config.references))requireNode(name);
 for(const name of [...(config.safety?[config.safety.tool,...config.safety.targets]:[]),...(config.demoWorkpiece?[config.demoWorkpiece.mount]:[])])requireNode(name);
 for(const {parent,child}of config.relationships||[]){if(lookup[child]&&lookup[parent]&&!descendant(lookup[child],lookup[parent]))errors.push(`階層不符：${child} 應隸屬 ${parent}`);}
 if(legacy?.missing.length)errors.push(...legacy.missing);
 const register=(def,type)=>{
  const node=requireNode(def.node);if(!node)return;
  if(type==='spindle'&&def.required?.some(name=>!lookup[name]))return;
  if(type==='spindle'&&def.exclude?.some(name=>lookup[name]&&descendant(lookup[name],node)))throw Error(`主軸包含禁止旋轉的外殼：${def.node}`);
  if(legacy&&type==='wheel'&&!legacy.availability[def.id])return;
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
 register(config.spindle,'spindle');if(config.lever)register(config.lever,'lever');if(config.toggle)register(config.toggle,'toggle');
 scene.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
 scene.updateWorldMatrix(true,true);
 const bounds=new Box3().setFromObject(scene),center=bounds.getCenter(new Vector3()),radius=bounds.getSize(new Vector3()).length()/2;
 if(!Number.isFinite(radius)||radius<=0)throw Error('模型沒有有效幾何尺寸');
 const restTransforms=new Map();scene.traverse(node=>restTransforms.set(node,{position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone()}));
 const result={scene,config,lookup,controls,pivots,initial,restTransforms,audit,errors:[...new Set(errors)],legacy,materials,center,radius,floor:bounds.min.y-center.y};
 resetMachine(result);return result;
}
export function resetMachine(m) {
 if(m.workpiece){m.workpiece.removeFromParent();m.workpiece.geometry.dispose();m.workpiece.material.dispose();m.workpiece=null;}
 for(const [node,s] of m.restTransforms){node.position.copy(s.position);node.quaternion.copy(s.quaternion);node.scale.copy(s.scale);}
 m.offsets=Object.fromEntries(m.config.axes.map(a=>[a.id,0]));m.angles=Object.fromEntries(m.config.wheels.map(w=>[w.id,0]));m.rpm=0;m.spindleAngle=0;m.leverAngle=0;m.running=false;m.moved=false;m.active=null;m.hover=null;
 setHighlight(m,null);m.scene.updateWorldMatrix(true,true);
}
function rotate(m,node,axis,angle){const object=m.pivots[node];if(object)object.quaternion.copy(m.initial[node].quaternion).multiply(new Quaternion().setFromAxisAngle(v(axis).normalize(),angle));}
export function setAxis(m,key,value){
 const a=m.config.axes.find(a=>a.id===key),object=a&&m.lookup[a.node];if(!object||!a.enabled)return;
 const next=clamp(Number(value),a.range);if(next!==m.offsets[key]&&m.rpm>0)m.moved=true;
 m.offsets[key]=next;object.position.copy(m.initial[a.node].position).addScaledVector(v(a.axis).normalize(),next);
 m.scene.updateWorldMatrix(true,true);
}
export function turnControl(m,key,direction,delta,teaching=false){
 const w=m.controls[key];if(!w||w.type!=='wheel'||(w.needsCalibration&&!teaching))return;
 const a=m.config.axes.find(a=>a.id===w.drives);if(!a?.enabled||!m.lookup[a.node])return;
 // Explicit opt-in demonstration ratios are not claimed as real lead-screw pitches.
 const ratio=w.ratio??(w.angleRange?Math.abs(a.range[0]/w.angleRange[0]):(a.range[1]-a.range[0])/(m.config.lesson.teachingTurnsForFullTravel*2*Math.PI));
 let next=m.angles[key]+direction*w.speed*delta;
 if(w.angleRange)next=clamp(next,w.angleRange);
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
export function stepMachine(m,running,rpm,dt){
 const lever=m.config.lever;let delay=0;
 if(lever){const target=running?lever.runAngle:0,rate=Math.abs(lever.runAngle)/lever.duration,remaining=Math.abs(target-m.leverAngle);if(running)delay=Math.min(dt,remaining/rate);m.leverAngle+=Math.sign(target-m.leverAngle)*Math.min(remaining,dt*rate);rotate(m,lever.node,lever.axis,m.leverAngle);}
 const target=running?clamp(rpm,[0,m.config.maxRpm]):0,time=Math.max(0,dt-delay),old=m.rpm;
 const acceleration=m.config.lesson.accelerationRpmPerSecond;
 m.rpm=old+Math.sign(target-old)*Math.min(Math.abs(target-old),acceleration*time);
 const arrival=Math.min(time,Math.abs(target-old)/acceleration);
 m.spindleAngle+=((old+m.rpm)*arrival/2+m.rpm*(time-arrival))*Math.PI/30;
 rotate(m,m.config.spindle.node,m.config.spindle.axis,m.spindleAngle);
 m.running=running;m.scene.updateWorldMatrix(true,true);
}
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
 root.traverse(mesh=>{if(!mesh.isMesh)return;if(!m.materials.has(mesh)){const original=mesh.material,copy=(Array.isArray(original)?original:[original]).map(mat=>{const c=mat.clone();c.emissive?.set('#30a888');c.emissiveIntensity=.5;return c;});m.materials.set(mesh,{original,copy});}const {original,copy}=m.materials.get(mesh);mesh.material=Array.isArray(original)?copy:copy[0];});
}
export function controlFor(object){for(let n=object;n;n=n.parent)if(n.userData.machineControl)return n.userData.machineControl;return null;}
export function toggleDemoWorkpiece(m,requestedRunning){
 const d=m.config.demoWorkpiece;if(!d||requestedRunning||m.rpm>0||m.leverAngle!==0||!m.lookup[d.mount])return false;
 if(m.workpiece){m.workpiece.removeFromParent();m.workpiece.geometry.dispose();m.workpiece.material.dispose();m.workpiece=null;}
 else {const mesh=new Mesh(new CylinderGeometry(d.radius,d.radius,d.length,32),new MeshStandardMaterial({color:'#adbdc5',metalness:.8,roughness:.3}));mesh.name=d.name;mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),v(d.axis).normalize());mesh.position.fromArray(d.position);mesh.castShadow=true;m.lookup[d.mount].add(mesh);m.workpiece=mesh;}
 return true;
}
export function disposeMachine(m){for(const [mesh,{original,copy}]of m.materials){mesh.material=original;copy.forEach(mat=>mat.dispose());}if(m.legacy)disposeHighlights(m.legacy);disposeModel(m.scene);}
