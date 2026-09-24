import { useEffect, useRef, useState } from 'react';
import ControlPanel from './ControlPanel.jsx';
import { createBlockStock } from '../levels/challenges.js';

// Student-facing controls shared by the classroom and every challenge:
// spindle → axis + step → jog / hold → DRO with zero → contact cue.
const AXES = {
  lathe: [
    { id: 'X', label: 'X 徑向', minus: '進刀', plus: '退刀', wheel: 'crossSlideHandwheel', holdSign: -1, diameter: true },
    { id: 'Z', label: 'Z 縱向', minus: '往夾頭', plus: '往尾端', wheel: 'carriageHandwheel', holdSign: 1 },
    // Compound rest: feeds along a set angle from Z, i.e. X and Z together → a real taper.
    { id: 'C', short: '小刀架', label: '小刀架', minus: '斜向往夾頭', plus: '斜向退回', wheel: null, compound: true },
  ],
  milling: [
    { id: 'X', label: 'X 工作臺', minus: '左移', plus: '右移', wheel: 'X_Handwheel_Right_Group', holdSign: 1 },
    { id: 'Y', label: 'Y 鞍座', minus: '前移', plus: '後移', wheel: 'Y_Handwheel_Group', holdSign: 1 },
    { id: 'Z', label: 'Z 升降', minus: '下降', plus: '上升', wheel: 'zLift', holdSign: 1 },
  ],
  drill: [
    { id: 'quill', short: '進給', label: '主軸進給', minus: '按住下降（鑽入）', plus: '按住上升', wheel: 'feed', holdSign: 1, lever: true },
    { id: 'table', short: '工作臺', label: '工作臺高度', minus: '下降', plus: '上升', wheel: null },
  ],
};
const STEPS = [0.01, 0.05, 0.1, 0.5, 1, 5];
const HEAD_TOOLS = { milling: [['head_face_mill', '面銑刀 Ø58'], ['head_end_mill', '立銑刀 Ø8']], drill: [['head_drill_85', '鑽頭 Ø8.5'], ['head_tap_m10', 'M10 絲攻']] };
const show = v => v == null ? '—' : (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3);

