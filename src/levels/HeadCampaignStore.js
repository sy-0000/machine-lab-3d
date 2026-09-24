import {cloneHeadState} from '../machining/HeadWorkpieceState.js';
import {HEAD_LEVELS,HEAD_SPEC_VERSION,createHeadStock} from './headCampaign.js';
export const HEAD_CAMPAIGN_KEY='machine-lab.campaign.head.v1';
const copy=s=>JSON.parse(JSON.stringify(s));
export class HeadCampaignStore{
  constructor(storage=globalThis.localStorage){this.storage=storage;}
  fresh(){const s=createHeadStock();return {version:1,specVersion:HEAD_SPEC_VERSION,currentLevel:0,completedLevels:[],revisions:[{revision:0,levelId:null,state:s,measurements:null}],working:cloneHeadState(s),measurements:null};}
  validate(d){
    if(d?.version!==1||d.specVersion!==HEAD_SPEC_VERSION||!Number.isInteger(d.currentLevel)||d.currentLevel<0||d.currentLevel>=HEAD_LEVELS.length||d.revisions?.length!==d.currentLevel+1||d.completedLevels?.length!==d.currentLevel)throw new Error('Invalid head campaign checkpoint');
    d.revisions.forEach((r,i)=>{if(r.revision!==i||r.levelId!==(i?HEAD_LEVELS[i-1].id:null)||i&&d.completedLevels[i-1]!==HEAD_LEVELS[i-1].id)throw new Error('Invalid revision chain');cloneHeadState(r.state);});
    cloneHeadState(d.working);return copy(d);
  }
  load(){const raw=this.storage?.getItem(HEAD_CAMPAIGN_KEY);return raw?this.validate(JSON.parse(raw)):this.fresh();}
  save(d){if(!this.storage)throw new Error('Local storage unavailable');this.storage.setItem(HEAD_CAMPAIGN_KEY,JSON.stringify(this.validate(d)));}
  checkpoint(d,state,result){
    const next=this.validate(d);if(!result?.operationsComplete||next.currentLevel===3)throw new Error('先完成實際加工及檢查');
    const id=HEAD_LEVELS[next.currentLevel].id;next.completedLevels.push(id);next.currentLevel++;
    next.revisions.push({revision:next.currentLevel,levelId:id,state:cloneHeadState(state),measurements:copy(result)});next.working=cloneHeadState(state);next.measurements=null;this.save(next);return next;
  }
}
