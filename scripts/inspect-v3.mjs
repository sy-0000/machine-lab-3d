import {chromium} from '@playwright/test';
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:1000}});
for(const [model,name,names,eye]of [
 ['machines/lathe/lathe.glb','lathe-accessories',['Object_168','Object_170','Object_171','Object_173','Object_175','Object_177','Object_181','Object_183','Object_185','Object_209'],[-2,1,3]],
 ['machines/lathe/lathe.glb','lathe-dials',['Object_24','Object_26','Object_28','Object_30','Object_32','Object_34','Object_36'],[0,.1,3]],
 ['machines/drill/drill.glb','drill-table',['HeadInternalSupport','PowerCableAndWiring','TableSupportCollar','WorkTableCasting'],[2,1,3]],
 ['machines/milling/milling.glb','mill-levers',['Head_Part_023','Head_Part_034','Head_Part_068','Head_Part_071'],[2,1,3]]
]){await p.goto('http://localhost:5173/scripts/inspect.html?model='+model);await p.waitForFunction(()=>window.ready);await p.evaluate(args=>window.view(...args),[names,eye,true]);await p.waitForTimeout(350);await p.screenshot({path:`reports/v3-${name}.png`});}
await b.close();
