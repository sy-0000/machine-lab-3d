import {Component,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,PerspectiveCamera,Grid} from '@react-three/drei';
import {PMREMGenerator} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CAMERA_VIEWS,cameraPose} from '../machines/cameraViews.js';
import MachineModel from './MachineModel';
import DuskMeadowWorld,{SUN_DIR} from './DuskMeadowWorld';
import WorkshopWorld from './WorkshopWorld';
import PartTooltip from './PartTooltip';
import LoadingScreen from './LoadingScreen';
import MachineDebug from './MachineDebug';
import {useTheme} from '../theme.js';
// Low graphics (no reflections or shadows, 1x resolution) on software WebGL, where each frame costs ~3x more;
// ?lowgfx forces it, ?hifx forces full effects.
function softwareRenderer(){
 try{
  const gl=document.createElement('canvas').getContext('webgl'),info=gl?.getExtension('WEBGL_debug_renderer_info');
  const name=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'';gl?.getExtension('WEBGL_lose_context')?.loseContext();
  return /swiftshader|llvmpipe|software|basic render/i.test(name);
 }catch{return false;}
}
const params=new URLSearchParams(location.search);
const LOW_GFX=params.has('lowgfx')||(!params.has('hifx')&&softwareRenderer());
// Light theme world: the domed steampunk workshop by default; ?scene=meadow shows the dusk meadow instead.
const MEADOW=params.get('scene')==='meadow';
class Boundary extends Component {
 state={error:null};static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error){this.props.onError(`3D 場景錯誤：${error.message}`);}
 render(){return this.state.error?null:this.props.children;}
}
function CameraRig({model,resetKey,orbit,view,maxPolarAngle=Math.PI,maxDistanceR=Infinity,lookUp=false}){
 const {camera,size,invalidate}=useThree(),flight=useRef(null);
 useLayoutEffect(()=>{
  if(!model||!orbit.current)return;
  // Drain pending damping/pan deltas before restoring the exact initial camera pose.
  const damping=orbit.current.enableDamping;orbit.current.enableDamping=false;orbit.current.update();
  const {target,position}=cameraPose(model,'overview',camera,size.width/size.height);flight.current=null;
  camera.position.copy(position);camera.near=model.radius/1000;camera.far=position.length()*30;camera.updateProjectionMatrix();
  orbit.current.target.copy(target);orbit.current.minDistance=model.radius*.03;orbit.current.maxDistance=Math.min(position.length()*4,model.radius*maxDistanceR);orbit.current.update();orbit.current.enableDamping=damping;invalidate();
 // camera: <PerspectiveCamera makeDefault> swaps the default camera after the first render; pose the new one.
 },[model,resetKey,maxDistanceR,camera]); // eslint-disable-line react-hooks/exhaustive-deps -- a resize must not throw away the student's view
 useEffect(()=>{
  if(!model||!orbit.current||!view.n)return;
  flight.current={from:camera.position.clone(),fromTarget:orbit.current.target.clone(),to:cameraPose(model,view.id,camera,size.width/size.height),start:performance.now()};invalidate();
 },[view]); // eslint-disable-line react-hooks/exhaustive-deps
 useFrame(()=>{
  // Look-up: the camera may drop below the target and tilt up (to see the dome and sky), but never below the floor.
  if(lookUp&&orbit.current&&model){
   const o=orbit.current,d=camera.position.distanceTo(o.target),h=o.target.y-(model.floor+model.radius*.08);
   o.maxPolarAngle=Math.min(Math.PI*.8,Math.max(Math.PI*.495,Math.PI/2+Math.asin(Math.max(-1,Math.min(1,h/Math.max(d,1e-6))))));
  }
  const f=flight.current;if(!f||!orbit.current)return;
  const k=Math.min(1,(performance.now()-f.start)/650),e=1-Math.pow(1-k,3);
  camera.position.lerpVectors(f.from,f.to.position,e);orbit.current.target.lerpVectors(f.fromTarget,f.to.target,e);orbit.current.update();
  if(k<1)invalidate();else flight.current=null;
 });
 return <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={.08} {...(lookUp?{}:{maxPolarAngle})}/>;
}
// Local studio reflections (no download) so metal parts read as metal instead of black.
function StudioEnvironment({intensity=.55}){
 const {gl,scene,invalidate}=useThree();
 useEffect(()=>{
  const pmrem=new PMREMGenerator(gl),room=new RoomEnvironment(),texture=pmrem.fromScene(room,.04).texture;
  scene.environment=texture;
  return()=>{scene.environment=null;texture.dispose();pmrem.dispose();room.dispose?.();};
 },[gl,scene]);
 useEffect(()=>{scene.environmentIntensity=intensity;invalidate();},[scene,intensity,invalidate]);
 return null;
}
function ViewBar({active,onSelect,disabled}){
 useEffect(()=>{
  const key=e=>{if(disabled||e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,select,textarea'))return;const v=CAMERA_VIEWS.find(v=>v.key===e.key);if(v){e.preventDefault();onSelect(v.id);}};
  addEventListener('keydown',key);return()=>removeEventListener('keydown',key);
 },[onSelect,disabled]);
 return <div className="view-bar" role="toolbar" aria-label="視角">{CAMERA_VIEWS.map(v=><button key={v.id} aria-pressed={active===v.id} disabled={disabled} onClick={()=>onSelect(v.id)} title={'快捷鍵 '+v.key}><kbd>{v.key}</kbd>{v.label}</button>)}</div>;
}
export default function MachineScene({model,controls,error,progress,onError,name}){
 const orbit=useRef(),r=model?.radius||2,[view,setView]=useState({id:'overview',n:0}),[theme]=useTheme(),dark=theme==='dark',indoor=!dark&&!MEADOW;
 useEffect(()=>setView({id:'overview',n:0}),[model,controls.resetKey]);
 return <section className="viewport" aria-label={`3D ${name}互動展示區`}>
  <div className="view-top"><ViewBar active={view.id} disabled={!model} onSelect={id=>setView(v=>({id,n:v.n+1}))}/></div>
  <Boundary onError={onError}><Canvas frameloop="demand" shadows={!LOW_GFX} dpr={LOW_GFX?1:[1,1.5]} fallback={<div className="scene-overlay">瀏覽器不支援 WebGL，請啟用硬體加速。</div>}>
   {/* Dark: the clear studio (e721766). Light: the domed steampunk workshop (or ?scene=meadow, the dusk meadow). */}
   {dark&&<color attach="background" args={['#151e24']}/>}
   <PerspectiveCamera makeDefault fov={42} position={[6,4,7]}/><CameraRig model={model} resetKey={controls.resetKey} orbit={orbit} view={view} maxPolarAngle={dark?Math.PI:Math.PI*.495} maxDistanceR={indoor?5.2:Infinity} lookUp={!dark}/>{!LOW_GFX&&<StudioEnvironment intensity={dark?.55:.35}/>}
   {dark?<><ambientLight intensity={1.2}/><hemisphereLight args={['#e3f6ff','#394245',1.5]}/></>
    :indoor?<><ambientLight intensity={.3} color="#ffd8b0"/><hemisphereLight args={['#ffe4c4','#4a3a30',.8]}/></>
    :<><ambientLight intensity={.35} color="#ffd2a8"/><hemisphereLight args={['#ffb98c','#3c4a2a',.9]}/></>}
   <directionalLight position={[r*2,r*3,r]} intensity={dark?3:indoor?2:2.3} color={dark?'#ffffff':indoor?'#ffe2bc':'#ffc48a'} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-r*2} shadow-camera-right={r*2} shadow-camera-top={r*2} shadow-camera-bottom={-r*2} shadow-camera-far={r*10} shadow-bias={-.0002}/>
   {dark?<directionalLight position={[-r,r,-r*2]} intensity={1.4} color="#98c8ff"/>
    :indoor?<directionalLight position={[-r*2,r*1.2,-r*3]} intensity={.8} color="#ff9a5a"/>
    :<directionalLight position={[SUN_DIR.x*r*4,r*.8,SUN_DIR.z*r*4]} intensity={1.6} color="#ff9a5a"/>}
   {model&&<><MachineModel model={model} controls={controls} orbit={orbit}/>
    {import.meta.env.DEV&&new URLSearchParams(location.search).has('inspect')&&<MachineDebug model={model} controls={controls} orbit={orbit}/>}
    {dark?<>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,model.floor-r*.005,0]} receiveShadow><planeGeometry args={[r*20,r*20]}/><meshStandardMaterial color="#182329"/></mesh>
    <Grid position={[0,model.floor,0]} args={[r*10,r*10]} cellSize={r/5} sectionSize={r} cellColor="#293a40" sectionColor="#3c565b" fadeDistance={r*8}/>
    </>:<Suspense fallback={null}>{indoor?<WorkshopWorld r={r} floor={model.floor-r*.002} shadows={!LOW_GFX} animate={!LOW_GFX}/>
     :<DuskMeadowWorld r={r} floor={model.floor-r*.002} shadows={!LOW_GFX} blades={!LOW_GFX}/>}</Suspense>}
   </>}
  </Canvas></Boundary>
  {!model&&!error&&<LoadingScreen progress={progress}/>}
  {error&&<div className="scene-overlay error" role="alert"><strong>無法載入{name}</strong><p>{error}</p><button onClick={()=>location.reload()}>重新載入</button></div>}
  <PartTooltip part={model?.controls[controls.interaction.active||controls.interaction.hover]} interaction={controls.interaction}/>
  <div className="view-bottom"><span>{model?.rpm>0?'● 主軸運轉中':'● 主軸已停止'}</span><span>拖曳旋轉 · 滾輪縮放 · 右鍵平移<br/>觸控：單指旋轉 · 雙指縮放與平移</span></div>
 </section>;
}
