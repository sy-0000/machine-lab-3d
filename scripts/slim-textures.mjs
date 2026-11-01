// Quest 版貼圖瘦身：node scripts/slim-textures.mjs
// 匯出的 glb 裡的貼圖是未壓縮的 PNG（多半 2048²）。這裡把 exports/ 底下所有 glb（含 tools/、lod/）的貼圖：
//   · 縮到最長邊 ≤ 1024（Quest 3 雙眼各約 2064×2208，1 m 外的牆面 1024 已足夠；記憶體只剩 1/4）
//   · 不透明的貼圖轉 JPEG（品質 85；法線貼圖 92），有用到透明的保留 PNG
// 寫到 exports/quest/（目錄結構與檔名相同，runtime.json、manifest.json 一起複製），網格與節點完全不動。
// Unity：選單 2／2b 匯入時選 exports/quest 資料夾即可。
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const SRC = 'exports', OUT = 'exports/quest', MAX = Number(process.env.MAX || 1024);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); if (p === OUT) return []; return statSync(p).isDirectory() ? walk(p) : [p]; });
let before = 0, after = 0, texBefore = 0, texAfter = 0;
for (const file of walk(SRC)) {
  const rel = relative(SRC, file), dst = join(OUT, rel);
  mkdirSync(dirname(dst), { recursive: true });
  if (!file.endsWith('.glb')) { if (/\.json$/.test(file)) copyFileSync(file, dst); continue; }
  const doc = await io.read(file);
  // 哪些貼圖要保留透明：被 BLEND／MASK 材質當底色用的
  const keepAlpha = new Set(), normals = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getAlphaMode() !== 'OPAQUE' && m.getBaseColorTexture()) keepAlpha.add(m.getBaseColorTexture());
    if (m.getNormalTexture()) normals.add(m.getNormalTexture());
  }
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage(); if (!img) continue;
    texBefore += img.byteLength;
    let pipe = sharp(Buffer.from(img)); const meta = await pipe.metadata();
    if (Math.max(meta.width, meta.height) > MAX) pipe = pipe.resize({ width: meta.width >= meta.height ? MAX : null, height: meta.height > meta.width ? MAX : null });
    let out, mime;
    if (keepAlpha.has(tex) && meta.hasAlpha) { out = await pipe.png({ compressionLevel: 9 }).toBuffer(); mime = 'image/png'; }
    else { out = await pipe.flatten({ background: '#808080' }).jpeg({ quality: normals.has(tex) ? 92 : 85, mozjpeg: true }).toBuffer(); mime = 'image/jpeg'; }
    if (out.byteLength < img.byteLength || mime !== tex.getMimeType()) { tex.setImage(new Uint8Array(out)).setMimeType(mime); if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.\w+$/, mime === 'image/png' ? '.png' : '.jpg')); }
    texAfter += tex.getImage().byteLength;
  }
  await io.write(dst, doc);
  before += statSync(file).size; after += statSync(dst).size;
  console.log(`${rel.padEnd(42)} ${(statSync(file).size / 1048576).toFixed(1).padStart(6)} MB → ${(statSync(dst).size / 1048576).toFixed(1).padStart(5)} MB`);
}
console.log(`合計 ${(before / 1048576).toFixed(0)} MB → ${(after / 1048576).toFixed(0)} MB（貼圖 ${(texBefore / 1048576).toFixed(0)} → ${(texAfter / 1048576).toFixed(0)} MB；最長邊 ≤ ${MAX}）`);
