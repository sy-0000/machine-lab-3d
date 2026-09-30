// 背景陳設：磚牆、牆上藍圖（圖釘固定）、暗色地面。刻意低調，只提供氛圍。
import * as THREE from 'three';
import { brickCanvases, makeCanvas, toTexture } from '../materials/textures.js';
import { mesh } from '../utils/geometry.js';

function blueprintTexture(kind) {
  const W = 1024, H = 768, c = makeCanvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1d4a72'); g.addColorStop(1, '#143654');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(200,225,255,0.12)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(225,240,255,0.85)'; ctx.fillStyle = 'rgba(225,240,255,0.85)'; ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  if (kind === 0) {
    // 齒輪組
    const gear = (cx, cy, r, teeth) => {
      ctx.beginPath();
      for (let i = 0; i <= teeth * 4; i++) {
        const a = (i / (teeth * 4)) * Math.PI * 2;
        const rr = i % 4 < 2 ? r : r * 0.86;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.25, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2); ctx.setLineDash([8, 6]); ctx.stroke(); ctx.setLineDash([]);
    };
    gear(380, 380, 180, 18); gear(640, 300, 110, 11); gear(760, 500, 70, 8);
  } else {
    // 鍋爐剖面
    ctx.beginPath(); ctx.roundRect(260, 200, 500, 320, 120); ctx.stroke();
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(340 + i * 70, 360, 22, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(760, 300); ctx.lineTo(880, 300); ctx.lineTo(880, 160); ctx.stroke();
    ctx.beginPath(); ctx.arc(880, 140, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(200, 560); ctx.lineTo(820, 560); ctx.stroke();
    for (let x = 200; x <= 820; x += 62) { ctx.beginPath(); ctx.moveTo(x, 550); ctx.lineTo(x, 570); ctx.stroke(); }
  }
  ctx.font = 'italic 34px Georgia, serif';
  ctx.fillText(kind === 0 ? 'Gear Train  No. 7' : 'Boiler Section  B-2', 60, H - 60);
  ctx.font = '22px Georgia, serif';
  ctx.fillText('scale 1 : 4', W - 200, H - 60);
  // 紙張摺痕與污漬
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(0,10,25,${Math.random() * 0.12})`;
    ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, 20 + Math.random() * 90, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  return toTexture(c, { srgb: true });
}

export function createBackdrop(mat, quality) {
  const g = new THREE.Group();
  g.name = 'Backdrop';
  const S = Math.min(quality.textureSize, 512);
  const brick = brickCanvases(S);
  const wallMat = new THREE.MeshStandardMaterial({
    map: toTexture(brick.color, { srgb: true, repeat: [4, 2.5] }),
    bumpMap: toTexture(brick.bump, { repeat: [4, 2.5] }), bumpScale: 2.5, roughness: 0.92,
  });
  const wall = mesh(new THREE.PlaneGeometry(9, 5.5), wallMat);
  wall.position.set(0, 1.4, -1.6);
  wall.name = 'Backdrop_BrickWall';
  g.add(wall);

  const floor = mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ color: 0x1a130e, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.15;
  g.add(floor);

  // 兩張藍圖
  [[-1.05, 1.35, 0.06, 0], [0.95, 1.55, -0.05, 1]].forEach(([x, y, rot, kind]) => {
    const bp = mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshStandardMaterial({ map: blueprintTexture(kind), roughness: 0.85 }));
    bp.position.set(x, y, -1.585);
    bp.rotation.z = rot;
    bp.name = 'Backdrop_Blueprint';
    g.add(bp);
    for (const [px, py] of [[-0.46, 0.34], [0.46, 0.34]]) {
      const pin = mesh(new THREE.SphereGeometry(0.018, 12, 8), mat.brassDark);
      const c = Math.cos(rot), s = Math.sin(rot);
      pin.position.set(x + px * c - py * s, y + px * s + py * c, -1.575);
      g.add(pin);
    }
  });
  return g;
}
