// 產生 Unity 用的繁中字型子集（TrueType、靜態 wght 500）：node scripts/unity-font.mjs
// 來源：Noto Sans TC 可變字型（SIL Open Font License 1.1，免費、可商用、可再散布）。
//   預設從 google/fonts 下載；或用 FONT_FILE 指定本機的 NotoSansTC 可變字型（例如 C:/Windows/Fonts/NotoSansTC-VF.ttf）。
// 收字：網站 VR 用字（src/xr/fonts/chars.txt）＋ Unity C# 原始碼與 Resources/*.json 裡的所有非 ASCII 字＋全部可列印 ASCII。
// 產出：unity/MachineYard/Assets/Fonts/MachineYardSansTC.ttf（＋ OFL.txt），由 Unity 選單「0b. Create CJK font asset」轉成 TMP 字型資產。
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf';
const OFL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanstc/OFL.txt';
const out = 'unity/MachineYard/Assets/Fonts';

const chars = new Set(readFileSync('src/xr/fonts/chars.txt', 'utf8'));
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const c of '　，。、；：？！「」『』（）《》〈〉…—–·・／％＋－×÷±°ØⅠⅡⅢ①②③④⑤←→↑↓▶■●○★☆✓✗') chars.add(c);
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const f of walk('unity/MachineYard/Assets').filter(f => /\.(cs|json)$/.test(f))) for (const c of readFileSync(f, 'utf8')) if (c.charCodeAt(0) > 0x7f) chars.add(c);
for (const c of [...chars]) if (/\s/.test(c) && c !== ' ' && c !== '　') chars.delete(c);

async function source() {
  if (process.env.FONT_FILE) return readFileSync(process.env.FONT_FILE);
  const r = await fetch(URL); if (!r.ok) throw new Error('下載字型失敗：' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
const font = await source();
const subset = await subsetFont(font, [...chars].join(''), { targetFormat: 'truetype', variationAxes: { wght: 500 } });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'MachineYardSansTC.ttf'), subset);
writeFileSync(join(out, 'chars.txt'), [...chars].sort().join(''));   // Unity 端預先把這些字烘進字型圖集
if (!existsSync(join(out, 'OFL.txt'))) { const r = await fetch(OFL); if (r.ok) writeFileSync(join(out, 'OFL.txt'), Buffer.from(await r.arrayBuffer())); }
console.log(`MachineYardSansTC.ttf：${chars.size} 字，${(subset.length / 1024).toFixed(0)} KB`);
