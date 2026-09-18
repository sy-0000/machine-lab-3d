import { AXES, LATHE_PARTS } from '../lathe';
export default function ControlPanel({ controls: c, ready }) {
  return <aside className="panel"><div className="panel-heading"><div><span className="eyebrow">MACHINE CONTROL</span><h2>操作控制台</h2></div><span className="chip">3 AXIS</span></div>
    <fieldset disabled={!ready}><legend className="sr-only">車床操作控制</legend>
      {c.missing.length>0 && <p className="missing-parts" role="alert">部分功能停用，缺少節點：{c.missing.join('、')}</p>}
      <div className="section-label"><h3>主軸控制</h3><span className={c.rotating ? 'green' : 'muted'}>{c.drive.phase}</span></div>
      <div className="button-row"><button className="primary" onClick={c.start} disabled={c.running || !c.available.spindle}>▶ 啟動主軸</button><button onClick={c.stop} disabled={!c.running}>■ 停止主軸</button></div>
      <p className="tool-lock">拉桿：{c.drive.phase==='拉桿啟動中'?'切換中':c.running?'啟動位置':'停止位置'}（{c.drive.leverAngle.toFixed(2)} rad）<br/>實際轉速：{Math.round(c.drive.actualRpm)} RPM</p>
      <label className="range-label" htmlFor="rpm">主軸轉速 <output>{c.rpm} <small>RPM</small></output></label><input id="rpm" type="range" min="0" max="2000" step="10" value={c.rpm} onChange={e => c.setRpm(e.target.value)}/><div className="range-ends"><span>0</span><span>2000 RPM</span></div>
      <div className="divider"/><h3>進給與位置</h3>
      {Object.entries(AXES).map(([key, def]) => <div className="axis-control" key={key}><label className="range-label" htmlFor={key}><span><b className={`axis axis-${key}`}>{key === 'quill' ? 'Q' : key === 'tail' ? 'T' : key.toUpperCase()}</b>{def.label}</span><output>{c.offsets[key] >= 0 ? '+' : ''}{c.offsets[key].toFixed(3)}</output></label><input id={key} type="range" min={c.limits[key][0]} max={c.limits[key][1]} step="any" value={c.offsets[key]} disabled={!c.available[key]} onChange={e => c.move(key, e.target.value)}/><div className="range-ends"><span>{c.limits[key][0].toFixed(3)}</span><span>{c.limits[key][1].toFixed(3)}</span></div><p className="hint">{c.available[key]?def.hint:'缺少對應零件，已停用此功能'}</p></div>)}
      <div className="touch-controls"><p>目前 Hover：{LATHE_PARTS[c.interaction.hover]?.label || '無'}<br/>觸控方向：先點手輪看說明，再按住旋轉。</p><div className="button-row"><button aria-pressed={c.touchDirection===-1} onClick={()=>c.setTouchDirection(-1)}>觸控向左 ↶</button><button aria-pressed={c.touchDirection===1} onClick={()=>c.setTouchDirection(1)}>觸控向右 ↷</button></div></div>
      <button className="workpiece-button" onClick={c.toggleWorkpiece} disabled={c.running || c.rotating || c.drive.leverAngle!==0 || !c.available.spindle}>{c.hasWorkpiece?'卸下示範工件':'裝上示範工件'}</button>
      <button className="reset" onClick={c.reset}>↺ 重設操作與視角</button>
    </fieldset><p className="panel-note">{ready ? '位置為模型局部座標的相對偏移量，非實際毫米。' : '模型就緒後即可操作。'}</p>
  </aside>;
}

