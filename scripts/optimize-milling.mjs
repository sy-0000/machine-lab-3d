// 將原始銑床模型整理成網頁用版本。
// 保留所有節點、網格與材質名稱（milling_split_controls.json 與 manifest 依名稱找零件），
// 不做 join / flatten / instance / quantize，避免改變節點座標或階層。
// 用法：node scripts/optimize-milling.mjs [來源.glb] [輸出.glb]
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { weld, dedup, prune, reorder, simplify, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';

const [src = 'assets-src/milling/milling.source.glb', out = 'public/models/machines/milling/milling.glb'] = process.argv.slice(2);
const TEXTURE_SIZE = 1024;
const SIMPLIFY_ERROR = 0.0004; // 相對模型尺寸的誤差；肉眼幾乎看不出

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);

const names = doc => ({
  nodes: doc.getRoot().listNodes().map(n => n.getName()).join('|'),
  materials: doc.getRoot().listMaterials().map(m => m.getName()).join('|'),
});
const before = names(doc);

await doc.transform(
  dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR, lockBorder: true }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEXTURE_SIZE, TEXTURE_SIZE], quality: 82 }),
  prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE, PropertyType.BUFFER_VIEW] }),
  reorder({ encoder: MeshoptEncoder }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

const after = names(doc);
if (before.nodes !== after.nodes) throw Error('節點名稱或順序改變了，停止輸出');
if (before.materials !== after.materials) throw Error('材質名稱改變了，停止輸出');

await io.write(out, doc);
const mb = f => (statSync(f).size / 1048576).toFixed(1) + ' MB';
console.log(`${src} ${mb(src)} → ${out} ${mb(out)}`);
