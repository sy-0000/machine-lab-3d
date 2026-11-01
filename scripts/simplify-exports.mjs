// 產生減面版本（給 Quest 實機 fps 不夠時切換用）：node scripts/simplify-exports.mjs
// 對三角形最多的幾個 glb，用 meshoptimizer（@gltf-transform/functions simplify）各產生 50% 與 25% 兩個版本，
// 寫到 exports/lod/<名稱>_50.glb、_25.glb。節點結構與名稱完全不變（只動網格），所以機台的軸、手輪等節點照常能動。
// Unity：選單「Detail ▸ 50% / 25%」後重建場景即改用減面版本（找不到就用原檔）。
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { mkdirSync, statSync } from 'node:fs';

const TARGETS = ['workshop_static', 'workshop_interactive', 'toolbox_interactive', 'toolbox_static',
  'machine_lathe_static', 'machine_lathe_interactive', 'machine_milling_static', 'machine_milling_interactive', 'machine_drill_static', 'machine_drill_interactive'];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
mkdirSync('exports/lod', { recursive: true });
const tris = doc => { let t = 0; for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) { const i = p.getIndices(); t += Math.round((i ? i.getCount() : p.getAttribute('POSITION').getCount()) / 3); } } return t; };
console.log('| 檔案 | 原始三角形 | 50% | 25% |'); console.log('|---|---:|---:|---:|');
for (const name of TARGETS) {
  const row = [name];
  const base = await io.read(`exports/${name}.glb`); row.push(tris(base).toLocaleString('en'));
  for (const pct of [50, 25]) {
    const doc = await io.read(`exports/${name}.glb`);
    // error 是相對於每個網格大小的誤差上限：50% 用 0.5%、25% 用 2%（較激進，可能看得出稜角變少）。
    // 工作室的三角形多半分散在大量小零件（鉚釘、螺絲、欄杆），簡化效果有限，那部分改由 Unity 的 TinyDetailMeters 停用
    const error = pct === 50 ? 0.005 : 0.02;
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: pct / 100, error, lockBorder: false }), dedup(), prune({ keepLeaves: true, keepAttributes: true }));
    await io.write(`exports/lod/${name}_${pct}.glb`, doc);
    row.push(`${tris(doc).toLocaleString('en')}（${(statSync(`exports/lod/${name}_${pct}.glb`).size / 1048576).toFixed(1)} MB）`);
  }
  console.log(`| ${row.join(' | ')} |`);
}
