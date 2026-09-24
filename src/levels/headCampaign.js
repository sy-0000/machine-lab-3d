import {HAMMER_DRAWING} from './hammerDrawingSpec.js';
import {createHeadState,headBounds,supportedHole} from '../machining/HeadWorkpieceState.js';
export const HEAD_SPEC_VERSION='hammer-head-user-stock-v1';
const h=HAMMER_DRAWING.head;
export const HEAD_LEVELS=[
  {id:'head-basic',title:'槌頭 1 · 基準面與基本尺寸',machine:'milling',tool:'head_end_mill',operation:'milling',
    hint:'裝夾 20×20×90，開主軸，以手輪或刀尖座標進給銑削。目標 18.5×18.5×86；正式公差未知。',targets:{basicSize:h.basicSizeMm,tolerance:h.tolerances}},
  {id:'head-profile',title:'槌頭 2 · 外形／斜面／倒角',machine:'milling',tool:'head_end_mill',operation:'milling',
    hint:'以連續 X/Z 進給切出斜面。左 1.5×45°、右 3×45° 已確認；完整輪廓對應與 R1.5 製程尚待確認。',targets:{leftChamfer:h.leftChamfer,rightChamfer:h.rightChamfer,tipRadius:h.tipRadiusMm,tolerance:h.tolerances}},
  {id:'head-drill',title:'槌頭 3 · Ø8.5 底孔',machine:'drill',tool:'head_drill_85',operation:'drilling',
    hint:'停機定位 X/Y，裝 Ø8.5 鑽頭後開主軸，向下進給。X 距實際左端 40；Y、孔深／通孔仍 unknown。',targets:{x:h.holeCenterFromLeftMm,y:h.holeAcrossMm,diameter:h.tapDrillDiameterMm,depth:h.holeDepthMm,tolerance:h.tolerances}},
  {id:'head-tap',title:'槌頭 4 · M10 攻牙',machine:'drill',tool:'head_tap_m10',operation:'tapping',
    hint:'停機換 M10 絲攻，對準實際 Ø8.5 底孔，再開主軸向下進給。無有效底孔不會產生螺紋。牙深／螺距 unknown。',targets:{thread:h.thread,pilotDiameter:h.tapDrillDiameterMm,depth:h.threadPitchAndDepth,tolerance:h.tolerances}},
];
export const createHeadStock=()=>createHeadState(h.stockMm.value);
export function headDimension(label,actual,target,tolerance=h.tolerances){
  const confirmed=target?.status==='confirmed',error=confirmed&&Number.isFinite(actual)&&typeof target.value==='number'?actual-target.value:null;
  const evaluated=confirmed&&tolerance?.status==='confirmed'&&Number.isFinite(tolerance.value)&&error!==null;
  return {label,target:target?.value??null,actual,error,confirmation:target?.status??'unknown',
    status:evaluated?(Math.abs(error)<=tolerance.value?'pass':error<0?'overcut':'under-target'):'draft'};
}
export function measureHeadStage(def,state,input){
  const b=headBounds(state),ops=state.operationHistory.slice(input.operationHistory.length);
  const hole=state.features.find(f=>f.type==='hole'),rows=[];
  if(def.id==='head-basic'){
    for(const [key,label] of [['lengthMm','長度'],['widthMm','寬度'],['heightMm','高度']])rows.push(headDimension(label,b[key],{status:h.basicSizeMm.status,value:h.basicSizeMm.value[key]},def.targets.tolerance));
    const heights=state.surface.topMm.filter(v=>v>0),minHeight=heights.length?Math.min(...heights):0;
    rows.push(headDimension('最低剩餘表面高度',minHeight,{status:h.basicSizeMm.status,value:h.basicSizeMm.value.heightMm},def.targets.tolerance));
  }
  if(def.id==='head-profile'){
    // Measurements remain unassigned until a face/edge datum for each view is confirmed.
    for(const [key,label] of [['leftChamfer','左倒角'],['rightChamfer','右倒角'],['tipRadius','尖端半徑']])rows.push({...headDimension(label,null,def.targets[key]),note:'需確認加工面／輪廓 datum；尚未驗收'});
  }
  if(def.id==='head-drill'){
    rows.push(headDimension('孔距實際左端',hole?hole.xMm-b.minX:null,def.targets.x,def.targets.tolerance),headDimension('孔 Y',hole?.yMm??null,def.targets.y),
      headDimension('孔徑',hole?.diameterMm??null,def.targets.diameter,def.targets.tolerance),headDimension('孔深',hole?.depthMm??null,def.targets.depth));
    rows.push({label:'通孔',actual:hole?.through??null,target:null,error:null,confirmation:'unknown',status:'draft'});
  }
  if(def.id==='head-tap'){
    const tapped=state.features.find(f=>f.thread),valid=!!tapped&&supportedHole(state,tapped)&&tapped.thread.state==='tapped'&&tapped.diameterMm===h.tapDrillDiameterMm.value&&tapped.thread.sourceHole===tapped.id&&tapped.thread.designation===h.thread.value;
    rows.push({label:'螺紋規格／有效底孔',target:h.thread.value,actual:tapped?.thread.designation??null,error:null,confirmation:'confirmed',status:valid?'pass':'not-evaluated'},
      headDimension('已攻牙深度',tapped?.thread.tappedDepthMm??null,def.targets.depth));
  }
  const operationsComplete=ops.some(o=>o.type===def.operation&&(def.id!=='head-profile'||(Math.abs(o.to.xMm-o.from.xMm)>0.01&&Math.abs(o.to.zMm-o.from.zMm)>0.01)));
  const fail=rows.some(r=>['overcut','under-target','fail'].includes(r.status));
  return {rows,operationsComplete,status:fail?'fail':rows.every(r=>r.status==='pass')?'pass':'draft',bounds:b};
}
