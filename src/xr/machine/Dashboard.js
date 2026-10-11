// 機台旁的立式儀表板（VR 操作介面第一頁：加工中）。整塊錶面是一張 CanvasTexture，按鈕用射線命中點的 uv 判斷。
// 風格與選單相同（胡桃木框、深色底、琥珀色）。固定在鋼板左前角，錶面 0.5 × 0.4 m、上緣高 1.3 m、向後傾 30°，
// 轉向機台正面的瞬移點。指令與桌機操作面板（OperatePanel.jsx）相同，走同一個 MachineSession。
// 第二頁（設定：加工模式、小刀架、錐度靠模、移動到工件座標、深度擋塊、重設）在下一步加入。
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Vector3 } from 'three';
import { createBlockStock } from '../../levels/challenges.js';
import { canvasTexture, FONT_SANS, wrapText } from '../ui/canvasText.js';
import { COLORS, drawEnamel, drawFrame, FONT_SERIF_TC, loadSignFonts } from '../ui/theme.js';
import { yawFacing } from '../SceneManager.js';

const W = 1000, H = 800, FACE = { w: 0.5, h: 0.4 }, TOP = 1.3, TILT = Math.PI / 6;
// 鋼板座標（＝房間座標，機台正面朝 +Z）
export const DASHBOARD_AT = { lathe: [-0.95, 0.65], milling: [-0.95, 0.7], drill: [-0.6, 0.55] };
const FACING_POINT = new Vector3(0, 0, 1.05); // 機台正面瞬移點
export const FEEDS = [0.01, 0.1, 1];
// 與桌機操作面板相同的軸與刀具
const AXES = {
  lathe: [{ id: 'X', label: 'X 徑向（直徑）', diameter: true }, { id: 'Z', label: 'Z 縱向' }],
  milling: [{ id: 'X', label: 'X 工作臺' }, { id: 'Y', label: 'Y 鞍座' }, { id: 'Z', label: 'Z 升降' }],
  drill: [{ id: 'quill', label: '主軸進給' }, { id: 'table', label: '工作臺高度' }],
};
const HEAD_TOOLS = { milling: [['head_face_mill', '面銑刀 Ø58'], ['head_end_mill', '立銑刀 Ø8']], drill: [['head_drill_85', '鑽頭 Ø8.5'], ['head_drill_10', '鑽頭 Ø10'], ['head_tap_m10', 'M10 絲攻']] };
const NAMES = { lathe: '車床', milling: '銑床', drill: '鑽床' };
const REASONS = { 'input-locked-or-unavailable': '機台目前不能操作', 'asset-command-pending': '正在處理上一個指令', cancelled: '已取消' };
const fmt = v => v == null ? '—' : (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3);

