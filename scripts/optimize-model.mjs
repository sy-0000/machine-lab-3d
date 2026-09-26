// 將 assets-src/ 的原始機台模型整理成網頁用版本（public/models/machines/）。
// 保留所有節點、網格與材質名稱（各機台 JSON 設定與 manifest 依名稱找零件），
// 不做 join / flatten / instance / quantize，避免改變節點座標或階層。
// 依三角形編號拆件的網格（JSON 的 geometrySplits.source）不 weld / simplify，保留原始三角形順序。
// 用法：node scripts/optimize-model.mjs milling|lathe
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weldPrimitive, simplifyPrimitive, dedup, prune, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readFileSync, statSync } from 'node:fs';

// textureSize：顏色／金屬粗糙度貼圖的最大邊長；法線貼圖（表面凹凸細節）一律保留 1024。
const MODELS = {
  milling: { config: 'public/models/milling_split_controls.json', simplifyError: 0.001, textureSize: 768 },
  // exact：測試以幾何中心量角度的零件，不簡化
  lathe: { config: 'public/models/lathe_parts.json', simplifyError: 0.0002, exact: ['Object_30'] },
};
const id = process.argv[2];
const spec = MODELS[id];
if (!spec) throw Error(`用法：node scripts/optimize-model.mjs ${Object.keys(MODELS).join('|')}`);
const src = `assets-src/${id}/${id}.source.glb`, out = `public/models/machines/${id}/${id}.glb`;
const splitNodes = (JSON.parse(readFileSync(spec.config)).geometrySplits || []).map(s => s.source);
const protectedNodes = new Set([...splitNodes, ...(spec.exact || [])]);

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const names = () => ({
  nodes: root.listNodes().map(n => n.getName()).join('|'),
  materials: root.listMaterials().map(m => m.getName()).join('|'),
});
const before = names();

const protectedMeshes = new Set(root.listNodes().filter(n => protectedNodes.has(n.getName()) && n.getMesh()).map(n => n.getMesh()));
if (protectedMeshes.size !== protectedNodes.size) throw Error('找不到要保留原始幾何的網格');
await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }));
for (const mesh of root.listMeshes()) {
  if (protectedMeshes.has(mesh)) continue;
  for (const prim of mesh.listPrimitives()) {
    weldPrimitive(prim);
    simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: spec.simplifyError, lockBorder: true });
  }
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normalTexture$/, resize: [1024, 1024], quality: 82 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!normalTexture$)/, resize: [spec.textureSize || 1024, spec.textureSize || 1024], quality: 82 }),
  prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE, PropertyType.BUFFER_VIEW] }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

const after = names();
if (before.nodes !== after.nodes) throw Error('節點名稱或順序改變了，停止輸出');
if (before.materials !== after.materials) throw Error('材質名稱改變了，停止輸出');

await io.write(out, doc);
const mb = f => (statSync(f).size / 1048576).toFixed(1) + ' MB';
console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
