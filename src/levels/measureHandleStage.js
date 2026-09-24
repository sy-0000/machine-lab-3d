import { measureWorkpiece } from './measureWorkpiece.js';
import { measureTaper } from './measureTaper.js';
import { taperRange } from './handleCampaign.js';
function sweptLength(operations,[start,end]) {
  const spans=operations.map(op=>[Math.max(start,Math.min(op.from.zMm,op.to.zMm)),Math.min(end,Math.max(op.from.zMm,op.to.zMm))])
    .filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0,until=start;
  for(const [a,b] of spans){total+=Math.max(0,b-Math.max(a,until));until=Math.max(until,b);}return total;
}
export function measureHandleStage(def,stock,input) {
  const base=measureWorkpiece(stock,def.targets);
  const history=stock.operationHistory.slice(input.operationHistory.length);
  const turned=history.some(op=>op.type==='profile-cut');
  const faced=stock.lengthMm<input.lengthMm&&history.some(op=>op.type==='face-cut');
  const diagonal=history.filter(op=>op.type==='profile-cut'&&Math.abs(op.to.zMm-op.from.zMm)>1e-6&&Math.abs(op.to.vMm-op.from.vMm)>1e-6);
  let operationsComplete=turned&&faced;
  let taper=null,chamfer=null;
  if(def.stage==='taper') {
    const range=taperRange(stock,def.taper);
    taper=measureTaper(stock,{...def.taper,rangeMm:range});
    operationsComplete=sweptLength(diagonal,range)>=def.taper.lengthMm-1e-7;
  }
  if(def.stage==='end') {
    const feature=def.features.find(f=>f.type==='chamfer'),size=feature.sizeMm;
    const start=input.lengthMm-size;
    const diameter=2*input.profile.radiusMm[Math.floor(start/input.profile.resolutionMm)];
    chamfer=diameter>2*size?measureTaper(stock,{rangeMm:[start,input.lengthMm],largeDiameterMm:diameter,smallDiameterMm:diameter-2*size,
      status:feature.status,toleranceMm:feature.toleranceMm,toleranceStatus:feature.toleranceStatus||'unknown'}):null;
    operationsComplete=sweptLength(diagonal,[start,input.lengthMm])>=size-1e-7;
  }
  if(def.stage==='finish')operationsComplete=false;
  const features=(def.features||[]).map(f=>({...f,status:f.type==='chamfer'?chamfer?.status||'draft':'draft',drawingStatus:f.status,
    actual:stock.features.find(actual=>actual.type===f.type)||null,accepted:f.type==='chamfer'&&chamfer?.status==='within-tolerance'}));
  const criteria=def.stage==='basic'?[base.length.status]:def.stage==='taper'?[taper.status]:features.map(f=>f.status);
  const pending=criteria.some(s=>['draft','not-evaluated'].includes(s));
  const status=criteria.some(s=>!['draft','not-evaluated','within-tolerance'].includes(s))?'fail':pending?'draft':'pass';
  const cuts=[base.length.overcut,taper?.overcut??null,chamfer?.overcut??null];
  return {...base,taper,chamfer,features,turned,faced,operationsComplete,
    status,pending,overcut:cuts.includes(true)?true:pending?null:false,
    machiningComplete:operationsComplete&&status==='pass'};
}
