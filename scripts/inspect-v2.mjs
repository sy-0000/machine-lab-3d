import {chromium} from '@playwright/test';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1200,height:1000}});
await page.goto('http://localhost:5173/scripts/inspect.html');await page.waitForFunction(()=>window.ready);
for(const [file,names,eye,isolate]of [
 ['lathe-tool',['Object_101','Object_103','Object_147','Object_149','Object_150','Object_152','Object_154'],[1,1,2],true],
 ['lathe-right-lever',['Object_127','Object_129','Object_131','Object_133','Object_135','Object_137'],[1,.4,3],true],
]){await page.evaluate(a=>window.view(...a),[names,eye,isolate]);await page.waitForTimeout(300);await page.screenshot({path:`reports/v2-${file}.png`});}
await page.goto('http://localhost:5173/scripts/inspect.html?model=deliver_milling_machine_split/milling_machine_textured.glb');await page.waitForFunction(()=>window.ready);
for(const [file,names,eye,isolate]of [
 ['mill-full',[],[2,.7,2],false],
 ['mill-head',Array.from({length:86},(_,i)=>'Head_Part_'+String(i).padStart(3,'0')),[2,.4,2],true],
 ['mill-spindle-detail',['Head_Part_001','Head_Part_020','Head_Part_047','Head_Part_009','Head_Part_050','Head_Part_034','Head_Part_068'],[2,.2,2],true],
 ['mill-oldspindle',['Head_Part_023','Head_Part_034','Head_Part_051','Head_Part_052'],[2,.7,2],true],
 ['mill-bottom',['Bottom_Part_002','Bottom_Part_003','Bottom_Part_004','Bottom_Part_014','Bottom_Part_035','Bottom_Part_036','Bottom_Part_037'],[2,.4,2],true],
]){await page.evaluate(a=>window.view(...a),[names,eye,isolate]);await page.waitForTimeout(300);await page.screenshot({path:`reports/v2-${file}.png`});}
await browser.close();
