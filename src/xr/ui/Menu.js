// VR 選單（車站翻牌板風格）：按左手 Y 叫出／關閉，平常浮在左手腕上方、面向頭盔；兩手射線都能點。
// 分頁：「主選單」（場內行先：門外、玄關、工具箱、三台機台、存檔、返回首頁）與「機台」（加工中／設定，見 machinePage.js）。
// 在操作位附近（機台旁）按 Y 預設打開「機台」頁，其他地方打開主選單頁。
// 「釘選」：面板固定在當下的位置與朝向（不跟著左手，搖桿走動時也留在原地），方便雙手轉手輪時看 DRO；
//   再按一次「釘選」或按 Y，面板回到左手腕。瞬移、換機台時，釘選的面板移到新位置的左前方約 0.8 m、胸口高度。
// 整個選單畫在一張 CanvasTexture 上，射線命中點的 uv 換算成按鈕；只在狀態改變時重繪。
// 桌機 #/world 的「機台」分頁直接顯示這張 canvas（pointerAt 換算滑鼠點擊）。
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { canvasTexture } from './canvasText.js';
import { COLORS, drawButtonBox, drawEnamel, drawFrame, drawKeyIcon, drawTiles, FONT_FELL, FONT_SERIF_TC, loadSignFonts, spacedText } from './theme.js';
import { createMachinePage } from './machinePage.js';

// 版面（像素）；平面寬 0.38 m
const W = 800, H = 920, BORDER = 24, PAD = 16;
const SIGN = { y: BORDER + PAD, h: 104 };
const TABS_Y = SIGN.y + SIGN.h + 14, TAB_H = 58;
const CONTENT = { x0: BORDER + PAD + 8, x1: W - BORDER - PAD - 8, y: TABS_Y + TAB_H + 18 };
const FOOT_Y = H - BORDER - 70;
const ROW_H = 66, GROUP_GAP = 16;
const TILE = { w: 62, h: 56, gap: 8, x: 112 };
const ARROW_X = 72, PLATFORM_X = W - BORDER - PAD - 40;
const PANEL_W = 0.38, PANEL_H = PANEL_W * H / W;
const PRESS_SECONDS = 0.1, RUN_AFTER = 0.18, NOTE_SECONDS = 3, REPEAT_DELAY = 0.45, REPEAT_EVERY = 0.09;
const UP = new Vector3(0, 1, 0);
const PIN_DISTANCE = 0.8, PIN_ANGLE = Math.PI / 6, CHEST_DROP = 0.4;

