import {Component,useLayoutEffect,useRef} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls,PerspectiveCamera,Grid} from '@react-three/drei';
import {Vector3,MathUtils} from 'three';
import MachineModel from './MachineModel';
import PartTooltip from './PartTooltip';
import LoadingScreen from './LoadingScreen';
import MachineDebug from './MachineDebug';
class Boundary extends Component {
 state={error:null};static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error){this.props.onError(`3D 場景錯誤：${error.message}`);}
 render(){return this.state.error?null:this.props.children;}
}
function CameraRig({model,resetKey,orbit}){
 const {camera,size,invalidate}=useThree();
 useLayoutEffect(()=>{
  if(!model||!orbit.current)return;
  // Drain pending damping/pan deltas before restoring the exact initial camera pose.
  const damping=orbit.current.enableDamping;orbit.current.enableDamping=false;orbit.current.update();
  const angle=Math.min(MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(MathUtils.degToRad(camera.fov/2))*size.width/size.height));
  const distance=model.radius/Math.sin(angle)*1.08;
  const direction=model.config.id==='drill'?new Vector3(1,.6,2.4):model.config.id==='milling'?new Vector3(2.4,.8,1.5):new Vector3(.6,.55,2.4);
  camera.position.copy(direction.normalize().multiplyScalar(distance));camera.near=model.radius/1000;camera.far=distance*30;camera.updateProjectionMatrix();
  orbit.current.target.set(0,0,0);orbit.current.minDistance=model.radius*.5;orbit.current.maxDistance=distance*4;orbit.current.update();orbit.current.enableDamping=damping;invalidate();
 },[model,resetKey,size.width,size.height,camera,invalidate,orbit]);
 return <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={.08}/>;
}
export default function MachineScene({model,controls,error,progress,onError,name}){
 const orbit=useRef(),r=model?.radius||2;
 return <section className="viewport" aria-label={`3D ${name}互動展示區`}>
  <div className="view-top"><span className="eyebrow">INTERACTIVE WORKSPACE</span><span className="view-badge">旋轉 · 縮放 · 平移</span></div>
  <Boundary onError={onError}><Canvas frameloop="demand" shadows dpr={[1,1.5]} fallback={<div className="scene-overlay">瀏覽器不支援 WebGL，請啟用硬體加速。</div>}>
   <color attach="background" args={['#151e24']}/><PerspectiveCamera makeDefault fov={42} position={[6,4,7]}/><CameraRig model={model} resetKey={controls.resetKey} orbit={orbit}/>
   <ambientLight intensity={1.2}/><hemisphereLight args={['#e3f6ff','#394245',1.5]}/>
   <directionalLight position={[r*2,r*3,r]} intensity={3} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-r*2} shadow-camera-right={r*2} shadow-camera-top={r*2} shadow-camera-bottom={-r*2} shadow-camera-far={r*10} shadow-bias={-.0002}/>
   <directionalLight position={[-r,r,-r*2]} intensity={1.4} color="#98c8ff"/>
   {model&&<><MachineModel model={model} controls={controls} orbit={orbit}/>
    {import.meta.env.DEV&&new URLSearchParams(location.search).has('inspect')&&<MachineDebug model={model} controls={controls} orbit={orbit}/>}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,model.floor-r*.005,0]} receiveShadow><planeGeometry args={[r*20,r*20]}/><meshStandardMaterial color="#182329"/></mesh>
    <Grid position={[0,model.floor,0]} args={[r*10,r*10]} cellSize={r/5} sectionSize={r} cellColor="#293a40" sectionColor="#3c565b" fadeDistance={r*8}/>
   </>}
  </Canvas></Boundary>
  {!model&&!error&&<LoadingScreen progress={progress}/>}
  {error&&<div className="scene-overlay error" role="alert"><strong>無法載入{name}</strong><p>{error}</p><button onClick={()=>location.reload()}>重新載入</button></div>}
  <PartTooltip part={model?.controls[controls.interaction.active||controls.interaction.hover]} interaction={controls.interaction}/>
  <div className="view-bottom"><span>{model?.rpm>0?'● 主軸運轉中':'● 主軸已停止'}</span><span>拖曳旋轉 · 滾輪縮放 · 右鍵平移<br/>觸控：單指旋轉 · 雙指縮放與平移</span></div>
 </section>;
}
