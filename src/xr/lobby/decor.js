// 玄關的「可選」裝飾（第一批，挑效能負擔小的）：掛衣架（皮圍裙、護目鏡）、角落儲氣罐（壓力錶、接管）、
// 木箱與油桶、牆面時鐘（指針跟著現在時間走）、機台藍圖、鐵柵排水蓋。
// 都是低多邊形、不加燈光；其餘可選項目（鞋櫃、洗手槽、活塞、傳動軸…）等 Quest 實機 FPS 確認後再加。
import { BoxGeometry, CircleGeometry, CylinderGeometry, ExtrudeGeometry, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Shape, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { add, group } from '../../vendor/steampunk-workshop/src/utils/geometry.js';
import { createGauge, setGaugeValue } from '../../vendor/steampunk-workshop/src/utils/fixtures.js';
import { createPipe } from '../../vendor/steampunk-workshop/src/utils/pipe.js';
import { createCrate, createBarrel } from '../../vendor/steampunk-workshop/src/assets/crates.js';
import { canvasTexture } from '../ui/canvasText.js';
import { VEST } from './exterior.js';

const { x: X, z0: Z0, z1: Z1 } = VEST;

// 入口左側：鐵製衣架，掛皮圍裙與護目鏡
function coatRack(M, root) {
  const g = group('CoatRack', root, [-X + 0.2, 0, Z1 - 0.55], [0, Math.PI / 2, 0]);
  add(g, new BoxGeometry(0.9, 0.05, 0.05), M.ironDark, 'Rail', [0, 1.75, 0]);
  for (const x of [-0.42, 0.42]) add(g, new BoxGeometry(0.04, 0.04, 0.18), M.ironDark, 'Bracket', [x, 1.75, -0.08]);
  for (const x of [-0.25, 0.05, 0.3]) add(g, new CylinderGeometry(0.012, 0.012, 0.1, 6), M.brass, 'Hook', [x, 1.7, 0.04], [Math.PI / 3, 0, 0]);
  const apron = new Shape();
  apron.moveTo(-0.13, 0); apron.lineTo(0.13, 0); apron.lineTo(0.2, -0.35); apron.lineTo(0.22, -0.95); apron.lineTo(-0.22, -0.95); apron.lineTo(-0.2, -0.35); apron.lineTo(-0.13, 0);
  const leather = new MeshStandardMaterial({ color: 0x6a4126, roughness: 0.75, metalness: 0.05 });
  add(g, new ExtrudeGeometry(apron, { depth: 0.012, bevelEnabled: false }), leather, 'LeatherApron', [-0.25, 1.66, 0.04]);
  add(g, new TorusGeometry(0.1, 0.008, 4, 16, Math.PI), leather, 'ApronStrap', [-0.25, 1.68, 0.05], [0, 0, 0]);
  // 護目鏡：兩個黃銅鏡框＋皮帶
  const goggles = group('Goggles', g, [0.3, 1.55, 0.06]);
  for (const x of [-0.045, 0.045]) {
    add(goggles, new TorusGeometry(0.035, 0.009, 6, 16), M.brass, 'Rim', [x, 0, 0]);
    add(goggles, new CircleGeometry(0.032, 16), M.glassAmber, 'Lens', [x, 0, 0.002]);
  }
  add(goggles, new TorusGeometry(0.07, 0.006, 4, 16, Math.PI), leather, 'Strap', [0, 0.02, -0.01], [0, 0, 0]);
}

// 東北角：儲氣罐＋壓力錶＋接到天花板銅管
function airTank(M, root) {
  const g = group('AirTank', root, [X - 0.48, 0, Z0 + 0.55]);
  add(g, new CylinderGeometry(0.32, 0.32, 1.3, 20), M.copper, 'Body', [0, 0.85, 0]);
  add(g, new SphereGeometry(0.32, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.copper, 'Top', [0, 1.5, 0]);
  add(g, new SphereGeometry(0.32, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.copper, 'Bottom', [0, 0.2, 0]);
  for (const y of [0.45, 1.25]) add(g, new TorusGeometry(0.325, 0.02, 6, 24), M.brassAged, 'Band', [0, y, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; add(g, new CylinderGeometry(0.025, 0.03, 0.2, 6), M.ironDark, 'Leg', [Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22]); }
  const gauge = createGauge(M, { radius: 0.09, depth: 0.05 });
  gauge.object.position.set(-0.2, 1.3, 0.26);
  gauge.object.rotation.y = -0.6;
  setGaugeValue(gauge.needle, 0.62);
  g.add(gauge.object);
  root.add(createPipe([new Vector3(X - 0.48, 1.82, Z0 + 0.55), new Vector3(X - 0.48, 3.95, Z0 + 0.55), new Vector3(X - 0.12, 3.95, Z0 + 0.55)], { radius: 0.035, material: M.copper, fittingMaterial: M.brass, name: 'TankPipe' }).object);
}

// 西北角：兩個木箱＋油桶（沿用工作室的木箱與木桶）
function crates(M, root) {
  const c1 = createCrate(M, { w: 0.7, h: 0.55, d: 0.55, seed: 21 });
  c1.object.position.set(-X + 0.6, 0, Z0 + 1.0);
  c1.object.rotation.y = 0.1;
  const c2 = createCrate(M, { w: 0.55, h: 0.45, d: 0.45, seed: 22 });
  c2.object.position.set(-X + 0.58, c1.height + 0.01, Z0 + 0.98);
  c2.object.rotation.y = -0.2;
  const drum = createBarrel(M);
  drum.object.position.set(-X + 0.75, 0, Z0 + 0.38);
  root.add(c1.object, c2.object, drum.object);
}

// 南牆（大門上方）：牆面時鐘
function wallClock(M, root) {
  const face = canvasTexture(256, 256), { ctx } = face;
  ctx.fillStyle = '#f2e6c8'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2610';
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 112 : 100;
    ctx.lineWidth = i % 5 ? 2 : 6;
    ctx.beginPath(); ctx.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); ctx.lineTo(128 + Math.sin(a) * 120, 128 - Math.cos(a) * 120); ctx.stroke();
  }
  face.texture.needsUpdate = true;
  const g = group('WallClock', root, [0, 3.88, Z1 - 0.04], [0, Math.PI, 0]);
  add(g, new CylinderGeometry(0.24, 0.24, 0.06, 32), M.brassAged, 'Case', [0, 0, -0.02], [Math.PI / 2, 0, 0]);
  add(g, new CircleGeometry(0.21, 32), new MeshBasicMaterial({ map: face.texture }), 'Face', [0, 0, 0.012]);
  const hand = (len, w, name) => { const h = group(name, g, [0, 0, 0.02]); add(h, new BoxGeometry(w, len, 0.006), M.ironDark, 'Blade', [0, len / 2 - 0.02, 0]); return h; };
  const hour = hand(0.11, 0.016, 'HourHand'), minute = hand(0.17, 0.01, 'MinuteHand');
  return {
    texture: face.texture,
    update() {
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      minute.rotation.z = -m / 60 * Math.PI * 2;
      hour.rotation.z = -h / 12 * Math.PI * 2;
    },
  };
}

// 右牆（放映幕南側）：機台藍圖（只有線條，不寫文字）
function blueprint(M, root) {
  const bp = canvasTexture(768, 512), { ctx } = bp;
  ctx.fillStyle = '#1d4f86'; ctx.fillRect(0, 0, 768, 512);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
  for (let x = 0; x < 768; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke(); }
  for (let y = 0; y < 512; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(768, y); ctx.stroke(); }
  ctx.strokeStyle = '#eaf3ff'; ctx.lineWidth = 4;
  ctx.strokeRect(70, 280, 620, 70); ctx.strokeRect(90, 150, 150, 130); ctx.strokeRect(520, 200, 120, 80); // 床身、主軸箱、尾座
  ctx.beginPath(); ctx.arc(300, 240, 40, 0, Math.PI * 2); ctx.stroke(); ctx.strokeRect(240, 225, 280, 30); // 夾頭、工件
  ctx.strokeRect(330, 260, 90, 30); ctx.strokeRect(110, 350, 40, 90); ctx.strokeRect(610, 350, 40, 90); // 刀座、腳座
  ctx.setLineDash([12, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(60, 240); ctx.lineTo(700, 240); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeRect(20, 20, 728, 472);
  bp.texture.needsUpdate = true;
  const g = group('Blueprint', root, [X - 0.03, 1.75, Z1 - 0.8], [0, -Math.PI / 2, 0]);
  add(g, new PlaneGeometry(0.84, 0.56), new MeshBasicMaterial({ map: bp.texture }), 'Sheet', [0, 0, 0.005]);
  for (const [x, y] of [[-0.39, 0.25], [0.39, 0.25], [-0.39, -0.25], [0.39, -0.25]]) add(g, new CylinderGeometry(0.012, 0.012, 0.012, 8), M.brass, 'Pin', [x, y, 0.012], [Math.PI / 2, 0, 0]);
  return bp.texture;
}

// 地面：鐵柵排水蓋
function drainGrate(M, root) {
  const g = group('DrainGrate', root, [0, 0.004, 13.15]);
  add(g, new BoxGeometry(0.5, 0.008, 0.5), M.castIron, 'Frame', [0, 0, 0]);
  add(g, new PlaneGeometry(0.42, 0.42), new MeshBasicMaterial({ color: 0x0a0806 }), 'Hole', [0, 0.005, 0], [-Math.PI / 2, 0, 0]);
  for (let i = -3; i <= 3; i++) add(g, new BoxGeometry(0.42, 0.012, 0.02), M.ironDark, 'Bar', [0, 0.008, i * 0.06]);
}

export function createDecor(M, root) {
  coatRack(M, root);
  airTank(M, root);
  crates(M, root);
  const clock = wallClock(M, root);
  const bpTexture = blueprint(M, root);
  drainGrate(M, root);
  return { update: () => clock.update(), textures: [clock.texture, bpTexture] };
}
