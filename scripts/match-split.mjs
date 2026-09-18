import fs from 'node:fs';
import {Vector3} from 'three';
import {loadSource} from './model-source.mjs';
const root=new URL('../public/models/',import.meta.url);
const old=(await loadSource(new URL('../todelete/models-v1/milling_machine_interactive.glb',import.meta.url))).scene;
const fresh=(await loadSource(new URL('deliver_milling_machine_split/milling_machine_split.glb',root))).scene;
const map=new Map(),p=new Vector3();
function triangles(mesh,visit){const a=mesh.geometry.attributes.position,idx=mesh.geometry.index,count=idx?.count||a.count;for(let i=0;i<count;i+=3){let x=0,y=0,z=0;for(let k=0;k<3;k++){p.fromBufferAttribute(a,idx?idx.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld);x+=p.x;y+=p.y;z+=p.z;}visit([x/3,y/3,z/3].map(v=>Math.round(v*100000)).join(','));}}
old.updateMatrixWorld(true);fresh.updateMatrixWorld(true);
old.traverse(mesh=>{if(mesh.isMesh){const semantic=mesh.name.replace(/_Mat\d+$/,'');triangles(mesh,key=>map.set(key,semantic));}});
const results=[];
fresh.traverse(mesh=>{if(!mesh.isMesh)return;const votes={};let total=0;triangles(mesh,key=>{total++;const s=map.get(key);if(s)votes[s]=(votes[s]||0)+1;});const ranking=Object.entries(votes).sort((a,b)=>b[1]-a[1]);results.push({name:mesh.name,total,votes,semantic:ranking[0]?.[0],matchedFraction:ranking.reduce((s,a)=>s+a[1],0)/total,purity:ranking[0]?ranking[0][1]/ranking.reduce((s,a)=>s+a[1],0):0});});
fs.writeFileSync(new URL('../reports/split-correspondence.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results.filter(r=>/Wheel|Handle|Spindle|Worktable/.test(r.semantic)),null,2));
console.log('ambiguous',JSON.stringify(results.filter(r=>r.purity<.98||r.matchedFraction<.6)));
