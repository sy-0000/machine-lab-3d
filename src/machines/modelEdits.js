import {Group,Mesh,TorusGeometry,CylinderGeometry,BoxGeometry,MeshStandardMaterial,Vector3} from 'three';
const vector=a=>new Vector3(...a);
// Explicit source names and reviewed triangle lists; no spatial grouping at runtime.
export function editSource(scene,config){
 const retired=[];
 scene.updateMatrixWorld(true);
 for(const spec of config.nodeOffsets||[]){const node=scene.getObjectByName(spec.node);if(!node)throw Error(`找不到面板零件：${spec.node}`);node.position.copy(node.parent.worldToLocal(node.getWorldPosition(new Vector3()).add(vector(spec.offset))));node.updateWorldMatrix(true,true);}
 for(const name of [...(config.removeNodes||[]),...(config.hideNodes||[])]){const node=scene.getObjectByName(name);if(!node)throw Error(`找不到要隱藏的零件：${name}`);node.visible=false;}
 for(const spec of config.geometrySplits||[]){
  const source=scene.getObjectByName(spec.source);if(!source?.isMesh)throw Error(`找不到拆分來源：${spec.source}`);
  const original=source.geometry,index=original.index,all=index?Array.from(index.array):Array.from({length:original.attributes.position.count},(_,i)=>i),selected=new Set(spec.triangles),keep=[],take=[];
  for(let i=0;i<all.length;i+=3)(selected.has(i/3)?take:keep).push(all[i],all[i+1],all[i+2]);
  if(take.length!==spec.triangles.length*3)throw Error(`拆分三角形不符：${spec.name}`);
  const part=source.clone();part.name=spec.name;part.geometry=original.clone();part.geometry.setIndex(take);const selectedGeometry=part.geometry;part.geometry=selectedGeometry.toNonIndexed();selectedGeometry.dispose();part.geometry.computeBoundingBox();part.geometry.computeBoundingSphere();source.parent.add(part);
  source.geometry=original.clone();source.geometry.setIndex(keep);const remainderGeometry=source.geometry;source.geometry=remainderGeometry.toNonIndexed();remainderGeometry.dispose();source.geometry.computeBoundingBox();source.geometry.computeBoundingSphere();original.dispose();
 }
 scene.updateMatrixWorld(true);return retired;
}
export function createAddition(def,scene,lookup){
 const group=new Group();group.name=def.name;scene.add(group);group.position.copy(scene.worldToLocal(vector(def.position||[0,0,0])));group.updateWorldMatrix(true,true);
 const steel=new MeshStandardMaterial({color:def.color||'#8d979c',metalness:.75,roughness:.32});
 if(def.kind==='handwheel'){
  const body=new Group(),radius=def.radius||.06;body.quaternion.setFromUnitVectors(new Vector3(0,0,1),vector(def.axis).normalize());group.add(body);
  const rim=new Mesh(new TorusGeometry(radius,radius*.11,12,48),steel);body.add(rim);
  for(const angle of [0,Math.PI/3,2*Math.PI/3]){const spoke=new Mesh(new BoxGeometry(radius*1.8,radius*.09,radius*.1),steel);spoke.rotation.z=angle;body.add(spoke);}
  const hub=new Mesh(new CylinderGeometry(radius*.22,radius*.22,.07,20),steel);hub.rotation.x=Math.PI/2;body.add(hub);
  if(def.mountLength){const shaft=new Mesh(new CylinderGeometry(radius*.13,radius*.13,def.mountLength,20),steel);shaft.rotation.x=Math.PI/2;shaft.position.z=-(def.gripSide||1)*def.mountLength/2;body.add(shaft);}
  const grip=new Mesh(new CylinderGeometry(radius*.12,radius*.14,.05,16),new MeshStandardMaterial({color:'#252b2f',roughness:.65}));grip.rotation.x=Math.PI/2;grip.position.set(radius*.78,0,(def.gripSide||1)*.035);body.add(grip);
 }else if(def.kind==='cloneLever'){
  steel.dispose();for(const name of def.sources){const source=lookup[name];if(!source?.isMesh)throw Error(`缺少拉桿樣本：${name}`);const copy=source.clone();copy.name=def.name+'_'+name;scene.add(copy);copy.matrix.copy(source.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);copy.position.add(vector(def.position).sub(vector(def.sourcePivot)));copy.updateWorldMatrix(true,true);group.attach(copy);}
 }
 if(def.kind==='cloneLever'){group.traverse(n=>{n.visible=true;});group.rotation.z=(def.initialDegrees-def.sourceDegrees)*Math.PI/180;if(def.scale)group.scale.setScalar(def.scale);}
 if(def.parent){const parent=lookup[def.parent];if(!parent)throw Error(`新增零件的父群組不存在：${def.parent}`);parent.attach(group);}
 lookup[def.name]=group;return group;
}
