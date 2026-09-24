import { useState } from 'react';
export default function ControlPanel({ controls: c, model, diagnostic = false }) {
 const [selected, setSelected] = useState('');
 const [step, setStep] = useState(1);
 const wheels = model?.config.wheels || [];
 const choice = wheels.some(w => w.id === selected) ? selected : wheels[0]?.id;
 const wheel = wheels.find(w => w.id === choice);
 const part = model?.controls[choice];
 const axis = model?.config.axes.find(a => a.id === wheel?.drives);
 const calibrationNeeded = wheels.some(w => w.needsCalibration);
 const locked = !part || (part.needsCalibration && !c.teaching);
 const movable = axis?.enabled && model?.lookup[axis.node];
 const value = axis ? model.offsets[axis.id] || 0 : 0;
 const press = (event, direction) => {
  event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  c.hold(choice, direction);
 };
 const release = () => c.stopInput();
 const jog = direction => { c.jog(axis.id, direction * step); };
 return <aside className="panel control-console" aria-label="操作控制台">
  <div className="console-heading"><div><span className="eyebrow">自由操作</span><h2>操作控制台</h2></div><span className={'console-state ' + (model?.rpm > 0 ? 'is-running' : '')}>{model?.rpm > 0 ? '運轉中' : '已停止'}</span></div>
  <fieldset disabled={!model || !c.inputEnabled}>
   <section className="console-section"><h3><span>01</span> 主軸啟停</h3>
    <div className="console-rpm"><strong>{Math.round(model?.rpm || 0)} <small>RPM</small></strong><span>設定 {c.rpm} RPM</span></div>
    {!diagnostic && <div className="button-row console-primary"><button className="primary" onClick={() => c.start(c.direction)} disabled={c.running || model?.emergency || !model?.pivots[model?.config.spindle.node]}>▶ 啟動主軸</button><button onClick={c.stop} disabled={!c.running}>■ 停止主軸</button></div>}
    {model?.config.actions?.some(a => a.type === 'emergency') && <button className="console-brake" onClick={c.brake}>腳踏煞車（減速停止）</button>}
    <details className="console-details"><summary>轉速與旋轉方向</summary>
     {model?.config.lever?.bidirectional && <div className="button-row"><button aria-pressed={c.running && c.direction===1} onClick={() => c.start(1)} disabled={model.emergency}>外撥／正轉</button><button aria-pressed={c.running && c.direction===-1} onClick={() => c.start(-1)} disabled={model.emergency}>內撥／反轉</button></div>}
     {model?.config.actions?.filter(a => a.type === 'detent').map(a => <label className="console-field" key={a.id}>{a.label}<select aria-label={a.label} value={model.detents[a.id]} onChange={e => c.detent(a.id, Number(e.target.value))}>{a.degrees.map((angle,index) => <option key={angle} value={index}>{a.id === model.config.speedSelectors?.gear ? model.config.speedSelectors.baseRpm[index] * model.config.speedSelectors.multipliers[model.detents[model.config.speedSelectors.mode]] + ' RPM' : a.id === model.config.speedSelectors?.mode ? model.config.speedSelectors.modeLabels[index] : angle + '°'}</option>)}</select></label>)}
     {!model?.config.speedSelectors && <><label className="range-label" htmlFor="rpm">設定轉速 <output>{c.rpm} RPM</output></label><input id="rpm" type="range" min="0" max={model?.config.maxRpm || 2000} step="10" value={c.rpm} onChange={e => c.setRpm(e.target.value)} /></>}
    </details>
   </section>
   <section className="console-section"><h3><span>02</span> 選擇移動部位</h3>
    <label className="console-field" htmlFor="wheel-choice">操作手輪<select id="wheel-choice" value={choice || ''} onChange={e => {c.stopInput(); setSelected(e.target.value);}}>{wheels.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}</select></label>
    <div className="console-position"><span>{axis?.label || '位置'}</span><strong>{(value * 1000).toFixed(2)} <small>mm</small></strong></div>
    {calibrationNeeded && <div className="calibration"><label><input type="checkbox" checked={c.teaching} onChange={e => c.setTeaching(e.target.checked)} /> 啟用教學進給比例</label><p>開啟後可操作需要示範比例的手輪。</p></div>}
    <p className="console-help">按一下微調位置，或按住下方按鈕連續轉動手輪。</p>
    <div className="console-step"><label htmlFor="jog-step">每次移動</label><select id="jog-step" value={step} onChange={e => setStep(Number(e.target.value))}><option value="0.1">0.1 mm</option><option value="1">1 mm</option><option value="5">5 mm</option></select></div>
    <div className="button-row"><button disabled={!movable || value <= axis.range[0]} onClick={() => jog(-1)}>− 微調</button><button disabled={!movable || value >= axis.range[1]} onClick={() => jog(1)}>＋ 微調</button></div>
    <div className="button-row console-hold">{[-1,1].map(direction => <button key={direction} className="hold-button" disabled={locked} onPointerDown={e => press(e,direction)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={e => {if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {e.preventDefault(); c.hold(choice,direction);}}} onKeyUp={release} onBlur={release} onContextMenu={e => e.preventDefault()}>{part?.springReturn ? direction < 0 ? '按住下降（放開回位）' : '按住回升' : direction < 0 ? '↶ 按住負向旋轉' : '↷ 按住正向旋轉'}</button>)}</div>
    {locked && model && <p className="console-help">請先啟用教學進給比例，再操作手輪。</p>}
    <details className="console-details"><summary>全部軸向與行程調整</summary>{model?.config.axes.map(a => <div className="axis-control" key={a.id}><label className="range-label" htmlFor={a.id}>{a.label}<output>{((model.offsets[a.id] || 0) * 1000).toFixed(2)} mm</output></label><input id={a.id} type="range" min={a.range[0]} max={a.range[1]} step="any" disabled={!a.enabled || !model.lookup[a.node]} value={model.offsets[a.id]} onChange={e => c.move(a.id,e.target.value)} /><div className="range-ends"><span>{a.range[0]*1000} mm</span><span>{a.range[1]*1000} mm</span></div></div>)}</details>
   </section>
   <section className="console-section"><h3><span>03</span> 工件與刀座</h3>
    {model?.config.demoWorkpiece && <><button className="workpiece-button" onClick={c.toggleWorkpiece} disabled={c.running || model.rpm > 0 || model.leverAngle !== 0 || !!c.state?.workpiece}>{model.workpiece ? '卸下示範工件' : '裝上示範工件'}</button><p className="console-help">停機後可以裝卸工件。</p></>}
    {model?.config.actions?.some(a => a.type==='index') && <details className="console-details"><summary>刀座角度 · {(model.indexSteps || 0)*10}°</summary><div className="button-row"><button onClick={() => c.index(-1)}>刀座左轉 10°</button><button onClick={() => c.index(1)}>刀座右轉 10°</button></div></details>}
    {!model?.config.demoWorkpiece && <p className="console-help">直接在場景觀察刀具與工作臺的連動。</p>}
   </section>
   {!diagnostic && <button className="reset" onClick={c.reset}>↺ 重設操作與視角</button>}
  </fieldset>
  {!diagnostic && model?.errors.length > 0 && <p role="alert" className="notice danger">部分操作無法使用：{model.errors.join('；')}</p>}
  {diagnostic && <p role="status" className={'notice '+c.warning.level}>{c.warning.text}</p>}
 </aside>;
}
