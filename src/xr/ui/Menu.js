// VR 選單（車站翻牌板風格）：按左手 Y 叫出／關閉，出現在視野正前方 0.75 m、比眼睛略低，打開後固定在空中（不跟著頭轉），
// 兩手射線都能點。整張選單畫在一張 CanvasTexture 上、貼在一片平面；射線命中點的 uv 換算成哪一列。
// 只在狀態改變時重繪（指到的列、按下／回彈、所在地點、底部提示）。項目與動作由 world.js 提供（menuItems / runMenu），
// 桌機 #/world 用 WorldPage 的 HTML 選單顯示同一份項目。選單登記為 persistent，換區域時不會被清掉。
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { canvasTexture } from './canvasText.js';
import { COLORS, drawEnamel, drawFrame, drawKeyIcon, drawTiles, FONT_FELL, FONT_SERIF_TC, loadSignFonts, spacedText } from './theme.js';

// 貼圖版面（像素）；平面寬 0.44 m
const W = 800, BORDER = 24, PAD = 16;
const SIGN = { y: BORDER + PAD, h: 168 };
const HEAD_Y = SIGN.y + SIGN.h + 18, HEAD_H = 40;
const ROW_H = 84, GROUP_GAP = 24, ROWS_Y = HEAD_Y + HEAD_H + 12;
const TILE = { w: 76, h: 68, gap: 8, x: 116 };
const ARROW_X = 74, PLATFORM_X = W - BORDER - PAD - 34;
const FOOT_H = 78;
const PANEL_W = 0.44, DISTANCE = 0.75, DROP = 0.1;
const PRESS_SECONDS = 0.1, RUN_AFTER = 0.18, NOTE_SECONDS = 3;
const IDLE_NOTE = '左手 Y 關閉選單';

function layout(list) {
  let y = ROWS_Y, group = list[0]?.group;
  const rows = list.map(item => {
    if (item.group !== group) { y += GROUP_GAP; group = item.group; }
    const row = { key: item.key, y };
    y += ROW_H;
    return row;
  });
  const footY = y + 14;
  return { rows, footY, height: footY + FOOT_H + BORDER };
}

