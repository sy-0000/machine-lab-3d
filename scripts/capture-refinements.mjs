import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:1000}});
for(const [machine,model,shot,names,eye]of [
 ['lathe','machines/lathe/lathe.glb','cams',['LeftSelectorPivot','RightSelectorPivot'],[0,.1,3]],
 ['lathe','machines/lathe/lathe.glb','tool',['ToolIndexPivot','ToolPostLowerBlock'],[1,.9,2]],
 ['milling','machines/milling/milling.glb','right-lever',['MillingRightLever','Head_Part_004'],[3,.4,3]],
 ['drill','machines/drill/drill.glb','switch',['SwitchBody','SwitchLever'],[-3,.4,1]]
]){await p.goto(`http://localhost:5173/scripts/review-refinements.html?model=${model}&machine=${machine}`);await p.waitForFunction(()=>window.ready);if(shot==='tool')await p.evaluate(()=>window.review.runtime.setAxis(window.review.machine,'z',.06));await p.evaluate(args=>window.focus(...args),[names,eye,1.6]);await p.waitForTimeout(250);await p.screenshot({path:fileURLToPath(new URL(`../reports/refinements-${shot}.png`,import.meta.url))});}await b.close();
