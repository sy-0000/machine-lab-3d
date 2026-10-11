// VR 牌子的共用風格（車站翻牌板）：胡桃木外框＋細黃銅線、深色底、墨綠琺瑯招牌、黑色翻牌字牌。
// 選單、按鈕、壓力錶名牌、提示牌、載入提示、門外招牌都用這裡的顏色與畫法，風格一致。
import { loadGlyphs } from './canvasText.js';

export const COLORS = {
  walnut: '#3a2617',      // 外框
  brassLine: '#5a3c22',   // 外框內側細線
  base: '#1c130c',        // 底色
  enamel: '#1d3229',      // 招牌琺瑯
  enamelLine: '#8c6a2c',  // 招牌下緣黃銅線
  brass: '#e8c27a',       // 招牌字
  sage: '#a8b8a0',        // 招牌小字
  label: '#8a7656',       // 欄位標題、說明小字
  tile: '#0d0b09',        // 翻牌字牌
  cream: '#e8dcc0',       // 字牌上的字
  muted: '#a89a80',       // 次要項目
  dim: '#6f6450',         // 不能用
  platform: '#a87a32',    // 月台號、圖示
  amber: '#ffb347',       // 目前所在（箭頭、月台號）
  amberText: '#ffcf7a',   // 目前所在（字）
  rowCurrent: '#2c2014',
  rowHover: '#2a1f15',
  rowHoverCurrent: '#3a2a1a',
  rowPressed: '#110b06',
};

export const FONT_FELL = '"IM Fell English SC", "Cormorant Garamond", Georgia, serif';
export const FONT_SERIF_TC = '"Noto Serif TC", "PMingLiU", "Songti TC", serif';

// 只在 VR 世界載入（不改 index.html，桌機其他頁面不會多下載）
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Noto+Serif+TC:wght@500;700&display=swap';
let cssLoaded = null;
function loadCss() {
  if (cssLoaded) return cssLoaded;
  cssLoaded = new Promise(resolve => {
    if (typeof document === 'undefined') return resolve();
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = FONT_CSS;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
  return cssLoaded;
}
/** 牌子用的字型：IM Fell English SC（英文、羅馬數字）與 Noto Serif TC 500／700（中文）。text 是會畫到的所有字。 */
export async function loadSignFonts(text) {
  await loadCss();
  try { await document.fonts.load(`40px ${FONT_FELL}`, 'Machine Yard IVXY'); } catch { /* 用備用字型 */ }
  await loadGlyphs(text, ['500 40px "Noto Serif TC"', '700 40px "Noto Serif TC"']);
}

/** 胡桃木外框＋內側細黃銅線＋深色底；回傳內框（x, y, w, h） */
export function drawFrame(ctx, w, h, { border = Math.round(Math.min(w, h) * 0.06), radius = border * 0.8 } = {}) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.walnut;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, radius); ctx.fill();
  ctx.fillStyle = COLORS.base;
  ctx.fillRect(border, border, w - border * 2, h - border * 2);
  const line = Math.max(2, Math.round(border * 0.14));
  ctx.strokeStyle = COLORS.brassLine; ctx.lineWidth = line;
  ctx.strokeRect(border - line / 2, border - line / 2, w - border * 2 + line, h - border * 2 + line);
  return { x: border, y: border, w: w - border * 2, h: h - border * 2 };
}

/** 墨綠琺瑯招牌底＋下緣黃銅線 */
export function drawEnamel(ctx, x, y, w, h, line = 3) {
  ctx.fillStyle = COLORS.enamel; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.enamelLine; ctx.fillRect(x, y + h - line, w, line);
}

/** 字距拉開的文字（置中於 x） */
export function spacedText(ctx, text, x, y, spacing) {
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = align;
}

/**
 * 一排翻牌字牌：每個字一片黑色字牌，正中間一條翻牌縫；固定 count 片，字不足補空白片。
 * (x, y) 是第一片的左上角。
 */
export function drawTiles(ctx, text, x, y, { count = 4, tileW, tileH, gap, color = COLORS.cream, font } = {}) {
  const chars = [...text];
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i++) {
    const tx = x + i * (tileW + gap);
    ctx.fillStyle = COLORS.tile;
    ctx.beginPath(); ctx.roundRect(tx, y, tileW, tileH, Math.max(3, tileW * 0.05)); ctx.fill();
    if (chars[i]) { ctx.fillStyle = color; ctx.fillText(chars[i], tx + tileW / 2, y + tileH / 2 + tileH * 0.04); }
    // 翻牌縫：黑線＋下方一條很淡的亮線，看得出上下兩半
    const seam = Math.max(2, Math.round(tileH * 0.035));
    ctx.fillStyle = '#000'; ctx.fillRect(tx, y + tileH / 2 - seam / 2, tileW, seam);
    ctx.fillStyle = 'rgba(255,240,210,0.07)'; ctx.fillRect(tx, y + tileH / 2 + seam / 2, tileW, 1);
  }
}

/** 圓圈裡一個字母（底部的「Y」按鍵圖示） */
export function drawKeyIcon(ctx, letter, cx, cy, r) {
  ctx.strokeStyle = COLORS.platform; ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = COLORS.platform; ctx.font = `${Math.round(r * 1.25)}px ${FONT_FELL}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(letter, cx, cy + r * 0.08);
}

/** 深色提示牌（外框＋一行置中文字），用在提示與載入訊息 */
export function drawNotice(ctx, w, h, text, { color = COLORS.cream, size = Math.round(h * 0.36) } = {}) {
  const inner = drawFrame(ctx, w, h, { border: Math.round(h * 0.09) });
  ctx.fillStyle = color; ctx.font = `700 ${size}px ${FONT_SERIF_TC}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, inner.y + inner.h / 2 + size * 0.05);
}
