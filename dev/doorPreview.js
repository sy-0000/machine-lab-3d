// 拱形防爆鋼門的 3D 預覽（只在 npm run dev 時使用：http://localhost:5173/dev/door-preview.html；不進網站建置）。
// 照 unity/MachineYard/Assets/Scripts/Runtime/ArchedBlastDoor.cs 的尺寸與零件重建：門洞半寬、拱腳高度、門扇厚 12 cm、
// 加強橫條與鉚釘、黃銅手輪、7 支門栓、鉸鏈筒、門框；開門時間軸與 VaultDoorController 相同（手輪 0–1.5 s、門栓 1.5–2.1 s、門 2.1–4.0 s 轉 100°）。
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1c1714');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 60);
camera.position.set(1.6, 1.6, 3.6);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.4, 0); controls.update();

scene.add(new THREE.HemisphereLight('#ffe2b8', '#3b2a20', 0.6));
const lamp = new THREE.PointLight('#ffc27a', 18, 9); lamp.position.set(-1.6, 3.0, 1.6); lamp.castShadow = true; scene.add(lamp);
const fill = new THREE.PointLight('#ffd9a8', 8, 8); fill.position.set(2.2, 2.2, 2.4); scene.add(fill);

const M = {
  steel: new THREE.MeshStandardMaterial({ color: '#4d4a45', metalness: 0.8, roughness: 0.45 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2a2725', metalness: 0.75, roughness: 0.5 }),
  brass: new THREE.MeshStandardMaterial({ color: '#b88c4d', metalness: 0.9, roughness: 0.32 }),
  black: new THREE.MeshBasicMaterial({ color: '#000' }),
  brick: new THREE.MeshStandardMaterial({ color: '#8a4a32', roughness: 0.9 }),
  floor: new THREE.MeshStandardMaterial({ color: '#5a5048', roughness: 0.85 }),
};
// 牆與地板（牆在門的正面後方）
const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), M.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const arch = (hw, sp, bottom) => { const s = new THREE.Shape(); s.moveTo(-hw, bottom); s.lineTo(-hw, sp); s.absarc(0, sp, hw, Math.PI, 0, true); s.lineTo(hw, bottom); s.lineTo(-hw, bottom); return s; };
const slab = (shape, z0, z1, mat) => { const g = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, z0); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m; };
const box = (parent, w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
const cyl = (parent, r, len, pos, dir, mat, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat); m.position.copy(pos); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); m.castShadow = true; parent.add(m); return m; };

let door = null;
function build(spec) {
  if (door) { scene.remove(door.root); }
  const { hw, sp, zf, fw, frame, wheelY, wheelR, bottom, wall } = spec;
  const root = new THREE.Group(); scene.add(root);
  // 牆（門洞挖空）
  const w = new THREE.Shape(); w.moveTo(-5, 0); w.lineTo(5, 0); w.lineTo(5, wall); w.lineTo(-5, wall); w.lineTo(-5, 0);
  w.holes.push(Object.assign(new THREE.Path(), { curves: arch(hw, sp, 0).curves }));
  root.add(slab(w, -0.4, 0, M.brick));
  const thick = 0.12;
  root.add(slab(arch(hw, sp, 0), zf - thick - 0.03, zf - thick - 0.02, M.black));       // 門洞後的黑面
  if (frame) { const f = arch(hw + fw, sp, 0); f.holes.push(Object.assign(new THREE.Path(), { curves: arch(hw, sp, 0).curves })); root.add(slab(f, zf - thick - 0.05, zf + 0.04, M.dark)); }
  const hinge = new THREE.Group(); hinge.position.set(-hw, 0, zf - thick / 2); root.add(hinge);
  const leaf = new THREE.Group(); leaf.position.set(hw, 0, -(zf - thick / 2)); hinge.add(leaf);
  const g = 0.012; leaf.add(slab(arch(hw - g, sp, Math.max(g, bottom)), zf - thick, zf, M.steel));
  for (const y of [0.35, sp * 0.62, sp + hw * 0.55]) {
    const half = y <= sp ? hw - 0.08 : Math.sqrt(Math.max(0.01, (hw - 0.08) ** 2 - (y - sp) ** 2));
    box(leaf, half * 2, 0.09, 0.02, 0, y, zf + 0.01, M.dark);
    for (let k = -3; k <= 3; k++) cyl(leaf, 0.015, 0.016, new THREE.Vector3(k * half / 3.4, y, zf + 0.025), new THREE.Vector3(0, 0, 1), M.brass, 8);
  }
  const wheel = new THREE.Group(); wheel.position.set(0, wheelY, zf + 0.09); leaf.add(wheel);
  { const rim = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.0225, 10, 48), M.brass); rim.castShadow = true; wheel.add(rim); }
  for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; cyl(wheel, 0.015, wheelR * 2, new THREE.Vector3(), new THREE.Vector3(Math.cos(a), Math.sin(a), 0), M.brass); }
  cyl(wheel, 0.06, 0.08, new THREE.Vector3(), new THREE.Vector3(0, 0, 1), M.dark, 16);
  cyl(leaf, 0.03, 0.09, new THREE.Vector3(0, wheelY, zf + 0.045), new THREE.Vector3(0, 0, 1), M.dark);
  const bolts = [];
  const bolt = (ex, ey, ix, iy) => { const p = new THREE.Vector3(ex - ix * 0.06, ey - iy * 0.06, zf - thick / 2); const m = cyl(leaf, 0.035, 0.22, p, new THREE.Vector3(ix, iy, 0), M.brass); bolts.push({ m, start: p.clone(), dir: new THREE.Vector3(ix, iy, 0) }); };
  for (const y of [0.45, sp * 0.5 + 0.2, sp - 0.15]) bolt(hw - g, y, -1, 0);
  for (const deg of [20, 55, 90, 125]) { const a = deg * Math.PI / 180, nx = Math.cos(a), ny = Math.sin(a); bolt(nx * (hw - g), sp + ny * (hw - g), -nx, -ny); }
  for (const y of [0.5, sp * 0.55 + 0.3, sp + 0.2]) cyl(root, 0.045, 0.24, new THREE.Vector3(-hw - 0.02, y, zf - thick / 2), new THREE.Vector3(0, 1, 0), M.dark);
  // 玄關的壓力錶與指示燈（與匯出的 VaultDoor 相同位置）
  if (spec.gauges) {
    for (const x of [-1.95, 1.95]) { cyl(root, 0.2, 0.08, new THREE.Vector3(x, 1.5, 0.08), new THREE.Vector3(0, 0, 1), M.brass, 24); const face = new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), new THREE.MeshStandardMaterial({ color: '#efe6cc' })); face.position.set(x, 1.5, 0.125); root.add(face); }
    box(root, 0.36, 0.36, 0.08, 0, 3.09, 0.06, M.dark);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff3b24' })); bulb.position.set(0, 3.09, 0.16); root.add(bulb);
  }
  door = { root, hinge, wheel, bolts, t: -1, dir: 1 };
}
const VEST = { hw: 1.2, sp: 1.45, zf: 0.22, fw: 0.22, frame: true, wheelY: 1.3, wheelR: 0.32, bottom: 0.012, wall: 4.2, gauges: true };
const SHOP = { hw: 1.11, sp: 2.5, zf: 0.12, fw: 0.3, frame: true, wheelY: 1.3, wheelR: 0.32, bottom: 0.09, wall: 4.4, gauges: false };
build(VEST);

