import { cloneWorkpieceState, createHandleState } from '../machining/WorkpieceState.js';
import { HANDLE_LEVELS, SPEC_VERSION } from './handleCampaign.js';
export const CAMPAIGN_KEY='machine-lab.campaign.handle.v1';
const copy=v=>JSON.parse(JSON.stringify(v));
export class CampaignStore {
  constructor(storage=globalThis.localStorage){this.storage=storage;}
  fresh(){const stock=createHandleState();return {version:1,specVersion:SPEC_VERSION,currentLevel:0,completedLevels:[],
    revisions:[{revision:0,levelId:null,state:stock,measurements:null}],working:cloneWorkpieceState(stock),measurements:null};}
  validate(data){
    if(data?.version!==1||data.specVersion!==SPEC_VERSION||!Number.isInteger(data.currentLevel)||data.currentLevel<0||data.currentLevel>=HANDLE_LEVELS.length||
      !Array.isArray(data.completedLevels)||!Array.isArray(data.revisions)||data.revisions.length!==data.currentLevel+1||
      data.completedLevels.length!==data.currentLevel)throw new Error('Campaign save/spec version is invalid');
    data.revisions.forEach((r,i)=>{if(r.revision!==i||r.levelId!==(i?HANDLE_LEVELS[i-1].id:null))throw new Error('Invalid checkpoint chain');cloneWorkpieceState(r.state);});
    if(data.completedLevels.some((id,i)=>id!==HANDLE_LEVELS[i].id))throw new Error('Invalid completed levels');
    cloneWorkpieceState(data.working);return copy(data);
  }
  load(){const raw=this.storage?.getItem(CAMPAIGN_KEY);return raw===null||raw===undefined?this.fresh():this.validate(JSON.parse(raw));}
  save(data){if(!this.storage)throw new Error('Campaign storage unavailable');this.storage.setItem(CAMPAIGN_KEY,JSON.stringify(this.validate(data)));}
  checkpoint(data,stock,measurements){
    const next=this.validate(data),def=HANDLE_LEVELS[next.currentLevel];
    if(!measurements?.operationsComplete||def.stage==='finish'||next.currentLevel>=HANDLE_LEVELS.length-1)throw new Error('Stage operations are incomplete');
    // completedLevels means teaching operations recorded, NOT dimensional acceptance.
    next.completedLevels.push(def.id);next.currentLevel++;
    next.revisions.push({revision:next.currentLevel,levelId:def.id,state:cloneWorkpieceState(stock),measurements:copy(measurements)});
    next.working=cloneWorkpieceState(stock);next.measurements=null;this.save(next);return next;
  }
}
