import { validateWorkpieceState } from '../machining/WorkpieceState.js';
import { validateTargets, isConfirmedTarget } from './LevelDefinition.js';

// Machine floating-point roundoff only. No implicit engineering tolerance.
const slack=(...numbers)=>8*Number.EPSILON*Math.max(1,...numbers.map(Math.abs));
const below=(a,b)=>a<b-slack(a,b);
const above=(a,b)=>a>b+slack(a,b);
const bounds=values=>values.length?{minMm:Math.min(...values),maxMm:Math.max(...values)}:null;
const relation=(min,max,target)=>target===null||min===null?'not-evaluated':
  below(min,target)?(above(max,target)?'mixed':'under-target'):above(max,target)?'over-target':'on-target';

/** Every profile cell overlapping physical stock Z [start,end) is measured, including boundary cells.
 * No fallback acceptance range; observed cut diameters are a separately labelled reference only.
 */
export function measureWorkpiece(workpiece,targets) {
  const s=validateWorkpieceState(workpiece),t=validateTargets(targets,s);
  const cells=s.profile.radiusMm.map((radius,i)=>({start:i*s.profile.resolutionMm,
    end:Math.min((i+1)*s.profile.resolutionMm,s.lengthMm),diameter:2*radius}));
  const observed=cells.filter(c=>c.start>=s.clamping.endZMm&&below(c.diameter,2*s.stock.radiusMm));
  const observedCutDiameter=bounds(observed.map(c=>c.diameter));
  const range=t.machiningZRange,selected=range?cells.filter(c=>c.end>range[0]&&c.start<range[1]):[];
  const actual=bounds(selected.map(c=>c.diameter));
  const coverageMm=range?selected.reduce((sum,c)=>sum+Math.max(0,Math.min(c.end,range[1])-Math.max(c.start,range[0])),0):null;
  const fullCoverage=!!range&&!below(coverageMm,range[1]-range[0]);
  const diameter={targetMm:t.diameterMm,toleranceMm:t.diameterToleranceMm,
    machiningZRange:range?[...range]:null,actual,coverageMm,fullCoverage,
    error:actual&&t.diameterMm!==null?{minMm:actual.minMm-t.diameterMm,maxMm:actual.maxMm-t.diameterMm}:null,
    relation:relation(actual?.minMm??null,actual?.maxMm??null,t.diameterMm),overcut:null,status:'not-evaluated'};
  const length={targetMm:t.finalLengthMm,toleranceMm:t.lengthToleranceMm,actualMm:s.lengthMm,
    errorMm:t.finalLengthMm===null?null:s.lengthMm-t.finalLengthMm,
    relation:relation(s.lengthMm,s.lengthMm,t.finalLengthMm),overcut:null,status:'not-evaluated'};
  const diameterReady=['diameterMm','diameterToleranceMm','machiningZRange'].every(k=>isConfirmedTarget(t,k));
  const lengthReady=['finalLengthMm','lengthToleranceMm'].every(k=>isConfirmedTarget(t,k));
  if(!diameterReady) diameter.status='draft';
  if(!lengthReady) length.status=isConfirmedTarget(t,'finalLengthMm')?'not-evaluated':'draft';
  if(diameterReady) {
    diameter.overcut=!!actual&&below(actual.minMm,t.diameterMm-t.diameterToleranceMm);
    diameter.status=!fullCoverage?'incomplete-range':diameter.overcut?'overcut':
      above(actual.maxMm,t.diameterMm+t.diameterToleranceMm)?'not-yet-to-size':'within-tolerance';
  }
  if(lengthReady) {
    length.overcut=below(s.lengthMm,t.finalLengthMm-t.lengthToleranceMm);
    length.status=length.overcut?'overcut':above(s.lengthMm,t.finalLengthMm+t.lengthToleranceMm)?'not-yet-to-size':'within-tolerance';
  }
  const failed=(diameterReady&&diameter.status!=='within-tolerance')||(lengthReady&&length.status!=='within-tolerance');
  const pending=!diameterReady||!lengthReady;
  return {status:failed?'fail':pending?'draft':'pass',pending,
    diameter,length,observedCutDiameter,overcut:diameter.overcut===true||length.overcut===true?true:pending?null:false};
}
