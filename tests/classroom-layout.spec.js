import {test,expect} from '@playwright/test';
test('levels page: three machine challenges, each opens its task step',async({page})=>{
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/#/levels');
 const cards=page.locator('.challenge-card');
 await expect(cards).toHaveCount(3);
 await expect(cards.nth(0)).toContainText('車床');await expect(cards.nth(1)).toContainText('銑床');await expect(cards.nth(2)).toContainText('鑽床');
 await page.screenshot({path:'reports/levels-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.setViewportSize({width:1440,height:900});
 await cards.nth(0).getByRole('link',{name:'開始 →'}).click();
 await expect(page).toHaveURL(/#\/challenge\/lathe$/);
 await expect(page.getByRole('list',{name:'關卡流程'})).toBeVisible();
 await expect(page.getByRole('button',{name:'開始（5 分鐘）'})).toBeEnabled({timeout:60000});
 await expect(page.getByRole('button',{name:'觀看示範'})).toHaveCount(0);
 expect(errors).toEqual([]);
});
const AXIS={lathe:{testid:'cut-x-diameter',minus:'X− 微調',zero:'X 歸零',node:'y'},milling:{testid:'dro-X',minus:'X− 微調',zero:'X 歸零',node:'X_Axis_Table'},drill:{testid:'dro-table',minus:'工作臺− 微調',zero:'工作臺 歸零',node:'table'}};
for(const id of ['lathe','milling','drill'])test(id+' classroom: camera presets, stock + fixture, jog step, zero, spindle and reset',async({page})=>{
 test.setTimeout(600000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('/?inspect=1#/'+id);
 await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeEnabled({timeout:60000});
 await expect(page.getByRole('button',{name:'開發者測試面板'})).toHaveCount(0);
 const read=()=>page.evaluate(()=>window.__MACHINE_DEBUG__);
 await expect.poll(async()=>!!(await read())).toBe(true);
 // Camera presets: button and keyboard shortcut.
 const views=page.getByRole('toolbar',{name:'視角'});
 await expect(views.getByRole('button')).toHaveCount(2);
 await views.getByRole('button',{name:/特寫/}).click();
 await expect(views.getByRole('button',{name:/特寫/})).toHaveAttribute('aria-pressed','true');
 await page.keyboard.press('1');
 await expect(views.getByRole('button',{name:/工作區/})).toHaveAttribute('aria-pressed','true');
 // Stock (and vise on milling / drill).
 await page.getByRole('button',{name:/放上工件/}).click();
 await expect(page.getByRole('button',{name:'換新毛胚'})).toBeVisible({timeout:30000});
 if(id!=='lathe')expect(await page.evaluate(async()=>{const {MachineRegistry}=await import('/src/machines/core/MachineRegistry.js');return !!MachineRegistry.getCurrentMachine().currentWorkpiece.object3D.getObjectByName('Fixture_Vise');})).toBe(true);
 // One click moves exactly one selected step; zero resets the readout only.
 const {testid,minus,zero}=AXIS[id],value=async()=>Number(await page.getByTestId(testid).textContent());
 const before=await value();
 if(id==='drill')await page.getByRole('radiogroup',{name:'移動軸'}).getByRole('radio',{name:'工作臺高度'}).click();
 await page.getByRole('radiogroup',{name:'每次進給量'}).getByRole('radio',{name:'1',exact:true}).click();
 await page.getByRole('button',{name:minus}).click();
 await expect.poll(value).toBeCloseTo(before-1,3);
 await page.getByRole('button',{name:zero,exact:true}).click();
 await expect.poll(value).toBeCloseTo(0,3);
 if(id==='lathe'){
  // Contact cue when the tip reaches the Ø20 surface.
  await page.getByText('移動到工件座標',{exact:true}).click();
  await page.getByRole('button',{name:'X 歸零',exact:true}).click();
  await page.getByRole('button',{name:'清除工件座標',exact:true}).click();
  await page.getByRole('spinbutton',{name:'X 工件座標目標 (mm)'}).fill('20');
  await page.getByRole('button',{name:'移動 X',exact:true}).click();
  await expect(page.getByTestId('contact-state')).toContainText('接觸');
 }
 await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
 await expect.poll(async()=>(await read()).rpm).toBeGreaterThan(0);
 await page.getByRole('button',{name:'■ 停止主軸'}).click();
 await expect.poll(async()=>(await read()).rpm).toBe(0);
 await page.getByRole('button',{name:'↺ 重設操作與視角'}).click();
 await expect.poll(async()=>(await read()).offsets[AXIS[id].node]).toBe(0);
 if(id==='lathe'){
  await page.screenshot({path:'reports/classroom-controls-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(errors).toEqual([]);
});
