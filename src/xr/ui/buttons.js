// 共用的黃銅銘牌與按鈕（CanvasTexture 文字＋低多邊形外形）。按鈕交給 InputManager.add() 登記點選。
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from 'three';
import { canvasTexture, FONT_SANS } from './canvasText.js';

/** 黃銅底色、深色框線與四角鉚釘的銘牌；draw(ctx, w, h) 畫上文字 */
export function brassPlate(width, height, draw) {
  const surface = canvasTexture(width, height), { ctx } = surface;
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#e6c27a'); g.addColorStop(0.5, '#c79a4e'); g.addColorStop(1, '#9c7333');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(0, 0, width, height, height * 0.12); ctx.fill();
  ctx.strokeStyle = '#5b3f17'; ctx.lineWidth = height * 0.035;
  ctx.beginPath(); ctx.roundRect(height * 0.05, height * 0.05, width - height * 0.1, height - height * 0.1, height * 0.09); ctx.stroke();
  for (const [x, y] of [[0.06, 0.18], [0.94, 0.18], [0.06, 0.82], [0.94, 0.82]]) { ctx.fillStyle = '#6e4c1d'; ctx.beginPath(); ctx.arc(width * x, height * y, height * 0.035, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#3a2610'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  draw(ctx, width, height);
  surface.texture.needsUpdate = true;
  return surface;
}

const ICONS = {
  prev: (ctx, cx, cy) => { ctx.moveTo(cx + 18, cy - 24); ctx.lineTo(cx - 18, cy); ctx.lineTo(cx + 18, cy + 24); },
  next: (ctx, cx, cy) => { ctx.moveTo(cx - 18, cy - 24); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx - 18, cy + 24); },
  play: (ctx, cx, cy) => { ctx.moveTo(cx - 14, cy - 24); ctx.lineTo(cx + 22, cy); ctx.lineTo(cx - 14, cy + 24); },
  pause: (ctx, cx, cy) => { ctx.rect(cx - 18, cy - 22, 12, 44); ctx.rect(cx + 6, cy - 22, 12, 44); },
  back: (ctx, cx, cy) => { ctx.moveTo(cx - 22, cy); ctx.lineTo(cx, cy - 22); ctx.lineTo(cx, cy - 9); ctx.lineTo(cx + 22, cy - 9); ctx.lineTo(cx + 22, cy + 9); ctx.lineTo(cx, cy + 9); ctx.lineTo(cx, cy + 22); },
};

/** 按鈕面的貼圖：左邊小圖示、右邊文字 */
export function buttonFace(label, icon = null, { width = 384, height = 128 } = {}) {
  return brassPlate(width, height, (ctx, w, h) => {
    const cy = h / 2;
    if (icon) { ctx.beginPath(); ICONS[icon](ctx, 66, cy); ctx.fill(); }
    ctx.font = `700 ${Math.round(h * 0.4)}px ${FONT_SANS}`;
    ctx.textAlign = icon ? 'left' : 'center';
    ctx.fillText(label, icon ? 104 : w / 2, cy + 2);
  });
}

let capMaterial = null;
/**
 * 黃銅按鈕（寬 width 公尺）。回傳 { object, setFace(surface), dispose }；正面朝 +Z。
 * 外殼材質共用；按鈕面的貼圖由呼叫端管理（可以換：例如暫停／播放）。
 */
export function brassButton(face, { width = 0.4, height = 0.13 } = {}) {
  capMaterial ??= new MeshStandardMaterial({ color: 0xb8893f, metalness: 0.85, roughness: 0.38 });
  const object = new Group();
  object.name = 'BrassButton';
  const cap = new Mesh(new BoxGeometry(width, height, 0.03), capMaterial);
  const plate = new Mesh(new PlaneGeometry(width * 0.95, height * 0.95), new MeshBasicMaterial({ map: face.texture, toneMapped: false }));
  plate.position.z = 0.0155;
  plate.userData.noHighlight = true;
  object.add(cap, plate);
  return {
    object,
    setFace(surface) { plate.material.map = surface.texture; plate.material.needsUpdate = true; },
  };
}
