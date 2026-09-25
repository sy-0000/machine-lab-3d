// 將 assets-src/scenery/ 的蒸氣龐克素材去背，輸出成淺色場景用的透明 webp（public/scenery/）。
// 多數素材的「透明」棋盤格或白底是畫死在圖上的：從圖片邊緣 flood fill 掉接近邊框顏色的淺色像素，
// 再把遮罩邊緣收一圈並羽化，避免留下白邊。已有真透明度的圖只裁切與縮小。
// 用法：node scripts/cutout-scenery.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets-src/scenery', OUT = 'public/scenery';
// tolerance：與邊框背景色的最大距離（RGB 最大分量差）。
const ITEMS = [
  { src: 'clock.webp', out: 'clock.webp', tolerance: 10 },
  { src: 'airship.webp', out: 'airship.webp', tolerance: 6 },
  { src: 'airship-watercolor.png', out: 'airship-watercolor.webp', tolerance: 8 },
  { src: 'clock-tower.png', out: 'clock-tower.webp', tolerance: 8 },
  { src: 'kiosk.webp', out: 'kiosk.webp', tolerance: 8 },
  { src: 'manor.webp', out: 'manor.webp' },
  // Workshop props and framed wall pictures (no cutout; the panel's crop drops its stock-ID caption).
  { src: 'globe.webp', out: 'globe.webp', tolerance: 10 },
  { src: 'telescope.webp', out: 'telescope.webp', tolerance: 8, flatten: true }, // semi-transparent watermark → white, then islands
  { src: 'gear-panel.png', out: 'gear-panel.webp', trim: false, crop: { left: 0, top: 0, width: 474, height: 328 } },
  { src: 'wall-clock.png', out: 'wall-clock.webp', trim: false },
];

/** The few most common border colours: the baked-in background (white, or white + grey checkerboard). */
function borderColours(data, w, h, ch) {
  const count = new Map();
  const add = (x, y) => { const i = (y * w + x) * ch, k = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]; count.set(k, (count.get(k) || 0) + 1); };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  const total = 2 * (w + h);
  return [...count].filter(([, n]) => n > total * .05).map(([k]) => [k >> 16, (k >> 8) & 255, k & 255]);
}

/** 4-connected regions of pixels where `inside(p)` holds, as arrays of pixel indices. */
function regions(w, h, inside) {
  const n = w * h, seen = new Uint8Array(n), out = [];
  for (let s = 0; s < n; s++) {
    if (seen[s] || !inside(s)) continue;
    const region = [s], stack = [s]; seen[s] = 1;
    while (stack.length) {
      const p = stack.pop(), x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (q >= 0 && q < n && !seen[q] && inside(q)) { seen[q] = 1; region.push(q); stack.push(q); }
    }
    out.push(region);
  }
  return out;
}

async function cutout({ src, out, tolerance, trim = true, crop, flatten }) {
  let input = sharp(`${SRC}/${src}`);
  if (flatten) input = sharp(await input.flatten({ background: '#ffffff' }).toBuffer());
  if (crop) input = sharp(await input.extract(crop).toBuffer());
  const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, ch = 4, n = w * h;
  if (tolerance) {
    const bg = borderColours(data, w, h, ch);
    const isBg = p => { const i = p * ch; return bg.some(c => Math.max(Math.abs(data[i] - c[0]), Math.abs(data[i + 1] - c[1]), Math.abs(data[i + 2] - c[2])) <= tolerance); };
    const mask = new Uint8Array(n), stack = [];
    const seed = p => { if (!mask[p] && isBg(p)) { mask[p] = 1; stack.push(p); } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (stack.length) {
      const p = stack.pop(), x = p % w;
      if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (p >= w) seed(p - w); if (p < n - w) seed(p + w);
    }
    // Pockets of pure background colour enclosed by the subject (e.g. between pipes) are background too.
    const flat = p => { const i = p * ch; return bg.some(c => Math.max(Math.abs(data[i] - c[0]), Math.abs(data[i + 1] - c[1]), Math.abs(data[i + 2] - c[2])) <= 3); };
    for (const region of regions(w, h, p => !mask[p] && flat(p))) if (region.length > n * .0008) for (const p of region) mask[p] = 1;
    // Small islands left in the background (watermark letters, specks) are dropped.
    for (const region of regions(w, h, p => !mask[p])) if (region.length < n * .003) for (const p of region) mask[p] = 1;
    // Grow the background by one pixel (eats the light fringe), then soften the edge.
    const alpha = Buffer.alloc(n);
    for (let p = 0; p < n; p++) {
      const x = p % w; let bgNear = mask[p];
      if (!bgNear) bgNear = (x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (p >= w && mask[p - w]) || (p < n - w && mask[p + w]);
      alpha[p] = bgNear ? 0 : data[p * ch + 3];
    }
    const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } }).blur(.8).extractChannel(0).raw().toBuffer();
    for (let p = 0; p < n; p++) data[p * ch + 3] = soft[p];
  }
  const img = await sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer();
  const res = await (trim ? sharp(img).trim({ threshold: 1 }) : sharp(img)).resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 90 }).toFile(`${OUT}/${out}`);
  console.log(`${out}  ${res.width}x${res.height}  ${(res.size / 1024).toFixed(0)} KB`);
}

mkdirSync(OUT, { recursive: true });
for (const item of ITEMS) await cutout(item);