export function createDashboard({ session, machineId, input, feed, maxRpm = 2000 }) {
  const root = new Group();
  root.name = 'Dashboard';
  const [px, pz] = DASHBOARD_AT[machineId] || DASHBOARD_AT.lathe;
  root.position.set(px, 0, pz);
  root.rotation.y = yawFacing(new Vector3(px, 0, pz), FACING_POINT) + Math.PI; // 錶面（+Z）朝向瞬移點
  // 立柱與底座
  const iron = new MeshStandardMaterial({ color: 0x2e2a26, metalness: 0.7, roughness: 0.5 });
  const brass = new MeshStandardMaterial({ color: 0xb38b4c, metalness: 0.9, roughness: 0.35 });
  const faceCenterY = TOP - FACE.h / 2 * Math.cos(TILT);
  const pole = new Mesh(new CylinderGeometry(0.035, 0.045, faceCenterY - 0.1, 12), iron);
  pole.position.y = (faceCenterY - 0.1) / 2;
  const base = new Mesh(new CylinderGeometry(0.18, 0.2, 0.04, 20), iron);
  base.position.y = 0.02;
  root.add(pole, base);
  // 錶面：胡桃木殼＋貼圖面，向後傾 30°
  const face = new Group();
  face.position.set(0, faceCenterY, 0);
  face.rotation.x = -TILT;
  const shell = new Mesh(new BoxGeometry(FACE.w + 0.04, FACE.h + 0.04, 0.05), new MeshStandardMaterial({ color: 0x3a2617, roughness: 0.6, metalness: 0.15 }));
  shell.position.z = -0.03;
  const rim = new Mesh(new BoxGeometry(FACE.w + 0.05, 0.012, 0.055), brass);
  rim.position.set(0, FACE.h / 2 + 0.02, -0.03);
  const surface = canvasTexture(W, H), { ctx, texture } = surface;
  const screen = new Mesh(new PlaneGeometry(FACE.w, FACE.h), new MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.name = 'DashboardScreen';
  shell.userData.noHighlight = rim.userData.noHighlight = screen.userData.noHighlight = true;
  face.add(shell, rim, screen);
  root.add(face);
  root.traverse(o => { if (o.isMesh && o !== screen) { o.castShadow = true; o.receiveShadow = true; } });

  const axes = AXES[machineId] || [];
  const tools = HEAD_TOOLS[machineId];
  let state = session.getState(), message = '', messageT = 0, hover = -1, pressed = -1, pressT = 0, signature = '';
  const send = command => {
    const result = session.command(command);
    const done = r => { message = r && !r.ok ? (REASONS[r.reason] || r.reason || '') : ''; messageT = message ? 4 : 0; refresh(true); return r; };
    return result && typeof result.then === 'function' ? result.then(done) : done(result);
  };
  const stopped = () => !!state && !state.running && state.rpm === 0 && state.leverAngle === 0;
  const machining = () => machineId === 'lathe' && !!state?.machining;
  const readout = a => machining() ? (a.id === 'X' ? state.machining.xDiameterMm : state.machining.zMm) : state?.axesMm?.[a.id];
  const zero = a => send(machining()
    ? { type: 'machining.datum', axis: a.id, valueMm: 0, ...(a.diameter ? { representation: 'diameter' } : {}) }
    : { type: 'workOffset.zero', axis: a.id, ...(a.diameter ? { representation: 'diameter' } : {}) });
  const mountStock = async () => {
    if (machineId === 'lathe') return send({ type: 'workpiece.createHandle' });
    if (!state?.activeCuttingTool || !tools.some(([id]) => id === state.activeCuttingTool.id)) {
      const r = await send({ type: 'tool.select', toolId: tools[0][0] }); if (!r?.ok) return;
    }
    return send({ type: 'workpiece.mountState', state: createBlockStock() });
  };
  const nextTool = () => {
    const i = tools.findIndex(([id]) => id === state?.activeCuttingTool?.id);
    return send({ type: 'tool.select', toolId: tools[(i + 1) % tools.length][0] });
  };
  const contact = () => {
    const m = state?.machining, head = state?.headMachining, running = state?.rpm > 0;
    const touching = machineId === 'lathe' ? !!m?.contact && !m?.unsafe : !!head?.contact;
    const overshoot = !running && touching && head?.embedMm > 0.05;
    const level = touching ? (running ? 'cutting' : overshoot ? 'overshoot' : 'touch') : 'none';
    return { level, text: { none: '未接觸', touch: '接觸（對刀點）', cutting: '切削中', overshoot: `壓入 ${head?.embedMm?.toFixed(2)} mm` }[level] };
  };

  // ---- 按鈕（像素座標）
  const buttons = [];
  const button = (x, y, w, h, label, action, enabled = () => true, active = () => false) => buttons.push({ x, y, w, h, label, action, enabled, active });
  const DRO_Y = 136, DRO_H = 72;
  axes.forEach((a, i) => button(452, DRO_Y + i * DRO_H + 10, 108, 52, '歸零', () => zero(a), () => readout(a) != null));
  FEEDS.forEach((mm, i) => button(40 + i * 128, 420, 120, 60, String(mm), () => { feed.mm = mm; refresh(true); }, () => true, () => feed.mm === mm));
  button(40, 500, 180, 64, '▶ 啟動', () => send({ type: 'spindle.start', direction: 1 }), () => !state?.running && !state?.emergency && state?.spindleAvailable !== false);
  button(232, 500, 180, 64, '■ 停止', () => send({ type: 'spindle.stop' }), () => !!state?.running || state?.rpm > 0);
  if (machineId !== 'lathe') {
    button(600, 420, 76, 60, '−', () => send({ type: 'spindle.speed', rpm: Math.max(0, (state?.targetRpm || 0) - 100) }));
    button(884, 420, 76, 60, '＋', () => send({ type: 'spindle.speed', rpm: Math.min(maxRpm, (state?.targetRpm || 0) + 100) }));
    button(600, 500, 360, 64, '刀具', nextTool, stopped);
  }
  button(40, 584, 290, 64, '放上工件／換新毛胚', mountStock, stopped);
  button(342, 584, 200, 64, '卸下工件', () => send({ type: 'workpiece.unmount' }), () => stopped() && !!state?.workpiece);
  button(760, 584, 200, 64, '設定 ›', () => { message = '設定頁（第二頁）在下一步加入'; messageT = 3; refresh(true); }, () => false);

  function drawButton(b, i) {
    const enabled = b.enabled(), active = b.active(), down = pressed === i;
    ctx.fillStyle = down ? COLORS.rowPressed : active ? '#3a2a14' : hover === i && enabled ? COLORS.rowHover : COLORS.tile;
    ctx.beginPath(); ctx.roundRect(b.x, b.y + (down ? 2 : 0), b.w, b.h, 8); ctx.fill();
    ctx.strokeStyle = active ? COLORS.amber : COLORS.brassLine; ctx.lineWidth = active ? 3 : 2; ctx.stroke();
    let label = b.label;
    if (label === '刀具') label = `刀具：${tools.find(([id]) => id === state?.activeCuttingTool?.id)?.[1] || '—'} ▸`;
    ctx.fillStyle = !enabled ? COLORS.dim : active ? COLORS.amberText : COLORS.cream;
    ctx.font = `700 ${label.length > 6 ? 28 : 32}px ${FONT_SERIF_TC}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + (down ? 3 : 1));
  }

  function draw() {
    const inner = drawFrame(ctx, W, H, { border: 20, radius: 16 });
    // 標題列：機台名稱與主軸狀態
    drawEnamel(ctx, inner.x, inner.y, inner.w, 88, 3);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = COLORS.brass; ctx.font = `700 44px ${FONT_SERIF_TC}`;
    ctx.fillText(`${NAMES[machineId] || ''}　儀表板`, inner.x + 24, inner.y + 46);
    const running = state?.rpm > 0;
    ctx.textAlign = 'right'; ctx.fillStyle = running ? COLORS.amber : COLORS.sage; ctx.font = `700 34px ${FONT_SERIF_TC}`;
    ctx.fillText(`${state?.emergency ? '煞車中' : running ? '● 運轉中' : '■ 停止'}　${Math.round(state?.rpm || 0)} RPM`, inner.x + inner.w - 24, inner.y + 46);
    // DRO
    axes.forEach((a, i) => {
      const y = DRO_Y + i * DRO_H;
      ctx.textAlign = 'left'; ctx.fillStyle = COLORS.label; ctx.font = `500 26px ${FONT_SERIF_TC}`;
      ctx.fillText(a.label, 44, y + 36);
      ctx.textAlign = 'right'; ctx.fillStyle = COLORS.amberText; ctx.font = `700 46px ${FONT_SANS}`;
      ctx.fillText(fmt(readout(a)), 430, y + 38);
    });
    ctx.fillStyle = COLORS.brassLine; ctx.fillRect(580, 128, 2, 260);
    // 接觸狀態、車床工件尺寸、警告
    const c = contact(), lamp = { none: '#5d544a', touch: '#f2c14e', cutting: '#ff8a3d', overshoot: '#ff4d3d' }[c.level];
    ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(624, 168, 18, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.cream; ctx.font = `700 32px ${FONT_SERIF_TC}`;
    ctx.fillText(c.text, 654, 170);
    let y = 230;
    ctx.font = `500 28px ${FONT_SERIF_TC}`; ctx.fillStyle = COLORS.cream;
    if (machineId === 'lathe' && state?.machining) {
      ctx.fillText(`工件長度　${fmt(state.machining.lengthMm)} mm`, 610, y); y += 42;
      ctx.fillText(`刀尖處直徑　Ø ${fmt(state.machining.diameterAtTipMm)}`, 610, y); y += 42;
    } else if (!state?.workpiece) { ctx.fillStyle = COLORS.label; ctx.fillText('尚未放上工件', 610, y); y += 42; }
    if (machineId !== 'lathe') {
      ctx.textAlign = 'center'; ctx.fillStyle = COLORS.label; ctx.font = `500 24px ${FONT_SERIF_TC}`;
      ctx.fillText('轉速設定', 780, 404);
      ctx.fillStyle = COLORS.amberText; ctx.font = `700 40px ${FONT_SANS}`;
      ctx.fillText(`${Math.round(state?.effectiveTargetRpm ?? state?.targetRpm ?? 0)}`, 780, 452);
      ctx.textAlign = 'left';
    }
    const warn = state?.warning;
    if (warn?.level) {
      ctx.fillStyle = warn.level === 'danger' ? '#ff6b57' : COLORS.amber; ctx.font = `700 26px ${FONT_SERIF_TC}`;
      wrapText(ctx, warn.text, 340).slice(0, 3).forEach((line, i) => ctx.fillText(line, 610, y + i * 34));
    }
    // 每格進給量
    ctx.textAlign = 'left'; ctx.fillStyle = COLORS.label; ctx.font = `500 24px ${FONT_SERIF_TC}`;
    ctx.fillText('手輪每格（10°）進給 mm', 44, 404);
    buttons.forEach(drawButton);
    // 訊息列
    ctx.textAlign = 'left'; ctx.font = `500 26px ${FONT_SERIF_TC}`;
    ctx.fillStyle = message ? COLORS.amber : COLORS.label;
    ctx.fillText(message || '射線指著按鈕按 trigger；手輪按住 grip 畫圈轉', 44, 700);
    texture.needsUpdate = true;
  }
  // 顯示的內容有變才重畫（DRO 在移動時每格都在變，最多每秒 15 次）
  const signatureOf = () => JSON.stringify([state?.rpm, state?.running, state?.emergency, state?.targetRpm, state?.activeCuttingTool?.id, !!state?.workpiece,
    axes.map(a => fmt(readout(a))), contact().level, state?.machining?.lengthMm, state?.machining?.diameterAtTipMm, state?.warning?.level, state?.warning?.text, feed.mm, message, hover, pressed, state?.busy]);
  function refresh(force = false) {
    state = session.getState();
    const next = signatureOf();
    if (force || next !== signature) { signature = next; draw(); }
  }

  const at = uv => {
    if (!uv) return -1;
    const x = uv.x * W, y = (1 - uv.y) * H;
    return buttons.findIndex(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  };
  const off = input.add(screen, {
    highlight: false,
    onMove: info => { const i = at(info.uv); if (i !== hover) { hover = i; refresh(true); } },
    onHover: on => { if (!on && hover !== -1) { hover = -1; refresh(true); } },
    onSelect: info => {
      const i = at(info.uv), b = buttons[i];
      if (!b) return;
      if (!b.enabled()) { info?.pulse?.(0.4, 30); return; }
      info?.pulse?.(0.25, 18);
      pressed = i; pressT = 0;
      b.action();
      refresh(true);
    },
  });

  const glyphs = Object.values(NAMES).join('') + axes.map(a => a.label).join('') + (tools || []).map(t => t[1]).join('') + Object.values(REASONS).join('')
    + '儀表板運轉中停止煞車未接觸接觸對刀點切削中壓入工件長度刀尖處直徑尚未放上轉速設定手輪每格進給啟動刀具放上工件換新毛胚卸下設定頁第二頁在下一步加入射線指著按鈕按手輪按住畫圈轉歸零請注意危險主軸正在旋轉機構已進入操作狀態刀具已接近旋轉中的夾頭目前無警告缺少已確認的距離夾具偵測未啟用';
  draw();
  loadSignFonts(glyphs).then(() => refresh(true));
  let t = 0;
  return {
    object: root,
    update(dt) {
      if (pressed >= 0 && (pressT += dt) > 0.12) { pressed = -1; refresh(true); }
      if (messageT > 0 && (messageT -= dt) <= 0) { message = ''; refresh(true); }
      if ((t += dt) >= 1 / 15) { t = 0; refresh(); }
    },
    dispose() {
      off();
      texture.dispose();
      root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
}
