import { LEVEL_1 } from './level1.js';
import { HAMMER_DRAWING } from './hammerDrawingSpec.js';
export const SPEC_VERSION='hammer-photo-v1';
const h=HAMMER_DRAWING.handle;
// Teaching setup, not a new drawing dimension: drawing left end faces the free end.
export const HANDLE_SETUP={datum:'left-end',direction:-1,datumAt:'actual-free-face'};
export const HANDLE_LEVELS=[
  {...LEVEL_1,stage:'basic',summary:'Ø20×300 毛胚；端面總長 240。基礎外徑只驗證減料，不要求等徑 Ø16.3。'},
  {...LEVEL_1,id:'handle-taper',title:'槌柄－錐度車削',stage:'taper',
    summary:'圖面左端 d20–120：錐長 100，大端 Ø16.3、小端 Ø9.3。圖面左端朝自由端；公差待確認。',
    taper:{status:'confirmed',lengthMm:h.taperLengthMm.value,largeDiameterMm:h.taperLargeDiameterMm.value,
      smallDiameterMm:h.taperSmallDiameterMm.value,endSegmentMm:h.leftEndLengthMm.value,toleranceMm:null,toleranceStatus:'unknown'}},
  {...LEVEL_1,id:'handle-end',title:'槌柄－端部成形',stage:'end',
    summary:'端段長 20；自由端 1×45° 倒角。端段直徑／螺紋待確認；SR9 在夾持側，待重新裝夾流程。',
    features:[{id:'chamfer',type:'chamfer',status:'confirmed',sizeMm:1,angleDeg:45,toleranceMm:null},
      {id:'sphere',type:'sphere',status:'confirmed',radiusMm:9,operationStatus:'draft',reason:'夾持側 SR9 需要重新裝夾，尚未加工'}]},
  {...LEVEL_1,id:'handle-finish',title:'槌柄－壓花／螺紋製程',stage:'finish',
    summary:'壓花範圍、節距及柄端螺紋規格未知。本關只提供製程架構，不會自動產生特徵或判定完成。',
    features:[{id:'knurl',type:'knurl',status:'draft',rangeMm:null,pitchMm:null},
      {id:'thread',type:'thread',status:'draft',rangeMm:null,pitchMm:null,diameterMm:null}]},
];
export const taperRange=(stock,target)=>[stock.lengthMm-target.endSegmentMm-target.lengthMm,stock.lengthMm-target.endSegmentMm];
