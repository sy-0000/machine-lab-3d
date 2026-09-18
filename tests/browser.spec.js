import {test,expect} from '@playwright/test';
const snap=page=>page.evaluate(()=>window.__MACHINE_DEBUG__);
async function open(page,id){await page.setViewportSize({width:1440,height:1700});await page.goto(`/?inspect=1#/${id}`);await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeEnabled({timeout:60000});await page.waitForFunction(id=>window.__MACHINE_DEBUG__?.id===id,id);}
async function reset(page){await page.getByRole('button',{name:'↺ 重設操作與視角'}).click();await expect.poll(async()=>Object.values((await snap(page)).angles).every(x=>x===0)).toBe(true);}
test('home has three cards and loads no GLB before choosing a machine',async({page})=>{const requests=[];page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url());});await page.goto('/');for(const name of ['車床','銑床','鑽床'])await expect(page.locator('.machine-card').filter({hasText:name})).toHaveCount(1);expect(requests).toEqual([]);await page.screenshot({path:'reports/home.png',fullPage:true});});
for(const [id,axis,wheel]of [['lathe','x','carriageHandwheel'],['milling','X_Axis_Table','X_Handwheel_Left_Group'],['drill','quill','feed']])test(`${id}: real load, both directions, slider, spindle, reset, console`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await open(page,id);const initial=await snap(page);
 expect(initial.errors).toEqual(id==='milling'?['找不到 JSON 節點：Worktable_X_Slide']:[]);
 if(id!=='lathe'){await expect(page.getByRole('button',{name:'↶ 按住負向旋轉'})).toBeDisabled();await page.getByRole('checkbox',{name:'啟用教學進給比例'}).check();}
 await page.locator('#wheel-choice').selectOption(wheel);
 const button=page.getByRole('button',{name:'↶ 按住負向旋轉'});await button.focus();await page.keyboard.down('Space');await expect.poll(async()=>(await snap(page)).angles[wheel]).toBeLessThan(-.08);await page.keyboard.up('Space');await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(true);
 const negative=(await snap(page)).angles[wheel];expect(Number(await page.locator('#'+axis).inputValue())).toBeLessThan(0);await page.waitForTimeout(150);expect((await snap(page)).angles[wheel]).toBe(negative);
 await page.getByRole('button',{name:'↷ 按住正向旋轉'}).focus();await page.keyboard.down('Space');await expect.poll(async()=>(await snap(page)).angles[wheel]).toBeGreaterThan(negative);await page.keyboard.up('Space');
 if(id==='lathe')await page.getByRole('button',{name:'裝上示範工件'}).click();
 await page.getByRole('button',{name:'▶ 啟動主軸'}).click();await expect.poll(async()=>(await snap(page)).rpm).toBeGreaterThan(0);if(id==='lathe')await expect(page.getByRole('button',{name:'卸下示範工件'})).toBeDisabled();
 const running=await snap(page),housing=id==='lathe'?'Object_22':id==='milling'?'Head_Assembly':'HeadHousing';expect(running.nodes[housing].quaternion).toEqual(initial.nodes[housing].quaternion);
 await page.getByRole('button',{name:'■ 停止主軸'}).click();await expect.poll(async()=>(await snap(page)).rpm).toBe(0);
 await page.locator('#'+axis).fill(id==='drill'?'-0.05':'0.1');await reset(page);expect((await snap(page)).spindleAngle).toBe(0);expect(Object.values((await snap(page)).offsets).every(v=>v===0)).toBe(true);
 if(id==='drill')await expect(page.locator('#table')).toBeDisabled();
 await page.screenshot({path:`reports/${id}-shared.png`,fullPage:true});expect(errors).toEqual([]);
});
test('real canvas mouse hold, tooltip, context menu, cancellation and orbit restoration',async({page})=>{
 await open(page,'lathe');
 async function point(){await expect.poll(async()=>(await snap(page)).picks.carriageHandwheel.length).toBeGreaterThan(0);return(await snap(page)).picks.carriageHandwheel[0];}
 let p=await point();await page.mouse.move(p.x,p.y);await expect(page.getByRole('tooltip')).toContainText('縱向進給手輪');
 const camera=(await snap(page)).camera;await page.mouse.down();await expect.poll(async()=>(await snap(page)).angles.carriageHandwheel).toBeLessThan(-.1);await page.mouse.move(p.x+10,p.y+10);await page.mouse.up();await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(true);expect((await snap(page)).camera).toEqual(camera);
 const negative=(await snap(page)).angles.carriageHandwheel;p=await point();await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});await expect.poll(async()=>(await snap(page)).angles.carriageHandwheel).toBeGreaterThan(negative);await page.mouse.up({button:'right'});
 for(const event of ['pointercancel','lostpointercapture','blur']){p=await point();await page.mouse.move(p.x,p.y);await page.mouse.down();await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(false);if(event==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else await page.locator('canvas').dispatchEvent(event,{pointerId:1,pointerType:'mouse'});await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(true);await page.mouse.up();}
 p=await point();expect(await page.locator('canvas').evaluate((canvas,p)=>{const e=new MouseEvent('contextmenu',{clientX:p.x,clientY:p.y,cancelable:true,bubbles:true});canvas.dispatchEvent(e);return e.defaultPrevented;},p)).toBe(true);
 expect(await page.locator('header').evaluate(el=>{const e=new MouseEvent('contextmenu',{cancelable:true,bubbles:true});el.dispatchEvent(e);return e.defaultPrevented;})).toBe(false);
});
test('mobile touch buttons stop on touch cancel; responsive navigation',async({page,context})=>{
 await open(page,'drill');await page.setViewportSize({width:390,height:844});await page.getByRole('checkbox',{name:'啟用教學進給比例'}).check();const button=page.getByRole('button',{name:'↶ 按住負向旋轉'});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await expect.poll(async()=>(await snap(page)).angles.feed).toBeLessThan(0);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(true);const stopped=(await snap(page)).angles.feed;await page.waitForTimeout(150);expect((await snap(page)).angles.feed).toBe(stopped);const reverse=await page.getByRole('button',{name:'↷ 按住正向旋轉'}).boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:reverse.x+reverse.width/2,y:reverse.y+reverse.height/2,id:2}]});await expect.poll(async()=>(await snap(page)).angles.feed).toBeGreaterThan(stopped);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect.poll(async()=>(await snap(page)).orbitEnabled).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'reports/mobile-shared.png',fullPage:true});await page.getByRole('link',{name:'← 返回機器選單'}).click();await expect(page.locator('.machine-card')).toHaveCount(3);
});
test('missing GLB is explicit and controls disabled',async({page})=>{await page.route('**/drill_press_interactive.glb',r=>r.fulfill({status:404,body:'missing'}));await page.goto('/#/drill');await expect(page.getByRole('alert')).toContainText('模型讀取失敗');await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeDisabled();});
test('orbit rotation zoom pan and camera reset',async({page})=>{
 await open(page,'drill');const initial=(await snap(page)).camera,box=await page.locator('canvas').boundingBox(),x=box.x+40,y=box.y+100;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+90,y+40,{steps:6});await page.mouse.up();await expect.poll(async()=>(await snap(page)).camera).not.toEqual(initial);
 const rotated=(await snap(page)).camera;await page.mouse.wheel(0,-180);await expect.poll(async()=>(await snap(page)).camera).not.toEqual(rotated);
 const zoomed=(await snap(page)).camera;await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+60,y+20,{steps:6});await page.mouse.up({button:'right'});await expect.poll(async()=>(await snap(page)).camera).not.toEqual(zoomed);
 await reset(page);await expect.poll(async()=>(await snap(page)).camera.map((v,i)=>Math.abs(v-initial[i])<1e-5).every(Boolean)).toBe(true);
});
test('bad JSON reference is shown; missing spindle assembly disables start',async({page})=>{
 await page.route('**/drill_press_parts.json',async route=>{const response=await route.fetch(),json=await response.json();json.interactions.SpindleAssembly.includes.push('MissingDrillPart');await route.fulfill({json});});await page.goto('/#/drill');await expect(page.getByRole('alert')).toContainText('MissingDrillPart');await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeDisabled();
});
test('world distance warnings and reset',async({page})=>{await open(page,'lathe');await page.getByRole('button',{name:'▶ 啟動主軸'}).click();await expect.poll(async()=>(await snap(page)).rpm).toBeGreaterThan(100);await page.locator('#x').fill('-0.01');await expect(page.locator('.notice')).toHaveClass(/caution/);await page.locator('#x').fill('-0.24');await expect(page.locator('.notice')).toHaveClass(/danger/);await reset(page);await expect(page.locator('.notice')).toContainText('目前無警告');});
