import {readFileSync,writeFileSync} from 'node:fs';
import {loadSource} from './model-source.mjs';
import {MACHINES} from '../src/machines/catalog.js';
import {normalizeConfig} from '../src/machines/config.js';
import {prepareMachine,disposeMachine} from '../src/machines/runtime.js';
const results=[];
for(const machine of MACHINES){
 const raw=JSON.parse(readFileSync(new URL('../public/models/'+machine.config,import.meta.url)));
 const {scene,json}=await loadSource(new URL('../public/models/'+machine.model,import.meta.url));
 const m=prepareMachine(scene,normalizeConfig(machine.id,raw));
 const result={id:machine.id,model:machine.model,config:machine.config,nodeCount:json.nodes.length,meshCount:json.meshes.length,errors:m.errors,audit:m.audit,axes:m.config.axes,wheels:m.config.wheels,spindle:m.config.spindle,notes:m.config.notes,sourceHierarchy:json.nodes.map((n,i)=>({index:i,name:n.name,children:(n.children||[]).map(index=>json.nodes[index].name)}))};results.push(result);
 console.log(machine.id,JSON.stringify({nodes:result.nodeCount,meshes:result.meshCount,errors:m.errors,pivots:Object.keys(m.pivots)}));disposeMachine(m);
}
writeFileSync(new URL('../reports/machine-audit.json',import.meta.url),JSON.stringify(results,null,2));
