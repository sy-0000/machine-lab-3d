// 讀 exports/ 的 glb 與 manifest.json，用 gltf-transform 重新開檔獨立計算三角形與節點數，寫出 docs/export-report.md，
// 並把 manifest 存一份到 docs/export-manifest-example.json。用法：node scripts/export-report.mjs
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const dir = 'exports';
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const kb = n => (n / 1024).toFixed(0);

const rows = [];
let totalBytes = 0, totalTris = 0;
for (const f of manifest.files) {
  const path = `${dir}/${f.file}`;
  if (f.status !== 'ok' || !existsSync(path)) { rows.push({ f, missing: true }); continue; }
  const doc = await io.read(path);
  const root = doc.getRoot();
  let tris = 0;
  // 依節點實際引用的 mesh 計數（共用幾何的實例各算一次，與執行期相同）
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices(), pos = prim.getAttribute('POSITION');
      tris += Math.round((idx ? idx.getCount() : pos.getCount()) / 3);
    }
  }
  const bytes = statSync(path).size;
  totalBytes += bytes; totalTris += tris;
  rows.push({ f, bytes, tris, nodes: root.listNodes().length, meshes: root.listMeshes().length, materials: root.listMaterials().length, textures: root.listTextures().length });
}

const out = [];
out.push('# 匯出報告（無頭瀏覽器實際執行）', '');
out.push(`- 產生時間：${manifest.generatedAt}；three r${manifest.three}；工具 \`${manifest.tool}\``);
out.push('- 執行方式：`npm run dev` 後 `node scripts/export-headless.mjs`（等同在 `?area=lobby&nobatch#/world` 按 Shift+A），再用 `node scripts/export-report.mjs` 產生本報告。');
out.push('- 三角形與節點數是**重新讀檔**（gltf-transform）計算，不是匯出端自報；兩者不一致會標 ⚠。');
out.push('- glb 未壓縮（GLTFExporter 不做 meshopt/Draco），大小主要是 PNG 貼圖；同一張程序貼圖在不同檔案各存一份。', '');
out.push('| 檔案 | 大小 (KB) | 三角形 | 節點 | mesh | 材質 | 貼圖 | 狀態 |', '|---|---:|---:|---:|---:|---:|---:|---|');
for (const r of rows) {
  if (r.missing) { out.push(`| ${r.f.file} | – | – | – | – | – | – | ❌ ${r.f.status}${r.f.error ? '：' + r.f.error : ''}${r.f.note ? '：' + r.f.note : ''} |`); continue; }
  const flag = r.tris !== r.f.triangles ? ` ⚠ 匯出端記 ${r.f.triangles}` : '';
  out.push(`| ${r.f.file} | ${kb(r.bytes)} | ${r.tris.toLocaleString('en')} | ${r.nodes} | ${r.meshes} | ${r.materials} | ${r.textures} | ok${flag} |`);
}
out.push(`| **合計** | **${kb(totalBytes)}** | **${totalTris.toLocaleString('en')}** | | | | | ${rows.filter(r => !r.missing).length} 個檔案 |`, '');

const expected = ['exterior', 'vestibule', 'workshop', 'toolbox', 'machine_lathe', 'machine_milling', 'machine_drill'].flatMap(b => [`${b}_static.glb`, `${b}_interactive.glb`]);
const missingExpected = expected.filter(n => !rows.some(r => r.f.file === n && !r.missing));
out.push('## 未產生的預期檔案', '', missingExpected.length ? missingExpected.map(n => `- ❌ ${n}`).join('\n') : '- 無（14 個場景／機台檔與工具檔都已產生）', '');

out.push('## 被略過的物件（依原因彙總）', '');
const byReason = new Map();
for (const g of manifest.groups || []) for (const s of g.skipped || []) {
  const k = s.reason;
  if (!byReason.has(k)) byReason.set(k, { count: 0, tris: 0, groups: new Set(), names: new Set() });
  const e = byReason.get(k); e.count++; e.tris += s.triangles || 0; e.groups.add(g.base); if (e.names.size < 6) e.names.add(s.name);
}
out.push('| 原因 | 數量 | 三角形 | 出現在 | 例子 |', '|---|---:|---:|---|---|');
for (const [reason, e] of byReason) out.push(`| ${reason} | ${e.count} | ${e.tris || ''} | ${[...e.groups].join(', ')} | ${[...e.names].join(', ')} |`);
out.push('');

out.push('## 展開的 InstancedMesh', '', '| 檔案群組 | 名稱 | 實例數 | 三角形（展開後） | 逐實例顏色 |', '|---|---|---:|---:|---|');
for (const g of manifest.groups || []) for (const e of g.expandedInstancedMeshes || []) out.push(`| ${g.base} | ${e.name} | ${e.instances} | ${e.triangles} | ${e.hasInstanceColor ? '有（未帶到）' : ''} |`);
out.push('');

out.push('## 警告（依類型彙總）', '');
const warn = new Map();
for (const g of manifest.groups || []) for (const w of g.warnings || []) {
  const k = w.message.replace(/「[^」]*」/g, '「…」').replace(/\(opacity [^)]*\)|（opacity [^）]*）/g, '').replace(/\d+ 個/g, 'N 個');
  if (!warn.has(k)) warn.set(k, { count: 0, names: new Set() });
  const e = warn.get(k); e.count++; if (e.names.size < 6) e.names.add(`${g.base}:${w.name}`);
}
for (const [k, e] of warn) out.push(`- ${k} — ${e.count} 處（例：${[...e.names].join('、')}）`);
out.push('');

out.push('## 燈光（未匯出，參數在 manifest `groups[].lights`）', '');
for (const g of manifest.groups || []) if (g.lights?.length) out.push(`- ${g.base}：${g.lights.length} 盞（${[...new Set(g.lights.map(l => l.type))].join('、')}）`);
out.push('');

out.push('## 機台節點對照', '');
for (const g of (manifest.groups || []).filter(g => g.zone === 'machine')) {
  const roles = Object.entries(g.interactiveNodeRoles || {});
  out.push(`- **${g.machineId}**：設定檔中的互動節點 ${roles.length} 個；模型中找不到：${g.configNodesMissingInScene?.length ? g.configNodesMissingInScene.join(', ') : '無'}。放置：rotationY=${(+g.placement?.machineSlotRotationY || 0).toFixed(4)}，offset=${JSON.stringify(g.placement?.offset?.map(v => +v.toFixed(4)))}，鐵座=${g.placement?.pedestal ? '有' : '無'}`);
}
out.push('');
if (manifest.notes?.length) out.push('## 執行期訊息', '', ...manifest.notes.map(n => `- ${n}`), '');

writeFileSync('docs/export-report.md', out.join('\n'));

// manifest 範例：完整結構，但每個陣列只留前幾筆（完整版很大，在 exports/manifest.json）
const trim = (v, depth = 0) => {
  if (Array.isArray(v)) { const keep = depth === 1 ? v : v.slice(0, 5).map(x => trim(x, depth + 1)); return v.length > keep.length ? [...keep, `…（另 ${v.length - keep.length} 筆，略）`] : keep; }
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x, depth + 1)]));
  return v;
};
const example = { _note: '由 scripts/export-report.mjs 從實際匯出的 exports/manifest.json 產生；files 保留全部檔案，其他較長的清單只留前 5 筆。', ...trim(manifest) };
writeFileSync('docs/export-manifest-example.json', JSON.stringify(example, null, 1));
console.log(`report: ${rows.length} files, ${kb(totalBytes)} KB, ${totalTris} tris; missing expected: ${missingExpected.length}`);
