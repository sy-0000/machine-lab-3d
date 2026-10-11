// 大門口的動畫螢幕：輪播首頁的三段繪本動畫（public/previews/*.anim.js，與網站的預覽頁共用同一份繪圖程式）。
// 每格由 XR 迴圈呼叫 update(dt) 畫到 CanvasTexture（不用 iframe：XR 中頁面的 requestAnimationFrame 可能停住）。
// 標題、頁碼與說明也畫進畫布；一段播完停一下再換下一段。
// onComplete(fn)：某一段從頭完整播到最後時呼叫 fn(clipId)（按上一段／下一段會從頭開始，跳過的不算）。
import { canvasTexture, FONT_SERIF, FONT_SANS, loadGlyphs, wrapText } from './ui/canvasText.js';

const CLIPS = [
  { id: 'lathe', title: '車床是怎麼切削的？' },
  { id: 'milling', title: '銑床是怎麼切削的？' },
  { id: 'drill', title: '鑽床是怎麼鑽孔的？' },
];
// 與 previews/*.html 的淺色主題相同
const THEME = { '--paper': '#F7F0E1', '--ink': '#4B3A30', '--blob1': '#E6F0E2', '--blob2': '#FCE6D2', '--rot': '#3D7CC9', '--feed': '#E35D4F', '--rapid': '#A0928A' };
const W = 1280, H = 800, HEADER = 236, HOLD_SECONDS = 1.6, REDRAW = 1 / 30;

export async function createAnimationScreen() {
  // 執行期以網址載入 public/ 底下的模組（開發與 GitHub Pages 都在網站根目錄的 previews/）
  const modules = await Promise.all(CLIPS.map(c => import(/* @vite-ignore */ new URL(`previews/${c.id}.anim.js`, document.baseURI).href)));
  // 標題、各頁名稱與說明的字先下載好（見 loadGlyphs）
  await loadGlyphs(CLIPS.map(c => c.title).join('') + modules.map(m => m.createAnimation(document.createElement('canvas').getContext('2d')).stages.map(s => s.name + s.desc).join('')).join('') + '第頁／（暫停中）0123456789');
  const surface = canvasTexture(W, H);
  const { ctx, texture } = surface;
  const anims = modules.map(m => {
    const a = m.createAnimation(ctx);
    Object.assign(a.theme, THEME);
    // 動畫畫在標題列下方，依各段的 VIEW 等比放大置中
    const x0 = 24, y0 = HEADER + 10, x1 = W - 24, y1 = H - 20, v = a.VIEW;
    const S = Math.min((x1 - x0) / (v.x1 - v.x0), (y1 - y0) / (v.z1 - v.z0));
    a.layout({ dpr: 1, width: W, height: H, clipX: 0, S, OX: (x0 + x1) / 2 - S * (v.x0 + v.x1) / 2, OY: (y0 + y1) / 2 - S * (v.z0 + v.z1) / 2 });
    return a;
  });

  let index = 0, simTime = 0, hold = 0, playing = true, sinceDraw = REDRAW, pendingDt = 0;
  const listeners = new Set(), completeListeners = new Set();
  const notify = () => listeners.forEach(fn => fn());

  function header(stage, k, total) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#FFFBF2'; ctx.fillRect(0, 0, W, HEADER);
    ctx.fillStyle = '#4B3A30'; ctx.fillRect(0, HEADER - 4, W, 4);
    ctx.fillStyle = '#8A7565'; ctx.font = `500 34px ${FONT_SANS}`; ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.fillText(`${CLIPS[index].title}（${index + 1} / ${CLIPS.length}）`, 34, 20);
    ctx.textAlign = 'right'; ctx.fillText(`第 ${k + 1} 頁 / ${total}${playing ? '' : '（暫停中）'}`, W - 34, 20);
    ctx.textAlign = 'left'; ctx.fillStyle = '#4B3A30'; ctx.font = `700 58px ${FONT_SERIF}`;
    ctx.fillText(stage.name, 34, 64);
    ctx.font = `500 36px ${FONT_SANS}`; ctx.fillStyle = '#5c4a3e';
    wrapText(ctx, stage.desc, W - 68).slice(0, 2).forEach((line, i) => ctx.fillText(line, 34, 140 + i * 44));
    ctx.restore();
  }

  function draw(sdt) {
    const a = anims[index];
    const st = a.drawFrame(simTime, sdt, playing);
    header(a.stages[st.k], st.k, a.stages.length);
    texture.needsUpdate = true;
  }
  const show = i => { index = (i + anims.length) % anims.length; simTime = 0; hold = 0; anims[index].clearChips(); sinceDraw = REDRAW; notify(); };

  draw(0);
  return {
    texture,
    aspect: W / H,
    get playing() { return playing; },
    get index() { return index; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onComplete(fn) { completeListeners.add(fn); return () => completeListeners.delete(fn); },
    clips: CLIPS,
    next() { show(index + 1); },
    prev() { show(index - 1); },
    togglePlay() { playing = !playing; sinceDraw = REDRAW; notify(); },
    update(dt) {
      const a = anims[index];
      if (playing) {
        simTime += dt;
        if (simTime >= a.TOTAL) {
          if (hold === 0) completeListeners.forEach(fn => fn(CLIPS[index].id));
          simTime = a.TOTAL; hold += dt; if (hold > HOLD_SECONDS) return show(index + 1);
        }
      }
      // 每秒重畫 30 次；切屑與旋轉依累積的時間前進
      pendingDt += playing ? dt : 0;
      sinceDraw += dt;
      if (sinceDraw < REDRAW) return;
      sinceDraw = 0;
      draw(pendingDt);
      pendingDt = 0;
    },
    dispose() { listeners.clear(); completeListeners.clear(); texture.dispose(); },
  };
}