export function createMenu({ input, player, camera, items, run, machine, nearMachine = () => false, audio }) {
  const root = new Group();
  root.name = 'Menu';
  root.visible = false;
  player.add(root);
  const surface = canvasTexture(W, H), { canvas, ctx, texture } = surface;
  const plane = new Mesh(new PlaneGeometry(PANEL_W, PANEL_H), new MeshBasicMaterial({ map: texture, toneMapped: false }));
  plane.name = 'MenuBoard';
  const back = new Mesh(new BoxGeometry(PANEL_W, PANEL_H, 0.02), new MeshBasicMaterial({ color: 0x24170d }));
  back.position.z = -0.0105;
  plane.userData.noHighlight = back.userData.noHighlight = true;
  root.add(back, plane);

  const state = { page: 'main', hover: -1, pressed: -1, pressT: 0, note: '', noteT: 0, signature: '', pinned: false, desktop: false };
  const hold = { button: null, t: 0, next: 0 };
  let pendingRun = null, runT = 0, buttons = [];
  const pinnedWorld = new Matrix4();
  const say = text => { state.note = text; state.noteT = text ? NOTE_SECONDS : 0; draw(); };
  const machinePage = createMachinePage({ machine, audio, say: text => { if (text) say(text); } });

  // ---- 主選單頁：場內行先（每列一個按鈕，自己畫翻牌字牌與月台號）
  function mainPage(add) {
    const list = items();
    let y = CONTENT.y, group = list[0]?.group;
    ctx.fillStyle = COLORS.label; ctx.font = `500 24px ${FONT_SERIF_TC}`; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText('目的地', TILE.x, y + 12);
    ctx.textAlign = 'right'; ctx.fillText('月台', PLATFORM_X + 34, y + 12);
    ctx.fillStyle = COLORS.brassLine; ctx.fillRect(CONTENT.x0, y + 30, CONTENT.x1 - CONTENT.x0, 2);
    y += 40;
    for (const item of list) {
      if (item.group !== group) { y += GROUP_GAP; group = item.group; }
      add({ x: CONTENT.x0 - 10, y, w: CONTENT.x1 - CONTENT.x0 + 20, h: ROW_H, item, action: 'item:' + item.key, delayed: true,
        enabled: () => true, draw: drawRow });
      y += ROW_H;
    }
  }
  function drawRow(b, { hover, pressed }) {
    const item = b.item;
    const bg = pressed ? COLORS.rowPressed : item.current ? (hover ? COLORS.rowHoverCurrent : COLORS.rowCurrent) : hover ? COLORS.rowHover : null;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(b.x, b.y + 3, b.w, b.h - 6); }
    const dy = pressed ? 2 : 0, top = b.y + (ROW_H - TILE.h) / 2 + dy, mid = b.y + ROW_H / 2 + dy;
    if (item.current) {
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath(); ctx.moveTo(ARROW_X - 12, mid - 14); ctx.lineTo(ARROW_X + 13, mid); ctx.lineTo(ARROW_X - 12, mid + 14); ctx.closePath(); ctx.fill();
    }
    const color = item.current ? COLORS.amberText : !item.enabled ? COLORS.dim : item.group === 2 ? COLORS.muted : COLORS.cream;
    drawTiles(ctx, item.label, TILE.x, top, { count: 4, tileW: TILE.w, tileH: TILE.h, gap: TILE.gap, color, font: `700 42px ${FONT_SERIF_TC}` });
    if (item.platform) {
      ctx.fillStyle = item.current ? COLORS.amber : COLORS.platform;
      ctx.font = `42px ${FONT_FELL}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(item.platform, PLATFORM_X, mid + 2);
    }
  }

  function draw() {
    buttons = [];
    const add = b => buttons.push({ enabled: () => true, active: () => false, ...b });
    const inner = drawFrame(ctx, W, H, { border: BORDER, radius: 18 });
    // 招牌
    drawEnamel(ctx, inner.x, SIGN.y, inner.w, SIGN.h, 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.brass; ctx.font = `62px ${FONT_FELL}`;
    ctx.fillText('Machine Yard', W / 2, SIGN.y + 44);
    ctx.fillStyle = COLORS.sage; ctx.font = `500 24px ${FONT_SERIF_TC}`;
    spacedText(ctx, '場內行先', W / 2, SIGN.y + 86, 20);
    // 分頁與釘選
    const machineReady = machinePage.available();
    add({ x: CONTENT.x0, y: TABS_Y, w: 200, h: TAB_H, label: '主選單', size: 28, active: () => state.page === 'main', action: 'page:main' });
    add({ x: CONTENT.x0 + 212, y: TABS_Y, w: 200, h: TAB_H, label: '機台', size: 28, active: () => state.page !== 'main', enabled: () => machineReady, action: 'page:machine1',
      reason: '走到工作室的機台旁才能操作機台' });
    if (!state.desktop) add({ x: CONTENT.x1 - 180, y: TABS_Y, w: 180, h: TAB_H, label: state.pinned ? '釘選中' : '釘選', size: 28, active: () => state.pinned, action: 'pin' });
    // 內容
    if (state.page === 'main') mainPage(add);
    else machinePage.draw(ctx, state.page, CONTENT, add);
    // 按鈕
    buttons.forEach((b, i) => {
      const look = { hover: state.hover === i, pressed: state.pressed === i, enabled: b.enabled(), active: b.active(), size: b.size };
      if (b.draw) b.draw(b, look); else drawButtonBox(ctx, b, look);
    });
    // 底部：Y 圖示＋說明（或暫時顯示原因）
    ctx.fillStyle = COLORS.brassLine; ctx.fillRect(inner.x + PAD, FOOT_Y, inner.w - PAD * 2, 2);
    const note = state.note || (state.desktop ? 'M 或 Esc 關閉選單' : state.pinned ? '已釘選：按 Y 或「釘選」放回左手' : '左手 Y 關閉選單');
    const cy = FOOT_Y + 36;
    ctx.font = `500 26px ${FONT_SERIF_TC}`; ctx.textBaseline = 'middle';
    if (state.note || state.desktop) {
      ctx.fillStyle = state.note ? COLORS.amber : COLORS.label; ctx.textAlign = 'center'; ctx.fillText(note, W / 2, cy);
    } else {
      const textW = ctx.measureText(note).width, r = 18, x0 = W / 2 - (r * 2 + 14 + textW) / 2;
      drawKeyIcon(ctx, 'Y', x0 + r, cy, r);
      ctx.fillStyle = COLORS.label; ctx.textAlign = 'left'; ctx.fillText(note, x0 + r * 2 + 14, cy + 1);
    }
    texture.needsUpdate = true;
    state.signature = signatureOf();
  }
  const signatureOf = () => (state.page === 'main' ? items().map(i => `${i.key}:${i.enabled ? 1 : 0}${i.current ? 1 : 0}`).join('|') : machinePage.signature(state.page))
    + `|${machinePage.available()}|${state.pinned}`;

  // ---- 點選
  const buttonAt = (x, y) => buttons.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  const fromUv = uv => (uv ? buttonAt(uv.x * W, (1 - uv.y) * H) : -1);
  function act(b, info) {
    if (!b.enabled()) { say(b.reason || b.item?.reason || '目前不能使用'); info?.pulse?.(0.5, 40); return; }
    info?.pulse?.(0.25, 18);
    if (typeof b.action === 'function') { b.action(); draw(); return; }
    if (b.action === 'pin') { setPinned(!state.pinned); return; }
    if (b.action.startsWith('page:')) { state.page = b.action.slice(5); state.hover = -1; draw(); return; }
    if (b.action.startsWith('item:')) {
      const item = items().find(x => x.key === b.item.key);
      if (!item?.enabled) { say(item?.reason || '目前不能使用'); info?.pulse?.(0.5, 40); return; }
      pendingRun = item.key; runT = 0; // 按下回彈後才跳轉
    }
  }
  function select(i, info) {
    const b = buttons[i];
    if (!b || pendingRun) return;
    if (b.repeat) return; // 按住連續的按鈕在按下時已經動作
    state.pressed = i; state.pressT = 0;
    act(b, info);
    draw();
  }
  function press(i, info) {
    const b = buttons[i];
    if (!b?.repeat) return;
    if (!b.enabled()) { info?.pulse?.(0.4, 30); return; }
    state.pressed = i; state.pressT = 0;
    act(b, info);
    hold.button = b; hold.t = 0; hold.next = REPEAT_DELAY;
  }
  const pressEnd = () => { hold.button = null; };

  input.add(plane, {
    persistent: true,
    highlight: false,
    enabled: () => root.visible,
    onMove: info => { const i = fromUv(info.uv); if (i !== state.hover) { state.hover = i; draw(); } },
    onHover: on => { if (!on && state.hover !== -1) { state.hover = -1; draw(); } },
    onPress: info => press(fromUv(info.uv), info),
    onPressEnd: pressEnd,
    onSelect: info => select(fromUv(info.uv), info),
  });

  // ---- 位置：左手腕上方（面向頭盔）或釘選在空中
  const eye = new Vector3(), at = new Vector3(), fwd = new Vector3(), left = new Vector3(), q = new Quaternion(), s = new Vector3();
  function setPinned(on) {
    state.pinned = on;
    if (on) { root.updateMatrixWorld(true); pinnedWorld.copy(root.matrixWorld); }
    draw();
  }
  /** 釘選的面板移到使用者左前方 0.8 m、胸口高度、面向頭（瞬移、換機台後） */
  function placePinnedNearUser() {
    camera.updateMatrixWorld(true);
    camera.getWorldPosition(eye);
    camera.getWorldDirection(fwd).setY(0);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    left.set(fwd.z, 0, -fwd.x);
    at.copy(eye).addScaledVector(fwd, PIN_DISTANCE * Math.cos(PIN_ANGLE)).addScaledVector(left, PIN_DISTANCE * Math.sin(PIN_ANGLE));
    at.y = eye.y - CHEST_DROP;
    // Matrix4.lookAt(eye, target)：+Z 軸＝eye − target，面板正面（+Z）朝向頭
    pinnedWorld.compose(at, q.setFromRotationMatrix(new Matrix4().lookAt(eye, at, UP)), s.set(1, 1, 1));
  }
  function followWrist() {
    const grip = input.grip('left');
    if (!grip) return false;
    grip.updateMatrixWorld(true);
    at.set(0, 0.03, 0.05);
    grip.localToWorld(at);
    at.y += 0.05 + PANEL_H / 2;
    player.updateMatrixWorld(true);
    root.position.copy(player.worldToLocal(at.clone()));
    camera.getWorldPosition(eye);
    root.lookAt(eye);
    return true;
  }
  function applyPinned() {
    // 存的是世界座標；player 會被搖桿與瞬移移動，換算回 player 座標
    player.updateMatrixWorld(true);
    const local = new Matrix4().copy(player.matrixWorld).invert().multiply(pinnedWorld);
    local.decompose(root.position, root.quaternion, root.scale);
  }

  function show(page) {
    state.page = page || (nearMachine() && machinePage.available() ? 'machine1' : 'main');
    state.hover = -1; state.pressed = -1; pendingRun = null; state.note = ''; state.noteT = 0;
    root.visible = true;
    draw();
  }
  function hide() { root.visible = false; pendingRun = null; state.pressed = -1; hold.button = null; }

  // 字型下載好再畫一次
  const glyphText = () => items().map(i => i.label + (i.reason || '')).join('') + machinePage.glyphs + '場內行先目的地月台主選單機台釘選中已按或放回左手關閉選單目前不能使用就在這裡走到工作室的機台旁才能操作';
  draw();
  loadSignFonts(glyphText()).then(draw);

  return {
    get visible() { return root.visible; },
    get pinned() { return state.pinned; },
    canvas,
    /** 左手 Y：釘選中 → 放回左手；顯示中 → 關閉；關閉中 → 打開（機台旁預設「機台」頁） */
    toggle() {
      if (state.pinned) { setPinned(false); return; }
      if (root.visible) hide(); else show();
    },
    show, hide,
    /** 瞬移或換區域、換機台之後：釘選的面板跟著移到使用者左前方 */
    followUser() { if (state.pinned && root.visible) placePinnedNearUser(); },
    /** 桌機 HTML 選單的「機台」分頁：直接顯示這張 canvas；open 時持續更新 */
    setDesktop(open, page = 'machine1') { state.desktop = open; if (open) { state.page = page; state.hover = -1; } draw(); },
    /** 桌機：canvas 像素座標上的滑鼠事件（type：'move' | 'down' | 'up' | 'leave'） */
    pointerAt(x, y, type) {
      const i = type === 'leave' ? -1 : buttonAt(x, y);
      if (type === 'move' || type === 'leave') { if (i !== state.hover) { state.hover = i; draw(); } return; }
      if (type === 'down') press(i, null);
      if (type === 'up') { pressEnd(); select(i, null); }
    },
    /** 每格：位置、按下回彈、按住連續、提示倒數；顯示內容變了才重畫 */
    update(dt = 1 / 72) {
      const active = root.visible || state.desktop;
      if (!active) return;
      if (root.visible) {
        if (state.pinned) applyPinned();
        else if (!followWrist() && !state.desktop) { hide(); return; }
      }
      if (hold.button && (hold.t += dt) >= hold.next) { hold.next += REPEAT_EVERY; if (hold.button.enabled()) { hold.button.action(); draw(); } }
      if (state.pressed >= 0 && (state.pressT += dt) >= PRESS_SECONDS && !hold.button) { state.pressed = -1; draw(); }
      // 跳轉計時獨立累加：pressT 在按鈕回彈（PRESS_SECONDS）後就停止，不能拿來等 RUN_AFTER（否則 pendingRun 永遠不清除、選單點不動）
      if (pendingRun && (runT += dt) >= RUN_AFTER) {
        const key = pendingRun; pendingRun = null;
        if (!state.pinned && !state.desktop) hide();
        run(key);
        return;
      }
      if (state.noteT > 0 && (state.noteT -= dt) <= 0) { state.note = ''; draw(); }
      if (signatureOf() !== state.signature) draw();
    },
    dispose() {
      input.remove(plane);
      root.removeFromParent();
      plane.geometry.dispose(); plane.material.dispose(); back.geometry.dispose(); back.material.dispose();
      texture.dispose();
    },
  };
}
