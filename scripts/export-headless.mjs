// 無頭瀏覽器實際跑一次 glb 匯出（需要先 `npm run dev`）。用法：node scripts/export-headless.mjs [網址，預設 http://127.0.0.1:5173]
// 等同在瀏覽器按 Shift+A；檔案由 dev server 寫進 exports/。
import { chromium } from '@playwright/test';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const t0 = Date.now();
page.on('console', m => { const t = m.text(); if (t.startsWith('[export]') || m.type() === 'error') console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', t.slice(0, 240)); });
page.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 300)));
try {
  await page.goto(`${base}/?area=lobby&nobatch#/world`);
  await page.waitForFunction(() => window.__xrExport && window.__xrWorld?.manager?.current?.scene, null, { timeout: 240000 });
  await page.keyboard.press('Shift+A'); // 與使用者在瀏覽器按的快捷鍵相同
  await page.waitForFunction(() => window.__xrExport.manifest.groups?.some(g => g.machineId === 'drill'), null, { timeout: 5400000, polling: 2000 });
  await page.waitForTimeout(1500);
  console.log('done in', ((Date.now() - t0) / 1000).toFixed(0) + 's');
} finally { await browser.close(); }
