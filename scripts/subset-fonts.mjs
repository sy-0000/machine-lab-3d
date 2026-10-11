// 產生 VR 用的繁中子集字型（woff2，保留 wght 可變軸 400–900）：npm run fonts
// 來源：本機的 Noto Sans TC／Noto Serif TC 可變字型（OFL；Windows 內建在 C:\Windows\Fonts，或用 FONT_DIR 指定資料夾）。
// 產生的檔案 commit 進 repo，網站建置（GitHub Pages）不需要原始字型。
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { collectChars } from '../src/xr/fonts/fontChars.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontDir = process.env.FONT_DIR || 'C:/Windows/Fonts';
const chars = collectChars(root);
writeFileSync(join(root, 'src/xr/fonts/chars.txt'), chars);
console.log(`${[...chars].length} 個字`);
for (const [source, out] of [['NotoSansTC-VF.ttf', 'xr-sans-tc.woff2'], ['NotoSerifTC-VF.ttf', 'xr-serif-tc.woff2']]) {
  const font = readFileSync(join(fontDir, source));
  const subset = await subsetFont(font, chars, { targetFormat: 'woff2', variationAxes: { wght: { min: 400, max: 900 } } });
  writeFileSync(join(root, 'src/xr/fonts', out), subset);
  console.log(`${out}：${(subset.length / 1024).toFixed(0)} KB`);
}
