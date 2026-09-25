import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { AdditiveBlending, BackSide, CanvasTexture, CatmullRomCurve3, DoubleSide, ExtrudeGeometry, Fog, MeshStandardMaterial, Path, RepeatWrapping, Shape, SpriteMaterial, SRGBColorSpace, TextureLoader, Vector3 } from 'three';

// 「穹頂工作室」世界（淺色模式）：磚牆圓廳、水泥地、鑄鐵肋骨撐起的玻璃大穹頂。
// 牆邊有蒸氣鍋爐、落地擺鐘、工作臺與轉動的牆面齒輪；鍋爐與地面通風口冒蒸氣，空中飄著被天光照亮的灰塵。
// 幾何與材質貼圖都以程式產生；只有地球儀、望遠鏡與兩幅掛畫用 public/scenery/ 的圖片。
// 尺寸都以機台半徑 r 為單位：房間半徑 6r、牆高 2.6r，穹頂坐在牆頂上。

const ROOM = 6, WALL = 2.6;
const HAZE = '#a4846a';
const rng = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const sceneryUrl = name => `${import.meta.env.BASE_URL}scenery/${name}.webp`;
const PICTURES = ['globe', 'telescope', 'gear-panel', 'wall-clock'];

// ---------- Procedural textures ----------

function canvasTexture(w, h, draw, { repeat = [1, 1], color = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c); if (color) t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; return t;
}

