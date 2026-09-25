import {test,expect} from '@playwright/test';
// Each challenge is played through the student UI only; stars come from the real cut workpiece.
test.setTimeout(300000);
const start=async(page,id)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/#/challenge/'+id);
  const begin=page.getByRole('button',{name:/^開始（\d 分鐘）$/});
  await expect(begin).toBeEnabled({timeout:60000});
  await begin.click();
  await expect(page.getByRole('timer',{name:'實作倒數'})).toBeVisible();
};
const jog=async(page,name,times)=>{for(let i=0;i<times;i++)await page.getByRole('button',{name,exact:true}).click();};
const step=(page,mm)=>page.getByRole('radiogroup',{name:'每次進給量'}).getByRole('radio',{name:String(mm),exact:true}).click();
const axis=(page,label)=>page.getByRole('radiogroup',{name:'移動軸'}).getByRole('radio',{name:label}).click();
const submit=async page=>{
  const stop=page.getByRole('button',{name:'■ 停止主軸'});if(await stop.isEnabled())await stop.click();
  const button=page.getByRole('button',{name:'繳交',exact:true});await expect(button).toBeEnabled({timeout:20000});await button.click();
  return page.getByTestId('stars');
};

test('lathe challenge: turn Ø16 × 50 and earn three stars',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,'lathe');
  await page.getByText('移動到工件座標',{exact:true}).click();
  const move=async(a,v)=>{await page.getByRole('spinbutton',{name:a+' 工件座標目標 (mm)'}).fill(String(v));await page.getByRole('button',{name:'移動 '+a,exact:true}).click();};
  await move('X',24);await move('Z',280);await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await move('X',20);await expect(page.getByTestId('contact-state')).toContainText('切削中');
  await page.getByRole('button',{name:'X 歸零',exact:true}).click();
  await expect(page.getByLabel('目前工件尺寸')).toContainText('Ø20 × 300 mm');
  await move('Z',302);await move('X',-4);await move('Z',250);await move('X',2);
  await expect(page.getByLabel('目前工件尺寸')).toContainText('50 mm');await expect(page.getByLabel('目前工件尺寸')).toContainText('Ø16 mm');
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  await expect(page.getByTestId('challenge-result')).toContainText('完美');
  await expect(page.getByRole('link',{name:/下一關：銑床/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('milling challenge: face mill the top to 18.5 and earn three stars',async({page})=>{
  test.setTimeout(600000); // each table jog re-cuts the full surface grid; slow in headless software WebGL
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,'milling');
  expect(await page.evaluate(async()=>{const {MachineRegistry}=await import('/src/machines/core/MachineRegistry.js');return MachineRegistry.getCurrentMachine().currentTool.id;})).toBe('head_face_mill');
  await axis(page,'X 工作臺');await step(page,5);await jog(page,'X＋ 微調',9);
  await axis(page,'Z 升降');await step(page,1);await jog(page,'Z＋ 微調',6);
  // One step too far: the stopped cutter is pushed into the stock and the panel says so.
  await expect(page.getByTestId('contact-state')).toContainText('刀尖壓入工件 1.00 mm');
  await jog(page,'Z− 微調',1);await expect(page.getByTestId('contact-state')).toContainText('接觸（對刀點）');
  await page.getByRole('button',{name:'Z 歸零',exact:true}).click();
  await axis(page,'X 工作臺');await step(page,5);await jog(page,'X− 微調',9);await axis(page,'Z 升降');
  await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await step(page,0.5);await jog(page,'Z＋ 微調',3);
  await axis(page,'X 工作臺');await step(page,5);await jog(page,'X＋ 微調',32);
  await expect(page.getByLabel('目前工件尺寸')).toContainText('整面已銑平');await expect(page.getByLabel('目前工件尺寸')).toContainText('18.5 mm');
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  expect(errors).toEqual([]);
});

test('drill challenge: line up two scribed holes, pick the right drills, tap M10, earn three stars',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,'drill');
  const feed=page.getByRole('button',{name:'進給− 微調',exact:true}),dro=async()=>Number(await page.getByTestId('dro-quill').textContent());
  const slideX=async()=>Number(await page.getByTestId('dro-slide').textContent());
  const hold=async until=>{await feed.scrollIntoViewIfNeeded();const b=await feed.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
    await expect.poll(until,{timeout:60000,intervals:[30]}).toBe(true);const at=await dro();await page.mouse.up();return at;};
  const tool=async id=>{const select=page.getByRole('combobox',{name:'刀具'});await expect(select).toBeEnabled({timeout:20000});await select.selectOption(id);await expect(select).toHaveValue(id);};
  const stopAt=async v=>{await page.getByRole('spinbutton',{name:'深度擋塊（讀值 mm）'}).fill(String(v));const c=page.getByRole('checkbox',{name:/深度擋塊/});if(!await c.isChecked())await c.check();};
  const drillTo=async v=>{await stopAt(v);await page.getByRole('button',{name:'▶ 啟動主軸'}).click();await axis(page,'主軸進給');await step(page,1);
    await hold(async()=>Math.abs(await dro()-v)<.01);await expect.poll(dro).toBe(0);await page.getByRole('button',{name:'■ 停止主軸'}).click();};
  await expect(page.getByLabel('目前工件尺寸')).toContainText('尚未鑽孔');
  // Line up with the X=25 scribe; the stock only slides with the quill up and the spindle stopped.
  await axis(page,'工件定位 X');await step(page,5);await jog(page,'工件 X− 微調',4);await expect.poll(slideX).toBe(25);
  await tool('head_drill_85');
  await axis(page,'主軸進給');await step(page,0.1);
  const touch=await hold(async()=>(await page.getByTestId('contact-state').textContent()).includes('接觸（'));expect(touch).toBeLessThan(-4);
  await expect.poll(dro).toBe(0);
  const at=d=>Math.round((touch-d)*10)/10;
  await drillTo(at(15));
  await tool('head_tap_m10');await drillTo(at(10));
  await expect(page.getByLabel('目前工件尺寸')).toContainText('M10 攻牙');
  await axis(page,'工件定位 X');await step(page,5);await jog(page,'工件 X＋ 微調',8);await expect.poll(slideX).toBe(65);
  await tool('head_drill_10');await drillTo(at(8));
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  expect(errors).toEqual([]);
});

test('workspace fullscreen toggle',async({page})=>{
  await start(page,'lathe');
  await page.getByRole('button',{name:'⛶ 全螢幕'}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.className)).toBe('game-workspace');
  await page.getByRole('button',{name:'🗗 離開全螢幕'}).click();
  await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBe(null);
});
