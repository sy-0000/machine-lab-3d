import { test, expect } from '@playwright/test';
// 回歸測試：VR 選單的「跳轉項目」按下後要真的執行，而且之後還能繼續點（docs/known-bugs.md #1）。
// 舊版 Menu.js 的 pendingRun 計時在按鈕回彈（0.1 s）後停住，跳轉永遠不執行、之後所有點擊都被擋掉。
// 用桌機模式的同一個 VR 選單畫布（setDesktop）送 pointer 事件，並以頭盔的影格時間（1/72 s）手動推進 update，
// 這樣無頭瀏覽器的軟體繪圖再慢也能重現頭盔上的時序。區域管理器忙碌（鏡頭還在移動）時跳轉會被拒絕，所以每次失敗就重點一次。
test.use({ launchOptions: { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } });
test.setTimeout(600000);

test('VR menu: item buttons run, and the menu keeps accepting clicks', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/?area=lobby#/world');
  await page.waitForFunction(() => window.__xrWorld?.menu && window.__xrWorld.manager?.current?.where, null, { timeout: 480000 });
  const where = () => page.evaluate(() => window.__xrWorld.manager.current.where);
  // 點一下並以 72 fps 推進 0.4 秒；回傳之後的站位
  const clickOnce = action => page.evaluate(a => {
    const m = window.__xrWorld.menu; m.setDesktop(true, 'main');
    const b = m.debugButtons.find(x => x.action === a);
    if (!b) throw new Error('找不到按鈕 ' + a);
    m.pointerAt(b.x + b.w / 2, b.y + b.h / 2, 'move'); m.pointerAt(b.x + b.w / 2, b.y + b.h / 2, 'up');
    for (let i = 0; i < 29; i++) m.update(1 / 72);
    return window.__xrWorld.manager.current.where;
  }, action);
  const go = async (action, expected) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await clickOnce(action) === expected) return;
      await page.waitForTimeout(3000);
    }
    throw new Error(`${action} 點了 40 次都沒有跳到 ${expected}（選單卡住）`);
  };
  expect(await where()).toBe('outside');
  await go('item:vestibule', 'center');
  await go('item:outside', 'outside');
  await go('item:vestibule', 'center');
  expect(errors).toEqual([]);
});