/** Old red brick, 8 bricks across and 16 courses per tile, soot speckles. */
function drawBrick(g, w, h) {
  const rand = rng(5), bw = w / 8, bh = h / 16;
  g.fillStyle = '#5b5047'; g.fillRect(0, 0, w, h);
  const tones = [[138, 70, 48], [120, 58, 40], [152, 88, 60], [104, 52, 38], [132, 80, 62], [96, 60, 48]];
  for (let row = 0; row < 16; row++) for (let i = -1; i < 9; i++) {
    const x = i * bw + (row % 2) * bw / 2, y = row * bh, [cr, cg, cb] = tones[Math.floor(rand() * tones.length)], v = (rand() - .5) * 24;
    g.fillStyle = `rgb(${cr + v},${cg + v * .7},${cb + v * .5})`; g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(20,10,5,${rand() * .18})`; g.fillRect(x + 3 + rand() * (bw - 10), y + 3 + rand() * (bh - 8), 2 + rand() * 6, 1 + rand() * 3); }
    g.fillStyle = 'rgba(255,230,200,.08)'; g.fillRect(x + 3, y + 3, bw - 6, 2);
  }
}

/** Worn concrete: mottled grey, oil stains, hairline cracks, expansion joints on the tile edges. */
function drawConcrete(g, w, h) {
  const rand = rng(9);
  g.fillStyle = '#8c8780'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { const v = 110 + rand() * 50; g.fillStyle = `rgba(${v},${v - 4},${v - 10},.12)`; g.beginPath(); g.arc(rand() * w, rand() * h, 8 + rand() * 60, 0, Math.PI * 2); g.fill(); }
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - .5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 7; i++) { const x = rand() * w, y = rand() * h, rr = 30 + rand() * 90, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(40,30,20,.35)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  g.strokeStyle = 'rgba(40,36,32,.45)'; g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) { let x = rand() * w, y = rand() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { x += (rand() - .5) * 40; y += (rand() - .5) * 40; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(50,44,38,.6)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
}

/** Dome glass: two columns by eight rows of warm, slightly uneven panes in dark iron glazing bars. */
function drawGlass(g, w, h) {
  const rand = rng(21), cols = 2, rows = 8, bar = 7;
  g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h);
  for (let c = 0; c < cols; c++) for (let rI = 0; rI < rows; rI++) {
    const x = c * w / cols, y = rI * h / rows, k = rI / rows, v = rand() * .1;
    const gr = g.createLinearGradient(x, y, x + w / cols, y + h / rows);
    gr.addColorStop(0, `rgb(${Math.round(250 - k * 40 - v * 200)},${Math.round(226 - k * 20 - v * 200)},${Math.round(180 + k * 30 - v * 150)})`);
    gr.addColorStop(1, `rgb(${Math.round(222 - k * 40)},${Math.round(206 - k * 20)},${Math.round(176 + k * 30)})`);
    g.fillStyle = gr; g.fillRect(x + bar, y + bar, w / cols - bar * 2, h / rows - bar * 2);
    if (rand() < .25) { g.fillStyle = 'rgba(60,50,40,.25)'; g.fillRect(x + bar, y + bar, w / cols - bar * 2, h / rows - bar * 2); }
  }
}

/** Arched window, glowing amber panes; transparent outside the arch. */
function drawWindow(g, w, h) {
  const arch = w / 2;
  g.beginPath(); g.moveTo(0, h); g.lineTo(0, arch); g.arc(w / 2, arch, w / 2, Math.PI, 0); g.lineTo(w, h); g.closePath(); g.save(); g.clip();
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe7b8'); gr.addColorStop(1, '#f0a860'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2b2622'; g.lineWidth = 10;
  for (let x = w / 4; x < w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = arch; y < h; y += h / 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.beginPath(); g.arc(w / 2, arch, w * .22, Math.PI, 0); g.stroke();
  g.restore(); g.strokeStyle = '#3a302a'; g.lineWidth = 18;
  g.beginPath(); g.moveTo(9, h); g.lineTo(9, arch); g.arc(w / 2, arch, w / 2 - 9, Math.PI, 0); g.lineTo(w - 9, h); g.stroke();
}

/** Dial: cream face, brass rim, minute ticks, Roman numerals. `gauge` draws a pressure gauge instead. */
function drawDial(g, w, h, gauge = false) {
  const c = w / 2, R = w / 2 - 4;
  g.fillStyle = '#b8903e'; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#efe4c8'; g.beginPath(); g.arc(c, c, R * .9, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#2a2018'; g.fillStyle = '#2a2018';
  if (gauge) {
    for (let i = 0; i <= 40; i++) { const a = Math.PI * .75 + i / 40 * Math.PI * 1.5, l = i % 5 ? .08 : .15; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .82, c + Math.sin(a) * R * .82); g.lineTo(c + Math.cos(a) * R * (.82 - l), c + Math.sin(a) * R * (.82 - l)); g.stroke(); }
    g.strokeStyle = '#b3261e'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, R * .78, Math.PI * 1.95, Math.PI * 2.25); g.stroke();
    g.strokeStyle = '#1a1410'; g.lineWidth = 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(Math.PI * 1.7) * R * .7, c + Math.sin(Math.PI * 1.7) * R * .7); g.stroke();
  } else {
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, l = i % 5 ? .05 : .1; g.lineWidth = i % 5 ? 2 : 5; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .86, c + Math.sin(a) * R * .86); g.lineTo(c + Math.cos(a) * R * (.86 - l), c + Math.sin(a) * R * (.86 - l)); g.stroke(); }
    const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.font = `bold ${Math.round(R * .15)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    roman.forEach((t, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(t, c + Math.cos(a) * R * .64, c + Math.sin(a) * R * .64); });
    g.lineCap = 'round'; g.lineWidth = 10; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(-Math.PI * .33) * R * .38, c + Math.sin(-Math.PI * .33) * R * .38); g.stroke();
    g.lineWidth = 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(Math.PI * .72) * R * .6, c + Math.sin(Math.PI * .72) * R * .6); g.stroke();
  }
  g.fillStyle = '#b8903e'; g.beginPath(); g.arc(c, c, R * .06, 0, Math.PI * 2); g.fill();
}

