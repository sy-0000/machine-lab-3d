import { useEffect, useState } from 'react';
const mm=n=>n===null||n===undefined?'—':Number(n.toFixed(6)).toString();
const span=value=>!value?'—':value.minMm===value.maxMm?mm(value.minMm):`${mm(value.minMm)}–${mm(value.maxMm)}`;
const labels={'draft':'草案／未評估','not-evaluated':'未評估','within-tolerance':'公差內','not-yet-to-size':'未切足（偏大／偏長）','overcut':'過切','incomplete-range':'區間缺料／長度不足'};
export default function LevelPanel({levelSession,controls}) {
  const [,refresh]=useState(0),[error,setError]=useState('');
  useEffect(()=>levelSession?.subscribe(()=>refresh(v=>v+1)),[levelSession]);
  if(!levelSession)return <section className="panel">正在載入關卡…</section>;
  const state=levelSession.getState(),definition=levelSession.definition,step=definition.steps[state.currentStep];
  const run=async operation=>{controls.stopInput(true);try{await operation();setError('');}catch(e){setError(e.message);}};
  const r=state.result;
  const targets=definition.targets;
  return <section className="panel level-progress" aria-label="Level 1 教學流程">
    <h2>Level 1 · 操作流程</h2>
    <p data-testid="level-step">{step?`Step ${state.currentStep+1} ${step.title}`:'完成'}</p>
    <p>{step?.hint||'已完成本版基礎操作驗證。'}</p>
    <p>目標外徑：{targets.diameterMm===null?'待確認':`Ø${targets.diameterMm} mm（半徑 ${targets.diameterMm/2} mm）`}。</p>
    <p>{targets.machiningZRange?`驗收 Z 區間：${targets.machiningZRange.join('–')} mm（工件後端為零，與對刀 offset 無關）。`:'Z 加工區間尚未確認；不使用整支毛胚或單點代替驗收範圍。'}</p>
    {targets.status==='draft'&&<p>部分驗收設定為 draft。總長目標 {targets.finalLengthMm??'待確認'} mm；Ø16.3 是圖面錐段大端，基礎車削範圍及公差待確認，尚不能判定整關驗收通過。</p>}
    <details><summary>完成狀態 {state.completedSteps.length} / {definition.steps.length}</summary><ol>{definition.steps.map((s,i)=><li key={s.id}>{state.completedSteps.includes(i)?'✓':'○'} {s.title}</li>)}</ol></details>
    <div className="lathe-buttons">
      <button disabled={state.busy||state.mounted} onClick={()=>run(()=>levelSession.mount())}>裝夾本關毛胚</button>
      <button disabled={state.busy} onClick={()=>run(()=>levelSession.retry())}>Retry</button>
      <button disabled={state.busy||!state.mounted} onClick={()=>run(()=>levelSession.inspect())}>檢查加工結果</button>
    </div>
    {state.measurements.overcut&&<p role="alert">驗收範圍內直徑或總長低於公差下限；工件不會自動修復。端面剩餘芯可完成行程後再檢查。</p>}
    {r&&<div data-testid="level-result"><p role="status"><strong>{r.complete?'驗收通過':r.status==='draft'?'未完成：尺寸驗收待確認（draft）':'未完成：驗收未通過'}</strong></p>
      <div className="level-measurement-scroll"><table aria-label="尺寸驗收結果"><thead><tr><th>目標 (mm)</th><th>實際 (mm)</th><th>誤差 (mm)</th><th>狀態</th></tr></thead><tbody>
        <tr data-testid="diameter-measurement"><th scope="row">外徑 Ø{mm(r.diameter.targetMm)}<br/>公差 {r.diameter.toleranceMm===null?'TODO':`±${mm(r.diameter.toleranceMm)}`}</th><td>{r.diameter.machiningZRange?span(r.diameter.actual):<>{span(r.observedCutDiameter)}<small> 已切削區參考；非驗收範圍</small></>}</td><td>{span(r.diameter.error)}</td><td>{labels[r.diameter.status]}</td></tr>
        <tr data-testid="length-measurement"><th scope="row">總長 {r.length.targetMm===null?'TODO':mm(r.length.targetMm)}<br/>公差 {r.length.toleranceMm===null?'TODO':`±${mm(r.length.toleranceMm)}`}</th><td>{mm(r.length.actualMm)}</td><td>{mm(r.length.errorMm)}</td><td>{labels[r.length.status]}</td></tr>
      </tbody></table></div>
      <p data-testid="measurement-overcut">過切：{r.overcut===null?'未評估（尺寸／範圍／公差未確認）':r.overcut?'有':'未發現（已評估範圍）'}</p>
      <small>誤差 = 實際 − 目標；直徑以指定區間最小–最大值呈現，不取平均掩蓋未切完或過切。</small>
    </div>}
    {error&&<p role="alert">{error}</p>}
    <a href="#/lathe">前往自由車床</a>
  </section>;
}
