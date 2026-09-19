import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:900}});
await p.goto('http://localhost:5173/scripts/inspect.html?model=machines/milling/milling.glb');await p.waitForFunction(()=>window.ready);
await p.evaluate(()=>window.view(['Head_Part_009','Head_Part_021','Head_Part_065'],[2,.5,3],true));await p.waitForTimeout(250);await p.screenshot({path:fileURLToPath(new URL('../reports/current-lever-inspection.png',import.meta.url))});await b.close();
