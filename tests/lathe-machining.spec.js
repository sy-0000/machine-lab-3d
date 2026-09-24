import {test,expect} from '@playwright/test';

test('manual lathe: actual diameter, axial feed, facing and datum clearing',async({page})=>{
  test.setTimeout(600000); // Full UI flow; software-rendered WebGL can take several minutes on this host.
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/#/lathe');
  await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeEnabled({timeout:60000});
  await page.getByRole('button',{name:'放上工件 Ø20×300'}).click();
  await expect(page.getByTestId('cut-length')).toHaveText('300.000');
  await expect(page.getByRole('button',{name:'開發者測試面板'})).toHaveCount(0);
  await page.getByText('移動到工件座標',{exact:true}).click();
  const move=async(axis,value)=>{
    await page.getByRole('spinbutton',{name:axis+' 工件座標目標 (mm)'}).fill(String(value));
    await page.getByRole('button',{name:'移動 '+axis,exact:true}).click();
  };
  const start=async()=>{
    await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
    await expect.poll(async()=>Number(await page.getByTestId('cut-rpm').textContent())).toBeGreaterThan(0);
  };
  await move('X',20);
  await page.getByRole('button',{name:'X＋ 微調',exact:true}).focus();
  await page.keyboard.down('Space');
  await expect.poll(async()=>Number(await page.getByTestId('cut-x-diameter').textContent())).toBeGreaterThan(20);
  await page.keyboard.up('Space');
  await move('X',20);
  await page.getByRole('button',{name:'X 歸零',exact:true}).click();
  await expect(page.getByTestId('cut-x-diameter')).toHaveText('0.000');
  await expect(page.getByTestId('cut-stock-diameter')).toHaveText('20.000');
  await page.getByRole('button',{name:'X＋ 微調',exact:true}).click();
  await expect(page.getByTestId('cut-x-diameter')).toHaveText('0.100');
  await page.getByRole('button',{name:'X− 微調',exact:true}).click();
  await expect(page.getByTestId('cut-x-diameter')).toHaveText('0.000');
  await start();await move('X',-3.7);
  await expect(page.getByTestId('cut-x-diameter')).toHaveText('-3.700');
  await expect(page.getByTestId('cut-stock-diameter')).toHaveText('16.300');
  await expect(page.getByTestId('cut-contact')).toHaveText('是');
  await move('Z',220);await expect(page.getByTestId('cut-stock-diameter')).toHaveText('16.300');
  await move('X',4);await expect(page.getByTestId('cut-contact')).toHaveText('否');
  await page.getByRole('combobox',{name:'加工模式',exact:true}).selectOption('facing');
  await move('Z',300);
  await page.getByRole('button',{name:'Z 歸零',exact:true}).click();
  await expect(page.getByTestId('cut-z')).toHaveText('0.000');
  await move('Z',-1);await move('X',-10);
  await expect(page.getByTestId('cut-length')).toHaveText('300.000');
  await expect(page.getByTestId('cut-stock-diameter')).toHaveText('10.000');
  await move('X',-20);await expect(page.getByTestId('cut-length')).toHaveText('299.000');
  await page.getByRole('button',{name:'清除工件座標',exact:true}).click();
  await expect(page.getByTestId('cut-x-diameter')).toHaveText('0.000');
  await expect(page.getByTestId('cut-z')).toHaveText('299.000');
  await page.getByRole('button',{name:'■ 停止主軸'}).click();
  await expect(page.getByTestId('cut-rpm')).toHaveText('0');
  expect(errors).toEqual([]);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'X 歸零',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'X 歸零',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
