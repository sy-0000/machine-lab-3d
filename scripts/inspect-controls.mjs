import fs from 'node:fs';import {chromium} from '@playwright/test';
const parts=JSON.parse(fs.readFileSync('assets-src/milling/milling_machine_split_manifest.json')).parts;
const b=await chromium.launch(),p=await b.newPage({viewport:{width:1400,height:1000}});await p.goto('http://localhost:5173/scripts/inspect.html?model=machines/milling/milling.glb');await p.waitForFunction(()=>window.ready);
const sets=[['front-controls',parts.filter(p=>p.name.startsWith('Bottom')&&p.center_m[0]>.15&&Math.max(...p.size_m)>.025).map(p=>p.name),[4,.3,1]],['table-controls',parts.filter(p=>p.name.startsWith('Table')&&Math.max(...p.size_m)>.05).map(p=>p.name),[4,.5,1]],['switch',['Head_Part_049','Head_Part_071','Head_Part_003'],[1,.3,4]],['spindle',['Head_Part_020'],[2,-1,2]]];
for(const [name,names,eye]of sets){await p.evaluate(a=>window.view(...a),[names,eye,true]);await p.waitForTimeout(300);await p.screenshot({path:`reports/v2-${name}.png`});}await b.close();
