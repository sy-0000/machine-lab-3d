import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import sansUrl from '../fonts/xr-sans-tc.woff2?url';
import serifUrl from '../fonts/xr-serif-tc.woff2?url';
import SUBSET_CHARS from '../fonts/chars.txt?raw';

// 畫在 CanvasTexture 上的文字：VR 專用的繁中子集字型（npm run fonts 產生，src/xr/fonts/，可變字重 400–900），
// 跟著網站一起打包、不需要連到 Google Fonts。子集裡沒有的字退回網頁的 Noto Sans/Serif TC 或系統字型。
export const FONT_SANS = '"XR Sans TC", "Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';
export const FONT_SERIF = '"XR Serif TC", "Noto Serif TC", "PMingLiU", "Songti TC", serif';

const inSubset = new Set(SUBSET_CHARS);
let registered = null;
/** 註冊並下載子集字型（只做一次） */
export function loadXrFonts() {
  if (registered) return registered;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return (registered = Promise.resolve());
  const faces = [new FontFace('XR Sans TC', `url(${sansUrl}) format("woff2")`, { weight: '400 900' }),
    new FontFace('XR Serif TC', `url(${serifUrl}) format("woff2")`, { weight: '400 900' })];
  registered = Promise.all(faces.map(face => face.load().then(f => document.fonts.add(f)).catch(() => {})));
  return registered;
}

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

/**
 * 畫 CanvasTexture 前呼叫：等子集字型下載好（字型還沒好就畫，會先用備用字型，之後要重畫）。
 * text 不在子集裡的字（例如之後新增的文字還沒重跑 npm run fonts）改從網頁的 Google Fonts 分片下載。
 */
export async function loadGlyphs(text = '', specs = ['400 40px "Noto Sans TC"', '500 40px "Noto Sans TC"', '700 40px "Noto Sans TC"', '700 40px "Noto Serif TC"', '900 40px "Noto Serif TC"']) {
  await loadXrFonts();
  const chars = [...new Set(text)].filter(ch => !inSubset.has(ch)).join('');
  if (!chars) return;
  try { await Promise.all(specs.map(f => document.fonts.load(f, chars))); } catch { /* 用備用字型 */ }
}
