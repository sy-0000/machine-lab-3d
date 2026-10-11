import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

// 畫在 CanvasTexture 上的文字（第 4 階段會加上建置時產生的繁中子集字型；目前用網頁已載入的 Noto Sans/Serif TC）。
export const FONT_SANS = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';
export const FONT_SERIF = '"Noto Serif TC", "PMingLiU", "Songti TC", serif';

export function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

/** 依寬度自動換行（中文逐字、英數以空白斷開） */
export function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const ch of paragraph) {
      if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch.trim() ? ch : ''; }
      else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

/** 等網頁字型載入（畫 CanvasTexture 前呼叫，否則第一次會用到備用字型） */
export async function fontsReady(families = ['500 40px "Noto Sans TC"', '700 40px "Noto Serif TC"']) {
  try { await Promise.all(families.map(f => document.fonts.load(f, '工安工具機'))); } catch { /* 用備用字型 */ }
}
