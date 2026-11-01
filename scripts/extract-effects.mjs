// 匯出時被略過的工作室特效（光束 SunBeam、爐火火星、蒸汽噴口）的位置與參數 → unity/MachineYard/Assets/Resources/workshop-effects.json
// 用法：npm run dev 之後（埠 PORT，預設 5199）node scripts/extract-effects.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const port = process.env.PORT || 5199;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`http://localhost:${port}/dev/extract-effects.html`);
const data = await page.evaluate(() => new Promise((res, rej) => { const t = setInterval(() => { if (window.__extract) { clearInterval(t); window.__extract.then(res, rej); } }, 100); }));
await browser.close();
writeFileSync('unity/MachineYard/Assets/Resources/workshop-effects.json', JSON.stringify(data, null, 1));
console.log(`光束 ${data.beams.length} 道、蒸汽噴口 ${data.steam.length} 個、火星 ${data.sparks ? 1 : 0}、爐火 ${data.fire ? 1 : 0}`);
