import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2 } from 'three';
import { applyMachine, stepDrive, resetModel, proximity, findInteractiveAncestor, WHEELS, highlight, describeMesh, directionFromButton } from '../lathe';
export default function LatheModel({model,controls,onDanger,orbit,inspectorEnabled}) {
 const {gl,camera,invalidate}=useThree(),latest=useRef(controls);latest.current=controls;
 const interactionRef=useRef({hoveredControl:null,activeControl:null,direction:0,pointerButton:null,pressed:false});
 const activeFrame=useRef(false);
 const finishRef=useRef(()=>{}),warningRef=useRef(),lastDrive=useRef(''),inspectRef=useRef(inspectorEnabled);inspectRef.current=inspectorEnabled;
 useLayoutEffect(()=>{applyMachine(model,controls.machine);invalidate();},[model,controls.machine,invalidate]);
 useLayoutEffect(()=>{finishRef.current(null,true);resetModel(model);invalidate();},[model,controls.resetKey,invalidate]);
 // Render again after React commits event state, even when the animation has stopped.
 useLayoutEffect(()=>{invalidate();},[controls.running,controls.rpm,controls.hasWorkpiece,controls.interaction,invalidate]);
 useEffect(()=>{
  const canvas=gl.domElement,ray=new Raycaster(),point=new Vector2(),s=interactionRef.current;
  let pointerId=null,hoveredMesh=null,selectedMesh=null,touchArmed=null,touchPreview=null,lastPoint={x:0,y:0},rightGesture=null;
  const report=()=>{latest.current.setInteraction({hover:s.hoveredControl,active:s.activeControl,pressed:s.pressed,direction:s.direction,pointerButton:s.pointerButton,x:lastPoint.x,y:lastPoint.y,orbitEnabled:orbit.current?.enabled??true,inspected:inspectRef.current?describeMesh(model,hoveredMesh):null,selected:inspectRef.current?describeMesh(model,selectedMesh):null});invalidate();};
  const hit=e=>{const r=canvas.getBoundingClientRect();point.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);model.scene.updateWorldMatrix(true,true);camera.updateMatrixWorld();ray.setFromCamera(point,camera);const mesh=ray.intersectObject(model.scene,true)[0]?.object;const parent=findInteractiveAncestor(mesh);if(import.meta.env.DEV)model.lastHit={mesh:mesh?.name,key:parent?.userData.controlKey,x:e.clientX,y:e.clientY,camera:camera.position.toArray()};return {mesh,key:parent?.userData.controlKey||null};};
  function finish(event,clear=false){
   if(event&&pointerId!==null&&event.pointerId!==undefined&&event.pointerId!==pointerId)return;
   const old=pointerId;pointerId=null;s.pressed=false;s.direction=0;s.activeControl=null;s.pointerButton=null;
   if(old!==null&&canvas.hasPointerCapture(old))canvas.releasePointerCapture(old);
   if(orbit.current)orbit.current.enabled=true;
   if(clear){s.hoveredControl=null;hoveredMesh=null;selectedMesh=null;touchArmed=null;touchPreview=null;rightGesture=null;}
   canvas.style.cursor=s.hoveredControl?'grab':'';highlight(model,s.hoveredControl,inspectRef.current?selectedMesh?.name:null);report();
  }
  finishRef.current=finish;
  function down(e){
   if(s.pressed){e.stopImmediatePropagation();return;}
   rightGesture=null;lastPoint={x:e.clientX,y:e.clientY};const {mesh,key}=hit(e);hoveredMesh=mesh;
   if(inspectRef.current&&e.button===0)selectedMesh=mesh;
   if(!key){s.hoveredControl=null;touchArmed=null;touchPreview=null;highlight(model,null,inspectRef.current?selectedMesh?.name:null);report();return;}
   if(key==='startLever'&&e.button!==0)return;
   const direction=e.pointerType==='touch'?latest.current.touchDirection:directionFromButton(e.button);if(!direction)return;
   e.preventDefault();e.stopImmediatePropagation();s.hoveredControl=key;
   if(e.pointerType==='touch'&&touchArmed!==key){touchArmed=key;touchPreview=key;highlight(model,key);report();return;}
   touchPreview=null;s.activeControl=key;s.direction=key==='startLever'?0:direction;s.pointerButton=e.button;s.pressed=true;pointerId=e.pointerId;
   canvas.setPointerCapture(pointerId);if(orbit.current)orbit.current.enabled=false;canvas.style.cursor='grabbing';highlight(model,key);
   if(key==='startLever')latest.current.toggleRunning();else latest.current.turn(key,direction*0.06); // A short press always has a small, symmetric step.
   report();
  }
  function move(e){
   if(s.pressed){e.stopImmediatePropagation();if(e.pointerId===pointerId){lastPoint={x:e.clientX,y:e.clientY};report();}return;}
   lastPoint={x:e.clientX,y:e.clientY};const {mesh,key}=hit(e);hoveredMesh=mesh;s.hoveredControl=key;canvas.style.cursor=key?'grab':'';
   if(e.pointerType!=='touch')touchPreview=null;
   highlight(model,key,inspectRef.current?selectedMesh?.name:null);report();
  }
  function up(e){if(s.pressed&&pointerId===e.pointerId){e.stopImmediatePropagation();if(s.pointerButton===2)rightGesture={x:e.clientX,y:e.clientY,time:performance.now()};finish(e);} }
  function leave(){if(!s.pressed&&!touchPreview){s.hoveredControl=null;hoveredMesh=null;canvas.style.cursor='';highlight(model,null,inspectRef.current?selectedMesh?.name:null);report();}}
  function context(e){
   const onWheel=Boolean(WHEELS[hit(e).key]),active=Boolean(WHEELS[s.activeControl]);
   const releaseMenu=rightGesture&&performance.now()-rightGesture.time<500&&Math.hypot(e.clientX-rightGesture.x,e.clientY-rightGesture.y)<4;
   if(onWheel||active||releaseMenu)e.preventDefault();
   // OrbitControls suppresses all canvas context menus by default. Bypass that handler outside wheels.
   e.stopImmediatePropagation();rightGesture=null;
  }
  const cancel=e=>{if(s.pressed)e.stopImmediatePropagation();finish(e,true);};
  const blur=()=>finish(null,true);
  const events={pointerenter:move,pointermove:move,pointerdown:down,pointerup:up,pointercancel:cancel,lostpointercapture:e=>finish(e),pointerleave:leave,contextmenu:context};
  Object.entries(events).forEach(([type,handler])=>canvas.addEventListener(type,handler,true));window.addEventListener('blur',blur);
  model.inputReady=true;invalidate();
  return()=>{model.inputReady=false;finish(null,true);Object.entries(events).forEach(([type,handler])=>canvas.removeEventListener(type,handler,true));window.removeEventListener('blur',blur);finishRef.current=()=>{};};
 },[model,gl,camera,orbit]);
 useEffect(()=>{if(!inspectorEnabled)highlight(model,interactionRef.current.hoveredControl);invalidate();},[inspectorEnabled,model,invalidate]);
 useFrame((_,delta)=>{
  const s=interactionRef.current;
  // Demand rendering pauses the clock between interactions; idle time must never become a feed jump.
  const frameDelta=activeFrame.current?delta:0;
  if(s.pressed&&WHEELS[s.activeControl])latest.current.turn(s.activeControl,s.direction*WHEELS[s.activeControl].rotationSpeed*frameDelta);
  const drive=stepDrive(model,controls.running,controls.rpm,frameDelta);
  const signature=`${Math.round(drive.actualRpm)}:${drive.leverAngle.toFixed(3)}:${drive.phase}`;
  if(signature!==lastDrive.current){lastDrive.current=signature;latest.current.setDrive({...drive});}
  activeFrame.current=s.pressed||controls.running||drive.actualRpm>0||drive.phase==='停止中';
  if(activeFrame.current)invalidate();
  const warning=proximity(model);if(warning!==warningRef.current){warningRef.current=warning;onDanger(warning);}
 });
 return <group position={[-model.center.x,-model.center.y,-model.center.z]}><primitive object={model.scene} dispose={null}/></group>;
}



