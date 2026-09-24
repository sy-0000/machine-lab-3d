import { cloneWorkpieceState } from '../machining/WorkpieceState.js';
const move=(axis,valueMm)=>({type:'machining.move',axis,valueMm,...(axis==='X'?{representation:'diameter'}:{})});
const line=(xDiameterMm,zMm)=>({type:'machining.line',xDiameterMm,zMm});
export function handleDemoCommands(def,input) {
  const list=[{type:'machining.clearDatum'},move('X',22),move('Z',input.lengthMm+1),{type:'spindle.start'},{wait:'running'}];
  let length=input.lengthMm;
  if(def.stage==='basic') {
    list.push({type:'machining.mode',mode:'facing'});
    while(length>240){length=Math.max(240,length-2);list.push(move('X',22),move('Z',length),move('X',0));}
    // Demonstration skim only; 19.8 is an explicit practice path, not a drawing target.
    list.push(move('X',22),{type:'machining.mode',mode:'turning'},move('Z',length-30),move('X',19.8),move('Z',length-40));
  } else if(def.stage==='taper') {
    const end=length-def.taper.endSegmentMm,start=end-def.taper.lengthMm;
    if(start<=input.clamping.endZMm)throw new Error('Checkpoint too short for safe taper demonstration');
    list.push(move('Z',start),move('X',def.taper.largeDiameterMm));
    for(let i=1;i<=100;i++)list.push(line(def.taper.largeDiameterMm+(def.taper.smallDiameterMm-def.taper.largeDiameterMm)*i/100,start+i));
  } else if(def.stage==='end') {
    const radius=input.profile.radiusMm[Math.floor((length-1)/input.profile.resolutionMm)];
    if(radius<1)throw new Error('Insufficient material for chamfer demo');
    list.push(move('Z',length-1),move('X',radius*2));
    for(let i=1;i<=10;i++)list.push(line(2*(radius-i/10),length-1+i/10));
  }
  // Draft finish stage only demonstrates the existing spindle/inspection workflow, no fake features.
  list.push(move('X',22),{type:'spindle.stop'},{wait:'stopped'});return list;
}

/** No geometry writes and no second clock: consumes MachineSession host updates. */
export class DemoSequence {
  constructor(machine,{onChange=()=>{},suspend=()=>{},createCommands=handleDemoCommands,prepareCommands=()=>[]}={}) {
    this.createCommands=createCommands;this.prepareCommands=prepareCommands;
    this.machine=machine;this.onChange=onChange;this.suspend=suspend;this.status='idle';this.index=0;
    this.input=machine.createInput('demo');this.unsubscribe=machine.observe(command=>{if(!command)this.advance();});
  }
  async send(c){const result=await this.machine.command(c,this.input);if(!result.ok)throw new Error(result.reason);}
  async start(def,input) {
    if(this.lease)throw new Error('Demo already active');
    this.commands=this.createCommands(def,input);this.pose=this.machine.getState();
    this.snapshot=this.pose.workpiece?.machinable?this.machine.exportWorkpieceState():null;
    this.suspend(true);this.lease=this.machine.lockInput(this.input);this.status='loading';this.error=null;this.onChange();
    try{await this.send({type:'machine.reset'});for(const c of this.prepareCommands(def))await this.send(c);await this.send({type:'workpiece.mountState',state:cloneWorkpieceState(input)});
      this.index=0;this.status='playing';this.onChange();await this.send({type:'wheel.release'});
    }catch(e){this.error=e.message;await this.stop();throw e;}
  }
  pause(){if(this.status==='playing'){this.status='paused';this.onChange();}}
  resume(){if(this.status==='paused'){this.status='playing';this.machine.command({type:'wheel.release'},this.input);this.onChange();}}
  async advance(){
    if(this.status!=='playing'||this.busy)return;
    this.busy=true;
    try {
      const c=this.commands[this.index];
      if(!c){this.busy=false;await this.stop();return;}
      const s=this.machine.getState();
      if(c.wait){if(c.wait==='running'&&!(s.running&&s.rpm>0))return;if(c.wait==='stopped'&&(s.running||s.rpm>0||s.leverAngle!==0))return;}
      else await this.send(c);
      this.index++;this.onChange();if(this.index===this.commands.length){this.busy=false;await this.stop();}
    }catch(e){this.error=e.message;this.busy=false;await this.stop();}
    finally{this.busy=false;}
  }
  async stop(){
    if(!this.lease)return;
    if(this.restoring)return this.restoring;
    this.status='restoring';this.onChange();
    this.restoring=(async()=>{
      try {
        await this.send({type:'machine.reset'});
        if(this.pose.id!=='lathe')await this.send({type:'tool.select',toolId:this.pose.activeCuttingTool?.source==='module'?this.pose.activeCuttingTool.id:null});
        if(this.snapshot){
          await this.send({type:'workpiece.mountState',state:this.snapshot});
          const m=this.pose.machining;
          if(this.pose.headMachining?.tipMm){
            for(const [axisId,valueMm] of Object.entries(this.pose.machineAxesMm))await this.send({type:'machineAxis.set',axisId,valueMm});
            const p=this.pose.headMachining.tipMm;
            await this.send({type:'head.setup',xMm:p.xMm,yMm:p.yMm,tipZMm:p.zMm});
          }
          if(m){await this.send(line(m.xRadialMm*2,m.physicalZMm));
            await this.send({type:'machining.datum',axis:'X',representation:'diameter',valueMm:m.xDiameterMm});
            await this.send({type:'machining.datum',axis:'Z',valueMm:m.zMm});
            await this.send({type:'machining.mode',mode:m.mode});}
        }else await this.send({type:'workpiece.unmount'});
        await this.send({type:'spindle.speed',rpm:this.pose.requestedRpm});
      }finally{
        this.machine.unlockInput(this.lease);this.lease=null;
        if(this.pose.running)this.machine.command({type:'spindle.start',direction:this.pose.direction});
        this.suspend(false);this.status=this.error?'error':'finished';this.onChange();
      }
    })();
    try{await this.restoring;}finally{this.restoring=null;}
  }
  dispose(){this.unsubscribe();if(this.lease){this.machine.unlockInput(this.lease);this.lease=null;}this.suspend(false);}
}
