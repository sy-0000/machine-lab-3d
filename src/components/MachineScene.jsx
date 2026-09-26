import {Component,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls,PerspectiveCamera,Grid} from '@react-three/drei';
import {Box3,PMREMGenerator} from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {CAMERA_VIEWS,DEFAULT_VIEW,cameraPose,frontYaw} from '../machines/cameraViews.js';
import MachineModel from './MachineModel';
import SteampunkWorkshopWorld from './SteampunkWorkshopWorld';
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
// Light theme world: the steampunk dome workshop (src/vendor/steampunk-workshop).
// Bench machines stand on an iron pedestal (metres) so they sit at working height in the full-size room.
const PEDESTAL={drill:.72};
function Pedestal({model,height}){
 // Footprint in scene coordinates (MachineModel shifts the model by -center).
 const {x,z,w,d}=useMemo(()=>{
  const box=new Box3().setFromObject(model.scene);if(!model.scene.parent)box.translate(model.center.clone().negate());
  return {x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,w:box.max.x-box.min.x+.12,d:box.max.z-box.min.z+.1};
 },[model]);
 const top=model.floor,iron={color:'#2e2a26',metalness:.65,roughness:.55},brass={color:'#b38b4c',metalness:.9,roughness:.35};
 return <group position={[x,top-height,z]}>
  <mesh position={[0,.03,0]} castShadow receiveShadow><boxGeometry args={[w+.08,.06,d+.08]}/><meshStandardMaterial {...iron}/></mesh>
  <mesh position={[0,height/2,0]} castShadow receiveShadow><boxGeometry args={[w-.04,height-.08,d-.04]}/><meshStandardMaterial {...iron}/></mesh>
  <mesh position={[0,height-.025,0]} castShadow receiveShadow><boxGeometry args={[w,.05,d]}/><meshStandardMaterial {...brass}/></mesh>
 </group>;
}
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
  const {target,position}=cameraPose(model,DEFAULT_VIEW,camera,size.width/size.height);flight.current=null;
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
// Reports once the scene behind the loading screen has really been drawn: shaders are compiled first
// (off the main thread where supported), then one frame renders and reaches the screen.
function SceneShown({gate,onShown}){
 const {gl,scene,camera,invalidate}=useThree(),pending=useRef(false),shown=useRef(onShown);shown.current=onShown;
 useEffect(()=>{
  if(!gate)return;let live=true;
  (async()=>{try{await gl.compileAsync?.(scene,camera);}catch{/* the first render compiles instead */}if(live){pending.current=true;invalidate();}})();
  return()=>{live=false;pending.current=false;};
 },[gate,gl,scene,camera,invalidate]);
 useFrame(()=>{
  if(!pending.current)return;pending.current=false;
  // This frame renders right after the callback; two animation frames later it is on screen.
  requestAnimationFrame(()=>requestAnimationFrame(()=>shown.current()));
 });
 return null;
}
function ViewBar({active,onSelect,disabled}){
 useEffect(()=>{
  const key=e=>{if(disabled||e.ctrlKey||e.metaKey||e.altKey||e.target.closest?.('input,select,textarea'))return;const v=CAMERA_VIEWS.find(v=>v.key===e.key);if(v){e.preventDefault();onSelect(v.id);}};
  addEventListener('keydown',key);return()=>removeEventListener('keydown',key);
 },[onSelect,disabled]);
 return <div className="view-bar" role="toolbar" aria-label="視角">{CAMERA_VIEWS.map(v=><button key={v.id} aria-pressed={active===v.id} disabled={disabled} onClick={()=>onSelect(v.id)} title={'快捷鍵 '+v.key}><kbd>{v.key}</kbd>{v.label}</button>)}</div>;
}
export default function MachineScene({model,controls,error,progress,onError,name,machineId}){
 const orbit=useRef(),r=model?.radius||2,[view,setView]=useState({id:DEFAULT_VIEW,n:0}),[theme]=useTheme(),dark=theme==='dark',steam=!dark,[roomReady,setRoomReady]=useState(false);
 const pedestal=steam&&model?PEDESTAL[model.config.id]||0:0;
 useEffect(()=>{if(!steam)setRoomReady(false);},[steam]);
 // The loading screen stays until the machine (and the steampunk room) has been drawn, then fades out.
 const gate=!!model&&(!steam||roomReady),[shown,setShown]=useState(false),[overlayGone,setOverlayGone]=useState(false);
 useEffect(()=>{if(!gate){setShown(false);setOverlayGone(false);return;}const id=setTimeout(()=>setShown(true),15000);return()=>clearTimeout(id);},[gate]); // never stuck (e.g. no WebGL)
 useEffect(()=>{if(!shown)return;const id=setTimeout(()=>setOverlayGone(true),1300);return()=>clearTimeout(id);},[shown]);
 const stage=!model?(progress?`下載模型 ${progress}%`:'Loading · 讀取模型與材質'):!gate?'正在搭建蒸汽工作室 · 貼圖在瀏覽器即時產生，約需數秒':'正在繪製 3D 畫面…';
 useEffect(()=>setView({id:DEFAULT_VIEW,n:0}),[model,controls.resetKey]);
 return <section className="viewport" aria-label={`3D ${name}互動展示區`}>
  <div className="view-top"><ViewBar active={view.id} disabled={!model} onSelect={id=>setView(v=>({id,n:v.n+1}))}/></div>
  <Boundary onError={onError}><Canvas frameloop="demand" shadows={!LOW_GFX} dpr={LOW_GFX?1:[1,1.5]} fallback={<div className="scene-overlay">瀏覽器不支援 WebGL，請啟用硬體加速。</div>}>
   {/* Dark: the clear studio (e721766). Light: the domed steampunk workshop. */}
   {dark&&<color attach="background" args={['#151e24']}/>}
   <PerspectiveCamera makeDefault fov={42} position={[6,4,7]}/><CameraRig model={model} resetKey={controls.resetKey} orbit={orbit} view={view} maxPolarAngle={dark?Math.PI:Math.PI*.495} maxDistanceR={steam?5.2:Infinity} lookUp={!dark}/>{!LOW_GFX&&dark&&<StudioEnvironment intensity={.55}/>}
   {/* The steampunk workshop brings its own sun, sky bounce, lamps, fire, reflections and fog. */}
   {dark&&<><ambientLight intensity={1.2}/><hemisphereLight args={['#e3f6ff','#394245',1.5]}/>
   <directionalLight position={[r*2,r*3,r]} intensity={3} color="#ffffff" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-r*2} shadow-camera-right={r*2} shadow-camera-top={r*2} shadow-camera-bottom={-r*2} shadow-camera-far={r*10} shadow-bias={-.0002}/>
   <directionalLight position={[-r,r,-r*2]} intensity={1.4} color="#98c8ff"/></>}
   <SceneShown gate={gate} onShown={()=>setShown(true)}/>
   {model&&<><MachineModel model={model} controls={controls} orbit={orbit}/>
    {import.meta.env.DEV&&new URLSearchParams(location.search).has('inspect')&&<MachineDebug model={model} controls={controls} orbit={orbit}/>}
    {dark?<>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,model.floor-r*.005,0]} receiveShadow><planeGeometry args={[r*20,r*20]}/><meshStandardMaterial color="#182329"/></mesh>
    <Grid position={[0,model.floor,0]} args={[r*10,r*10]} cellSize={r/5} sectionSize={r} cellColor="#293a40" sectionColor="#3c565b" fadeDistance={r*8}/>
    </>:<>
     {pedestal>0&&<Pedestal model={model} height={pedestal}/>}
     <SteampunkWorkshopWorld floor={model.floor-pedestal-.002} facing={frontYaw(model.config.id)} low={LOW_GFX} onReady={()=>setRoomReady(true)}/>
    </>}
   </>}
  </Canvas></Boundary>
  {!overlayGone&&!error&&<LoadingScreen progress={!model?progress*.8:!gate?88:shown?100:95} stage={stage} machineId={machineId} done={shown}/>}
  {error&&<div className="scene-overlay error" role="alert"><strong>無法載入{name}</strong><p>{error}</p><button onClick={()=>location.reload()}>重新載入</button></div>}
  <PartTooltip part={model?.controls[controls.interaction.active||controls.interaction.hover]} interaction={controls.interaction}/>
  <div className="view-bottom"><span>{model?.rpm>0?'● 主軸運轉中':'● 主軸已停止'}</span><span>拖曳旋轉 · 滾輪縮放 · 右鍵平移<br/>觸控：單指旋轉 · 雙指縮放與平移</span></div>
 </section>;
}
