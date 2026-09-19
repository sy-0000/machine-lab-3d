import {useRef,useState} from 'react';
import {resetMachine,setAxisAndWheel,turnControl,safetyStatus,toggleDemoWorkpiece,indexTool,emergencyStop,releaseEmergency,setDetent,stepDetent,selectorRpm} from '../machines/runtime';
export default function useMachineControls(model) {
 const [direction,setDirection]=useState(1);
 const [running,setRunning]=useState(false),[rpm,setRpm]=useState(500),[resetKey,setResetKey]=useState(0),[teaching,setTeaching]=useState(false),[interaction,setInteraction]=useState({hover:null,active:null,x:0,y:0}),[version,setVersion]=useState(0);
 const held=useRef(null),release=useRef(()=>{}),invalidate=useRef(()=>{});
 const refresh=()=>{setVersion(v=>v+1);invalidate.current();};
 const stopInput=(clear=false)=>{held.current=null;release.current(clear);refresh();};
 return {model,running,direction,rpm:(model&&selectorRpm(model))??rpm,resetKey,teaching,interaction,setInteraction,held,release,invalidate,version,refresh,stopInput,
  setTeaching:value=>{stopInput();if(value&&model)for(const a of model.config.axes)setAxisAndWheel(model,a.id,model.offsets[a.id],true);setTeaching(value);refresh();},
  setRpm:value=>{setRpm(Number(value));invalidate.current();},
  start:(value)=>{if(model?.pivots[model.config.spindle.node]&&!model.emergency){setDirection(value===-1?-1:1);setRunning(true);invalidate.current();}},
  stop:()=>{setRunning(false);invalidate.current();},
  toggle:(value)=>{if(model?.pivots[model.config.spindle.node]&&!model.emergency){const next=value===-1?-1:1;setDirection(next);setRunning(v=>v&&direction===next?false:true);invalidate.current();}},
  detentStep:(key,direction)=>{if(model){stepDetent(model,key,direction);refresh();}},
  detent:(key,index)=>{if(model){setDetent(model,key,index);refresh();}},
  index:()=>{if(model){indexTool(model);refresh();}},
  brake:()=>{if(model){stopInput();setRunning(false);emergencyStop(model);refresh();}},
  releaseBrake:()=>{if(model){releaseEmergency(model);refresh();}},
  toggleWorkpiece:()=>{if(model&&toggleDemoWorkpiece(model,running))refresh();},
  move:(key,value)=>{if(model){setAxisAndWheel(model,key,Number(value),teaching);refresh();}},
  turn:(key,direction,dt)=>{if(model){turnControl(model,key,direction,dt,teaching);refresh();}},
  reset:()=>{stopInput(true);setRunning(false);setDirection(1);setTeaching(false);setRpm(model?.config.defaultRpm||500);if(model)resetMachine(model);setInteraction({hover:null,active:null,x:0,y:0});setResetKey(v=>v+1);refresh();},
  warning:model?safetyStatus(model):{level:'',text:'等待模型載入'},
 };
}
