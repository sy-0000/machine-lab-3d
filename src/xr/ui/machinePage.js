// 選單的「機台」頁（原機台旁的儀表板，第 6 階段後移進左手選單）：
//   第一頁「加工中」：主軸狀態與轉速、DRO 各軸＋歸零、接觸燈號、車床工件長度與刀尖處直徑、安全警告、
//                     每格進給量 0.01／0.1／1、主軸啟動／停止、銑床鑽床轉速 −／＋ 與刀具（停機時）、放上／卸下工件、設定 ›
//   第二頁「設定」：車床加工模式、小刀架角度與斜向進給、錐度靠模（開關＋角度）、移動到工件座標 X／Z、清除工件座標；
//                   鑽床深度擋塊（開關＋深度）；全部：重設操作；‹ 返回。數字用 −／＋（按住連續加減）。
// DRO、轉速等數字用翻牌字牌顯示；數字變化時只有輕微的喀聲（audio.click，限制頻率），沒有翻轉動畫。
// 指令與桌機操作面板（OperatePanel.jsx）相同，走工作室的 MachineSession。這個模組只負責畫與按鈕；外框、分頁、
// 釘選與按鈕的點選判斷在 Menu.js。
import { createBlockStock } from '../../levels/challenges.js';
import { COLORS, drawNumberTiles, FONT_SERIF_TC } from './theme.js';
import { wrapText } from './canvasText.js';

