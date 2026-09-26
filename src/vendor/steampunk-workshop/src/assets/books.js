// Book helpers shared by the bookcase, shelving and reading corner: runs of varied leather-bound
// books (merged, vertex-coloured) and an open book with printed pages.
import * as THREE from 'three';
import { add, group, V } from '../utils/geometry.js';

export const BOOK_COLORS = [0x9a2e22, 0x3e6a44, 0x86582e, 0x31467a, 0xa8823e, 0x6a2c40, 0xb49070, 0x6a6a52, 0x44423c, 0x9a4a22, 0x2e5a5a].map(
  (c) => new THREE.Color(c),
);

// Fill a shelf segment [x0, x0+width] with standing books (spines toward +Z), occasional lying
// stacks and a leaning book at the end. `books` is a GeoBatch(keepColor), `trim` a GeoBatch for
// gilt spine bands. Returns the x where filling stopped.
export function addBookRun(books, trim, rand, { x0, width, y, backZ, maxH, maxD }) {
  let x = x0;
  const end = x0 + width;
  const q = new THREE.Quaternion();
  while (x < end - 0.03) {
    const color = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)].clone().multiplyScalar(0.85 + rand() * 0.5);
    if (rand() < 0.07 && end - x > 0.3) {
      // a small lying stack
      let yy = y;
      const n = 2 + Math.floor(rand() * 3);
      const w0 = Math.min(maxH, 0.22 + rand() * 0.1);
      for (let i = 0; i < n; i++) {
        const t = 0.03 + rand() * 0.035;
        const d = Math.min(maxD, 0.16 + rand() * 0.08);
        const c = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)].clone().multiplyScalar(0.8 + rand() * 0.4);
        q.setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.3, 0));
        books.add(new THREE.BoxGeometry(w0 - i * 0.012, t, d), new THREE.Matrix4().compose(V(x + w0 / 2, yy + t / 2, backZ + d / 2 + 0.02), q, V(1, 1, 1)), c);
        yy += t;
      }
      x += w0 + 0.02;
      continue;
    }
    const w = 0.022 + rand() * 0.055;
    const h = Math.min(maxH, 0.18 + rand() * 0.2);
    const d = Math.min(maxD, 0.14 + rand() * 0.12);
    const last = x + w > end - 0.07;
    const lean = last && rand() < 0.7 ? 0.18 + rand() * 0.2 : rand() < 0.04 ? 0.05 : 0;
    q.setFromEuler(new THREE.Euler(0, 0, -lean));
    const cx = x + w / 2 + Math.sin(lean) * h * 0.5;
    const cy = y + (h / 2) * Math.cos(lean) + (w / 2) * Math.sin(lean);
    const m = new THREE.Matrix4().compose(V(cx, cy, backZ + d / 2 + 0.01), q, V(1, 1, 1));
    books.add(new THREE.BoxGeometry(w, h, d), m, color);
    if (rand() < 0.55) {
      for (const f of [0.12, 0.82]) {
        const band = new THREE.Matrix4().compose(V(0, (f - 0.5) * h, d / 2 + 0.001), new THREE.Quaternion(), V(1, 1, 1));
        trim.add(new THREE.BoxGeometry(w * 0.92, 0.007, 0.002), m.clone().multiply(band));
      }
    }
    x += w + 0.0015;
    if (lean > 0.15) break;
  }
  return x;
}

// Open book lying on a surface: leather cover, two gently curved page blocks meeting at the gutter.
export function createOpenBook(M, { w = 0.34, d = 0.24 } = {}) {
  const g = group('OpenBook');
  const half = w / 2;
  add(g, new THREE.BoxGeometry(w + 0.012, 0.004, d + 0.012), M.leatherDark, 'Cover', [0, 0.002, 0]);
  for (const s of [-1, 1]) {
    add(g, new THREE.BoxGeometry(half - 0.01, 0.012, d - 0.004), M.paper, 'PageBlock', [s * (half / 2), 0.009, 0]);
    const geo = new THREE.PlaneGeometry(half - 0.006, d - 0.006, 12, 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (half - 0.006) / 2; // 0 at the gutter .. half at the fore-edge
      const t = x / (half - 0.006);
      pos.setX(i, s * x);
      pos.setY(i, 0.016 + Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * 0.012 - t * 0.004);
      uv.setX(i, s < 0 ? 0.5 - t * 0.5 : 0.5 + t * 0.5);
    }
    geo.computeVertexNormals();
    add(g, geo, M.bookPage, 'Pages').userData.noShadow = true;
  }
  add(g, new THREE.BoxGeometry(0.004, 0.0015, d * 0.9), M.leatherDark, 'Ribbon', [0.02, 0.029, 0.02], [0, 0.2, 0]).material = M.paintRed;
  return g;
}