// 蒸汽（門栓收回時）
const steamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const puffs = [];
function steam(pos) { for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.6 })); s.position.copy(pos); s.scale.setScalar(0.08); s.userData = { v: new THREE.Vector3((Math.random() - .5) * .4, .4 + Math.random() * .4, .3 + Math.random() * .3), life: 0 }; scene.add(s); puffs.push(s); } }

const ease = t => t * t * (3 - 2 * t);
let boltsSteamed = false;
function play(dir) { door.dir = dir; door.t = 0; boltsSteamed = false; }
document.getElementById('open').onclick = () => play(1);
document.getElementById('close').onclick = () => play(-1);
const tab = (spec, on, off) => { build(spec); on.classList.add('on'); off.classList.remove('on'); };
document.getElementById('vest').onclick = e => tab(VEST, e.target, document.getElementById('shop'));
document.getElementById('shop').onclick = e => tab(SHOP, e.target, document.getElementById('vest'));
window.__door = { play, setTime: t => { door.dir = 1; door.t = t; } };

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (door.t >= 0) {
    door.t += dt; const t = door.t;
    // 開門：手輪 0–1.5 s、門栓 1.5–2.1 s、門 2.1–4.0 s；關門：門 1.2 s → 門栓 0.5 s → 手輪 0.8 s
    if (door.dir > 0) {
      door.wheel.rotation.z -= dt * Math.min(1, t / 0.6) * 5;
      const kb = t > 1.5 ? ease(Math.min(1, (t - 1.5) / 0.6)) : 0;
      for (const b of door.bolts) b.m.position.copy(b.start).addScaledVector(b.dir, 0.18 * kb);
      if (t > 1.5 && !boltsSteamed) { boltsSteamed = true; for (const b of door.bolts) steam(b.m.getWorldPosition(new THREE.Vector3())); }
      door.hinge.rotation.y = t > 2.1 ? -ease(Math.min(1, (t - 2.1) / 1.9)) * 100 * Math.PI / 180 : 0;
      if (t > 4.2) door.t = -1;
    } else {
      door.hinge.rotation.y = -ease(Math.max(0, 1 - t / 1.2)) * 100 * Math.PI / 180;
      const kb = t < 1.2 ? 1 : ease(Math.max(0, 1 - (t - 1.2) / 0.5));
      for (const b of door.bolts) b.m.position.copy(b.start).addScaledVector(b.dir, 0.18 * kb);
      if (t > 1.7) door.wheel.rotation.z += dt * 5;
      if (t > 2.5) door.t = -1;
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) { const s = puffs[i]; s.userData.life += dt; s.position.addScaledVector(s.userData.v, dt); s.scale.setScalar(0.08 + s.userData.life * 0.35); s.material.opacity = Math.max(0, 0.6 - s.userData.life * 0.4); if (s.userData.life > 1.5) { scene.remove(s); puffs.splice(i, 1); } }
  controls.update(); renderer.render(scene, camera);
});
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
