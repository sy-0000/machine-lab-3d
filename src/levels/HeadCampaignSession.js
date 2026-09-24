import {HeadCampaignStore} from './HeadCampaignStore.js';
import {HEAD_LEVELS,measureHeadStage} from './headCampaign.js';
import {DemoSequence} from './DemoSequence.js';
import {headDemoCommands} from './headDemoCommands.js';
import {cloneHeadState} from '../machining/HeadWorkpieceState.js';
export class HeadCampaignSession{
  constructor(machine,store=new HeadCampaignStore()){
    this.machine=machine;this.store=store;this.data=store.load();this.definition=HEAD_LEVELS[this.data.currentLevel];
    if(machine.getState().id!==this.definition.machine)throw new Error('Head stage requires '+this.definition.machine);
    this.listeners=new Set();this.mounted=false;this.suspended=false;this.error='';
    this.demo=new DemoSequence(machine,{createCommands:headDemoCommands,prepareCommands:def=>[{type:'tool.select',toolId:def.tool}],suspend:v=>{this.suspended=v;},onChange:()=>this.notify()});
    this.unsubscribe=machine.observe(()=>this.observe());
  }
  subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
  notify(){for(const f of this.listeners)f();}
  async send(c){const r=await this.machine.command(c);if(!r.ok)throw new Error(r.reason);}
  persist(){try{this.store.save(this.data);this.error='';}catch(e){this.error=e.message;}this.notify();}
  observe(){if(this.suspended||!this.mounted||this.machine.getState().disposed)return;
    const next=this.machine.exportWorkpieceState();
    if(JSON.stringify(next)!==JSON.stringify(this.data.working)){this.data.working=next;this.data.measurements=null;this.persist();}
  }
  async start(){
    if(this.mounted)return;
    await this.send({type:'machine.reset'});await this.send({type:'tool.select',toolId:this.definition.tool});
    await this.send({type:'workpiece.mountState',state:this.data.working});this.mounted=true;this.persist();
  }
  async retry(){
    if(this.demo.lease)throw new Error('先結束示範');
    this.mounted=false;await this.send({type:'machine.reset'});
    this.data.working=cloneHeadState(this.data.revisions.at(-1).state);this.data.measurements=null;
    await this.start();
  }
  inspect(){const s=this.machine.getState();if(!this.mounted||s.running||s.rpm>0||this.demo.lease)throw new Error('先裝夾、停機，再檢查');
    this.data.measurements=measureHeadStage(this.definition,this.data.working,this.data.revisions.at(-1).state);this.persist();return this.data.measurements;
  }
  next(){const s=this.machine.getState();if(this.demo.lease||s.running||s.rpm>0)throw new Error('先停機及結束示範');
    this.data=this.store.checkpoint(this.data,this.data.working,this.data.measurements);this.mounted=false;return HEAD_LEVELS[this.data.currentLevel];
  }
  async demoStart(){await this.demo.start(this.definition,this.data.revisions.at(-1).state);}
  dispose(){this.unsubscribe();this.demo.dispose();this.listeners.clear();}
}
