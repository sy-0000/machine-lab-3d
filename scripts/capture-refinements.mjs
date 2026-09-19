import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:1000}});
for(const [machine,model,shot,names,eye]of [
 ['lathe','lathe_16k20_dark_green_no_backboard.glb','cams',['LeftSelectorPivot','RightSelectorPivot'],[0,.1,3]],
 ['lathe','lathe_16k20_dark_green_no_backboard.glb','tool',['ToolIndexPivot','ToolPostFixedBase'],[1,.9,2]],
 ['milling','deliver_milling_machine_split/milling_machine_textured.glb','right-lever',['MillingRightLever','Head_Part_004'],[3,.4,3]],
 ['drill','drill_press_interactive.glb','switch',['SwitchBody','SwitchLever'],[-3,.4,1]]
]){await p.goto(`http://localhost:5173/scripts/review-refinements.html?model=${model}&machine=${machine}`);await p.waitForFunction(()=>window.ready);if(shot==='tool')await p.evaluate(()=>window.review.runtime.setAxis(window.review.machine,'z',.06));await p.evaluate(args=>window.focus(...args),[names,eye,1.6]);await p.waitForTimeout(250);await p.screenshot({path:fileURLToPath(new URL(`../reports/refinements-${shot}.png`,import.meta.url))});}await b.close();
