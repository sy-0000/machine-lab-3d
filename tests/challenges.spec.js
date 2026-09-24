import {test,expect} from '@playwright/test';
// Each challenge is played through the student UI only; stars come from the real cut workpiece.
test.setTimeout(300000);
const start=async(page,id)=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/#/challenge/'+id);
  await expect(page.getByRole('button',{name:'開始（5 分鐘）'})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'開始（5 分鐘）'}).click();
  await expect(page.getByRole('timer',{name:'實作倒數'})).toBeVisible();
};
const jog=async(page,name,times)=>{for(let i=0;i<times;i++)await page.getByRole('button',{name,exact:true}).click();};
const step=(page,mm)=>page.getByRole('radiogroup',{name:'每次進給量'}).getByRole('radio',{name:String(mm),exact:true}).click();
const axis=(page,label)=>page.getByRole('radiogroup',{name:'移動軸'}).getByRole('radio',{name:label}).click();
const submit=async page=>{
  await page.getByRole('button',{name:'■ 停止主軸'}).click();
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
  await move('Z',302);await move('X',-4);await move('Z',250);await move('X',2);
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  await expect(page.getByTestId('challenge-result')).toContainText('完美');
  await expect(page.getByRole('link',{name:/下一關：銑床/})).toBeVisible();
  expect(errors).toEqual([]);
});

test('milling challenge: face mill the top to 18.5 and earn three stars',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,'milling');
  expect(await page.evaluate(async()=>{const {MachineRegistry}=await import('/src/machines/core/MachineRegistry.js');return MachineRegistry.getCurrentMachine().currentTool.id;})).toBe('head_face_mill');
  await axis(page,'Z 升降');await step(page,1);await jog(page,'Z＋ 微調',5);
  await page.getByRole('button',{name:'Z 歸零',exact:true}).click();
  await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await step(page,0.5);await jog(page,'Z＋ 微調',3);
  await axis(page,'X 工作臺');await step(page,5);await jog(page,'X＋ 微調',32);
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  expect(errors).toEqual([]);
});

test('drill challenge: quill lock holds the feed; a 10 mm blind hole earns three stars',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await start(page,'drill');
  await expect(page.getByRole('checkbox',{name:/套筒鎖定/})).toBeChecked();
  await step(page,1);await jog(page,'進給− 微調',5);
  await expect(page.getByTestId('contact-state')).toContainText('接觸');
  await page.getByRole('button',{name:'進給 歸零',exact:true}).click();
  await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await jog(page,'進給− 微調',10);await expect(page.getByTestId('dro-quill')).toHaveText('-10.000');
  await step(page,5);await jog(page,'進給＋ 微調',4);
  await expect(await submit(page)).toHaveAttribute('aria-label','3 顆星');
  expect(errors).toEqual([]);
});
