import {useEffect,useRef,useState} from 'react';
import {legacySliderCommand} from '../machining/adapters/MachineV1Adapter.js';

// UI state only. All machine mutations, including pointer/keyboard holds, go through Session.
export default function useMachineControls(session) {
 const [resetKey,setResetKey]=useState(0),[interaction,setInteraction]=useState({hover:null,active:null,x:0,y:0}),[version,setVersion]=useState(0),[commandError,setCommandError]=useState('');
 const held=useRef(null),release=useRef(()=>{}),invalidate=useRef(()=>{});
 const refresh=()=>{setVersion(v=>v+1);invalidate.current();};
 useEffect(()=>{
  held.current=null;setCommandError('');
  if(!session)return;
  return session.subscribe(()=>{
   if(!session.canCommand()) {held.current=null;release.current(true);}
   refresh();
  });
 },[session]);
 const send=command=>{
  const result=session?.command(command);
  if(result && !result.ok)setCommandError(result.reason);else setCommandError('');
  return !!result?.ok;
 };
 const stopInput=(clear=false)=>{held.current=null;session?.command({type:'wheel.release'});release.current(clear);refresh();};
 const state=session?.getState();
 return {session,state,running:state?.running||false,direction:state?.direction||1,rpm:state?.targetRpm??500,teaching:state?.teaching||false,
  inputEnabled:!!session?.canCommand()&&!state?.busy,resetKey,interaction,setInteraction,held,release,invalidate,version,refresh,stopInput,
  hold:(key,direction)=>{if(send({type:'wheel.hold',key,direction}))held.current={key,direction};},
  setTeaching:enabled=>{stopInput();send({type:'teaching.set',enabled});},
  setRpm:value=>send({type:'spindle.speed',rpm:Number(value)}),
  start:direction=>send({type:'spindle.start',direction}),
  stop:()=>send({type:'spindle.stop'}),
  toggle:direction=>send({type:'spindle.toggle',direction}),
  detentStep:(key,direction)=>send({type:'detent.step',key,direction}),
  detent:(key,index)=>send({type:'detent.set',key,index}),
  index:(direction=1)=>send({type:'tool.index',direction}),
  brake:()=>{stopInput();send({type:'spindle.brake'});},
  releaseBrake:()=>send({type:'spindle.releaseBrake'}),
  toggleWorkpiece:()=>send({type:'workpiece.toggleDemo'}),
  move:(key,value)=>send(legacySliderCommand(key,value)),
  jog:(axisId,deltaMm)=>{stopInput();send({type:'machineAxis.jog',axisId,deltaMm});},
  reset:()=>{stopInput(true);if(send({type:'machine.reset'})){setInteraction({hover:null,active:null,x:0,y:0});setResetKey(v=>v+1);}},
  warning:commandError?{level:'caution',text:commandError}:state?.warning||{level:'',text:'等待模型載入'},
 };
}
