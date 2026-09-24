import {test,expect} from '@playwright/test';

test('player UI, exclusive demo input, Group reset and single clock use one session', async ({page}) => {
  test.setTimeout(600000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?inspect=1#/lathe');
  await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeEnabled({timeout:60000});
  // Observe the real UI's session instead of creating a parallel controller or animation loop.
  await page.evaluate(async()=>{
    const {MachineSession}=await import('/src/machining/MachineSession.js');
    const original=MachineSession.prototype.command;
    window.__SESSION_COMMANDS__=[];
    MachineSession.prototype.command=function(command,...args){
      window.__SESSION_TEST__=this;window.__SESSION_COMMANDS__.push(command.type);
      return original.call(this,command,...args);
    };
  });
  await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().rpm)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__SESSION_COMMANDS__)).toContain('spindle.start');
  await page.getByRole('button',{name:'■ 停止主軸'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().rpm)).toBe(0);
  await page.evaluate(()=>{
    const s=window.__SESSION_TEST__,demo=s.createInput('demo');
    window.__DEMO_TEST__=demo;window.__LEASE_TEST__=s.lockInput(demo);
    s.command({type:'workOffset.set',axis:'X',representation:'diameter',valueMm:20},demo);
    s.command({type:'axis.move',axis:'X',representation:'diameter',valueMm:16.3},demo);
    s.command({type:'spindle.start'},demo);
  });
  await expect(page.getByRole('button',{name:'▶ 啟動主軸'})).toBeDisabled();
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().rpm)).toBeGreaterThan(0);
  const lockState=await page.evaluate(()=>{
    const s=window.__SESSION_TEST__;
    return {state:s.getState(),denied:s.command({type:'axis.move',axis:'Z',valueMm:99})};
  });
  expect(lockState.denied.ok).toBe(false);expect(lockState.state.lathe.xDiameterMm).toBeCloseTo(16.3);
  expect(lockState.state.machineAxesMm.y).toBeCloseTo(-1.85);
  expect(lockState.state.updateCount).toBeGreaterThan(0);
  await page.evaluate(()=>window.__SESSION_TEST__.unlockInput(window.__LEASE_TEST__));
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().rpm)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().leverAngle)).toBe(0);
  expect(await page.evaluate(async()=>{
    const s=window.__SESSION_TEST__;
    const mounted=await s.command({type:'workpiece.mount',spec:{type:'cylinder',diameter:20,length:100}});
    const tool=await s.command({type:'tool.select',toolId:'threading_tool'});
    return {mounted,tool};
  })).toEqual({mounted:{ok:true},tool:{ok:true}});
  await page.getByRole('button',{name:'↺ 重設操作與視角'}).click();
  const reset=await page.evaluate(async()=>{
    const {MachineRegistry}=await import('/src/machines/core/MachineRegistry.js');
    const machine=MachineRegistry.getCurrentMachine();
    let blocked=false;try{machine.step(1);}catch{blocked=true;}
    return {state:window.__SESSION_TEST__.getState(),attached:!!machine.currentWorkpiece.object3D.parent,defaultVisible:machine.runtime.lookup.TurningTool.visible,blocked};
  });
  expect(reset.attached).toBe(true);expect(reset.defaultVisible).toBe(false);expect(reset.blocked).toBe(true);
  expect(reset.state.activeCuttingTool.id).toBe('threading_tool');
  await page.getByRole('tab',{name:'鑽床'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__MACHINE_DEBUG__?.id)).toBe('drill');
  await page.getByRole('button',{name:'▶ 啟動主軸'}).click();
  await expect.poll(()=>page.evaluate(()=>window.__SESSION_TEST__.getState().id)).toBe('drill');
  await page.getByRole('link',{name:'← 返回首頁'}).click();
  expect(await page.evaluate(()=>window.__SESSION_TEST__.getState().disposed)).toBe(true);
  expect(errors).toEqual([]);
});
