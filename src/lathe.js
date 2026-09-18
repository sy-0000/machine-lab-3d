import { Box3, Color, Vector3, Group, Mesh, BufferGeometry, CylinderGeometry, MeshStandardMaterial } from 'three';
import { AXES, LATHE_PARTS, WHEELS, MECHANISMS, SPLITS, MODEL_NAME } from './latheParts.js';
export { AXES, LATHE_PARTS, WHEELS, MODEL_NAME };
const defaultParts=LATHE_PARTS, defaultMechanisms=MECHANISMS, defaultAxes=AXES;
export const clamp = (v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
export const directionFromButton = button => button===0 ? -1 : button===2 ? 1 : 0;
export const homeState = ()=>({offsets:Object.fromEntries(Object.keys(AXES).map(k=>[k,0])),angles:Object.fromEntries(Object.keys(WHEELS).map(k=>[k,0]))});
export function findInteractiveAncestor(object) { for(let n=object;n;n=n.parent) if(n.userData?.interactivePart)return n;return null; }
export function measuredBounds(scene) {
  const seen=new Set();scene.traverse(mesh=>{const g=mesh.geometry;if(!g||seen.has(g))return;seen.add(g);const b=new Box3(),p=new Vector3(),a=g.attributes.position,idx=g.index;for(let i=0;i<(idx?.count??a.count);i++)b.expandByPoint(p.fromBufferAttribute(a,idx?idx.getX(i):i));g.boundingBox=b;});
}
export function inventory(scene) {
  scene.updateMatrixWorld(true);const entries=[];
  scene.traverse(n=>{const b=new Box3().setFromObject(n);entries.push({name:n.name,parent:n.parent?.name||null,children:n.children.map(c=>c.name),mesh:n.isMesh?n.name:null,materials:n.isMesh?(Array.isArray(n.material)?n.material:[n.material]).map(m=>m.name):[],min:b.min.toArray(),max:b.max.toArray(),center:b.getCenter(new Vector3()).toArray(),size:b.getSize(new Vector3()).toArray()});});return entries;
}
function splitSources(scene, sources, retired) {
  for(const [name,def]of Object.entries(SPLITS)){
    const source=sources[name];if(!source?.isMesh)continue;
    const g=source.geometry,p=g.attributes.position,idx=g.index,parts=Object.fromEntries(def.parts.map(key=>[key,[]]));
    for(let i=0;i<(idx?.count??p.count);i+=3){const center=new Vector3();const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);for(const id of ids)center.add(new Vector3().fromBufferAttribute(p,id).applyMatrix4(source.matrixWorld));center.divideScalar(3);parts[def.select(center)].push(...ids);}
    // Split the original index list only. No new geometry, displacement or synthetic handle is introduced.
    for(const [part,indices]of Object.entries(parts)){
      if(!indices.length)continue;
      const geometry=new BufferGeometry();for(const [key,attr]of Object.entries(g.attributes))geometry.setAttribute(key,attr);geometry.setIndex(indices);
      const mesh=new Mesh(geometry,source.material);mesh.name=`${name}::${part}`;mesh.userData={...source.userData,sourceName:name,splitPart:part};mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);source.parent.add(mesh);sources[mesh.name]=mesh;
    }
    source.removeFromParent();retired.push(source);
  }
}
export function prepareModel(scene, definitions = null) {
  const {parts: LATHE_PARTS, mechanisms: MECHANISMS, axes: AXES} = definitions || {parts:defaultParts, mechanisms:defaultMechanisms, axes:defaultAxes};
  const WHEELS = Object.fromEntries(Object.entries(LATHE_PARTS).filter(([,p])=>p.wheelObjects));
  measuredBounds(scene);scene.updateMatrixWorld(true);
  const sourceInventory=inventory(scene),sources={};scene.traverse(n=>{sources[n.name]=n;});
  const retired=[],missing=[],nodes={},availability={},ownership={},attachmentChecks=[];
  splitSources(scene,sources,retired);measuredBounds(scene);scene.updateMatrixWorld(true);
  const make=(name,parent=scene,pivot=[0,0,0])=>{const group=new Group();group.name=name;scene.add(group);group.position.copy(scene.worldToLocal(new Vector3(...pivot)));group.updateMatrixWorld(true);if(parent!==scene)parent.attach(group);nodes[name]=group;return group;};
  const attach=(names,parent,owner)=>{
    let complete=true;
    for(const name of names){const object=sources[name];if(!object){missing.push(`${owner}：${name}`);complete=false;continue;}
      const before=object.matrixWorld.clone();parent.attach(object);object.updateMatrixWorld(true);
      const error=Math.max(...before.elements.map((v,i)=>Math.abs(v-object.matrixWorld.elements[i])));attachmentChecks.push({name,error});
      if(error>1e-6)throw new Error(`重新建立 ${name} 父群組時世界座標改變，停止載入以保護模型。`);
      object.traverse(n=>{if(n.isMesh)ownership[n.name]=owner;});
    }return complete;
  };
  for(const [name,def]of Object.entries(MECHANISMS)){const group=make(name,def.parent?nodes[def.parent]:scene);availability[name]=attach(def.objects,group,name);}
  const spindle=make('SpindlePivot',scene,LATHE_PARTS.spindle.pivot),chuck=make('ChuckAssembly',spindle,LATHE_PARTS.spindle.pivot);
  availability.spindle=attach(LATHE_PARTS.spindle.objectNames,spindle,'spindle');
  availability.spindle=attach(LATHE_PARTS.chuck.objectNames,chuck,'chuck')&&availability.spindle;
  make('WorkpieceMount',chuck,[-0.20274,0.8525885,-0.0216612]);
  for(const [key,def]of Object.entries(WHEELS)){
    const pivot=make(def.pivotName,nodes[def.parent],def.pivot);
    const wheel=make(def.baseName,pivot,def.pivot),handle=make(`${def.baseName}Handle`,pivot,def.pivot);
    const wheelOk=attach(def.wheelObjects,wheel,key),handleOk=attach(def.handleObjects,handle,key);
    availability[key]=wheelOk&&handleOk&&availability[AXES[def.key].name];
    pivot.userData={interactivePart:availability[key],controlKey:key};
  }
  const lever=make('StartLeverPivot',nodes[LATHE_PARTS.startLever.parent]||scene,LATHE_PARTS.startLever.pivot);
  availability.startLever=attach(LATHE_PARTS.startLever.rodObjects,make('StartLeverRod',lever,LATHE_PARTS.startLever.pivot),'startLever');
  availability.startLever=attach(LATHE_PARTS.startLever.handleObjects,make('StartLeverHandle',lever,LATHE_PARTS.startLever.pivot),'startLever')&&availability.startLever;
  availability.spindle=availability.spindle&&availability.startLever;lever.userData={interactivePart:availability.startLever&&availability.spindle,controlKey:'startLever'};
  for(const [key,def]of Object.entries(AXES)) availability[key]=availability[def.name] && (key==='tail'||availability[Object.keys(WHEELS).find(k=>WHEELS[k].key===key)]);
  scene.updateMatrixWorld(true);
  const bounds=new Box3().setFromObject(scene);if(bounds.isEmpty())throw new Error('模型沒有可顯示的幾何物件。');
  const center=bounds.getCenter(new Vector3()),radius=bounds.getSize(new Vector3()).length()/2;
  const initial=Object.fromEntries(Object.entries(nodes).map(([n,obj])=>[n,obj.position.clone()])),rotations=Object.fromEntries(Object.entries(nodes).map(([n,obj])=>[n,obj.rotation.clone()]));
  scene.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
  return {scene,sources,nodes,initial,rotations,limits:Object.fromEntries(Object.entries(AXES).map(([k,d])=>[k,[...d.range]])),availability,missing,ownership,sourceInventory,attachmentChecks,retired,highlights:new Map(),center,radius,floor:bounds.min.y-center.y,drive:{leverAngle:0,actualRpm:0,phase:'已停止'},workpiece:null};
}
export function applyMachine(model,state) {
  for(const [key,def]of Object.entries(AXES))model.nodes[def.name].position[def.axis]=model.initial[def.name][def.axis]+clamp(state.offsets[key],...model.limits[key]);
  for(const [key,def]of Object.entries(WHEELS))model.nodes[def.pivotName].rotation[def.axis]=model.rotations[def.pivotName][def.axis]+state.angles[key];
  model.scene.updateMatrixWorld(true);
}
export function moveAxis(model,state,key,value) {
  if(!model.availability[key])return state;
  const next=clamp(value,...model.limits[key]),angles={...state.angles};
  for(const [name,def]of Object.entries(WHEELS))if(def.key===key)angles[name]=next/def.ratio;
  return {offsets:{...state.offsets,[key]:next},angles};
}
export function turnWheel(model,state,key,angularDelta) {
  if(!model.availability[key])return state;
  // Integrate angle only; derive displacement from angle and the saved home, never += mesh.position.
  const def=WHEELS[key];return moveAxis(model,state,def.key,(state.angles[key]+angularDelta)*def.ratio);
}
const toward=(current,target,step)=>current<target?Math.min(target,current+step):Math.max(target,current-step);
export function stepDrive(model,running,rpm,delta) {
  const d=model.drive,def=LATHE_PARTS.startLever,requested=running&&model.availability.spindle;
  const target=requested?def.runAngle:def.stopAngle;
  const previousAngle=d.leverAngle,rate=Math.abs(def.runAngle-def.stopAngle)/def.duration;
  d.leverAngle=toward(d.leverAngle,target,delta*rate);
  model.nodes.StartLeverPivot.rotation[def.axis]=model.rotations.StartLeverPivot[def.axis]+d.leverAngle;
  // No spindle rotation during the lever's travel to RUN. Integrate only the remaining time after arrival.
  const delay=requested?Math.min(delta,Math.abs(target-previousAngle)/rate):0;
  const time=delta-delay,desired=requested&&d.leverAngle===target?rpm:0,old=d.actualRpm;
  const acceleration=900,arrival=Math.min(time,Math.abs(desired-old)/acceleration);
  d.actualRpm=toward(old,desired,time*acceleration);
  const revolutions=((old+d.actualRpm)*arrival/2+d.actualRpm*(time-arrival))/60;
  model.nodes.SpindlePivot.rotation.x+=revolutions*Math.PI*2;
  d.phase=requested&&d.leverAngle!==target?'拉桿啟動中':!requested&&(d.actualRpm>0||d.leverAngle!==target)?'停止中':d.actualRpm>0?'運轉中':requested?'待轉（0 RPM）':'已停止';
  return d;
}
export function resetModel(model) {
  applyMachine(model,homeState());model.drive={leverAngle:0,actualRpm:0,phase:'已停止'};
  model.nodes.StartLeverPivot.rotation.copy(model.rotations.StartLeverPivot);highlight(model,null);
}
export function setWorkpiece(model,enabled,running=false) {
  if(running||model.drive.actualRpm>0||model.drive.leverAngle!==0)return false;
  if(enabled&&!model.workpiece){const mesh=new Mesh(new CylinderGeometry(0.026,0.026,0.18,32),new MeshStandardMaterial({color:'#aebfc7',metalness:0.8,roughness:0.28}));mesh.name='DemoWorkpiece';mesh.rotation.z=-Math.PI/2;mesh.position.x=0.09;mesh.castShadow=true;model.nodes.WorkpieceMount.add(mesh);model.workpiece=mesh;}
  else if(!enabled&&model.workpiece){const mesh=model.workpiece;mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();model.workpiece=null;}
  return true;
}
export function highlight(model,key,selectedName=null) {
  model.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const active=(key&&model.ownership[mesh.name]===key)||mesh.name===selectedName;
    let item=model.highlights.get(mesh);
    if(active&&!item){const original=mesh.material;mesh.material=Array.isArray(original)?original.map(m=>m.clone()):original.clone();const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];item={mesh,original,materials,states:materials.map(m=>({emissive:m.emissive?.clone(),intensity:m.emissiveIntensity,color:m.color?.clone()}))};model.highlights.set(mesh,item);}
    if(!item)return;
    item.materials.forEach((mat,i)=>{const saved=item.states[i];if(mat.emissive){mat.emissive.copy(saved.emissive);mat.emissiveIntensity=saved.intensity;if(active){mat.emissive.set('#67cbaa');mat.emissiveIntensity=0.5;}}else if(mat.color){mat.color.copy(saved.color);if(active)mat.color.lerp(new Color('#80ffcc'),0.25);}});
  });
}
export function describeMesh(model,object) {
  if(!object)return null;
  const box=new Box3().setFromObject(object),parents=[];for(let n=object;n;n=n.parent)parents.unshift(n.name||'(scene)');
  const subtree=n=>({name:n.name,children:n.children.map(subtree)});
  return {name:object.name,sourceName:object.userData.sourceName||object.name,parents,subtree:subtree(object.parent||object),center:box.getCenter(new Vector3()).toArray(),size:box.getSize(new Vector3()).toArray(),assigned:model.ownership[object.name]||'固定／未分配',materials:(Array.isArray(object.material)?object.material:[object.material]).filter(Boolean).map(m=>m.name)};
}
export function proximity(model) {
  const tool=new Box3().setFromObject(model.nodes.ToolHeightAssembly),target=new Box3().setFromObject(model.workpiece||model.nodes.ChuckAssembly);
  if(tool.isEmpty()||target.isEmpty())return null;
  const gap=new Vector3(...['x','y','z'].map(a=>Math.max(0,tool.min[a]-target.max[a],target.min[a]-tool.max[a]))).length();
  return gap<0.02?'danger':gap<0.07?'caution':null;
}
export function disposeHighlights(model) {for(const item of model.highlights.values()){item.mesh.material=item.original;item.materials.forEach(m=>m.dispose());}model.highlights.clear();for(const mesh of model.retired)mesh.geometry.dispose();}
export function disposeModel(scene) {
  const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);for(const m of(Array.isArray(n.material)?n.material:[n.material])){if(!m)continue;materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
}
