import {useState} from 'react';
export default function ControlPanel({controls:c,model}){
 const [selected,setSelected]=useState('');const wheels=model?.config.wheels||[],choice=selected||wheels[0]?.id;
 const part=model?.controls[choice],calibrationNeeded=wheels.some(w=>w.needsCalibration);
 const press=(event,direction)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);c.held.current={key:choice,direction};c.turn(choice,direction,.025);};
 const release=()=>c.stopInput();
 return <aside className="panel"><span className="eyebrow">MACHINE CONTROL</span><h2>操作控制台</h2><fieldset disabled={!model}>
  <div className="button-row"><button className="primary" onClick={c.start} disabled={c.running||model?.emergency||!model?.pivots[model?.config.spindle.node]}>▶ 啟動主軸</button><button onClick={c.stop} disabled={!c.running}>■ 停止主軸</button></div>
  <label className="range-label" htmlFor="rpm">設定轉速 <output>{c.rpm} RPM</output></label><input id="rpm" type="range" min="0" max={model?.config.maxRpm||2000} step="10" value={c.rpm} onChange={e=>c.setRpm(e.target.value)}/>
  <p className="tool-lock">實際轉速：{Math.round(model?.rpm||0)} RPM<br/>{model?.rpm>0?'運轉中':c.running?'啟動中／待轉':'已停止'}</p>
  {model?.config.actions?.some(a=>a.type==='index')&&<button onClick={c.index}>刀座右轉 45°（目前 {model.indexSteps*45}°）</button>}
  {model?.config.actions?.some(a=>a.type==='emergency')&&<div className="button-row"><button onClick={c.brake}>腳踏緊急煞車</button><button disabled={!model.emergency} onClick={c.releaseBrake}>解除煞車</button></div>}
  <div className="divider"/><h3>進給與位置</h3>
  {model?.config.axes.map(a=><div className="axis-control" key={a.id}><label className="range-label" htmlFor={a.id}>{a.label}<output>{model.offsets[a.id].toFixed(3)}</output></label><input id={a.id} type="range" min={a.range[0]} max={a.range[1]} step="any" disabled={!a.enabled||!model.lookup[a.node]} value={model.offsets[a.id]} onChange={e=>c.move(a.id,e.target.value)}/><div className="range-ends"><span>{a.range[0]}</span><span>{a.range[1]}</span></div></div>)}
  {calibrationNeeded&&<div className="calibration"><label><input type="checkbox" checked={c.teaching} onChange={e=>c.setTeaching(e.target.checked)}/> 啟用教學進給比例</label><p>原 JSON 未指定比例。銑床以 10 圈走完全行程；鑽床 0° 為原位、−115° 對應 −0.085 m。這些是示範值，非實機導程。</p></div>}
  <div className="touch-controls"><label htmlFor="wheel-choice">選擇手輪／觸控操作</label><select id="wheel-choice" value={choice||''} onChange={e=>{c.stopInput();setSelected(e.target.value);}}>{wheels.map(w=><option key={w.id} value={w.id}>{w.label}</option>)}</select>
   <div className="button-row">{[-1,1].map(direction=><button key={direction} className="hold-button" disabled={!part||(part.needsCalibration&&!c.teaching)} onPointerDown={e=>press(e,direction)} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();c.held.current={key:choice,direction};c.turn(choice,direction,.025);}}} onKeyUp={release} onBlur={release} onContextMenu={e=>e.preventDefault()}>{part?.springReturn?(direction<0?'按住下降（放開回位）':'按住回升'):(direction<0?'↶ 按住負向旋轉':'↷ 按住正向旋轉')}</button>)}</div>
  </div>{model?.config.demoWorkpiece&&<button className="workpiece-button" onClick={c.toggleWorkpiece} disabled={c.running||model.rpm>0||model.leverAngle!==0}>{model.workpiece?'卸下示範工件':'裝上示範工件'}</button>}<button className="reset" onClick={c.reset}>↺ 重設操作與視角</button>
 </fieldset><p className="panel-note">位置依 JSON 模型單位；旋轉軸與 Pivot 不由外觀推測。</p></aside>;
}
