// 共用的牌子與按鈕（CanvasTexture 文字＋低多邊形外形），風格見 theme.js（車站翻牌板）。按鈕交給 InputManager.add() 登記點選。
// 牌子先用目前已有的字畫一次，字型（IM Fell English SC、Noto Serif TC）下載好後自動重畫。
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { canvasTexture } from './canvasText.js';
import { COLORS, drawEnamel, drawFrame, FONT_SERIF_TC, loadSignFonts } from './theme.js';

/** 胡桃木框、墨綠琺瑯底的名牌；draw(ctx, w, h) 畫上文字（預設黃銅色、置中）；text：會畫到的字（字型下載好後重畫） */
export function signPlate(width, height, draw, text = '') {
  const surface = canvasTexture(width, height), { ctx } = surface;
  const paint = () => {
    const inner = drawFrame(ctx, width, height, { border: Math.round(height * 0.1) });
    drawEnamel(ctx, inner.x, inner.y, inner.w, inner.h, Math.max(3, Math.round(height * 0.03)));
    ctx.fillStyle = COLORS.brass; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    draw(ctx, width, height);
    surface.texture.needsUpdate = true;
  };
  paint();
  loadSignFonts(text).then(paint);
  return surface;
}

const ICONS = {
  prev: (ctx, cx, cy) => { ctx.moveTo(cx + 18, cy - 24); ctx.lineTo(cx - 18, cy); ctx.lineTo(cx + 18, cy + 24); },
  next: (ctx, cx, cy) => { ctx.moveTo(cx - 18, cy - 24); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx - 18, cy + 24); },
  play: (ctx, cx, cy) => { ctx.moveTo(cx - 14, cy - 24); ctx.lineTo(cx + 22, cy); ctx.lineTo(cx - 14, cy + 24); },
  pause: (ctx, cx, cy) => { ctx.rect(cx - 18, cy - 22, 12, 44); ctx.rect(cx + 6, cy - 22, 12, 44); },
  back: (ctx, cx, cy) => { ctx.moveTo(cx - 22, cy); ctx.lineTo(cx, cy - 22); ctx.lineTo(cx, cy - 9); ctx.lineTo(cx + 22, cy - 9); ctx.lineTo(cx + 22, cy + 9); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx, cy + 22); },
};

/** 按鈕面的貼圖：胡桃木框、深色底；左邊琥珀色小圖示、右邊奶油白文字 */
export function buttonFace(label, icon = null, { width = 384, height = 128 } = {}) {
  const surface = canvasTexture(width, height), { ctx } = surface;
  const paint = () => {
    drawFrame(ctx, width, height, { border: Math.round(height * 0.1) });
    const cy = height / 2;
    if (icon) { ctx.fillStyle = COLORS.platform; ctx.beginPath(); ICONS[icon](ctx, 72, cy); ctx.fill(); }
    ctx.fillStyle = COLORS.cream; ctx.font = `700 ${Math.round(height * 0.4)}px ${FONT_SERIF_TC}`;
    ctx.textAlign = icon ? 'left' : 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, icon ? 110 : width / 2, cy + 2);
    surface.texture.needsUpdate = true;
  };
  paint();
  loadSignFonts(label).then(paint);
  return surface;
}

let capMaterial = null;
/**
 * 按鈕（寬 width 公尺）：胡桃木外殼＋貼圖面。回傳 { object, setFace(surface) }；正面朝 +Z。
 * 外殼材質共用（高亮時 InputManager 會各自複製）；按鈕面的貼圖由呼叫端管理（可以換：例如暫停／播放）。
 */
export function brassButton(face, { width = 0.4, height = 0.13 } = {}) {
  capMaterial ??= new MeshStandardMaterial({ color: 0x3a2617, metalness: 0.15, roughness: 0.6 });
  const object = new Group();
  object.name = 'SignButton';
  const cap = new Mesh(new BoxGeometry(width, height, 0.03), capMaterial);
  const plate = new Mesh(new PlaneGeometry(width * 0.97, height * 0.95), new MeshBasicMaterial({ map: face.texture, toneMapped: false }));
  plate.position.z = 0.0155;
  plate.userData.noHighlight = true;
  object.add(cap, plate);
  return {
    object,
    setFace(surface) { plate.material.map = surface.texture; plate.material.needsUpdate = true; },
  };
}
