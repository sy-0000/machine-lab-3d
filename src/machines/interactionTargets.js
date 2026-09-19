import {Box3,BoxGeometry,Mesh,MeshBasicMaterial,Vector3} from 'three';

export function addInteractionTargets(scene,controls,lookup){
 scene.updateMatrixWorld(true);
 for(const [key,control] of Object.entries(controls)){
  control.pickRoots=[control.object];
  for(const name of control.targets||[]){const node=lookup[name];if(!node)throw Error(`互動目標不存在：${name}`);node.userData.machineControl=key;control.pickRoots.push(node);}
  if(!control.hitPadding)continue;
  // Separate padded proxies follow each mesh, including the fixed rotary base.
  const meshes=[];for(const root of control.pickRoots)root.traverseVisible(n=>{if(n.isMesh)meshes.push(n);});
  for(const [i,source] of meshes.entries()){
   const box=new Box3().setFromObject(source).expandByScalar(control.hitPadding),size=box.getSize(new Vector3());
   const hit=new Mesh(new BoxGeometry(...size.toArray()),new MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false}));
   hit.name=`Hitbox_${key}_${i}`;hit.userData={machineControl:key,hitbox:true};hit.position.copy(box.getCenter(new Vector3()));scene.add(hit);source.attach(hit);lookup[hit.name]=hit;
  }
 }
}
