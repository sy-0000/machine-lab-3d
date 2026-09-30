// 程序化貼圖：木紋、工作台（刀痕/燒痕/油漬）、磚牆、皮革、金屬刮痕、黃銅氧化、紅銅銅綠
import * as THREE from 'three';
import { fbm, valueNoise, rng } from './noise.js';

export function makeCanvas(w, h = w) {
  // 在背景執行緒（Web Worker）裡沒有 document，改用 OffscreenCanvas
  if (typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTexture(canvas, { srgb = false, repeat = [1, 1], anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  // 背景烘焙好的 ImageBitmap 已經上下翻轉過（WebGL 上傳 ImageBitmap 時不理會 flipY）
  if (typeof ImageBitmap !== 'undefined' && canvas instanceof ImageBitmap) t.flipY = false;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

const lerp = (a, b, t) => a + (b - a) * t;
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

function pixelPass(size, fn, h = size) {
  const c = makeCanvas(size, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b, a = 255] = fn(x / size, y / h, x, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- 木紋 ----
export function woodCanvases(size, { dark = 0x2a170c, light = 0x6b4226, rings = 9, seed = 3 } = {}) {
  const D = hex(dark), L = hex(light);
  const grainAt = (u, v) => {
    const warp = fbm(u * 3, v * 1.5, 4, seed, 3) * 2.2;
    const g = 0.5 + 0.5 * Math.sin((v * rings + warp) * Math.PI * 2);
    const fiber = valueNoise(u * 6, v * size * 0.35, seed + 9);
    return Math.pow(g, 1.6) * 0.75 + fiber * 0.25;
  };
  const color = pixelPass(size, (u, v) => {
    const g = grainAt(u, v);
    const blot = fbm(u * 5, v * 5, 3, seed + 4, 5);
    const k = g * (0.75 + blot * 0.5);
    return [lerp(D[0], L[0], k), lerp(D[1], L[1], k), lerp(D[2], L[2], k)];
  });
  const rough = pixelPass(size, (u, v) => {
    const r = 170 + grainAt(u, v) * 50;
    return [r, r, r];
  });
  return { color, rough };
}

// ---- 工作台：木板 + 刀痕 + 燒痕 + 油漬 ----
export function workbenchCanvases(size) {
  const { color, rough } = woodCanvases(size, { dark: 0x2e1c10, light: 0x5e3f27, rings: 9, seed: 11 });
  const cc = color.getContext('2d');
  const rc = rough.getContext('2d');
  const R = rng(42);
  // 木板接縫
  for (let i = 1; i < 5; i++) {
    const y = (i / 5) * size + (R() - 0.5) * 6;
    cc.fillStyle = 'rgba(15,8,3,0.85)'; cc.fillRect(0, y - 1.5, size, 3);
    rc.fillStyle = 'rgb(240,240,240)'; rc.fillRect(0, y - 1.5, size, 3);
  }
  // 刀痕
  for (let i = 0; i < 90; i++) {
    const x = R() * size, y = R() * size, len = (0.02 + R() * 0.08) * size, a = (R() - 0.5) * 1.2 + (R() < 0.5 ? 0 : Math.PI / 2);
    cc.strokeStyle = `rgba(20,10,4,${0.25 + R() * 0.4})`; cc.lineWidth = 0.6 + R() * 1.2;
    cc.beginPath(); cc.moveTo(x, y); cc.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); cc.stroke();
    cc.strokeStyle = `rgba(190,150,110,${0.12 + R() * 0.15})`; cc.lineWidth = 0.5;
    cc.beginPath(); cc.moveTo(x + 1, y + 1); cc.lineTo(x + 1 + Math.cos(a) * len, y + 1 + Math.sin(a) * len); cc.stroke();
    rc.strokeStyle = 'rgba(255,255,255,0.6)'; rc.lineWidth = 1;
    rc.beginPath(); rc.moveTo(x, y); rc.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); rc.stroke();
  }
  // 燒痕
  for (let i = 0; i < 6; i++) {
    const x = R() * size, y = R() * size, r = (0.02 + R() * 0.05) * size;
    const g = cc.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(8,4,2,0.95)'); g.addColorStop(0.45, 'rgba(25,12,5,0.7)'); g.addColorStop(1, 'rgba(40,20,8,0)');
    cc.fillStyle = g; cc.beginPath(); cc.ellipse(x, y, r, r * (0.6 + R() * 0.5), R() * 3, 0, Math.PI * 2); cc.fill();
  }
  // 油漬（較暗、較光滑）
  for (let i = 0; i < 9; i++) {
    const x = R() * size, y = R() * size, r = (0.03 + R() * 0.08) * size;
    for (let k = 0; k < 5; k++) {
      const ox = x + (R() - 0.5) * r, oy = y + (R() - 0.5) * r, rr = r * (0.3 + R() * 0.6);
      const g = cc.createRadialGradient(ox, oy, 0, ox, oy, rr);
      g.addColorStop(0, 'rgba(12,8,4,0.45)'); g.addColorStop(1, 'rgba(12,8,4,0)');
      cc.fillStyle = g; cc.beginPath(); cc.arc(ox, oy, rr, 0, Math.PI * 2); cc.fill();
      const gr = rc.createRadialGradient(ox, oy, 0, ox, oy, rr);
      gr.addColorStop(0, 'rgba(60,60,60,0.8)'); gr.addColorStop(1, 'rgba(60,60,60,0)');
      rc.fillStyle = gr; rc.beginPath(); rc.arc(ox, oy, rr, 0, Math.PI * 2); rc.fill();
    }
  }
  return { color, rough };
}

// ---- 磚牆 ----
export function brickCanvases(size) {
  const rows = 8, cols = 4;
  const bh = size / rows, bw = size / cols, mortar = size * 0.012;
  const R = rng(5);
  const tints = [];
  for (let i = 0; i < rows * cols * 2; i++) tints.push(0.7 + R() * 0.45);
  const brickAt = (x, y) => {
    const row = Math.floor(y / bh);
    const off = (row % 2) * bw * 0.5;
    const xx = (x + off) % size;
    const col = Math.floor(xx / bw);
    const lx = xx - col * bw, ly = y - row * bh;
    const edge = Math.min(lx, bw - lx, ly, bh - ly);
    return { edge, id: row * cols + col };
  };
  const color = pixelPass(size, (u, v, x, y) => {
    const { edge, id } = brickAt(x, y);
    const n = fbm(u * 16, v * 16, 4, 21, 16);
    if (edge < mortar) { const m = 45 + n * 30; return [m, m * 0.95, m * 0.9]; }
    const t = tints[id % tints.length] * (0.75 + n * 0.5);
    const soot = fbm(u * 3, v * 3, 3, 8, 3);
    const s = 1 - Math.max(0, soot - 0.45) * 1.2;
    return [92 * t * s, 42 * t * s, 30 * t * s];
  });
  const bump = pixelPass(size, (u, v, x, y) => {
    const { edge } = brickAt(x, y);
    const n = fbm(u * 24, v * 24, 3, 3, 24);
    const b = edge < mortar ? 20 : Math.min(255, 150 + Math.min(edge - mortar, 4) * 20 + n * 60);
    return [b, b, b];
  });
  return { color, bump };
}

// ---- 皮革 ----
export function leatherCanvases(size, base = 0x4a2a16) {
  const B = hex(base);
  const pebble = (u, v) => {
    const a = valueNoise(u * 90, v * 90, 3), b = valueNoise(u * 180, v * 180, 4);
    return Math.pow(a, 1.5) * 0.7 + b * 0.3;
  };
  const color = pixelPass(size, (u, v) => {
    const p = pebble(u, v);
    const wear = fbm(u * 4, v * 4, 4, 13, 4);
    const k = 0.7 + p * 0.3 + Math.max(0, wear - 0.55) * 0.9;
    return [B[0] * k, B[1] * k, B[2] * k];
  });
  const bump = pixelPass(size, (u, v) => { const p = pebble(u, v) * 255; return [p, p, p]; });
  return { color, bump };
}

// ---- 金屬刮痕粗糙度（中灰基底 + 亮/暗細線）----
export function scratchRoughCanvas(size, base = 0.35, seed = 9, density = 1) {
  const c = pixelPass(size, (u, v) => {
    const n = fbm(u * 6, v * 6, 4, seed, 6);
    const r = Math.max(0, Math.min(1, base + (n - 0.5) * 0.25)) * 255;
    return [r, r, r];
  });
  const ctx = c.getContext('2d');
  const R = rng(seed * 13);
  const count = Math.floor(260 * density);
  for (let i = 0; i < count; i++) {
    const x = R() * size, y = R() * size, len = (0.02 + R() * 0.15) * size;
    const a = R() < 0.6 ? (R() - 0.5) * 0.5 : R() * Math.PI;
    const bright = R() < 0.65;
    ctx.strokeStyle = bright ? `rgba(255,255,255,${0.15 + R() * 0.35})` : `rgba(0,0,0,${0.15 + R() * 0.3})`;
    ctx.lineWidth = 0.4 + R() * 0.9;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + (R() - 0.5) * 6, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return c;
}

// ---- 黃銅：輕度氧化斑 ----
export function brassColorCanvas(size, base = 0xc49a45, tarnish = 0x5e4a22, seed = 2) {
  const B = hex(base), T = hex(tarnish);
  return pixelPass(size, (u, v) => {
    const n = fbm(u * 5, v * 5, 5, seed, 5);
    const k = Math.max(0, Math.min(1, (n - 0.42) * 2.2));
    const speck = valueNoise(u * 120, v * 120, seed + 3) > 0.93 ? 0.35 : 0;
    const t = Math.min(1, k * 0.75 + speck);
    return [lerp(B[0], T[0], t), lerp(B[1], T[1], t), lerp(B[2], T[2], t)];
  });
}

// ---- 紅銅：銅綠（color / metalness / roughness）----
export function copperPatinaCanvases(size, seed = 6, amount = 0.5) {
  const C = hex(0xb86a3e), Dk = hex(0x5a2c18), P = hex(0x3f7a66), P2 = hex(0x285446);
  const patinaAt = (u, v) => {
    const n = fbm(u * 4, v * 4, 5, seed, 4);
    const fine = valueNoise(u * 60, v * 60, seed + 1);
    return Math.max(0, Math.min(1, (n + fine * 0.15 - (1 - amount) * 0.75) * 3));
  };
  const color = pixelPass(size, (u, v) => {
    const p = patinaAt(u, v);
    const dk = fbm(u * 9, v * 9, 3, seed + 5, 9);
    const cu = [lerp(C[0], Dk[0], dk * 0.6), lerp(C[1], Dk[1], dk * 0.6), lerp(C[2], Dk[2], dk * 0.6)];
    const pa = [lerp(P[0], P2[0], dk), lerp(P[1], P2[1], dk), lerp(P[2], P2[2], dk)];
    return [lerp(cu[0], pa[0], p), lerp(cu[1], pa[1], p), lerp(cu[2], pa[2], p)];
  });
  const metal = pixelPass(size, (u, v) => { const m = (1 - patinaAt(u, v)) * 255; return [m, m, m]; });
  const rough = pixelPass(size, (u, v) => { const r = (0.32 + patinaAt(u, v) * 0.55) * 255; return [r, r, r]; });
  return { color, metal, rough };
}

// ---- 鑄鐵 ----
export function castIronCanvases(size, seed = 17) {
  const color = pixelPass(size, (u, v) => {
    const n = fbm(u * 10, v * 10, 5, seed, 10);
    const rust = Math.max(0, fbm(u * 4, v * 4, 4, seed + 2, 4) - 0.6) * 2.4;
    const g = 48 + n * 30;
    return [lerp(g, 96, rust), lerp(g, 52, rust), lerp(g * 1.02, 30, rust)];
  });
  const rough = pixelPass(size, (u, v) => { const r = (0.55 + fbm(u * 14, v * 14, 3, seed + 1, 14) * 0.3) * 255; return [r, r, r]; });
  return { color, rough };
}

// ---- 絨布纖維 ----
export function velvetCanvas(size, seed = 31) {
  return pixelPass(size, (u, v) => {
    const n = fbm(u * 12, v * 12, 4, seed, 12) * 0.6 + valueNoise(u * 200, v * 200, seed) * 0.4;
    const r = 150 + n * 105;
    return [r, r, r];
  });
}

// 握把磨亮：沿 v 方向的粗糙度帶（中段光滑）
export function gripRoughCanvas(size, from = 0.2, to = 0.75, base = 0.72, polished = 0.3) {
  return pixelPass(size, (u, v) => {
    const inBand = Math.min(1, Math.max(0, Math.min(v - from, to - v) * 12));
    const n = valueNoise(u * 30, v * 60, 4) * 0.08;
    const r = (lerp(base, polished, inBand) + n) * 255;
    return [r, r, r];
  }, 64);
}

// 銼刀齒紋：雙向斜交叉細紋（凹凸 + 粗糙度）
export function fileTeethCanvas(size = 256) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
  const draw = (angle, gap, alpha) => {
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(angle);
    for (let x = -size; x < size; x += gap) {
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = gap * 0.35;
      ctx.beginPath(); ctx.moveTo(x, -size); ctx.lineTo(x, size); ctx.stroke();
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`; ctx.lineWidth = gap * 0.3;
      ctx.beginPath(); ctx.moveTo(x + gap * 0.5, -size); ctx.lineTo(x + gap * 0.5, size); ctx.stroke();
    }
    ctx.restore();
  };
  draw(0.45, 6, 0.55); draw(-0.95, 8, 0.35);
  return c;
}

// 滾花菱形紋
export function knurlCanvas(size = 256) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  const n = 16, s = size / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const cx = i * s + s / 2, cy = j * s + s / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.6);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#222');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx, cy - s / 2); ctx.lineTo(cx + s / 2, cy); ctx.lineTo(cx, cy + s / 2); ctx.lineTo(cx - s / 2, cy); ctx.closePath(); ctx.fill();
  }
  return c;
}

// 沖孔網板透明度（側護片）
export function perforatedCanvas(size = 256, holes = 10) {
  const c = makeCanvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  const s = size / holes;
  for (let j = 0; j < holes; j++) for (let i = 0; i < holes; i++) {
    ctx.beginPath(); ctx.arc(i * s + s / 2 + (j % 2) * s / 2, j * s + s / 2, s * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

// ---- 預先烘焙（src/prewarm）----
// 程序化貼圖每次產生的結果都一樣，但逐像素計算會卡住主執行緒好幾秒。網站會先在背景執行緒（Web Worker）
// 用同一套函式畫好，交回 ImageBitmap；之後以相同參數呼叫時直接取用，沒有烘焙好的才在這裡現算。
const prebaked = new Map();
let recording = null, depth = 0;
/** 放入背景烘焙的結果（鍵 = 函式名稱 + 參數 JSON） */
export function setPrebaked(entries) { for (const [key, value] of entries) prebaked.set(key, value); }
/** 背景執行緒用：記錄 fn() 期間最外層呼叫的貼圖，回傳 Map(鍵 → 畫布) */
export function recordGenerated(fn) {
  recording = new Map();
  try { fn(); return recording; } finally { recording = null; }
}
const bakeable = (name, generate) => (...args) => {
  const key = name + JSON.stringify(args);
  if (prebaked.has(key)) return prebaked.get(key);
  depth++;
  try {
    const out = generate(...args);
    if (recording && depth === 1) recording.set(key, out);
    return out;
  } finally { depth--; }
};
// 模組內的函式宣告可以重新指定：匯出的名稱從此都經過 bakeable（呼叫端不需修改）
woodCanvases = bakeable('woodCanvases', woodCanvases);
workbenchCanvases = bakeable('workbenchCanvases', workbenchCanvases);
brickCanvases = bakeable('brickCanvases', brickCanvases);
leatherCanvases = bakeable('leatherCanvases', leatherCanvases);
scratchRoughCanvas = bakeable('scratchRoughCanvas', scratchRoughCanvas);
brassColorCanvas = bakeable('brassColorCanvas', brassColorCanvas);
copperPatinaCanvases = bakeable('copperPatinaCanvases', copperPatinaCanvases);
castIronCanvases = bakeable('castIronCanvases', castIronCanvases);
velvetCanvas = bakeable('velvetCanvas', velvetCanvas);
gripRoughCanvas = bakeable('gripRoughCanvas', gripRoughCanvas);
fileTeethCanvas = bakeable('fileTeethCanvas', fileTeethCanvas);
knurlCanvas = bakeable('knurlCanvas', knurlCanvas);
perforatedCanvas = bakeable('perforatedCanvas', perforatedCanvas);
