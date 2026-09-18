import {useEffect,useState} from 'react';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {disposeModel} from '../lathe';
import {normalizeConfig} from './config';
import {prepareMachine,disposeMachine} from './runtime';
import useMachineControls from '../hooks/useMachineControls';
import MachineScene from '../components/MachineScene';
import ControlPanel from '../components/ControlPanel';
export default function MachinePage({machine}){
 const [model,setModel]=useState(null),[error,setError]=useState(''),[progress,setProgress]=useState(0);
 const controls=useMachineControls(model);
 useEffect(()=>{
  const abort=new AbortController();let dead=false,owned,prepared;
  const root=`${import.meta.env.BASE_URL}models/`;
  async function load(){try{
   const configResponse=await fetch(root+machine.config,{signal:abort.signal});if(!configResponse.ok)throw Error(`設定檔讀取失敗：${machine.config}（${configResponse.status}）`);
   const raw=await configResponse.json();if(raw.model?.endsWith('.glb')&&raw.model!==machine.model)throw Error(`JSON 模型檔名不符：${raw.model}`);const config=normalizeConfig(machine.id,raw);
   const response=await fetch(root+machine.model,{signal:abort.signal});if(!response.ok)throw Error(`模型讀取失敗：${machine.model}（${response.status}）`);
   const total=Number(response.headers.get('content-length')),reader=response.body.getReader(),chunks=[];let received=0,last=-1;
   while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;const p=total?Math.min(85,Math.floor(received/total*85)):5;if(p!==last&&!dead){setProgress(p);last=p;}}
   const data=new Uint8Array(received);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
   if(received<20||new DataView(data.buffer).getUint32(0,true)!==0x46546c67)throw Error('回應不是有效的 GLB 模型。');
   const gltf=await new GLTFLoader().parseAsync(data.buffer,new URL(root,location.href).href);owned=gltf.scene;
   if(dead){disposeModel(owned);owned=null;return;}
   setProgress(95);prepared=prepareMachine(owned,config);setModel(prepared);setProgress(100);
  }catch(cause){if(!dead)setError(cause.message);}}
  load();return()=>{dead=true;abort.abort();if(prepared)disposeMachine(prepared);else if(owned)disposeModel(owned);};
 },[machine]);
 return <main><div className="intro"><div><a className="back-link" href="#/">← 返回機器選單</a><h1>{machine.name}互動教室</h1><p>{machine.subtitle}</p></div><span className="lesson-tag">設定檔驅動 · {machine.number}</span></div>
  <div className="workspace"><div className="left-column"><MachineScene name={machine.name} model={model} controls={controls} error={error} progress={progress} onError={setError}/>
   <section className="status-panel"><h2>即時狀態</h2><div className="telemetry"><div><span>主軸</span><strong>{model?.rpm>0?'運轉中':'已停止'}</strong></div><div><span>設定／實際 RPM</span><strong>{controls.rpm} / {Math.round(model?.rpm||0)}</strong></div>{model?.config.axes.map(a=><div key={a.id}><span>{a.label}</span><strong>{model.offsets[a.id].toFixed(3)}</strong></div>)}</div><div role="status" className={`notice ${controls.warning.level}`}>{controls.warning.text}</div></section>
   {model&&<section className="status-panel mapping-status"><h2>節點核對與模型限制</h2><p>{model.audit.filter(a=>a.found).length} 筆節點參照已找到；{model.errors.length} 項對照問題。</p>{model.errors.length>0&&<div role="alert" className="missing-parts">{model.errors.map(e=><p key={e}>{e}</p>)}</div>}<ul>{model.config.notes.map(note=><li key={note}>{note}</li>)}</ul><details><summary>查看節點、軸向與 Pivot</summary><pre>{JSON.stringify({axes:model.config.axes,wheels:model.config.wheels,spindle:model.config.spindle,audit:model.audit},null,2)}</pre></details></section>}
  </div><ControlPanel controls={controls} model={model}/></div>
 </main>;
}