export default function OperatePanel({ session, controls, model, machineId, levelMode = false, children }) {
  const axes = AXES[machineId] || [];
  const [axisId, setAxisId] = useState(axes[0]?.id);
  const [step, setStep] = useState(0.1);
  const [angle, setAngle] = useState(3);
  const [stopDepth, setStopDepth] = useState('-10');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState({ X: '', Z: '' });
  // Remember the expanded section across stock changes (the lathe section remounts with each new stock).
  const [targetOpen, setTargetOpen] = useState(false);
  const holdTimer = useRef(null), repeatTimer = useRef(null);
  const state = controls.state, m = state?.machining, head = state?.headMachining;
  const machining = machineId === 'lathe' && !!m;
  const available = axes.filter(a => !a.compound || machining);
  const axis = available.find(a => a.id === axisId) || available[0];
  const stopped = !!state && !state.running && state.rpm === 0 && state.leverAngle === 0;
  const running = state?.rpm > 0;
  useEffect(() => { setAxisId(axes[0]?.id); }, [machineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = command => {
    const result = session?.command(command);
    if (result && typeof result.then === 'function') return result.then(r => { setMessage(r.ok ? '' : r.reason); return r; });
    setMessage(result && !result.ok ? result.reason : ''); controls.refresh(); return result;
  };
  // Lathe with a cuttable stock uses the machining work coordinates; everything else uses the DRO offsets.
  const readout = a => machining ? (a.id === 'X' ? m.xDiameterMm : m.zMm) : state?.axesMm?.[a.id];
  const jog = (a, delta) => {
    if (a.compound) {
      // Along the compound slide: Δz = d·cosθ, Δdiameter = −2·d·sinθ (feeding toward the chuck grows the diameter).
      // Read the tip fresh: a held button repeats this from a timer whose render-time state is stale.
      const t = angle * Math.PI / 180, now = session?.getState().machining || m;
      return send({ type: 'machining.line', xDiameterMm: now.xDiameterMm - 2 * delta * Math.sin(t), zMm: now.zMm + delta * Math.cos(t) });
    }
    return send(machining
      ? { type: 'machining.move', axis: a.id, valueMm: delta, mode: 'relative', ...(a.diameter ? { representation: 'diameter' } : {}) }
      : { type: 'axis.move', axis: a.id, valueMm: delta, mode: 'relative', ...(a.diameter ? { representation: 'diameter' } : {}) });
  };
  const zero = a => send(machining
    ? { type: 'machining.datum', axis: a.id, valueMm: 0, ...(a.diameter ? { representation: 'diameter' } : {}) }
    : { type: 'workOffset.zero', axis: a.id, ...(a.diameter ? { representation: 'diameter' } : {}) });

  // While held, the handwheel turns at a speed tied to the selected step: about 8 × step mm/s.
  const holdSpeed = wheel => {
    const ratio = wheel?.ratio, mmPerSecond = Math.min(40, Math.max(0.08, step * 8));
    session?.command({ type: 'hold.speed', scale: ratio ? mmPerSecond / (wheel.speed * ratio * 1000) : 1 });
  };
  const endHold = () => { clearTimeout(holdTimer.current); clearInterval(repeatTimer.current); holdTimer.current = repeatTimer.current = null; controls.stopInput(); session?.command({ type: 'hold.speed', scale: 1 }); };
  const beginHold = (event, direction) => {
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    const wheel = model?.config.wheels.find(w => w.id === axis.wheel);
    // Drill feed lever: feeds only while held and springs back up on release, like the real lever.
    if (axis.lever && wheel) { holdSpeed(wheel); controls.hold(wheel.id, direction * axis.holdSign); return; }
    jog(axis, direction * step);
    // Holding turns the real handwheel continuously (or repeats the step when there is no wheel).
    holdTimer.current = setTimeout(() => {
      if (wheel) { holdSpeed(wheel); controls.hold(wheel.id, direction * axis.holdSign); }
      else repeatTimer.current = setInterval(() => jog(axis, direction * step), 90);
    }, 380);
  };
  useEffect(() => endHold, []); // eslint-disable-line react-hooks/exhaustive-deps

  const contact = machineId === 'lathe' ? !!m?.contact && !m?.unsafe : !!head?.contact;
  const contactLevel = contact ? (running ? 'cutting' : 'touch') : 'none';
  const contactText = { none: '未接觸', touch: '接觸（對刀點）', cutting: '切削中' }[contactLevel];

  const mountStock = async () => {
    if (machineId === 'lathe') return send({ type: 'workpiece.createHandle' });
    if (!state?.activeCuttingTool || !HEAD_TOOLS[machineId].some(([id]) => id === state.activeCuttingTool.id)) {
      const r = await send({ type: 'tool.select', toolId: HEAD_TOOLS[machineId][0][0] }); if (!r?.ok) return;
    }
    return send({ type: 'workpiece.mountState', state: createBlockStock() });
  };
  const disabled = !session?.canCommand() || state?.busy;
  const label = a => a.short || a.id;

  return <aside className="panel operate-panel" aria-label="操作面板">
    {children}
    <fieldset disabled={disabled || !model}>
      <section className="op-section">
        <div className="op-heading"><h3>主軸</h3><span className={'op-state ' + (running ? 'is-running' : '')}>{running ? '運轉中' : '已停止'} · <output data-testid="cut-rpm">{Math.round(model?.rpm || 0)}</output> RPM</span></div>
        <div className="op-row">
          <button className="primary" onClick={() => controls.start(controls.direction)} disabled={controls.running || model?.emergency || !model?.pivots[model?.config.spindle.node]}>▶ 啟動主軸</button>
          <button onClick={controls.stop} disabled={!controls.running}>■ 停止主軸</button>
        </div>
      </section>

      <section className="op-section">
        <div className="op-heading"><h3>進給</h3><span className={'contact-pill ' + contactLevel} data-testid="contact-state" role="status">● {contactText}</span></div>
        <div className="segmented" role="radiogroup" aria-label="移動軸">
          {available.map(a => <button key={a.id} role="radio" aria-checked={a.id === axis?.id} onClick={() => { endHold(); setAxisId(a.id); }}>{a.label}</button>)}
        </div>
        {axis?.compound && <label className="op-field">小刀架角度（°，由 Z 軸算起）
          <input aria-label="小刀架角度" type="number" step="0.5" min="-45" max="45" value={angle} onChange={e => setAngle(Math.max(-45, Math.min(45, Number(e.target.value) || 0)))} /></label>}
        <div className="segmented steps" role="radiogroup" aria-label="每次進給量">
          {STEPS.map(s => <button key={s} role="radio" aria-checked={s === step} onClick={() => setStep(s)}>{s}</button>)}
          <span className="unit">mm</span>
        </div>
        {axis && <div className="jog-row">
          {[-1, 1].map(d => <button key={d} className="jog" aria-label={`${label(axis)}${d < 0 ? '−' : '＋'} 微調`} aria-describedby={'jog-hint-' + d} onPointerDown={e => beginHold(e, d)} onPointerUp={endHold} onPointerCancel={endHold} onLostPointerCapture={endHold}
            onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); if (axis.lever) beginHold(e, d); else jog(axis, d * step); } }} onKeyUp={() => axis.lever && endHold()} onContextMenu={e => e.preventDefault()}>
            <strong>{label(axis)}{d < 0 ? '−' : '＋'} 微調</strong><small id={'jog-hint-' + d}>{d < 0 ? axis.minus : axis.plus}</small>
          </button>)}
        </div>}
        <p className="op-help">{axis?.lever ? `按住下降鑽孔，放開自動回到最上面；速度跟著進給量（約 ${Math.min(40, Math.max(0.08, step * 8)).toFixed(1)} mm/s）。` : axis?.compound ? `沿小刀架斜向移動 ${step} mm：Z 與 X 同時動，車出錐度。錐度半角 = atan((大徑 − 小徑) ÷ (2 × 長度))。` : `點一下移動 ${step} mm；按住不放會連續轉動手輪。`}</p>
        {machineId === 'drill' && <div className="op-field depth-stop">
          <label className="op-check"><input type="checkbox" checked={state?.feedStopMm != null} onChange={e => send({ type: 'feed.stop', axisId: 'quill', depthMm: e.target.checked ? Number(stopDepth) : null })} /> 深度擋塊</label>
          <input aria-label="深度擋塊（讀值 mm）" type="number" step="0.5" value={stopDepth} onChange={e => { setStopDepth(e.target.value); if (state?.feedStopMm != null && e.target.value !== '' && Number.isFinite(Number(e.target.value))) send({ type: 'feed.stop', axisId: 'quill', depthMm: Number(e.target.value) }); }} /> <small>mm（讀值）</small>
        </div>}
      </section>

      <section className="op-section">
        <div className="op-heading"><h3>座標讀值</h3>{machining && <small>{m.centerAligned ? '中心高已對準' : '中心高未對準'}</small>}</div>
        <div className="dro">
          {axes.filter(a => !a.compound).map(a => <div key={a.id} className={a.id === axis?.id ? 'active' : ''}>
            <span>{a.label}{a.diameter ? '（直徑）' : ''}</span>
            <strong><output data-testid={machineId === 'lathe' ? 'cut-' + (a.id === 'X' ? 'x-diameter' : 'z') : 'dro-' + a.id}>{show(readout(a))}</output><small> mm</small></strong>
            <button onClick={() => zero(a)} disabled={!state?.axesMm}>{label(a)} 歸零</button>
          </div>)}
        </div>
        {machineId === 'lathe' && <p className="op-help">刀尖接觸：<output data-testid="cut-contact">{m?.contact ? '是' : '否'}</output>。歸零只設定讀值基準，不移動刀具；X 讀值是直徑，變化 1 mm = 刀尖徑向 0.5 mm。</p>}
        {m?.unsafe && <p role="alert" className="notice danger">刀尖進入夾頭危險區，本段禁止切削。請退刀。</p>}
      </section>

      {machining && <section className="op-section">
        <div className="op-heading"><h3>車削</h3></div>
        <label className="op-field">加工模式<select aria-label="加工模式" value={m.mode || 'turning'} onChange={e => send({ type: 'machining.mode', mode: e.target.value })}><option value="turning">外徑車削</option><option value="facing">端面車削</option></select></label>
        <dl className="op-measure"><dt>目前長度</dt><dd><output data-testid="cut-length">{show(m.lengthMm)}</output> mm</dd>
          <dt>刀尖處直徑</dt><dd>Ø <output data-testid="cut-stock-diameter">{show(m.diameterAtTipMm)}</output> mm</dd></dl>
        <details className="op-details" open={targetOpen} onToggle={e => setTargetOpen(e.currentTarget.open)}><summary>移動到工件座標</summary>
          {['X', 'Z'].map(a => <div className="op-target" key={a}><label>{a} 工件座標 (mm)<input aria-label={a + ' 工件座標目標 (mm)'} type="number" step="0.1" value={target[a]} onChange={e => setTarget({ ...target, [a]: e.target.value })} /></label>
            <button disabled={target[a] === ''} onClick={() => send({ type: 'machining.move', axis: a, valueMm: Number(target[a]), ...(a === 'X' ? { representation: 'diameter' } : {}) })}>移動 {a}</button></div>)}
          <button onClick={() => send({ type: 'machining.clearDatum' })}>清除工件座標</button>
        </details>
      </section>}

      {!levelMode && <section className="op-section">
        <div className="op-heading"><h3>工件</h3>{state?.workpiece && <small>{state.workpiece.name}</small>}</div>
        {machineId !== 'lathe' && <label className="op-field">刀具<select aria-label="刀具" value={state?.activeCuttingTool?.id || ''} disabled={!stopped} onChange={e => send({ type: 'tool.select', toolId: e.target.value })}>
          {!HEAD_TOOLS[machineId].some(([id]) => id === state?.activeCuttingTool?.id) && <option value="">原機台刀具</option>}
          {HEAD_TOOLS[machineId].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
        <div className="op-row">
          <button disabled={!stopped} onClick={mountStock}>{state?.workpiece?.machinable ? '換新毛胚' : machineId === 'lathe' ? '放上工件 Ø20×300' : '放上工件 20×20×90'}</button>
          <button disabled={!stopped || !state?.workpiece} onClick={() => send({ type: 'workpiece.unmount' })}>卸下工件</button>
        </div>
        <p className="op-help">{machineId === 'lathe' ? '毛胚由夾頭夾持，刀尖會自動對準中心高。' : machineId === 'drill' ? '方料由虎鉗夾持，已對準鑽頭正下方。' : '方料由虎鉗夾持，順著工作臺 X 方向擺放。'}停機後才能換工件或刀具。</p>
      </section>}

      <button className="reset" onClick={controls.reset}>↺ 重設操作與視角</button>
      {model?.errors.length > 0 && <p role="alert" className="notice danger">部分操作無法使用：{model.errors.join('；')}</p>}
      {message && <p role="alert" className="notice caution">{message}</p>}
      <details className="op-details advanced"><summary>進階：全部機台控制</summary>
        <ControlPanel controls={controls} model={model} diagnostic />
      </details>
    </fieldset>
  </aside>;
}
