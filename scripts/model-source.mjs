import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
export const MODEL_FILE = new URL('../public/models/machines/lathe/lathe.glb',import.meta.url);
export function readGLB(file=MODEL_FILE) { const bytes=readFileSync(file); const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString()); return {bytes,json}; }
export async function loadSource(file=MODEL_FILE) {
  const {bytes,json}=readGLB(file);
  const binaryStart=20+bytes.readUInt32LE(12)+8;
  // Offline structural tests use the real geometry; image decoding remains a browser test.
  json.materials=(json.materials||[]).map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor || [0.5,0.5,0.5,1]},doubleSided:m.doubleSided}));
  const raw=Buffer.from(JSON.stringify(json)); const padded=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20); raw.copy(padded);
  const bin=bytes.subarray(binaryStart); const out=Buffer.alloc(12+8+padded.length+8+bin.length);
  out.writeUInt32LE(0x46546c67,0); out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(padded.length,12);out.writeUInt32LE(0x4e4f534a,16);padded.copy(out,20);out.writeUInt32LE(bin.length,20+padded.length);out.writeUInt32LE(0x004e4942,24+padded.length);bin.copy(out,28+padded.length);
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),'');
  return {scene:gltf.scene,json};
}