export function createMenu({ input, player, camera, items, run }) {
  const root = new Group();
  root.name = 'Menu';
  root.visible = false;
  player.add(root);

  const { rows, footY, height: H } = layout(items());
  const surface = canvasTexture(W, H), { ctx, texture } = surface;
  const panelH = PANEL_W * H / W;
  const plane = new Mesh(new PlaneGeometry(PANEL_W, panelH), new MeshBasicMaterial({ map: texture, toneMapped: false }));
  plane.name = 'MenuBoard';
  const back = new Mesh(new BoxGeometry(PANEL_W, panelH, 0.02), new MeshBasicMaterial({ color: 0x24170d }));
  back.position.z = -0.0105;
  plane.userData.noHighlight = back.userData.noHighlight = true;
  root.add(back, plane);

  // 狀態：指到的列、按下的列與計時、底部提示
  const state = { hover: -1, pressed: -1, pressT: 0, note: '', noteT: 0, signature: '' };
  let pendingRun = null;

  function draw() {
    const list = items();
    const inner = drawFrame(ctx, W, H, { border: BORDER, radius: 18 });
    // 招牌
    drawEnamel(ctx, inner.x, SIGN.y, inner.w, SIGN.h, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.brass; ctx.font = `76px ${FONT_FELL}`;
    ctx.fillText('Machine Yard', W / 2, SIGN.y + 68);
    ctx.fillStyle = COLORS.sage; ctx.font = `500 28px ${FONT_SERIF_TC}`;
    spacedText(ctx, '場內行先', W / 2, SIGN.y + 132, 22);
    // 欄位標題
    ctx.fillStyle = COLORS.label; ctx.font = `500 26px ${FONT_SERIF_TC}`;
    ctx.textAlign = 'left'; ctx.fillText('目的地', TILE.x, HEAD_Y + HEAD_H / 2);
    ctx.textAlign = 'right'; ctx.fillText('月台', PLATFORM_X + 34, HEAD_Y + HEAD_H / 2);
    ctx.fillStyle = COLORS.brassLine; ctx.fillRect(inner.x + PAD, HEAD_Y + HEAD_H + 2, inner.w - PAD * 2, 2);
    // 各列
    rows.forEach((row, i) => {
      const item = list.find(x => x.key === row.key);
      if (!item) return;
      const pressed = state.pressed === i, hover = state.hover === i;
      const bg = pressed ? COLORS.rowPressed : item.current ? (hover ? COLORS.rowHoverCurrent : COLORS.rowCurrent) : hover ? COLORS.rowHover : null;
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(inner.x + 6, row.y + 3, inner.w - 12, ROW_H - 6); }
      const dy = pressed ? 2 : 0, top = row.y + (ROW_H - TILE.h) / 2 + dy, mid = row.y + ROW_H / 2 + dy;
      if (item.current) {
        ctx.fillStyle = COLORS.amber;
        ctx.beginPath(); ctx.moveTo(ARROW_X - 12, mid - 15); ctx.lineTo(ARROW_X + 14, mid); ctx.lineTo(ARROW_X - 12, mid + 15); ctx.closePath(); ctx.fill();
      }
      const color = item.current ? COLORS.amberText : !item.enabled ? COLORS.dim : item.group === 2 ? COLORS.muted : COLORS.cream;
      drawTiles(ctx, item.label, TILE.x, top, { count: 4, tileW: TILE.w, tileH: TILE.h, gap: TILE.gap, color, font: `700 48px ${FONT_SERIF_TC}` });
      if (item.platform) {
        ctx.fillStyle = item.current ? COLORS.amber : COLORS.platform;
        ctx.font = `46px ${FONT_FELL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(item.platform, PLATFORM_X, mid + 2);
      }
    });
    // 底部：Y 圖示＋說明（或暫時顯示不能用的原因）
    ctx.fillStyle = COLORS.brassLine; ctx.fillRect(inner.x + PAD, footY - 6, inner.w - PAD * 2, 2);
    const note = state.note || IDLE_NOTE;
    ctx.font = `500 28px ${FONT_SERIF_TC}`;
    const textW = ctx.measureText(note).width, iconR = 19, total = iconR * 2 + 16 + textW;
    const x0 = W / 2 - total / 2, cy = footY + FOOT_H / 2 - 4;
    if (!state.note) drawKeyIcon(ctx, 'Y', x0 + iconR, cy, iconR);
    ctx.fillStyle = state.note ? COLORS.amber : COLORS.label; ctx.font = `500 28px ${FONT_SERIF_TC}`;
    ctx.textAlign = state.note ? 'center' : 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(note, state.note ? W / 2 : x0 + iconR * 2 + 16, cy + 1);
    texture.needsUpdate = true;
    state.signature = signatureOf(list);
  }
  // 項目狀態（所在地點、能不能用）有變才需要重畫
  const signatureOf = list => list.map(i => `${i.key}:${i.enabled ? 1 : 0}${i.current ? 1 : 0}`).join('|');

  const rowAt = uv => {
    if (!uv) return -1;
    const y = (1 - uv.y) * H;
    return rows.findIndex(r => y >= r.y && y < r.y + ROW_H);
  };
  const setHover = i => { if (state.hover !== i) { state.hover = i; draw(); } };
  const say = text => { state.note = text; state.noteT = text ? NOTE_SECONDS : 0; draw(); };

  input.add(plane, {
    persistent: true,
    highlight: false,
    enabled: () => root.visible,
    onMove: info => setHover(rowAt(info.uv)),
    onHover: on => { if (!on) setHover(-1); },
    onSelect: info => {
      if (pendingRun) return;
      const i = rowAt(info.uv);
      if (i < 0) return;
      const item = items().find(x => x.key === rows[i].key);
      if (!item?.enabled) { say(item?.reason || '目前不能使用'); info?.pulse?.(0.5, 40); return; }
      info?.pulse?.(0.3, 20);
      // 按下：內容下移、底色變深約 0.1 秒後回彈，再跳轉
      state.pressed = i; state.pressT = 0; pendingRun = item.key;
      draw();
    },
  });

  function show() {
    // 放在視野正前方（只取水平方向），比眼睛低一點，面向頭盔
    const eye = camera.getWorldPosition(new Vector3());
    const forward = camera.getWorldDirection(new Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const at = eye.clone().addScaledVector(forward, DISTANCE);
    at.y -= DROP;
    player.updateMatrixWorld(true);
    root.position.copy(player.worldToLocal(at.clone()));
    root.visible = true;
    root.updateMatrixWorld(true);
    root.lookAt(eye);
    state.hover = -1; state.pressed = -1; pendingRun = null; state.note = ''; state.noteT = 0;
    draw();
  }
  function hide() { root.visible = false; pendingRun = null; state.pressed = -1; }

  // 字型下載好再畫一次（IM Fell English SC＋Noto Serif TC 500／700）
  const glyphText = () => items().map(i => i.label + (i.reason || '')).join('') + '場內行先目的地月台' + IDLE_NOTE + '目前不能使用就在這裡';
  draw();
  loadSignFonts(glyphText()).then(draw);

  return {
    get visible() { return root.visible; },
    toggle() { if (root.visible) hide(); else show(); },
    show, hide,
    /** 每格：處理按下回彈、提示倒數；所在地點改變時重畫 */
    update(dt = 1 / 72) {
      if (!root.visible) return;
      if (pendingRun) {
        state.pressT += dt;
        if (state.pressed >= 0 && state.pressT >= PRESS_SECONDS) { state.pressed = -1; draw(); }
        if (state.pressT >= RUN_AFTER) { const key = pendingRun; hide(); run(key); }
        return;
      }
      if (state.noteT > 0 && (state.noteT -= dt) <= 0) say('');
      if (signatureOf(items()) !== state.signature) draw();
    },
    dispose() {
      input.remove(plane);
      root.removeFromParent();
      plane.geometry.dispose(); plane.material.dispose(); back.geometry.dispose(); back.material.dispose();
      texture.dispose();
    },
  };
}
