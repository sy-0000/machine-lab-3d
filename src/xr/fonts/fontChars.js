// VR 畫面（CanvasTexture）會用到的字：從資料檔與 VR 程式碼裡的字串收集（去掉註解），加上全部可列印 ASCII。
// scripts/subset-fonts.mjs 依這份清單產生子集字型；fontChars.test.js 檢查清單沒有漏字（改了文字要重跑 npm run fonts）。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// 會畫到 VR 畫面上的文字來源（相對專案根目錄；資料夾會遞迴，只取 .js/.json）
export const SOURCES = [
  'src/xr',
  'src/data/safety-rules.json',
  'src/vendor/steampunk-toolbox/src/config/tools.config.js',
  'public/previews/lathe.anim.js',
  'public/previews/milling.anim.js',
  'public/previews/drill.anim.js',
];
const SKIP = /(\.test\.js$)|([\\/]fonts[\\/])/;

function files(root, path) {
  const full = join(root, path);
  if (statSync(full).isDirectory()) return readdirSync(full).flatMap(name => files(root, join(path, name)));
  return /\.(js|json)$/.test(path) && !SKIP.test(path) ? [path] : [];
}

// 去掉 JS 註解（粗略：// 到行尾、/* */ 區塊；網址裡的 // 後面只有 ASCII，不影響中文字收集）
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** 回傳排序後、不重複的字元字串 */
export function collectChars(root) {
  const set = new Set();
  for (let c = 0x20; c < 0x7f; c++) set.add(String.fromCharCode(c));
  for (const source of SOURCES) for (const path of files(root, source)) {
    let text = readFileSync(join(root, path), 'utf8');
    if (path.endsWith('.js')) text = stripComments(text);
    for (const ch of text) if (ch.codePointAt(0) >= 0x80) set.add(ch);
  }
  return [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

export const relativeSources = root => SOURCES.flatMap(s => files(root, s)).map(p => relative(root, join(root, p)));
