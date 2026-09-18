import { Component, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import { MathUtils, Vector3 } from 'three';
import LatheModel from './LatheModel';
import LoadingScreen from './LoadingScreen';
import { LATHE_PARTS, MODEL_NAME } from '../lathe';
import DebugProbe from './DebugProbe';
class SceneBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { this.props.onError(`3D 場景無法啟動：${error.message}`); }
  render() { return this.state.error ? null : this.props.children; }
}
function CameraRig({ model, resetKey, orbit }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!model || !orbit.current) return;
    const vertical = MathUtils.degToRad(camera.fov / 2);
    const horizontal = Math.atan(Math.tan(vertical) * size.width / size.height);
    const distance = model.radius / Math.sin(Math.min(vertical, horizontal)) * 1.08;
    camera.position.copy(new Vector3(0.6, 0.55, 2.4).normalize().multiplyScalar(distance));
    camera.near = model.radius / 1000;
    camera.far = distance * 30;
    camera.updateProjectionMatrix();
    orbit.current.target.set(0, 0, 0);
    orbit.current.minDistance = model.radius * 0.5;
    orbit.current.maxDistance = distance * 4;
    orbit.current.update();
    orbit.current.saveState();
  }, [model, camera, size.width, size.height]);
  useLayoutEffect(() => { orbit.current?.reset(); }, [resetKey]);
  return <OrbitControls ref={orbit} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.92}/>;
}
export default function LatheScene({ model, controls, error, progress, onDanger, onError }) {
  const orbit = useRef();
  const [inspectorEnabled, setInspectorEnabled] = useState(false);
  const interaction = controls.interaction;
  const activePart = LATHE_PARTS[interaction.active || interaction.hover];
  const inspected = interaction.selected || interaction.inspected;
  const radius = model?.radius || 3;
  return <section className="viewport" aria-label="3D 車床互動展示區">
    <div className="view-top"><span className="eyebrow">INTERACTIVE WORKSPACE</span><span className="view-badge">自由視角 · 3D</span></div>
    <SceneBoundary onError={onError}><Canvas frameloop="demand" shadows dpr={[1, 2]} fallback={<div className="scene-overlay">瀏覽器不支援 WebGL，請啟用硬體加速。</div>}>
      <color attach="background" args={['#151e24']}/>
      <PerspectiveCamera makeDefault fov={42} position={[6, 4, 7]}/>
      <CameraRig model={model} resetKey={controls.resetKey} orbit={orbit}/>
      <ambientLight intensity={1.15}/><hemisphereLight args={['#e3f6ff', '#394245', 1.5]}/>
      <directionalLight position={[radius * 2, radius * 3, radius]} intensity={3} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-radius * 2} shadow-camera-right={radius * 2} shadow-camera-top={radius * 2} shadow-camera-bottom={-radius * 2} shadow-camera-near={radius * 0.01} shadow-camera-far={radius * 10} shadow-bias={-0.0002}/>
      <directionalLight position={[-radius, radius, -radius * 2]} intensity={1.4} color="#98c8ff"/>
      {model && <><LatheModel model={model} controls={controls} onDanger={onDanger} orbit={orbit} inspectorEnabled={inspectorEnabled}/>
        {import.meta.env.DEV && new URLSearchParams(window.location.search).has('inspect') && <DebugProbe model={model} controls={controls} orbit={orbit} interaction={interaction}/>}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, model.floor - radius * 0.004, 0]} receiveShadow><planeGeometry args={[radius * 20, radius * 20]}/><meshStandardMaterial color="#182329" roughness={0.95}/></mesh>
        <Grid position={[0, model.floor, 0]} args={[radius * 10, radius * 10]} cellSize={radius / 5} sectionSize={radius} cellColor="#293a40" sectionColor="#3c565b" fadeDistance={radius * 8} infiniteGrid/>
      </>}
    </Canvas></SceneBoundary>
    {!model && !error && <LoadingScreen progress={progress}/>}
    {error && <div className="scene-overlay error" role="alert"><strong>無法載入車床</strong><p>{error}</p><code>public/models/{MODEL_NAME}</code><button onClick={() => window.location.reload()}>重新載入</button></div>}
    {activePart && <div className="part-tooltip" role="tooltip" style={{left:Math.max(8,Math.min(interaction.x+22,window.innerWidth-235)),top:Math.max(8,Math.min(interaction.y+24,window.innerHeight-140))}}><strong>{activePart.label}</strong>{activePart.help.map(line=><small key={line}>{line}</small>)}<small>觸控：先點選查看說明，再按住操作</small></div>}
    {import.meta.env.DEV && <details className="debug-panel" onToggle={e=>setInspectorEnabled(e.currentTarget.open)}><summary>零件檢查器</summary><div>Hover：{interaction.inspected?.name || interaction.hover || '無'}<br/>操作中：{interaction.active || '無'} / 方向 {interaction.direction}<br/>OrbitControls：{interaction.orbitEnabled?'啟用':'停用'}<br/>缺少節點：{error || model?.missing.join('、') || (model?'無':'等待載入')}
      {inspected && <><hr/><b>{inspected.name}</b><br/>GLB 來源：{inspected.sourceName}<br/>操作分配：{inspected.assigned}<br/>世界中心：{inspected.center.map(v=>v.toFixed(5)).join(', ')}<br/>世界尺寸：{inspected.size.map(v=>v.toFixed(5)).join(', ')}<br/>父階層：{inspected.parents.join(' → ')}<pre>{JSON.stringify(inspected.subtree,null,2)}</pre></>}
    </div></details>}
    <div className="view-bottom"><span><i className={controls.rotating ? 'dot active' : 'dot'}/>{controls.rotating ? '主軸運轉中' : '主軸已停止'}</span><span>拖曳旋轉 · 滾輪縮放 · 右鍵平移<br className="mobile-break"/>觸控：單指旋轉 · 雙指縮放與平移</span></div>
  </section>;
}

