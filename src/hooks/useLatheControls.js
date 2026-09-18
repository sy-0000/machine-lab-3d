import { useRef, useState } from 'react';
import { AXES, WHEELS, homeState, clamp, turnWheel, moveAxis, setWorkpiece } from '../lathe';
export default function useLatheControls(model) {
 const [running,setRunning]=useState(false),[rpm,setRpm]=useState(500),[machine,setMachine]=useState(homeState),[resetKey,setResetKey]=useState(0),[toolMoved,setToolMoved]=useState(false),[hasWorkpiece,setHasWorkpiece]=useState(false);
 const [drive,setDrive]=useState({leverAngle:0,actualRpm:0,phase:'已停止'}),[interaction,setInteraction]=useState({hover:null,active:null,pressed:false,direction:0,x:0,y:0,orbitEnabled:true,inspected:null,selected:null});
 const [touchDirection,setTouchDirection]=useState(-1); const machineRef=useRef(machine);const commit=next=>{machineRef.current=next;setMachine(next);};
 const moving=key=>{if(['x','y','z'].includes(key)&&model?.drive.actualRpm>0)setToolMoved(true);};
 function move(key,value){if(!model)return;const next=moveAxis(model,machineRef.current,key,Number(value));if(next!==machineRef.current){moving(key);commit(next);}}
 function turn(key,delta){if(!model)return;const next=turnWheel(model,machineRef.current,key,delta);if(next!==machineRef.current){moving(WHEELS[key].key);commit(next);}}
 function reset(){setRunning(false);setRpm(500);commit(homeState());setDrive({leverAngle:0,actualRpm:0,phase:'已停止'});setToolMoved(false);setResetKey(k=>k+1);}
 function toggleWorkpiece(){if(model&&setWorkpiece(model,!hasWorkpiece,running))setHasWorkpiece(!hasWorkpiece);}
 return {touchDirection,setTouchDirection,running,rotating:drive.actualRpm>0,rpm,drive,setDrive,machine,machineRef,offsets:machine.offsets,toolMoved,resetKey,move,turn,reset,interaction,setInteraction,hasWorkpiece,toggleWorkpiece,
 setRpm:value=>setRpm(clamp(Number(value),0,2000)),start:()=>{if(model?.availability.spindle)setRunning(true);},stop:()=>{setRunning(false);setToolMoved(false);},toggleRunning:()=>{if(model?.availability.spindle)setRunning(v=>!v);},
 limits:model?.limits||Object.fromEntries(Object.entries(AXES).map(([k,d])=>[k,d.range])),available:model?.availability||{},missing:model?.missing||[],
 };
}


