// Transfer per-face materials, UVs and normals by verified triangle correspondence.
import fs from 'node:fs';
import {Vector3,Matrix3} from 'three';
import {loadSource,readGLB} from './model-source.mjs';
const oldFile=new URL('../todelete/models-v1/milling_machine_interactive.glb',import.meta.url),newFile=new URL('../todelete/models-v2/milling_machine_split.glb',import.meta.url);
const oldRaw=readGLB(oldFile),freshRaw=readGLB(newFile),old=(await loadSource(oldFile)).scene,fresh=(await loadSource(newFile)).scene;
old.updateMatrixWorld(true);fresh.updateMatrixWorld(true);
const grid=new Map(),scale=10000,vec=new Vector3(),materialIds=new Map(oldRaw.json.materials.map((m,i)=>[m.name,i]));
function eachTriangle(mesh,fn){const g=mesh.geometry,a=g.attributes.position,idx=g.index;for(let i=0;i<(idx?.count??a.count);i+=3){const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k),points=ids.map(k=>new Vector3().fromBufferAttribute(a,k).applyMatrix4(mesh.matrixWorld));fn(ids,points);}}
const cell=points=>[0,1,2].map(k=>Math.floor(points.reduce((s,p)=>s+p.getComponent(k),0)/3*scale));
old.traverse(mesh=>{if(!mesh.isMesh)return;eachTriangle(mesh,(ids,points)=>{const key=cell(points).join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push({mesh,ids,points,material:materialIds.get(mesh.material.name)});});});
const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]],stats={triangles:0,matched:0,maxVertexError:0,retriangulated:0,unmatched:[]};
const out={...freshRaw.json,materials:oldRaw.json.materials,textures:oldRaw.json.textures,samplers:oldRaw.json.samplers,images:[],accessors:[],bufferViews:[],buffers:[],meshes:[]};const chunks=[];let length=0;
function buffer(bytes){const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const i=out.bufferViews.length;out.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;return i;}
function attr(values,size){const data=new Float32Array(values),view=buffer(Buffer.from(data.buffer)),i=out.accessors.length;const a={bufferView:view,componentType:5126,count:data.length/size,type:size===2?'VEC2':'VEC3'};if(size===3){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let k=0;k<data.length;k++){a.min[k%3]=Math.min(a.min[k%3],data[k]);a.max[k%3]=Math.max(a.max[k%3],data[k]);}}out.accessors.push(a);return i;}
const imageViews=new Map(),binStart=28+oldRaw.bytes.readUInt32LE(12);
for(const im of oldRaw.json.images){if(!imageViews.has(im.bufferView)){const view=oldRaw.json.bufferViews[im.bufferView];imageViews.set(im.bufferView,buffer(oldRaw.bytes.subarray(binStart+(view.byteOffset||0),binStart+(view.byteOffset||0)+view.byteLength)));}out.images.push({...im,bufferView:imageViews.get(im.bufferView)});}
const meshByName=new Map();fresh.traverse(mesh=>{if(mesh.isMesh)meshByName.set(mesh.name,mesh);});
for(const node of out.nodes){const mesh=meshByName.get(node.name);if(!mesh)continue;const groups=new Map(),normalInverse=new Matrix3().getNormalMatrix(mesh.matrixWorld).invert();
 eachTriangle(mesh,(ids,points)=>{
  stats.triangles++;const c=cell(points);let best=null,error=Infinity;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const t of grid.get([c[0]+x,c[1]+y,c[2]+z].join(','))||[]){for(const order of permutations){const e=Math.max(...points.map((p,i)=>p.distanceToSquared(t.points[order[i]])));if(e<error){error=e;best={...t,order};}}}
  if(!best||error>1e-8){
   // Six faces were retriangulated: require all three exact source vertices on one material surface.
   const face=new Vector3().subVectors(points[1],points[0]).cross(new Vector3().subVectors(points[2],points[0])).normalize();
   old.traverse(source=>{if(!source.isMesh||best&&error<=1e-8)return;const attrs=source.geometry.attributes,normalMatrix=new Matrix3().getNormalMatrix(source.matrixWorld),found=points.map(()=>({id:-1,score:-Infinity,error:Infinity}));
    for(let i=0;i<attrs.position.count;i++){const p=new Vector3().fromBufferAttribute(attrs.position,i).applyMatrix4(source.matrixWorld);for(let k=0;k<3;k++){const distance=p.distanceToSquared(points[k]);if(distance>1e-12)continue;const score=attrs.normal?new Vector3().fromBufferAttribute(attrs.normal,i).applyMatrix3(normalMatrix).normalize().dot(face):1;if(score>found[k].score)found[k]={id:i,score,error:distance};}}
    if(found.every(f=>f.id>=0)){best={mesh:source,ids:found.map(f=>f.id),order:[0,1,2],material:materialIds.get(source.material.name)};error=Math.max(...found.map(f=>f.error));stats.retriangulated++;}
   });
  }
  if(!best||error>1e-8){stats.unmatched.push({node:node.name,triangle:stats.triangles,error:Math.sqrt(error)});return;}
  stats.matched++;stats.maxVertexError=Math.max(stats.maxVertexError,Math.sqrt(error));
  if(!groups.has(best.material))groups.set(best.material,{position:[],normal:[],uv:[]});const g=groups.get(best.material),normalMatrix=new Matrix3().getNormalMatrix(best.mesh.matrixWorld),oldAttrs=best.mesh.geometry.attributes;
  for(let k=0;k<3;k++){g.position.push(...new Vector3().fromBufferAttribute(mesh.geometry.attributes.position,ids[k]).toArray());const sourceId=best.ids[best.order[k]];const n=oldAttrs.normal?new Vector3().fromBufferAttribute(oldAttrs.normal,sourceId).applyMatrix3(normalMatrix).applyMatrix3(normalInverse).normalize():new Vector3().subVectors(points[1],points[0]).cross(new Vector3().subVectors(points[2],points[0])).applyMatrix3(normalInverse).normalize();g.normal.push(...n.toArray());g.uv.push(oldAttrs.uv?.getX(sourceId)||0,oldAttrs.uv?.getY(sourceId)||0);}
 });
 node.mesh=out.meshes.length;out.meshes.push({name:node.name,primitives:[...groups].map(([material,g])=>({attributes:{POSITION:attr(g.position,3),NORMAL:attr(g.normal,3),TEXCOORD_0:attr(g.uv,2)},material}))});
}
fs.writeFileSync(new URL('../reports/v3-material-transfer.json',import.meta.url),JSON.stringify(stats,null,2));console.log(stats);
if(stats.unmatched.length)throw Error('Unmatched triangles: refusing partial material conversion');
const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}out.buffers=[{byteLength:length}];out.asset.extras={...out.asset.extras,materialRestoration:'Triangle-verified UV/material/normal transfer from original interactive GLB'};
const raw=Buffer.from(JSON.stringify(out)),json=Buffer.alloc(Math.ceil(raw.length/4)*4,0x20);raw.copy(json);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(length);bh.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(new URL('../public/models/deliver_milling_machine_split/milling_machine_textured.glb',import.meta.url),Buffer.concat([header,json,bh,...chunks]));

await import('./patch-milling-back-materials.mjs');