export const FEEDS = [0.01, 0.1, 1];
const AXES = {
  lathe: [{ id: 'X', label: 'X 徑向 Ø', diameter: true }, { id: 'Z', label: 'Z 縱向' }],
  milling: [{ id: 'X', label: 'X 工作臺' }, { id: 'Y', label: 'Y 鞍座' }, { id: 'Z', label: 'Z 升降' }],
  drill: [{ id: 'quill', label: '主軸進給' }, { id: 'table', label: '工作臺高' }],
};
const HEAD_TOOLS = { milling: [['head_face_mill', '面銑刀 Ø58'], ['head_end_mill', '立銑刀 Ø8']], drill: [['head_drill_85', '鑽頭 Ø8.5'], ['head_drill_10', '鑽頭 Ø10'], ['head_tap_m10', 'M10 絲攻']] };
const NAMES = { lathe: '車床', milling: '銑床', drill: '鑽床' };
const REASONS = { 'input-locked-or-unavailable': '機台目前不能操作', 'asset-command-pending': '正在處理上一個指令', cancelled: '已取消' };
const fmt = v => v == null ? '—' : (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * @param {{ machine: () => ({ session, machineId, feed: { mm }, maxRpm } | null), audio?: { click(): void }, say: (text: string) => void }} options
 */
export function createMachinePage({ machine, audio, say }) {
  // 第二頁的數值（每台機台各自記住）
  const settings = { compoundDeg: 3, taperDeg: 3, targetX: 20, targetZ: 0, depthMm: -10 };
  let lastNumbers = '';

  const ctxOf = () => {
    const m = machine();
    if (!m?.session) return null;
    const state = m.session.getState();
    return state.disposed ? null : { ...m, state };
  };
  const send = (m, command) => {
    const r = m.session.command(command);
    const done = res => { say(res && !res.ok ? (REASONS[res.reason] || res.reason || '') : ''); return res; };
    return r && typeof r.then === 'function' ? r.then(done) : done(r);
  };
  const stopped = s => !s.running && s.rpm === 0 && s.leverAngle === 0;
  const machining = (m) => m.machineId === 'lathe' && !!m.state.machining;
  const readout = (m, a) => machining(m) ? (a.id === 'X' ? m.state.machining.xDiameterMm : m.state.machining.zMm) : m.state.axesMm?.[a.id];
  const contactOf = m => {
    const s = m.state, mm = s.machining, head = s.headMachining, running = s.rpm > 0;
    const touching = m.machineId === 'lathe' ? !!mm?.contact && !mm?.unsafe : !!head?.contact;
    const overshoot = !running && touching && head?.embedMm > 0.05;
    const level = touching ? (running ? 'cutting' : overshoot ? 'overshoot' : 'touch') : 'none';
    return { level, text: { none: '未接觸', touch: '接觸（對刀點）', cutting: '切削中', overshoot: `刀尖壓入 ${head?.embedMm?.toFixed(2)} mm` }[level] };
  };
  const label = (ctx, text, x, y, { size = 24, color = COLORS.label, align = 'left', weight = 500 } = {}) => {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${FONT_SERIF_TC}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };

  function page1(ctx, area, add, m) {
    const s = m.state, { x0, x1 } = area;
    let y = area.y;
    // 主軸
    const running = s.rpm > 0;
    label(ctx, `${NAMES[m.machineId]}　主軸`, x0, y + 26, { size: 28, color: COLORS.brass, weight: 700 });
    label(ctx, s.emergency ? '煞車中' : running ? '● 運轉中' : '■ 停止', x0 + 200, y + 26, { size: 26, color: running ? COLORS.amber : COLORS.sage, weight: 700 });
    drawNumberTiles(ctx, String(Math.round(s.rpm || 0)), x1 - 70, y + 2, { count: 4, tileW: 34, tileH: 48 });
    label(ctx, 'RPM', x1, y + 26, { size: 22, align: 'right', color: COLORS.platform });
    y += 66;
    // DRO
    for (const a of AXES[m.machineId] || []) {
      label(ctx, a.label, x0, y + 25, { size: 24 });
      drawNumberTiles(ctx, fmt(readout(m, a)), x1 - 116, y, { count: 8, tileW: 34, tileH: 50 });
      add({ x: x1 - 104, y: y + 2, w: 104, h: 46, label: '歸零', size: 26, enabled: () => readout(m, a) != null,
        action: () => send(m, machining(m)
          ? { type: 'machining.datum', axis: a.id, valueMm: 0, ...(a.diameter ? { representation: 'diameter' } : {}) }
          : { type: 'workOffset.zero', axis: a.id, ...(a.diameter ? { representation: 'diameter' } : {}) }) });
      y += 60;
    }
    // 接觸燈號、車床尺寸、警告
    const c = contactOf(m), lamp = { none: '#5d544a', touch: '#f2c14e', cutting: '#ff8a3d', overshoot: '#ff4d3d' }[c.level];
    ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(x0 + 14, y + 22, 13, 0, Math.PI * 2); ctx.fill();
    label(ctx, c.text, x0 + 38, y + 23, { size: 26, color: c.level === 'overshoot' ? '#ff6b57' : COLORS.cream, weight: 700 });
    if (m.machineId === 'lathe' && s.machining) label(ctx, `長 ${fmt(s.machining.lengthMm)}　刀尖處 Ø ${fmt(s.machining.diameterAtTipMm)}`, x1, y + 23, { size: 22, align: 'right', color: COLORS.cream });
    else if (!s.workpiece) label(ctx, '尚未放上工件', x1, y + 23, { size: 22, align: 'right' });
    y += 46;
    const warn = s.warning;
    if (warn?.level) {
      const lines = wrapText(Object.assign(ctx, { font: `700 22px ${FONT_SERIF_TC}` }), warn.text, x1 - x0);
      label(ctx, lines[0] + (lines.length > 1 ? '…' : ''), x0, y + 14, { size: 22, color: warn.level === 'danger' ? '#ff6b57' : COLORS.amber, weight: 700 });
    }
    y += 36;
    // 每格進給量
    label(ctx, '手輪每格（10°）mm', x0, y + 26, { size: 22 });
    FEEDS.forEach((mm, i) => add({ x: x0 + 220 + i * 118, y, w: 110, h: 52, label: String(mm), active: () => m.feed.mm === mm, action: () => { m.feed.mm = mm; } }));
    y += 66;
    // 主軸、轉速
    add({ x: x0, y, w: 170, h: 56, label: '▶ 啟動', action: () => send(m, { type: 'spindle.start', direction: 1 }), enabled: () => !s.running && !s.emergency && s.spindleAvailable !== false });
    add({ x: x0 + 180, y, w: 170, h: 56, label: '■ 停止', action: () => send(m, { type: 'spindle.stop' }), enabled: () => !!s.running || s.rpm > 0 });
    if (m.machineId !== 'lathe') {
      const target = Math.round(s.effectiveTargetRpm ?? s.targetRpm ?? 0);
      add({ x: x0 + 380, y, w: 64, h: 56, label: '−', repeat: true, action: () => send(m, { type: 'spindle.speed', rpm: Math.max(0, (m.session.getState().targetRpm || 0) - 100) }) });
      drawNumberTiles(ctx, String(target), x1 - 74, y + 4, { count: 4, tileW: 30, tileH: 46, color: COLORS.cream });
      add({ x: x1 - 64, y, w: 64, h: 56, label: '＋', repeat: true, action: () => send(m, { type: 'spindle.speed', rpm: Math.min(m.maxRpm || 2000, (m.session.getState().targetRpm || 0) + 100) }) });
    }
    y += 68;
    // 工件、刀具、設定
    const tools = HEAD_TOOLS[m.machineId];
    add({ x: x0, y, w: 250, h: 56, label: '放上工件／換新毛胚', size: 24, enabled: () => stopped(s), action: async () => {
      if (m.machineId === 'lathe') return send(m, { type: 'workpiece.createHandle' });
      if (!s.activeCuttingTool || !tools.some(([id]) => id === s.activeCuttingTool.id)) { const r = await send(m, { type: 'tool.select', toolId: tools[0][0] }); if (!r?.ok) return; }
      return send(m, { type: 'workpiece.mountState', state: createBlockStock() });
    } });
    add({ x: x0 + 260, y, w: 150, h: 56, label: '卸下工件', size: 26, enabled: () => stopped(s) && !!s.workpiece, action: () => send(m, { type: 'workpiece.unmount' }) });
    if (tools) {
      const name = tools.find(([id]) => id === s.activeCuttingTool?.id)?.[1] || '—';
      add({ x: x0 + 420, y, w: x1 - x0 - 420, h: 56, label: `${name} ▸`, size: 24, enabled: () => stopped(s), action: () => {
        const i = tools.findIndex(([id]) => id === s.activeCuttingTool?.id);
        return send(m, { type: 'tool.select', toolId: tools[(i + 1) % tools.length][0] });
      } });
    }
    y += 68;
    return { y, numbers: `${Math.round(s.rpm || 0)}|${(AXES[m.machineId] || []).map(a => fmt(readout(m, a))).join('|')}` };
  }

  // −／＋ 數值列：label、數值、兩顆按鈕（按住連續）
  function stepper(ctx, add, area, y, text, value, unit, onStep, extra) {
    const { x0, x1 } = area;
    label(ctx, text, x0, y + 28, { size: 24 });
    add({ x: x0 + 250, y, w: 60, h: 56, label: '−', repeat: true, action: () => onStep(-1) });
    label(ctx, `${value}${unit}`, x0 + 385, y + 28, { size: 28, color: COLORS.amberText, align: 'center', weight: 700 });
    add({ x: x0 + 460, y, w: 60, h: 56, label: '＋', repeat: true, action: () => onStep(1) });
    if (extra) add({ x: x0 + 532, y, w: x1 - x0 - 532, h: 56, size: 24, ...extra });
  }

  function page2(ctx, area, add, m) {
    const s = m.state, { x0, x1 } = area;
    let y = area.y;
    label(ctx, `${NAMES[m.machineId]}　設定`, x0, y + 24, { size: 28, color: COLORS.brass, weight: 700 });
    y += 58;
    if (m.machineId === 'lathe') {
      const mm = s.machining;
      label(ctx, '加工模式', x0, y + 28, { size: 24 });
      [['turning', '外徑車削'], ['facing', '端面車削']].forEach(([mode, text], i) => add({ x: x0 + 250 + i * 200, y, w: 190, h: 56, label: text, size: 26,
        enabled: () => !!mm, active: () => (mm?.mode || 'turning') === mode, action: () => send(m, { type: 'machining.mode', mode }) }));
      y += 66;
      stepper(ctx, add, area, y, '小刀架角度', settings.compoundDeg.toFixed(1), '°', d => { settings.compoundDeg = clamp(settings.compoundDeg + d * 0.5, -45, 45); },
        { label: '斜向進給 ▸', enabled: () => !!mm, repeat: true, action: () => {
          // 沿小刀架方向往夾頭走一格（每格進給量）：Δz = −d·cosθ、Δ直徑 = +2·d·sinθ
          const t = settings.compoundDeg * Math.PI / 180, now = m.session.getState().machining, d = -m.feed.mm;
          if (now) send(m, { type: 'machining.line', xDiameterMm: now.xDiameterMm - 2 * d * Math.sin(t), zMm: now.zMm + d * Math.cos(t) });
        } });
      y += 66;
      const taperOn = !!mm?.taperAttachment?.enabled;
      stepper(ctx, add, area, y, '錐度靠模（半角）', settings.taperDeg.toFixed(1), '°', d => {
        settings.taperDeg = clamp(settings.taperDeg + d * 0.5, -10, 10);
        if (taperOn) send(m, { type: 'machining.taperAttachment', enabled: true, angleDeg: settings.taperDeg });
      }, { label: taperOn ? '靠模：開' : '靠模：關', active: () => taperOn, enabled: () => !!mm,
        action: () => send(m, { type: 'machining.taperAttachment', enabled: !taperOn, angleDeg: settings.taperDeg }) });
      y += 66;
      stepper(ctx, add, area, y, '移到工件座標 X Ø', settings.targetX.toFixed(1), '', d => { settings.targetX = Math.max(0, settings.targetX + d * 0.5); },
        { label: '移動 X', enabled: () => !!mm, action: () => send(m, { type: 'machining.move', axis: 'X', valueMm: settings.targetX, representation: 'diameter' }) });
      y += 66;
      stepper(ctx, add, area, y, '移到工件座標 Z', settings.targetZ.toFixed(1), '', d => { settings.targetZ += d * 0.5; },
        { label: '移動 Z', enabled: () => !!mm, action: () => send(m, { type: 'machining.move', axis: 'Z', valueMm: settings.targetZ }) });
      y += 66;
      add({ x: x0, y, w: 250, h: 56, label: '清除工件座標', size: 26, enabled: () => !!mm, action: () => send(m, { type: 'machining.clearDatum' }) });
    } else if (m.machineId === 'drill') {
      const on = s.feedStopMm != null;
      stepper(ctx, add, area, y, '深度擋塊（讀值 mm）', settings.depthMm.toFixed(1), '', d => {
        settings.depthMm += d * 0.5;
        if (on) send(m, { type: 'feed.stop', axisId: 'quill', depthMm: settings.depthMm });
      }, { label: on ? '擋塊：開' : '擋塊：關', active: () => on, action: () => send(m, { type: 'feed.stop', axisId: 'quill', depthMm: on ? null : settings.depthMm }) });
      y += 66;
    } else {
      label(ctx, '銑床沒有額外的設定項目', x0, y + 28, { size: 24 });
      y += 66;
    }
    add({ x: x1 - 250, y, w: 250, h: 56, label: '重設操作', size: 26, action: () => send(m, { type: 'machine.reset' }) });
    return { y: y + 68, numbers: '' };
  }

  return {
    available: () => !!ctxOf(),
    /** page：'machine1' | 'machine2'；area = { x0, x1, y }；add(button) 登記按鈕 */
    draw(ctx, page, area, add) {
      const m = ctxOf();
      if (!m) { label(ctx, '走到工作室的機台旁才能操作機台', (area.x0 + area.x1) / 2, area.y + 80, { size: 28, align: 'center' }); return; }
      const out = (page === 'machine2' ? page2 : page1)(ctx, area, add, m);
      if (page === 'machine1') add({ x: area.x1 - 160, y: out.y, w: 160, h: 56, label: '設定 ›', size: 26, action: 'page:machine2' });
      else add({ x: area.x0, y: out.y, w: 160, h: 56, label: '‹ 返回', size: 26, action: 'page:machine1' });
      // 數字變了：輕微喀聲（由 audio 限制頻率）
      if (out.numbers && out.numbers !== lastNumbers) { if (lastNumbers) audio?.click(); lastNumbers = out.numbers; }
    },
    /** 有變才重畫用：目前顯示內容的摘要 */
    signature(page) {
      const m = ctxOf();
      if (!m) return 'none';
      const s = m.state;
      return JSON.stringify([page, s.rpm, s.running, s.emergency, s.targetRpm, s.activeCuttingTool?.id, !!s.workpiece, s.axesMm, s.machining?.xDiameterMm, s.machining?.zMm,
        s.machining?.mode, s.machining?.taperAttachment, s.machining?.lengthMm, s.machining?.diameterAtTipMm, contactOf(m).level, s.warning?.level, s.warning?.text,
        s.feedStopMm, m.feed.mm, settings, s.busy]);
    },
    /** 預先載入用的字 */
    glyphs: Object.values(NAMES).join('') + Object.values(AXES).flat().map(a => a.label).join('') + Object.values(HEAD_TOOLS).flat().map(t => t[1]).join('') + Object.values(REASONS).join('')
      + '主軸煞車中運轉停止未接觸接觸對刀點切削刀尖壓入長處尚未放上工件手輪每格啟動換新毛胚卸下設定返回加工模式外徑車削端面小刀架角度斜向進給錐度靠模半角開關移到工件座標移動清除深度擋塊讀值銑床沒有額外的項目重設操作走到工作室的機台旁才能操作歸零',
  };
}
