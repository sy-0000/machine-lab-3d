import { useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { BackSide, BufferGeometry, CanvasTexture, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, Fog, InstancedMesh, MeshStandardMaterial, Object3D, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector3 } from 'three';

// 「黃昏草原」世界（淺色模式）：機台立在傍晚的草地上，天空由紫到橘，低垂的夕陽前浮著一面巨大的齒輪鐘，
// 遠方是蒸氣龐克建築與飛船的剪影看板（public/scenery/，由 scripts/cutout-scenery.mjs 去背產生）。
// 尺寸都以機台半徑 r 為單位。

const HAZE = '#f0a874';
/** Sun direction: low in the west, placed so it sits just left of the machine from the default camera ([6,4,7]). */
const SUN_AZ = Math.atan2(-.85, -.53), SUN_EL = 6 * Math.PI / 180;
export const SUN_DIR = new Vector3(Math.sin(SUN_AZ) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.cos(SUN_AZ) * Math.cos(SUN_EL));
const deg = d => d * Math.PI / 180;

const sceneryUrl = name => `${import.meta.env.BASE_URL}scenery/${name}.webp`;
const SCENERY = ['manor', 'clock-tower', 'kiosk', 'airship', 'airship-watercolor', 'clock'];
/**
 * Billboards around the meadow, each facing the machine. az: degrees from the sun's azimuth; d: distance;
 * h: height; y: base height above the floor (airships float); flip mirrors the picture so repeats read differently.
 */
const BILLBOARDS = [
  { img: 'clock-tower', az: -24, d: 17, h: 6.5, y: -.25 },
  { img: 'kiosk', az: -62, d: 12, h: 3.2, y: -.15 },
  { img: 'manor', az: 38, d: 19, h: 6.2, y: -.2 },
  { img: 'kiosk', az: 95, d: 15, h: 3.4, y: -.15, flip: true },
  { img: 'manor', az: 150, d: 24, h: 5.5, y: -.2, flip: true },
  { img: 'clock-tower', az: 205, d: 22, h: 6, y: -.25, flip: true },
  { img: 'manor', az: 262, d: 20, h: 5.2, y: -.2 },
  { img: 'airship', az: 22, d: 23, h: 4.2, y: 7.5 },
  { img: 'airship-watercolor', az: -48, d: 28, h: 3.6, y: 10, flip: true },
  { img: 'airship', az: 128, d: 30, h: 3.4, y: 9, flip: true },
  { img: 'airship-watercolor', az: 230, d: 26, h: 3, y: 8 },
];

/** Dusk sky dome: violet zenith, rose band, orange horizon and a glowing sun. Colours are display (sRGB) values. */
function skyMaterial() {
  return {
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 sunDir; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 below = vec3(.86,.57,.40), horizon = vec3(1.,.72,.44), rose = vec3(.88,.49,.50), violet = vec3(.42,.36,.58), zenith = vec3(.19,.20,.39);
        vec3 c = h < 0. ? mix(horizon, below, clamp(-h * 8., 0., 1.))
          : h < .12 ? mix(horizon, rose, h / .12)
          : h < .45 ? mix(rose, violet, (h - .12) / .33)
          : mix(violet, zenith, clamp((h - .45) / .55, 0., 1.));
        float s = max(dot(d, normalize(sunDir)), 0.);
        c += vec3(1., .78, .5) * (pow(s, 900.) * 1.6 + pow(s, 40.) * .35 + pow(s, 6.) * .18);
        gl_FragColor = vec4(c, 1.);
      }`,
  };
}

function grassTexture() {
  const size = 512, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#4f6a2c'; g.fillRect(0, 0, size, size);
  let s = 3; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + rand() * 50},${100 + rand() * 40},${30 + rand() * 20},.18)`; g.beginPath(); g.arc(rand() * size, rand() * size, 10 + rand() * 40, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 9000; i++) {
    const x = rand() * size, y = rand() * size, l = 4 + rand() * 10, t = rand();
    g.strokeStyle = t < .6 ? `rgba(${60 + rand() * 40},${95 + rand() * 45},${25 + rand() * 20},.8)` : `rgba(${150 + rand() * 60},${130 + rand() * 40},${50 + rand() * 30},.7)`;
    g.lineWidth = 1 + rand(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - .5) * 4, y - l); g.stroke();
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(40, 40); t.anisotropy = 8; return t;
}

/** Instanced grass blades on a ring around the machine, for depth near the camera. */
function grassBlades(r, floor, count = 9000) {
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, .1, 1, 0], 3)); geo.computeVertexNormals();
  const mesh = new InstancedMesh(geo, new MeshStandardMaterial({ side: DoubleSide, roughness: .9 }), count);
  const o = new Object3D(), col = new Color();
  let s = 17; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, d = r * (1.05 + Math.pow(rand(), 1.6) * 6);
    o.position.set(Math.cos(a) * d, floor, Math.sin(a) * d); o.rotation.set((rand() - .5) * .5, rand() * Math.PI, (rand() - .5) * .5);
    o.scale.set(r * (.006 + rand() * .006), r * (.025 + rand() * .045), 1); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
    mesh.setColorAt(i, col.setHSL(.19 + rand() * .08, .4 + rand() * .2, .1 + rand() * .1));
  }
  mesh.receiveShadow = true; return mesh;
}

