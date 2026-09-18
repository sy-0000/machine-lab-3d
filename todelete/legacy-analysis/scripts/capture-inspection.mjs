import {chromium} from '@playwright/test';
const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1000,height:850}});await p.goto('http://localhost:5173/scripts/inspect.html');await p.waitForFunction(()=>window.ready);
for(const [file,names,eye,isolate] of [
 ['full',[],[-2,1.2,3],false],
 ['carriage',['Object_117'],[1,.8,3],true],
 ['cross',['Object_105','Object_107','Object_109'],[1,.5,2],true],
 ['height',['Object_143','Object_145'],[2,1,1],true],
 ['tail',['Object_68','Object_70','Object_72','Object_189'],[3,1,1],true],
 ['spindle',['Object_78','Object_80'],[2,1,2],true],
 ['lever',['Object_10','Object_12','Object_38'],[1,.5,3],true]
]){await p.evaluate(({names,eye,isolate})=>window.view(names,eye,isolate),{names,eye,isolate});await p.waitForTimeout(150);await p.screenshot({path:`reports/${file}.png`});}await b.close();
