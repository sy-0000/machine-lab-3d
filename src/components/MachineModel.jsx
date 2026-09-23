import {useEffect,useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Raycaster,Vector2} from 'three';
import {controlFor,setHighlight,visibleHit} from '../machines/runtime';
export default function MachineModel({model,controls,orbit}) {
 const {gl,camera,invalidate}=useThree(),latest=useRef(controls),previousActive=useRef(false),elapsed=useRef(0),published=useRef(''),clock=useRef(null),frame=useRef(0);
 const session=controls.session;
 useEffect(()=>{
  if(!session)return;
  const owner=session.claimClock();clock.current=owner;frame.current=0;previousActive.current=false;
  return()=>{session.releaseClock(owner);clock.current=null;};
 },[session]);
 latest.current=controls;
 useLayoutEffect(()=>{controls.invalidate.current=invalidate;invalidate();},[controls.running,controls.rpm,controls.resetKey,controls.version,controls.interaction,invalidate]);
 useEffect(()=>{
  const canvas=gl.domElement,ray=new Raycaster(),point=new Vector2();let pointer=null,hover=null,armed=null,rightRelease=null;
  const update=(key,x=0,y=0)=>{hover=key;model.hover=key;setHighlight(model,key);latest.current.setInteraction({hover:key,active:latest.current.held.current?.key||null,x,y});invalidate();};
  const release=()=>{const old=pointer;pointer=null;latest.current.held.current=null;session?.command({type:'wheel.release'});model.active=null;if(old!==null&&canvas.hasPointerCapture(old))canvas.releasePointerCapture(old);if(orbit.current)orbit.current.enabled=true;canvas.style.cursor=hover?'grab':'';invalidate();};
  const finish=(clear=false)=>{if(clear){hover=null;armed=null;rightRelease=null;model.hover=null;setHighlight(model,null);}release();latest.current.setInteraction(v=>({...v,hover:clear?null:v.hover,active:null}));invalidate();};
  latest.current.release.current=finish;
  function hit(e){const rect=canvas.getBoundingClientRect();point.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);model.scene.updateWorldMatrix(true,true);camera.updateMatrixWorld();ray.setFromCamera(point,camera);return controlFor(visibleHit(ray,model.scene)?.object);}
  function down(e){
   if(!latest.current.inputEnabled)return;
   if(pointer!==null){e.stopImmediatePropagation();return;}
   const key=hit(e),part=model.controls[key];if(!part)return;
   if(e.button!==0&&e.button!==2)return;if(part.type!=='wheel'&&!part.bidirectional&&e.button!==0)return;
   e.preventDefault();e.stopImmediatePropagation();update(key,e.clientX,e.clientY);
   if(e.pointerType==='touch'&&part.type==='wheel'&&!part.springReturn&&armed!==key){armed=key;return;}
   if(part.needsCalibration&&!latest.current.teaching)return;
   pointer=e.pointerId;canvas.setPointerCapture(pointer);if(orbit.current)orbit.current.enabled=false;
   if(part.type==='wheel'){const direction=e.button===2?1:-1;latest.current.hold(key,direction);model.active=key;}else if(part.type==='detent')latest.current.detentStep(key,e.button===2?1:-1);else if(part.type==='index')latest.current.index(e.button===2?1:-1);else if(part.type==='emergency')latest.current.brake();else latest.current.toggle(e.button===2?-1:1);
   canvas.style.cursor='grabbing';latest.current.refresh();update(key,e.clientX,e.clientY);
  }
  function move(e){if(pointer!==null){e.stopImmediatePropagation();return;}const key=hit(e);canvas.style.cursor=key?'grab':'';update(key,e.clientX,e.clientY);}
  function up(e){if(pointer!==e.pointerId)return;e.stopImmediatePropagation();if(e.button===2)rightRelease=performance.now();finish();}
  function cancel(e){if(pointer!==null&&e.pointerId!==pointer)return;finish();}
  function blur(){finish();armed=null;update(null);}
  function context(e){if(['wheel','lever','detent','index'].includes(model.controls[hit(e)]?.type)||latest.current.held.current||rightRelease&&performance.now()-rightRelease<500)e.preventDefault();e.stopImmediatePropagation();rightRelease=null;}
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel,pointerleave:()=>{if(pointer===null)update(null);},contextmenu:context};
  Object.entries(events).forEach(([type,fn])=>canvas.addEventListener(type,fn,true));window.addEventListener('blur',blur);
  return()=>{release();setHighlight(model,null);Object.entries(events).forEach(([type,fn])=>canvas.removeEventListener(type,fn,true));window.removeEventListener('blur',blur);latest.current.release.current=()=>{};latest.current.invalidate.current=()=>{};};
 },[model,session,gl,camera,orbit,invalidate]);
 useFrame((_,delta)=>{
  const c=latest.current,held=c.held.current,dt=previousActive.current?delta:0;
  if(held){if(orbit.current)orbit.current.enabled=false;model.active=held.key;}
  if(!session||!clock.current)return;
  const {active}=session.update(dt,{clock:clock.current,frameId:frame.current++});
  elapsed.current+=delta;const signature=JSON.stringify([Math.round(model.rpm),model.leverAngle,model.offsets,model.angles]);
  // The final RPM can round to the same value as the preceding frame.
  // Publish the stop transition so controls unlock even when the signature is unchanged.
  if((previousActive.current&&!active)||(signature!==published.current&&(elapsed.current>.08||!active))){elapsed.current=0;published.current=signature;c.refresh();}
  previousActive.current=active;if(active)invalidate();
 });
 return <group position={model.center.clone().negate().toArray()}><primitive object={model.scene} dispose={null}/></group>;
}