export default function DuskMeadowWorld({ r, floor, shadows = true, blades = true }) {
  const { scene } = useThree();
  const textures = useLoader(TextureLoader, SCENERY.map(sceneryUrl));
  const tex = useMemo(() => Object.fromEntries(SCENERY.map((name, i) => { const t = textures[i]; t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return [name, t]; })), [textures]);
  const sky = useMemo(skyMaterial, []);
  const ground = useMemo(() => ({ texture: grassTexture(), geometry: new CircleGeometry(r * 46, 96) }), [r]);
  const tufts = useMemo(() => blades ? grassBlades(r, floor) : null, [r, floor, blades]);
  useEffect(() => () => { ground.texture.dispose(); ground.geometry.dispose(); }, [ground]);
  useEffect(() => () => { tufts?.geometry.dispose(); tufts?.material.dispose(); tufts?.dispose(); }, [tufts]);
  useEffect(() => {
    // Warm evening haze: the far buildings fade into the horizon colour.
    const previous = scene.fog; scene.fog = new Fog(HAZE, r * 4, r * 34);
    return () => { scene.fog = previous; };
  }, [scene, r]);
  const clock = { d: r * 42, size: r * 8 };
  return <group>
    <mesh renderOrder={-20}><sphereGeometry args={[r * 48, 48, 24]} /><shaderMaterial args={[sky]} side={BackSide} depthWrite={false} fog={false} /></mesh>
    {/* The sun sets behind a giant, faint clock face. */}
    <mesh position={[SUN_DIR.x * clock.d, floor + r * 2.2 + SUN_DIR.y * clock.d, SUN_DIR.z * clock.d]} rotation={[0, SUN_AZ + Math.PI, 0]} renderOrder={-19}>
      <planeGeometry args={[clock.size, clock.size]} /><meshBasicMaterial map={tex.clock} transparent opacity={.42} depthWrite={false} fog={false} />
    </mesh>
    <mesh geometry={ground.geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, floor, 0]} receiveShadow={shadows}>
      <meshStandardMaterial map={ground.texture} roughness={1} color="#9c9072" />
    </mesh>
    {tufts && <primitive object={tufts} />}
    {BILLBOARDS.map((b, i) => {
      const t = tex[b.img], w = b.h * r * t.image.width / t.image.height, a = SUN_AZ + deg(b.az), d = b.d * r;
      return <mesh key={i} position={[Math.sin(a) * d, floor + (b.y + b.h / 2) * r, Math.cos(a) * d]} rotation={[0, a + Math.PI, 0]} scale={[b.flip ? -1 : 1, 1, 1]}>
        <planeGeometry args={[w, b.h * r]} /><meshBasicMaterial map={t} transparent alphaTest={.3} side={DoubleSide} color="#e9c7a4" />
      </mesh>;
    })}
  </group>;
}
