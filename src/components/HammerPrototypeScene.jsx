import { useMemo, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { LatheGeometry, Vector2 } from 'three';
import { STOCK, HAMMER_LEVELS } from '../levels/hammerPrototype.js';

function Stock({ attempt }) {
  const group = useRef();
  const geometry = useMemo(() => {
    const points = [new Vector2(0, 0), ...attempt.profile.map((r, i) => new Vector2(r, i * STOCK.spacing)), new Vector2(0, STOCK.length)];
    return new LatheGeometry(points, 48);
  }, [attempt.profile]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => { if (group.current) group.current.rotation.x += attempt.rpm / 60 * Math.PI * 2 * dt; });
  return <group ref={group}>
    <mesh geometry={geometry} rotation={[0, 0, -Math.PI / 2]}>
      <meshStandardMaterial color="#bdcbd3" metalness={0.65} roughness={0.32} />
    </mesh>
    {/* A small stripe makes rotation visible even on the symmetric stock. */}
    <mesh position={[8, STOCK.radius + 0.12, 0]}><boxGeometry args={[10, 0.2, 2]} /><meshStandardMaterial color="#586874" /></mesh>
    {attempt.marks.map(mark => <mesh key={mark.position} position={[mark.position, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[attempt.profile[Math.round(mark.position / STOCK.spacing)] + 0.02, 0.10 + mark.severity * 0.14, 6, 48]} />
      <meshStandardMaterial color="#554738" roughness={0.95} />
    </mesh>)}
  </group>;
}
function Cutter({ attempt }) {
  const level = HAMMER_LEVELS[attempt.levelIndex];
  const engaged = ['running', 'stopping', 'complete'].includes(attempt.phase);
  const radius = engaged ? level.radius : STOCK.radius + 5;
  return <group position={[attempt.position, radius, 0]}>
    <mesh position={[0, 10, 0]}><boxGeometry args={[3, 20, 5]} /><meshStandardMaterial color="#e9bd66" metalness={0.4} roughness={0.4} /></mesh>
    <mesh position={[0, 25, 0]}><boxGeometry args={[12, 12, 12]} /><meshStandardMaterial color="#395768" /></mesh>
  </group>;
}
export default function HammerPrototypeScene({ attempt }) {
  const level = HAMMER_LEVELS[attempt.levelIndex];
  return <div className="prototype-scene" aria-label="槌柄加工局部 3D 視圖">
    <Canvas camera={{ position: [160, 130, 200], fov: 38, near: 0.1, far: 2000 }} dpr={[1, 1.5]} fallback={<p>無法顯示 WebGL，請使用下方輪廓圖查看加工結果。</p>}>
      <color attach="background" args={['#142129']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[80, 150, 100]} intensity={3} />
      <directionalLight position={[-80, 40, -80]} intensity={2} color="#89bfff" />
      <Stock attempt={attempt} /><Cutter attempt={attempt} />
      <mesh position={[-9, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[23, 23, 18, 32]} /><meshStandardMaterial color="#516271" metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[(level.start + level.end) / 2, -18, 0]}><boxGeometry args={[level.start - level.end, 0.7, 5]} /><meshStandardMaterial color="#86e8c1" /></mesh>
      <Grid position={[70, -25, 0]} args={[260, 180]} cellSize={10} sectionSize={50} cellColor="#30434c" sectionColor="#49636c" fadeDistance={500} />
      <OrbitControls makeDefault target={[65, 0, 0]} minDistance={100} maxDistance={500} />
    </Canvas>
    <span className="prototype-scene-label">金色：刀具 · 綠色：本關加工區 · 拖曳旋轉視角</span>
  </div>;
}
