// 由工具實際幾何投影到 XZ 平面，產生貼合輪廓的凹槽外框（柵格化 → 膨脹 → 輪廓追蹤 → 簡化 → 平滑）
import * as THREE from 'three';

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export function silhouetteOutline(object, { res = 0.004, margin = 0.012 } = {}) {
  object.updateWorldMatrix(true, true);
  const tris = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(object);
  object.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
      tris.push(a.x, a.z, b.x, b.z, c.x, c.z);
    }
  });
  const pad = margin + res * 3;
  const minX = box.min.x - pad, minZ = box.min.z - pad;
  const W = Math.ceil((box.max.x - box.min.x + pad * 2) / res) + 1;
  const H = Math.ceil((box.max.z - box.min.z + pad * 2) / res) + 1;
  const grid = new Uint8Array(W * H);

  // 三角形柵格化（以格心做重心測試）
  for (let t = 0; t < tris.length; t += 6) {
    const x0 = (tris[t] - minX) / res, y0 = (tris[t + 1] - minZ) / res;
    const x1 = (tris[t + 2] - minX) / res, y1 = (tris[t + 3] - minZ) / res;
    const x2 = (tris[t + 4] - minX) / res, y2 = (tris[t + 5] - minZ) / res;
    const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    const bx0 = Math.max(0, Math.floor(Math.min(x0, x1, x2))), bx1 = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const by0 = Math.max(0, Math.floor(Math.min(y0, y1, y2))), by1 = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (Math.abs(d) < 1e-9) { // 退化三角形：直接標記端點
      grid[Math.round(y0) * W + Math.round(x0)] = 1; continue;
    }
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / d;
      const l2 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / d;
      if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) grid[y * W + x] = 1;
    }
  }
  // 圓形膨脹
  const r = Math.ceil(margin / res);
  const dil = new Uint8Array(W * H);
  const offs = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) offs.push(dx, dy);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!grid[y * W + x]) continue;
    for (let k = 0; k < offs.length; k += 2) {
      const nx = x + offs[k], ny = y + offs[k + 1];
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) dil[ny * W + nx] = 1;
    }
  }
  // 連通元件標記：成組工具（如 3 支銼刀）可能產生多個獨立凹槽
  const label = new Int32Array(W * H);
  let comps = 0;
  const queue = [];
  for (let i = 0; i < W * H; i++) {
    if (!dil[i] || label[i]) continue;
    comps++;
    label[i] = comps; queue.length = 0; queue.push(i);
    while (queue.length) {
      const k = queue.pop();
      const x = k % W, y = (k - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (dil[n] && !label[n]) { label[n] = comps; queue.push(n); }
      }
    }
  }
  const outlines = [];
  for (let c = 1; c <= comps; c++) {
    const filled = (x, y) => x >= 0 && y >= 0 && x < W && y < H && label[y * W + x] === c;
    let sx = -1, sy = -1;
    outer: for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (filled(x, y)) { sx = x; sy = y; break outer; }
    const contour = [[sx, sy]];
    let cx = sx, cy = sy, bx = sx - 1, by = sy;
    for (let step = 0; step < W * H * 2; step++) {
      const di = DIRS.findIndex(([dx, dy]) => dx === bx - cx && dy === by - cy);
      let moved = false;
      for (let k = 1; k <= 8; k++) {
        const j = (di + k) % 8;
        const nx = cx + DIRS[j][0], ny = cy + DIRS[j][1];
        if (filled(nx, ny)) {
          const pj = (j + 7) % 8;
          bx = cx + DIRS[pj][0]; by = cy + DIRS[pj][1];
          cx = nx; cy = ny; moved = true; break;
        }
      }
      if (!moved) break;
      if (cx === sx && cy === sy) break;
      contour.push([cx, cy]);
    }
    if (contour.length < 8) continue;
    let pts = contour.map(([x, y]) => new THREE.Vector2(minX + (x + 0.5) * res, minZ + (y + 0.5) * res));
    pts = simplify(pts, res * 0.9);
    pts = chaikin(pts, 2);
    outlines.push(pts);
  }
  return outlines;
}

function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    const A = pts[s], B = pts[e];
    const L = A.distanceTo(B) || 1e-9;
    for (let i = s + 1; i < e; i++) {
      const P = pts[i];
      const d = Math.abs((B.x - A.x) * (A.y - P.y) - (A.x - P.x) * (B.y - A.y)) / L;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function chaikin(pts, iterations) {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push(a.clone().lerp(b, 0.25), a.clone().lerp(b, 0.75));
    }
    p = out;
  }
  return p;
}
