import { LevelSession } from './LevelSession.js';
import { CampaignStore } from './CampaignStore.js';
import { HANDLE_LEVELS } from './handleCampaign.js';
import { measureHandleStage } from './measureHandleStage.js';
import { DemoSequence } from './DemoSequence.js';
export class HandleCampaignSession {
  constructor(machine,store=new CampaignStore()) {
    this.machine=machine;this.store=store;this.data=store.load();this.listeners=new Set();this.error='';
    this.open();this.demo=new DemoSequence(machine,{suspend:value=>{this.level.suspended=value;},onChange:()=>this.notify()});
  }
  open(){
    this.unwatch?.();this.level?.dispose();
    this.definition=HANDLE_LEVELS[this.data.currentLevel];
    const input=this.data.revisions.at(-1).state;
    this.level=new LevelSession(this.definition,this.machine,{input,working:this.data.working,
      measure:(stock,initial)=>measureHandleStage(this.definition,stock,initial)});
    this.unwatch=this.level.subscribe(()=>{this.persist();this.notify();});
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn();}
  persist(){
    if(this.level.suspended)return;
    this.data.working=this.level.exportWorkingCopy();this.data.measurements=this.level.getState().result;
    const serialized=JSON.stringify(this.data);
    if(serialized===this.lastSaved)return;
    try{this.store.save(this.data);this.lastSaved=serialized;this.error='';}catch(e){this.error=e.message;}
  }
  async next(){
    const s=this.level.getState(),m=this.machine.getState();
    if(this.demo.lease||!s.result?.operationsComplete||!s.completedSteps.includes(8)||m.running||m.rpm>0)throw new Error('先完成對刀、實切、停機與檢查');
    this.data=this.store.checkpoint(this.data,this.level.exportWorkingCopy(),s.result);
    await this.machine.command({type:'machine.reset'});await this.machine.command({type:'workpiece.unmount'});
    this.open();this.notify();
  }
  async retry(){if(this.demo.lease)throw new Error('請先結束示範');await this.level.retry();this.persist();}
  async demoStart(){await this.demo.start(this.definition,this.data.revisions.at(-1).state);}
  dispose(){this.persist();this.demo.dispose();this.unwatch();this.level.dispose();this.listeners.clear();}
}
