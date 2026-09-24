import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { CanvasTexture, CylinderGeometry, CircleGeometry, Fog, RepeatWrapping, SRGBColorSpace, BackSide, DoubleSide } from 'three';

// 「天空船塢」世界：機台立在懸空木甲板上，四周是霧中層層退後的蒸氣龐克城市剪影。
// 全部以程式產生（無額外下載）。尺寸都以機台半徑 r 為單位。淺色模式專用：暖金偏橘的朦朧空氣感。
const HORIZON = '#ecd3a6';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** One wrap-around skyline strip on a transparent canvas: towers, domes, spires, arches, a few airships. */
function skylineTexture(seed, color, { windows = false, airships = 0, tall = 1, repeat = 4 } = {}) {
  const w = 2048, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), rand = rng(seed); g.fillStyle = color;
  for (let x = 0; x < w;) {
    const bw = 28 + rand() * 90, bh = (70 + rand() * 260) * tall, top = h - bh, kind = rand();
    g.fillRect(x, top, bw, bh);
    if (kind < .3) { g.beginPath(); g.ellipse(x + bw / 2, top, bw * .42, bw * .42, 0, Math.PI, 0); g.fill(); g.fillRect(x + bw / 2 - 2, top - bw * .42 - 40, 4, 40); }
    else if (kind < .55) { g.beginPath(); g.moveTo(x + bw * .15, top); g.lineTo(x + bw / 2, top - bw * 1.4); g.lineTo(x + bw * .85, top); g.fill(); }
    else if (kind < .75) { for (let i = 0; i < 4; i++) g.fillRect(x + i * bw / 4, top - 10, bw / 8, 10); }
    else { g.fillRect(x + bw * .3, top - 60, bw * .4, 60); g.beginPath(); g.arc(x + bw / 2, top - 60, bw * .2, Math.PI, 0); g.fill(); }
    if (windows) {
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let y = top + 18; y < h - 30; y += 34) for (let wx = x + 8; wx < x + bw - 12; wx += 16) if (rand() < .55) { g.beginPath(); g.moveTo(wx, y + 14); g.lineTo(wx, y + 5); g.arc(wx + 4, y + 5, 4, Math.PI, 0); g.lineTo(wx + 8, y + 14); g.fill(); }
      g.restore();
    }
    x += bw + rand() * 18;
  }
  for (let i = 0; i < airships; i++) {
    const ax = rand() * w, ay = 60 + rand() * 120, s = 24 + rand() * 30;
    g.beginPath(); g.ellipse(ax, ay, s * 2, s * .7, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(ax - s * .6, ay + s * .6, s * 1.2, s * .45); g.fillRect(ax + s * 1.6, ay - s * .5, s * .5, s);
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = RepeatWrapping; t.repeat.set(repeat, 1); t.anisotropy = 4; return t;
}

/** Deck boards with nail marks, radially mapped onto the platform disc. */
function deckTexture() {
  const size = 1024, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), rand = rng(7), board = size / 16;
  for (let i = 0; i < 16; i++) {
    const tone = 92 + rand() * 26; g.fillStyle = `rgb(${tone + 34},${tone + 4},${tone - 30})`; g.fillRect(0, i * board, size, board);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(60,38,20,${.05 + rand() * .08})`; g.fillRect(rand() * size, i * board + rand() * board, 40 + rand() * 160, 1 + rand() * 2); }
    g.fillStyle = '#3b2a1c'; g.fillRect(0, i * board, size, 3);
    for (let x = rand() * 200; x < size; x += 180 + rand() * 200) { g.fillRect(x, i * board, 3, board); g.fillStyle = '#2a2622'; g.fillRect(x + 8, i * board + board * .3, 4, 4); g.fillRect(x + 8, i * board + board * .65, 4, 4); g.fillStyle = '#3b2a1c'; }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t;
}

export default function SkyDockWorld({ r, floor, shadows = true }) {
  const { scene } = useThree();
  const layers = useMemo(() => [
    { radius: r * 9, height: r * 1.7, color: '#9a7446', seed: 11, windows: true, tall: 1, repeat: 5, base: .55 },
    { radius: r * 15, height: r * 2.6, color: '#c49a62', seed: 23, airships: 2, tall: 1.2, repeat: 6, base: .95 },
    { radius: r * 24, height: r * 4, color: '#dfbf8c', seed: 37, airships: 3, tall: 1.4, repeat: 7, base: 1.5 },
  ].map(l => ({ ...l, texture: skylineTexture(l.seed, l.color, l), geometry: new CylinderGeometry(l.radius, l.radius, l.height, 96, 1, true) })), [r]);
  const deck = useMemo(() => ({ texture: deckTexture(), top: new CircleGeometry(r * 1.7, 96) }), [r]);
  useEffect(() => {
    // Fog in the horizon colour pushes the skyline back (atmospheric perspective).
    const previous = scene.fog; scene.fog = new Fog(HORIZON, r * 3, r * 26);
    return () => { scene.fog = previous; };
  }, [scene, r]);
  useEffect(() => () => { for (const l of layers) { l.texture.dispose(); l.geometry.dispose(); } deck.texture.dispose(); deck.top.dispose(); }, [layers, deck]);
  const posts = 28, deckR = r * 1.7;
  return <group>
    <hemisphereLight args={['#ffe0b0', '#8a6a44', .6]} />
    <directionalLight position={[-r * 3, r * 2.2, r * 1.5]} intensity={1} color="#ffc27a" />
    {/* Floating dock: plank deck, brass rim, low railing and a tapering hull underneath. */}
    <mesh geometry={deck.top} rotation={[-Math.PI / 2, 0, 0]} position={[0, floor, 0]} receiveShadow={shadows}>
      <meshStandardMaterial map={deck.texture} roughness={.85} metalness={.05} />
    </mesh>
    <mesh position={[0, floor - r * .04, 0]} receiveShadow={shadows}><cylinderGeometry args={[deckR, deckR, r * .08, 96, 1, true]} /><meshStandardMaterial color="#b58a3c" metalness={.75} roughness={.35} side={DoubleSide} /></mesh>
    <mesh position={[0, floor - r * .5, 0]}><cylinderGeometry args={[deckR * .98, deckR * .35, r * .9, 48]} /><meshStandardMaterial color="#4a3a2c" metalness={.3} roughness={.7} /></mesh>
    <mesh position={[0, floor - r * 1.05, 0]}><cylinderGeometry args={[deckR * .35, deckR * .12, r * .3, 32]} /><meshStandardMaterial color="#b58a3c" metalness={.8} roughness={.3} /></mesh>
    {Array.from({ length: posts }, (_, i) => { const a = i / posts * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * deckR * .97, floor + r * .12, Math.sin(a) * deckR * .97]}><cylinderGeometry args={[r * .012, r * .012, r * .24, 8]} /><meshStandardMaterial color="#2f2a24" metalness={.6} roughness={.4} /></mesh>; })}
    <mesh position={[0, floor + r * .24, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[deckR * .97, r * .012, 8, 128]} /><meshStandardMaterial color="#b58a3c" metalness={.8} roughness={.3} /></mesh>
    {/* Skyline rings, viewed from inside; far rings sit lower so their tops read as distant. */}
    {layers.map((l, i) => <mesh key={i} geometry={l.geometry} position={[0, floor - r * l.base + l.height / 2, 0]} renderOrder={-10 - i}>
      <meshBasicMaterial map={l.texture} transparent alphaTest={.02} side={BackSide} fog depthWrite={false} />
    </mesh>)}
  </group>;
}
