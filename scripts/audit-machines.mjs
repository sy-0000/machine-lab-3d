import {readFileSync,writeFileSync} from 'node:fs';
import {loadSource} from './model-source.mjs';
import {MACHINES} from '../src/machines/catalog.js';
import {normalizeConfig} from '../src/machines/config.js';
import {prepareMachine,disposeMachine} from '../src/machines/runtime.js';
const results=[];
for(const machine of MACHINES){
 const raw=JSON.parse(readFileSync(new URL('../public/models/'+machine.config,import.meta.url)));
 const {scene,json}=await loadSource(new URL('../public/models/'+machine.model,import.meta.url));
 let manifestAudit=null;
 if(machine.id==='milling'){const manifest=JSON.parse(readFileSync(new URL('../public/models/deliver_milling_machine_split/milling_machine_split_manifest.json',import.meta.url)));const names=new Set(json.nodes.map(n=>n.name));manifestAudit={count:manifest.parts.length,missing:manifest.parts.filter(p=>!names.has(p.name)).map(p=>p.name)};if(manifestAudit.missing.length)throw Error('Manifest references missing GLB nodes');}
 const m=prepareMachine(scene,normalizeConfig(machine.id,raw));
 const result={manifestAudit,id:machine.id,model:machine.model,config:machine.config,nodeCount:json.nodes.length,meshCount:json.meshes.length,errors:m.errors,audit:m.audit,axes:m.config.axes,wheels:m.config.wheels,spindle:m.config.spindle,notes:m.config.notes,sourceHierarchy:json.nodes.map((n,i)=>({index:i,name:n.name,children:(n.children||[]).map(index=>json.nodes[index].name)}))};results.push(result);
 console.log(machine.id,JSON.stringify({nodes:result.nodeCount,meshes:result.meshCount,errors:m.errors,pivots:Object.keys(m.pivots)}));disposeMachine(m);
}
writeFileSync(new URL('../reports/machine-audit.json',import.meta.url),JSON.stringify(results,null,2));
