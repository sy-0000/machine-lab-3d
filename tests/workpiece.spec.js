import {test,expect} from '@playwright/test';

test('demo workpiece mounts and unmounts after moving each lathe axis',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:1700});
 await page.goto('/?inspect=1#/lathe');
 const button=page.locator('.workpiece-button');
 await expect(button).toBeEnabled({timeout:60000});
 for(const axis of await page.locator('.axis-control input').all()){
  const min=Number(await axis.getAttribute('min')),max=Number(await axis.getAttribute('max'));
  await axis.fill(String(Number((min+(max-min)*.6).toFixed(4))));
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toHaveText('卸下示範工件');
  const state=await page.evaluate(async()=>{
   const {MachineRegistry}=await import('/src/machines/core/MachineRegistry.js');
   const m=MachineRegistry.getCurrentMachine().runtime;
   m.scene.updateWorldMatrix(true,true);
   const expected=m.scene.localToWorld(m.scene.position.clone().set(-.20274+.09,.8525885,-.0216612));
   return {attached:!!m.workpiece?.parent,inScene:!!m.scene.getObjectByName('DemoWorkpiece'),positionError:m.workpiece.getWorldPosition(m.scene.position.clone()).distanceTo(expected)};
  });
  expect(state.attached).toBe(true);expect(state.inScene).toBe(true);
  expect(state.positionError).toBeLessThan(1e-6);
  await button.click();
  await expect(button).toHaveText('裝上示範工件');
 }
 expect(errors).toEqual([]);
});

test('demo workpiece mounts after dragging a canvas handwheel',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width:1440,height:1700});
 await page.goto('/?inspect=1#/lathe');
 const button=page.locator('.workpiece-button');
 await expect(button).toBeEnabled({timeout:60000});
 await expect.poll(()=>page.evaluate(()=>window.__MACHINE_DEBUG__?.picks.carriageHandwheel?.length||0)).toBeGreaterThan(0);
 const point=await page.evaluate(()=>window.__MACHINE_DEBUG__.picks.carriageHandwheel[0]);
 await page.mouse.move(point.x,point.y);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>window.__MACHINE_DEBUG__.angles.carriageHandwheel)).toBeLessThan(-.1);
 await page.mouse.move(point.x+15,point.y+15);await page.mouse.up();
 await button.click();await expect(button).toHaveText('卸下示範工件');
 expect(errors).toEqual([]);
});