function drawWood(g, w, h) {
  const rand = rng(33); g.fillStyle = '#6b4526'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${40 + rand() * 40},${20 + rand() * 20},${8},${.12 + rand() * .15})`; g.fillRect(0, y, w, 1 + rand() * 2); }
  for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(30,15,5,.3)'; g.lineWidth = 2; g.beginPath(); g.ellipse(rand() * w, rand() * h, 8 + rand() * 20, 3 + rand() * 5, 0, 0, Math.PI * 2); g.stroke(); }
}

/** Soft white puff (steam, dust). */
function drawPuff(g, w) {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
}

/** Light shaft: bright at the top, fading to nothing at the floor (used additively). */
function drawShaft(g, w, h) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.6, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

// ---------- Shared materials ----------

function useMaterials() {
  const m = useMemo(() => {
    const wood = canvasTexture(256, 256, drawWood);
    return {
      woodMap: wood,
      copper: new MeshStandardMaterial({ color: '#b8703f', metalness: .85, roughness: .32 }),
      brass: new MeshStandardMaterial({ color: '#c9a04c', metalness: .9, roughness: .28 }),
      iron: new MeshStandardMaterial({ color: '#3a3633', metalness: .7, roughness: .55 }),
      darkIron: new MeshStandardMaterial({ color: '#23201e', metalness: .6, roughness: .6 }),
      wood: new MeshStandardMaterial({ map: wood, color: '#c79a70', roughness: .75 }),
      glow: new MeshStandardMaterial({ color: '#ffb060', emissive: '#ff8a30', emissiveIntensity: 2.2 }),
      bulb: new MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffd690', emissiveIntensity: 3 }),
    };
  }, []);
  useEffect(() => () => { for (const v of Object.values(m)) v.dispose?.(); }, [m]);
  return m;
}

// ---------- Gears ----------

function gearGeometry(teeth, radius, depth) {
  const s = new Shape(), root = radius * .84, da = Math.PI * 2 / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * da;
    [[root, a], [radius, a + da * .12], [radius, a + da * .38], [root, a + da * .5]].forEach(([rr, aa], k) => {
      const x = Math.cos(aa) * rr, y = Math.sin(aa) * rr; if (!i && !k) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hub = new Path(); hub.absarc(0, 0, radius * .16, 0, Math.PI * 2, true); s.holes.push(hub);
  const n = teeth > 14 ? 6 : 4;
  for (let i = 0; i < n; i++) { const a = (i + .5) / n * Math.PI * 2, c = radius * .52, w = new Path(); w.absarc(Math.cos(a) * c, Math.sin(a) * c, radius * (n > 4 ? .15 : .19), 0, Math.PI * 2, true); s.holes.push(w); }
  const g = new ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * .15, bevelSize: depth * .12, bevelSegments: 1, curveSegments: 10 });
  g.center(); return g;
}

/** A gear turning about its own axis (local z). speed: radians per second. */
function Gear({ teeth = 16, radius, depth, material, speed = 0, animate, ...props }) {
  const geometry = useMemo(() => gearGeometry(teeth, radius, depth), [teeth, radius, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const ref = useRef();
  useFrame((_, dt) => { if (animate && speed && ref.current) ref.current.rotation.z += speed * dt; });
  return <group {...props}><mesh ref={ref} geometry={geometry} material={material} castShadow receiveShadow /></group>;
}

// ---------- Particles ----------

/** Steam: soft sprites that rise, spread and fade in a loop. Positions are relative to the emitter. */
function Steam({ position, r, sprite, seed = 1, count = 30, rise = 1.4, spread = .35, size = .6, period = 3.2, opacity = .5, animate }) {
  const group = useRef();
  const puffs = useMemo(() => { const rand = rng(seed * 131 + count); return Array.from({ length: count }, (_, i) => ({ phase: i / count, dx: rand() - .5, dz: rand() - .5, mat: new SpriteMaterial({ map: sprite, color: '#f3ece4', transparent: true, depthWrite: false, opacity: 0, rotation: rand() * Math.PI * 2 }) })); }, [sprite, count, seed]);
  useEffect(() => () => puffs.forEach(p => p.mat.dispose()), [puffs]);
  const place = t => group.current?.children.forEach((s, i) => {
    const p = puffs[i], life = ((t / period) + p.phase) % 1, sc = r * size * (.35 + life * 1.6);
    s.position.set(p.dx * spread * r * life * 2, life * rise * r, p.dz * spread * r * life * 2);
    s.scale.set(sc, sc, 1); p.mat.opacity = Math.sin(Math.PI * life) * opacity;
  });
  useEffect(() => place(0));
  useFrame(({ clock }) => { if (animate) place(clock.elapsedTime); });
  return <group ref={group} position={position}>{puffs.map((p, i) => <sprite key={i} material={p.mat} />)}</group>;
}

/** Dust motes drifting in the skylight. */
function Dust({ r, floor, sprite, animate, count = 700 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const rand = rng(77), a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { const ang = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * ROOM * .85; a.set([Math.cos(ang) * d, floor + rand() * r * WALL * 1.5, Math.sin(ang) * d], i * 3); }
    return a;
  }, [r, floor, count]);
  useFrame(({ clock }, dt) => { if (!animate || !ref.current) return; ref.current.rotation.y += dt * .015; ref.current.position.y = Math.sin(clock.elapsedTime * .3) * r * .05; });
  return <points ref={ref}>
    <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
    <pointsMaterial map={sprite} size={r * .035} color="#ffd9a4" transparent opacity={.55} blending={AdditiveBlending} depthWrite={false} sizeAttenuation />
  </points>;
}

// ---------- Props ----------

/** Horizontal copper boiler on an iron firebox, chimney to the dome, pressure gauge, safety valve with steam. */
function Boiler({ r, mats, gaugeTex, sprite, animate, ...props }) {
  const len = r * 2.2, rad = r * .6, cy = r * .7 + rad, fire = useRef();
  useFrame(({ clock }) => { if (animate && fire.current) fire.current.intensity = 2.6 + Math.sin(clock.elapsedTime * 13) * .4 + Math.sin(clock.elapsedTime * 7.3) * .5; });
  const pipe = useMemo(() => new CatmullRomCurve3([new Vector3(-len * .45, cy, 0), new Vector3(-len * .7, cy, 0), new Vector3(-len * .75, cy - r * .3, 0), new Vector3(-len * .75, r * .1, r * .2)]), [len, cy, r]);
  const rivets = [];
  for (const x of [-len * .36, -len * .12, len * .12, len * .36]) for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; rivets.push([x, cy + Math.sin(a) * rad * 1.04, Math.cos(a) * rad * 1.04]); }
  return <group {...props}>
    <mesh position={[0, r * .35, 0]} material={mats.darkIron} castShadow receiveShadow><boxGeometry args={[len * .92, r * .7, rad * 2.05]} /></mesh>
    <mesh position={[len * .22, r * .34, rad * 1.03]} material={mats.glow}><planeGeometry args={[r * .42, r * .3]} /></mesh>
    <pointLight ref={fire} position={[len * .22, r * .35, rad * 1.5]} color="#ff7a2a" intensity={2.8} distance={r * 4} decay={2} />
    <mesh position={[0, cy, 0]} rotation={[0, 0, Math.PI / 2]} material={mats.copper} castShadow receiveShadow><cylinderGeometry args={[rad, rad, len, 48]} /></mesh>
    {[-1, 1].map(s => <mesh key={s} position={[s * len / 2, cy, 0]} scale={[.35, 1, 1]} material={mats.copper} castShadow><sphereGeometry args={[rad, 32, 16]} /></mesh>)}
    {[-.36, -.12, .12, .36].map(x => <mesh key={x} position={[x * len, cy, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.brass}><torusGeometry args={[rad * 1.01, r * .03, 8, 48]} /></mesh>)}
    {rivets.map((p, i) => <mesh key={i} position={p} material={mats.brass}><sphereGeometry args={[r * .018, 6, 4]} /></mesh>)}
    <mesh position={[-len * .1, cy + rad + r * .12, 0]} material={mats.copper} castShadow><cylinderGeometry args={[r * .2, r * .24, r * .3, 24]} /></mesh>
    <mesh position={[-len * .1, cy + rad + r * .27, 0]} material={mats.copper}><sphereGeometry args={[r * .2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
    <mesh position={[len * .32, cy + rad + r * .12, 0]} material={mats.brass}><cylinderGeometry args={[r * .05, r * .07, r * .3, 12]} /></mesh>
    <Steam position={new Vector3(len * .32, cy + rad + r * .3, 0)} r={r} sprite={sprite} animate={animate} rise={1.6} size={.45} />
    {/* Chimney up into the dome */}
    <mesh position={[len * .05, cy + r * 2.2, 0]} material={mats.iron} castShadow><cylinderGeometry args={[r * .16, r * .19, r * 4, 20]} /></mesh>
    {[1.2, 2.2, 3.2].map(y => <mesh key={y} position={[len * .05, cy + y * r, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><torusGeometry args={[r * .185, r * .025, 6, 24]} /></mesh>)}
    {/* Gauge on the front end */}
    <group position={[len / 2 + rad * .36, cy + rad * .3, 0]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[r * .2, r * .2, r * .08, 32]} /></mesh>
      <mesh position={[0, 0, r * .041]}><circleGeometry args={[r * .18, 32]} /><meshStandardMaterial map={gaugeTex} roughness={.4} /></mesh>
    </group>
    <mesh material={mats.copper} castShadow><tubeGeometry args={[pipe, 32, r * .07, 10]} /></mesh>
  </group>;
}

/** Longcase clock with a swinging pendulum behind glass. */
function PendulumClock({ r, mats, faceTex, animate, ...props }) {
  const w = r * .78, h = r * 2.5, d = r * .44, pend = useRef();
  useFrame(({ clock }) => { if (animate && pend.current) pend.current.rotation.z = Math.sin(clock.elapsedTime * Math.PI) * .16; });
  return <group {...props}>
    <mesh position={[0, r * .15, 0]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[w * 1.15, r * .3, d * 1.15]} /></mesh>
    <mesh position={[0, h * .45, 0]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[w * .85, h * .6, d]} /></mesh>
    <mesh position={[0, h * .85, 0]} material={mats.wood} castShadow><boxGeometry args={[w, h * .25, d * 1.1]} /></mesh>
    <mesh position={[0, h * .975, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.wood} castShadow><cylinderGeometry args={[w / 2, w / 2, d * 1.1, 32, 1, false, -Math.PI / 2, Math.PI]} /></mesh>
    <mesh position={[0, h * 1.02 + w * .5, 0]} material={mats.brass}><sphereGeometry args={[r * .05, 12, 8]} /></mesh>
    <mesh position={[0, h * .85, d * .56]}><circleGeometry args={[w * .38, 48]} /><meshStandardMaterial map={faceTex} roughness={.45} /></mesh>
    <mesh position={[0, h * .85, d * .56]} material={mats.brass}><torusGeometry args={[w * .39, r * .025, 8, 48]} /></mesh>
    {/* Pendulum in a glazed trunk */}
    <mesh position={[0, h * .45, d * .505]} material={mats.darkIron}><planeGeometry args={[w * .55, h * .5]} /></mesh>
    <group ref={pend} position={[0, h * .7, d * .52]}>
      <mesh position={[0, -h * .2, 0]} material={mats.brass}><boxGeometry args={[r * .02, h * .4, r * .01]} /></mesh>
      <mesh position={[0, -h * .4, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[w * .15, w * .15, r * .03, 32]} /></mesh>
    </group>
    <mesh position={[0, h * .45, d * .54]}><planeGeometry args={[w * .55, h * .5]} /><meshStandardMaterial color="#d8e4e8" transparent opacity={.12} roughness={.05} metalness={.3} /></mesh>
  </group>;
}

/** Workbench with a vise, tools, loose gears, a lamp, a globe and a telescope. */
function Workbench({ r, mats, tex, animate, ...props }) {
  const w = r * 2.6, d = r * 1.05, top = r * .95;
  const loose = [[-.35, .12, 14, mats.brass], [-.18, .08, 10, mats.copper], [-.05, .15, 18, mats.brass], [.1, .06, 9, mats.iron], [.02, .1, 12, mats.copper]];
  return <group {...props}>
    <mesh position={[0, top, 0]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[w, r * .1, d]} /></mesh>
    {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => <mesh key={`${x}${z}`} position={[x * (w / 2 - r * .1), top / 2, z * (d / 2 - r * .1)]} material={mats.wood} castShadow><boxGeometry args={[r * .1, top, r * .1]} /></mesh>)}
    <mesh position={[0, r * .25, 0]} material={mats.wood} receiveShadow><boxGeometry args={[w * .92, r * .05, d * .85]} /></mesh>
    {/* Pegboard with a few hanging tools */}
    <mesh position={[0, top + r * .7, -d / 2 + r * .03]} material={mats.wood} receiveShadow><boxGeometry args={[w, r * 1.3, r * .05]} /></mesh>
    {[-.8, -.55, -.3, .55, .8].map((x, i) => <mesh key={x} position={[x * w / 2, top + r * (.8 + (i % 2) * .15), -d / 2 + r * .08]} material={i % 2 ? mats.iron : mats.brass} castShadow><boxGeometry args={[r * .05, r * (.35 + (i % 3) * .1), r * .03]} /></mesh>)}
    <Gear teeth={20} radius={r * .28} depth={r * .05} material={mats.brass} speed={.5} animate={animate} position={[w * .08, top + r * .82, -d / 2 + r * .1]} />
    <Gear teeth={12} radius={r * .17} depth={r * .05} material={mats.copper} speed={-.5 * 20 / 12} animate={animate} position={[w * .08 + r * .42, top + r * .92, -d / 2 + r * .1]} />
    {/* Vise */}
    <group position={[w * .38, top + r * .1, d * .25]}>
      <mesh material={mats.iron} castShadow><boxGeometry args={[r * .3, r * .12, r * .2]} /></mesh>
      <mesh position={[0, r * .1, 0]} material={mats.iron} castShadow><boxGeometry args={[r * .28, r * .1, r * .05]} /></mesh>
      <mesh position={[0, r * .05, r * .18]} rotation={[Math.PI / 2, 0, 0]} material={mats.brass}><cylinderGeometry args={[r * .015, r * .015, r * .3, 8]} /></mesh>
    </group>
    {/* Loose gears, hammer, oil can */}
    {loose.map(([x, rad, t, m], i) => <Gear key={i} teeth={t} radius={r * rad} depth={r * .03} material={m} position={[x * w, top + r * .07 + i * r * .002, d * (.2 - (i % 3) * .12)]} rotation={[-Math.PI / 2, 0, i]} />)}
    <group position={[-w * .05, top + r * .08, d * .35]} rotation={[0, .4, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={mats.wood} castShadow><cylinderGeometry args={[r * .025, r * .025, r * .45, 8]} /></mesh>
      <mesh position={[r * .22, 0, 0]} material={mats.iron} castShadow><boxGeometry args={[r * .06, r * .06, r * .18]} /></mesh>
    </group>
    <group position={[w * .22, top + r * .05, -d * .1]}>
      <mesh position={[0, r * .1, 0]} material={mats.copper} castShadow><cylinderGeometry args={[r * .08, r * .09, r * .2, 20]} /></mesh>
      <mesh position={[0, r * .26, 0]} material={mats.brass}><coneGeometry args={[r * .07, r * .12, 16]} /></mesh>
      <mesh position={[r * .04, r * .36, 0]} rotation={[0, 0, -.9]} material={mats.brass}><cylinderGeometry args={[r * .01, r * .015, r * .22, 8]} /></mesh>
    </group>
    {/* Lamp */}
    <group position={[-w * .42, top + r * .05, -d * .2]}>
      <mesh material={mats.iron}><cylinderGeometry args={[r * .1, r * .12, r * .04, 20]} /></mesh>
      <mesh position={[0, r * .3, 0]} material={mats.brass}><cylinderGeometry args={[r * .015, r * .015, r * .6, 8]} /></mesh>
      <mesh position={[r * .1, r * .6, 0]} rotation={[0, 0, -.6]} material={mats.brass}><coneGeometry args={[r * .12, r * .16, 20, 1, true]} /></mesh>
      <mesh position={[r * .12, r * .56, 0]} material={mats.bulb}><sphereGeometry args={[r * .04, 12, 8]} /></mesh>
      <pointLight position={[r * .15, r * .5, 0]} color="#ffc880" intensity={1.2} distance={r * 2.5} decay={2} />
    </group>
    <Billboard position={[-w * .22, top + r * .05 + r * .3, -d * .05]}><mesh><planeGeometry args={[r * .6 * tex.globe.image.width / tex.globe.image.height, r * .6]} /><meshStandardMaterial map={tex.globe} transparent alphaTest={.3} roughness={.6} /></mesh></Billboard>
    <Billboard position={[w * .6, r * .42, d * .1]}><mesh><planeGeometry args={[r * .85 * tex.telescope.image.width / tex.telescope.image.height, r * .85]} /><meshStandardMaterial map={tex.telescope} transparent alphaTest={.3} roughness={.5} /></mesh></Billboard>
  </group>;
}

/** Framed picture on the wall, facing the room centre. */
function Framed({ map, height, r, mats, ...props }) {
  const w = height * map.image.width / map.image.height;
  return <group {...props}>
    <mesh position={[0, 0, -r * .03]} material={mats.brass} castShadow><boxGeometry args={[w + r * .16, height + r * .16, r * .05]} /></mesh>
    <mesh><planeGeometry args={[w, height]} /><meshStandardMaterial map={map} roughness={.6} /></mesh>
  </group>;
}

/** Pendant lamp hanging from the dome ring. */
function Pendant({ r, mats, y, top, ...props }) {
  return <group {...props}>
    <mesh position={[0, (y + top) / 2, 0]} material={mats.darkIron}><cylinderGeometry args={[r * .01, r * .01, top - y, 6]} /></mesh>
    <mesh position={[0, y + r * .1, 0]} material={mats.brass}><coneGeometry args={[r * .22, r * .2, 24, 1, true]} /></mesh>
    <mesh position={[0, y, 0]} material={mats.bulb}><sphereGeometry args={[r * .06, 16, 8]} /></mesh>
    <pointLight position={[0, y - r * .1, 0]} color="#ffc27a" intensity={3} distance={r * 5} decay={2} />
  </group>;
}

/** Keeps the demand frameloop running while the room animates (gears, pendulum, steam, dust). */
function Ticker() { useFrame(state => state.invalidate()); return null; }

/** Place an object against the wall at angle `deg` (0 = +z), `inset` r from the wall, facing the centre. */
const onWall = (r, deg, inset, y = 0) => { const a = deg * Math.PI / 180, d = r * (ROOM - inset); return { position: [Math.sin(a) * d, y, Math.cos(a) * d], rotation: [0, a + Math.PI, 0] }; };

export default function WorkshopWorld({ r, floor, shadows = true, animate = true }) {
  const { scene } = useThree();
  const loaded = useLoader(TextureLoader, PICTURES.map(sceneryUrl));
  const tex = useMemo(() => Object.fromEntries(PICTURES.map((n, i) => { const t = loaded[i]; t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return [n, t]; })), [loaded]);
  const mats = useMaterials();
  const maps = useMemo(() => {
    const R = r * ROOM, H = r * WALL;
    return {
      brick: canvasTexture(1024, 512, drawBrick, { repeat: [Math.round(2 * Math.PI * R / (r * 2.2)), H / (r * 1.1)] }),
      concrete: canvasTexture(1024, 1024, drawConcrete, { repeat: [5, 5] }),
      glass: canvasTexture(256, 512, drawGlass, { repeat: [16, 1] }),
      window: canvasTexture(256, 512, drawWindow),
      clock: canvasTexture(512, 512, (g, w, h) => drawDial(g, w, h)),
      gauge: canvasTexture(256, 256, (g, w, h) => drawDial(g, w, h, true)),
      puff: canvasTexture(128, 128, drawPuff),
      shaft: canvasTexture(64, 256, drawShaft),
    };
  }, [r]);
  useEffect(() => () => { for (const t of Object.values(maps)) t.dispose(); }, [maps]);
  useEffect(() => {
    // Dusty indoor air: the far wall and the dome sit slightly back in a warm haze.
    const previous = { fog: scene.fog, background: scene.background };
    scene.fog = new Fog(HAZE, r * 5, r * 24); scene.background = null;
    return () => { scene.fog = previous.fog; scene.background = previous.background; };
  }, [scene, r]);

  const R = r * ROOM, H = r * WALL, pillars = 12;
  const f = y => floor + y;
  return <group>
    {animate && <Ticker />}
    {/* Floor, walls, cornice and iron pilasters */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floor, 0]} receiveShadow={shadows}><circleGeometry args={[R, 72]} /><meshStandardMaterial map={maps.concrete} roughness={.92} /></mesh>
    <mesh position={[0, f(H / 2), 0]} receiveShadow={shadows}><cylinderGeometry args={[R, R, H, 72, 1, true]} /><meshStandardMaterial map={maps.brick} bumpMap={maps.brick} bumpScale={1.5} roughness={.95} side={BackSide} /></mesh>
    <mesh position={[0, f(H), 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.iron}><torusGeometry args={[R * .995, r * .09, 8, 96]} /></mesh>
    <mesh position={[0, f(r * .12), 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.darkIron}><torusGeometry args={[R * .998, r * .12, 6, 96]} /></mesh>
    {Array.from({ length: pillars }, (_, i) => { const p = onWall(r, i * 360 / pillars, .08, f(H / 2)); return <mesh key={i} {...p} material={mats.iron} castShadow><boxGeometry args={[r * .22, H, r * .16]} /></mesh>; })}
    {/* Copper pipes running around the wall */}
    {[.78, .86].map(k => <mesh key={k} position={[0, f(H * k), 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.copper}><torusGeometry args={[R * .965, r * .05, 8, 96]} /></mesh>)}
    {/* Arched windows between the pilasters */}
    {[45, 105, 165, 285].map(deg => { const p = onWall(r, deg, .02, f(H * .55)); return <mesh key={deg} {...p}><planeGeometry args={[r * .9, r * 1.8]} /><meshBasicMaterial map={maps.window} transparent alphaTest={.1} fog={false} /></mesh>; })}
    {/* Glass dome on cast-iron ribs, oculus at the top */}
    <mesh position={[0, f(H), 0]}><sphereGeometry args={[R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial map={maps.glass} emissiveMap={maps.glass} emissive="#ffe2b8" emissiveIntensity={.85} roughness={.35} metalness={.2} side={BackSide} /></mesh>
    {Array.from({ length: 8 }, (_, i) => <mesh key={i} position={[0, f(H), 0]} rotation={[0, i * Math.PI / 8, 0]} material={mats.darkIron}><torusGeometry args={[R * .99, r * .06, 6, 64, Math.PI]} /></mesh>)}
    {[.35, .65, .88].map(k => { const a = k * Math.PI / 2; return <mesh key={k} position={[0, f(H + Math.sin(a) * R * .99), 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.darkIron}><torusGeometry args={[Math.cos(a) * R * .99, r * .05, 6, 64]} /></mesh>; })}
    {/* Light shafts from the dome */}
    {[[-.8, .5, .12], [1.2, -.6, -.1], [.2, 1.3, .06]].map(([x, z, tilt], i) => <mesh key={i} position={[x * r, f(H * 1.05), z * r]} rotation={[tilt, 0, -tilt]}>
      <cylinderGeometry args={[r * .45, r * 1.1, H * 2.1, 24, 1, true]} /><meshBasicMaterial map={maps.shaft} color="#ffd9a0" transparent opacity={.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} fog={false} />
    </mesh>)}
    {/* Pendant lamps */}
    {[[0, 1], [120, 1], [240, 1]].map(([deg]) => { const p = onWall(r, deg + 60, 2.2); return <Pendant key={deg} r={r} mats={mats} position={[p.position[0], 0, p.position[2]]} y={f(H * .95)} top={f(H + R * .5)} />; })}
    {/* Wall gears: a meshing train that turns slowly */}
    <group {...onWall(r, 225, .12, f(H * .5))}>
      <Gear teeth={28} radius={r * .75} depth={r * .1} material={mats.brass} speed={.25} animate={animate} position={[0, 0, 0]} />
      <Gear teeth={16} radius={r * .43} depth={r * .1} material={mats.copper} speed={-.25 * 28 / 16} animate={animate} position={[r * 1.1, r * .3, r * .02]} rotation={[0, 0, .1]} />
      <Gear teeth={12} radius={r * .32} depth={r * .1} material={mats.iron} speed={.25 * 28 / 12} animate={animate} position={[-r * .93, -r * .52, r * .02]} />
      <Gear teeth={20} radius={r * .5} depth={r * .08} material={mats.brass} speed={-.25 * 28 / 20} animate={animate} position={[-r * .6, r * 1.05, -r * .02]} />
    </group>
    {/* Machines of the workshop, against the wall behind the lathe */}
    <Boiler r={r} mats={mats} gaugeTex={maps.gauge} sprite={maps.puff} animate={animate} {...onWall(r, 190, 1.2, floor)} />
    <PendulumClock r={r} mats={mats} faceTex={maps.clock} animate={animate} {...onWall(r, 140, .35, floor)} />
    <Workbench r={r} mats={mats} tex={tex} animate={animate} {...onWall(r, 265, .75, floor)} />
    <Framed map={tex['gear-panel']} height={r * 1.1} r={r} mats={mats} {...onWall(r, 315, .1, f(H * .55))} />
    <Framed map={tex['wall-clock']} height={r * .9} r={r} mats={mats} {...onWall(r, 15, .1, f(H * .62))} />
    {/* Crates and barrels by the wall */}
    {[[330, .7, 0], [338, .6, 1], [60, .6, 2]].map(([deg, s, i]) => { const p = onWall(r, deg, .8, f(r * s / 2)); return <mesh key={deg} {...p} rotation={[0, p.rotation[1] + i * .4, 0]} material={mats.wood} castShadow receiveShadow><boxGeometry args={[r * s, r * s, r * s]} /></mesh>; })}
    {[75, 82].map((deg, i) => { const p = onWall(r, deg, .7, f(r * .45)); return <mesh key={deg} position={p.position} material={i ? mats.copper : mats.iron} castShadow receiveShadow><cylinderGeometry args={[r * .3, r * .3, r * .9, 24]} /></mesh>; })}
    {/* Floor vent with a lazy plume */}
    <mesh position={[r * 2.6, floor + r * .004, -r * 1.6]} rotation={[-Math.PI / 2, 0, 0]} material={mats.darkIron}><circleGeometry args={[r * .3, 24]} /></mesh>
    <Steam position={new Vector3(r * 2.6, floor, -r * 1.6)} r={r} sprite={maps.puff} seed={2} animate={animate} rise={2.4} spread={.5} size={.8} period={5} opacity={.3} count={18} />
    <Dust r={r} floor={floor} sprite={maps.puff} animate={animate} />
  </group>;
}
