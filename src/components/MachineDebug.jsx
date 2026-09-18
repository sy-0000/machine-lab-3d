import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Vector3,Quaternion,Raycaster,Vector2} from 'three';
import {controlFor} from '../machines/runtime';
// Read-only test snapshots. Tests operate real UI and Pointer Events.
export default function MachineDebug({model,controls,orbit}){
 const {camera,gl}=useThree(),cache=useRef({key:'',picks:{}});
 useEffect(()=>()=>{delete window.__MACHINE_DEBUG__;},[]);
 useFrame(()=>{
  model.scene.updateWorldMatrix(true,true);camera.updateMatrixWorld();const rect=gl.domElement.getBoundingClientRect();
  const key=JSON.stringify([camera.position.toArray(),rect.x,rect.y,rect.width,rect.height,model.offsets,model.angles]);
  if(!controls.held.current&&key!==cache.current.key){
   const ray=new Raycaster(),picks={};
   for(const [id,part]of Object.entries(model.controls)){
    picks[id]=[];part.object.traverse(mesh=>{
     if(!mesh.isMesh||picks[id].length)return;
     const a=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count||a.count;
     for(let j=0;j+2<count;j+=Math.max(1,Math.floor(count/120))*3){
      const point=new Vector3();for(let k=0;k<3;k++)point.add(new Vector3().fromBufferAttribute(a,index?index.getX(j+k):j+k));
      point.divideScalar(3).applyMatrix4(mesh.matrixWorld).project(camera);if(Math.abs(point.x)>.95||Math.abs(point.y)>.9)continue;
      ray.setFromCamera(new Vector2(point.x,point.y),camera);
      if(controlFor(ray.intersectObject(model.scene,true)[0]?.object)===id){picks[id].push({x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2});break;}
     }
    });
   }cache.current={key,picks};
  }
  window.__MACHINE_DEBUG__={id:model.config.id,indexSteps:model.indexSteps,emergency:model.emergency,errors:model.errors,offsets:{...model.offsets},angles:{...model.angles},rpm:model.rpm,spindleAngle:model.spindleAngle,active:controls.held.current,orbitEnabled:orbit.current?.enabled,camera:camera.position.toArray(),picks:cache.current.picks,nodes:Object.fromEntries(Object.entries({...model.lookup,...model.pivots}).map(([name,node])=>[name,{parent:node.parent?.name,world:node.getWorldPosition(new Vector3()).toArray(),quaternion:node.getWorldQuaternion(new Quaternion()).toArray()}]))};
 });return null;
}
