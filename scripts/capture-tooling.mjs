import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:1000}});
for(const [machine,model,shot,names,eye]of [
 ['lathe','machines/lathe/lathe.glb','panel',['LeftSelectorPivot','RightSelectorPivot','SpindleSpeedTable'],[0,.05,3]],
 ['lathe','machines/lathe/lathe.glb','tool',['ToolIndexPivot','ToolPostColumn'],[1,1.2,2]],
 ['milling','machines/milling/milling.glb','spindle',['MillingRightLever','Spindle_Rotor_Group'],[2,.4,-3]],
 ['drill','machines/drill/drill.glb','drill',['Chuck','TwistDrill'],[2,.4,3]]
]){await p.goto(`http://localhost:5173/scripts/review-refinements.html?model=${model}&machine=${machine}`);await p.waitForFunction(()=>window.ready);if(shot==='tool')await p.evaluate(()=>{window.review.runtime.setAxis(window.review.machine,'z',.06);window.review.runtime.indexTool(window.review.machine,-1);});if(shot==='drill')await p.evaluate(()=>window.review.runtime.setAxis(window.review.machine,'quill',-.085));await p.evaluate(args=>window.focus(...args),[names,eye,1.45]);await p.waitForTimeout(250);await p.screenshot({path:fileURLToPath(new URL(`../reports/tooling-${shot}.png`,import.meta.url))});}await b.close();
