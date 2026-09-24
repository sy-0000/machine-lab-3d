import { cloneWorkpieceState } from '../machining/WorkpieceState.js';
import { measureWorkpiece } from './measureWorkpiece.js';

/** Observes one MachineSession; owns attempt/setup only, never geometry mutations or a clock. */
export class LevelSession {
  #machine; #initial; #working; #unsubscribe; #listeners=new Set(); #disposed=false;
  #mounted=false; #busy=false; #done=new Set(); #cutStart=0; #result=null; #attempt=1;
  constructor(definition,machineSession,{input=definition.initialWorkpiece,working=null,measure=null}={}) {
    if(machineSession.getState().id!==definition.machineId)throw new Error('Wrong machine for level');
    this.definition=definition;this.#machine=machineSession;
    this.measure=measure;this.suspended=false;
    this.#initial=cloneWorkpieceState(input);
    this.#working=cloneWorkpieceState(working||this.#initial);
    this.#unsubscribe=machineSession.observe(command=>this.#observe(command));
  }
  subscribe(listener){this.#listeners.add(listener);return()=>this.#listeners.delete(listener);}
  #notify(){for(const listener of this.#listeners)listener();}
  exportWorkingCopy(){return cloneWorkpieceState(this.#working);}
  #stopped(s){return !s.running&&s.rpm===0&&s.leverAngle===0;}
  #measure() {
    const wp=this.#working,measurement=measureWorkpiece(wp,this.definition.targets);
    if(this.measure)return this.measure(wp,this.#initial,this.#cutStart);
    const history=wp.operationHistory.slice(this.#cutStart);
    const turned=history.some(op=>op.type==='profile-cut');
    const faced=wp.lengthMm<this.#initial.lengthMm&&history.some(op=>op.type==='face-cut');
    return {...measurement,turned,faced,operationsComplete:turned&&faced,
      machiningComplete:turned&&faced&&measurement.status==='pass'};
  }
  #observe(command=null) {
    if(this.#disposed||this.#busy||!this.#mounted||this.suspended)return;
    const s=this.#machine.getState(),m=s.machining;
    if(s.disposed||!m)return;
    const old=JSON.stringify(this.getState());
    const previousHistory=this.#working.operationHistory.length;
    this.#working=this.#machine.exportWorkpieceState();
    if(this.#working.operationHistory.length!==previousHistory)this.#result=null;
    const eps=this.definition.setup.contactEpsilonMm;
    const rotating=s.running&&s.rpm>0;
    const outer=rotating&&m.centerAligned&&!m.unsafe&&m.contact&&m.physicalZMm<this.#working.lengthMm-eps&&
      Math.abs(Math.abs(m.xRadialMm)*2-m.diameterAtTipMm)<=eps;
    const face=rotating&&m.centerAligned&&!m.unsafe&&m.contact&&Math.abs(m.physicalZMm-this.#working.lengthMm)<=eps;
    // A later datum/clear invalidates dependent setup and requires contact + zero again.
    if(command?.type==='machining.clearDatum'||command?.type==='machine.reset')this.#invalidateFrom(4);
    if(command?.type==='machining.datum')this.#invalidateFrom(command.axis==='X'?4:6);
    const checks=[true,m.centerAligned,rotating,outer,
      outer&&command?.type==='machining.datum'&&command.axis==='X'&&Math.abs(m.xDiameterMm)<=eps&&Math.abs(m.datumMm.X-m.xRadialMm)<=eps,
      face,
      face&&command?.type==='machining.datum'&&command.axis==='Z'&&Math.abs(m.zMm)<=eps&&Math.abs(m.datumMm.Z-m.physicalZMm)<=eps];
    for(let i=0;i<checks.length;i++) {
      if(this.#done.has(i))continue;
      if(!checks[i])break;
      this.#done.add(i);
      if(i===6)this.#cutStart=this.#working.operationHistory.length;
    }
    const measure=this.#measure();
    if(this.#done.has(6)&&measure.operationsComplete)this.#done.add(7);
    else {this.#done.delete(7);this.#done.delete(8);this.#done.delete(9);}
    if(this.#done.has(7)&&this.#stopped(s))this.#done.add(8);
    else {this.#done.delete(8);this.#done.delete(9);}
    if(this.#result?.complete && (!this.#done.has(8)||!measure.machiningComplete))this.#result=null;
    if(JSON.stringify(this.getState())!==old)this.#notify();
  }
  #invalidateFrom(index){for(let i=index;i<10;i++)this.#done.delete(i);this.#result=null;}
  getState(){return {attempt:this.#attempt,mounted:this.#mounted,busy:this.#busy,
    completedSteps:[...this.#done].sort((a,b)=>a-b),currentStep:this.definition.steps.findIndex((_,i)=>!this.#done.has(i)),
    result:this.#result?JSON.parse(JSON.stringify(this.#result)):null,measurements:this.#measure()};}
  async mount(){
    if(this.#disposed||this.#busy)throw new Error('Level unavailable');
    if(this.#mounted)throw new Error('Use Retry for a new working copy');
    this.#busy=true;this.#notify();
    try {
      const result=await this.#machine.command({type:'workpiece.mountState',state:cloneWorkpieceState(this.#working)});
      if(!result.ok)throw new Error(result.reason);
      this.#mounted=true;
    }finally{this.#busy=false;this.#observe();this.#notify();}
  }
  async retry(){
    if(this.#disposed||this.#busy)throw new Error('Level unavailable');
    this.#busy=true;this.#notify();
    try {
      // Existing reset stops the spindle and restores the mechanical pose; it does not repair stock.
      const reset=this.#machine.command({type:'machine.reset'});if(!reset.ok)throw new Error(reset.reason);
      const unmount=await this.#machine.command({type:'workpiece.unmount'});if(!unmount.ok)throw new Error(unmount.reason);
      this.#working=cloneWorkpieceState(this.#initial);this.#mounted=false;this.#done.clear();
      this.#cutStart=0;this.#result=null;this.#attempt++;
    }finally{this.#busy=false;this.#notify();}
  }
  inspect(){
    if(this.#disposed||this.#busy||this.suspended)throw new Error('Level unavailable');
    this.#observe();const measurements=this.#measure();
    const complete=this.#done.has(8)&&measurements.machiningComplete&&this.#stopped(this.#machine.getState());
    this.#result={complete,...measurements};if(complete)this.#done.add(9);
    this.#notify();return JSON.parse(JSON.stringify(this.#result));
  }
  dispose(){this.#disposed=true;this.#unsubscribe();this.#listeners.clear();}
}
