import { useEffect,useState } from 'react';
import { HANDLE_LEVELS,taperRange } from '../levels/handleCampaign.js';
const mm=n=>n==null?'—':Number(n.toFixed(4)).toString();
const labels={draft:'draft／未驗收','not-evaluated':'未評估','within-tolerance':'公差內',overcut:'過切','not-yet-to-size':'未切足','incomplete-range':'區間不足'};
export default function CampaignPanel({campaign,controls}) {
  const [,refresh]=useState(0),[error,setError]=useState(''),[x,setX]=useState(''),[z,setZ]=useState('');
  useEffect(()=>campaign?.subscribe(()=>refresh(n=>n+1)),[campaign]);
  if(!campaign)return <section className="panel">正在載入槌柄流程…</section>;
  const level=campaign.level,s=level.getState(),def=campaign.definition,demo=campaign.demo,r=s.result;
  const run=async fn=>{controls.stopInput(true);try{await fn();setError('');}catch(e){setError(e.message);}};
  const range=def.taper?taperRange(level.exportWorkingCopy(),def.taper):null;
  const step=def.steps[s.currentStep];
  return <section className="panel" aria-label="槌柄 Campaign">
    <h2>Level {campaign.data.currentLevel+1} · {def.title}</h2><p>{def.summary}</p>
    <p>圖面左端朝自由端；實體 Z = 目前總長 − 圖面距左端尺寸。工件 Z 再減去玩家對刀 offset。</p>
    {range&&<p>本工件錐段實體 Z：{range.map(mm).join('–')} mm；請依自己的 Z 歸零換算進給。</p>}
    <p data-testid="level-step">{step?`Step ${s.currentStep+1} ${step.title}`:'操作完成'}</p>
    <p>{s.currentStep===0?'裝上本關 input checkpoint；繼續上次加工會保留已存幾何，Retry 才還原本關開始狀態。':s.currentStep===7&&def.stage!=='basic'?def.summary:step?.hint}</p>
    <p data-testid="campaign-save">本機 checkpoint r{campaign.data.currentLevel} · 操作進度 {campaign.data.completedLevels.length}/4（不代表圖面合格）</p>
    <div className="lathe-buttons">
      <button disabled={!!demo.lease||s.busy} onClick={()=>run(()=>campaign.demoStart())}>觀看示範</button>
      <button disabled={!!demo.lease||s.busy||s.mounted} onClick={()=>run(()=>level.mount())}>開始／繼續操作</button>
      <button disabled={!!demo.lease||s.busy} onClick={()=>run(()=>campaign.retry())}>Retry</button>
      <button disabled={!!demo.lease||!s.mounted} onClick={()=>run(()=>level.inspect())}>檢查加工結果</button>
    </div>
    <p data-testid="demo-status">示範：{demo.status} {demo.lease?`${demo.index}/${demo.commands.length}`:''}（獨立副本）</p>
    {demo.lease&&<fieldset disabled={['loading','restoring'].includes(demo.status)} className="lathe-buttons"><button onClick={()=>demo.status==='paused'?demo.resume():demo.pause()}>{demo.status==='paused'?'繼續示範':'暫停示範'}</button>
      <button onClick={()=>run(async()=>{await demo.stop();await campaign.demoStart();})}>重新播放</button><button onClick={()=>run(()=>demo.stop())}>跳過示範／返回操作</button></fieldset>}
    {def.stage==='finish'&&<p role="status">製程待確認：壓花／螺紋尚未加工，不能判定成功。可保留存檔，待補圖面資料。</p>}
    {['taper','end'].includes(def.stage)&&<fieldset disabled={!s.mounted||!!demo.lease}>
      <legend>X/Z 線性聯動進給（沿實際刀尖連線切削）</legend>
      <label>X 终點／直徑工件座標<input aria-label="聯動 X" type="number" value={x} onChange={e=>setX(e.target.value)}/></label>
      <label>Z 終點／工件座標<input aria-label="聯動 Z" type="number" value={z} onChange={e=>setZ(e.target.value)}/></label>
      <button disabled={x===''||z===''} onClick={()=>run(async()=>{const result=campaign.machine.command({type:'machining.line',xDiameterMm:Number(x),zMm:Number(z)});if(!result.ok)throw new Error(result.reason);})}>X/Z 聯動進給</button>
      <small>先退刀定位，再靠刀；輸入的是刀尖終點，不是自動套用圖面。0.5 mm profile 網格的階梯誤差會保留在量測中。</small>
    </fieldset>}
    {r&&<div data-testid="level-result"><p role="status">{r.complete?'驗收通過':r.status==='fail'?'未完成：已確認項目驗收失敗':'未完成：尺寸驗收待確認（draft）'}；教學操作 {r.operationsComplete?'已記錄':'尚未完成'}</p>
      <div className="level-measurement-scroll"><table aria-label="尺寸驗收結果"><thead><tr><th>目標 (mm)</th><th>實際 (mm)</th><th>誤差 (mm)</th><th>狀態</th></tr></thead><tbody>
        <tr data-testid="diameter-measurement"><th>基礎外徑：無等徑驗收目標</th><td>{mm(r.observedCutDiameter?.minMm)}<small> 已切削區參考；非驗收範圍</small></td><td>—</td><td>草案／未評估</td></tr>
        <tr data-testid="length-measurement"><th scope="row">總長 {r.length.targetMm}（confirmed）</th><td>{mm(r.length.actualMm)}</td><td>{mm(r.length.errorMm)}</td><td>{labels[r.length.status]}</td></tr>
        {r.taper&&<><tr><th>錐長 {def.taper.lengthMm}</th><td>{mm(r.taper.coverageMm)}</td><td>{mm(r.taper.coverageMm-def.taper.lengthMm)}</td><td>{labels[r.taper.status]}</td></tr>
          <tr><th>大端 Ø{def.taper.largeDiameterMm}</th><td>{mm(r.taper.largeDiameterMm)}</td><td>{mm(r.taper.largeDiameterMm-def.taper.largeDiameterMm)}</td><td>{labels[r.taper.status]}</td></tr>
          <tr><th>小端 Ø{def.taper.smallDiameterMm}</th><td>{mm(r.taper.smallDiameterMm)}</td><td>{mm(r.taper.smallDiameterMm-def.taper.smallDiameterMm)}</td><td>{labels[r.taper.status]}</td></tr>
          <tr><th>錐面線性最大偏差</th><td>{mm(r.taper.linearDeviationMm)}</td><td>—</td><td>公差 unknown</td></tr></>}
        {r.chamfer&&<tr><th>1×45° 倒角輪廓</th><td>量測長 {mm(r.chamfer.coverageMm)}</td><td>最大直徑偏差 {mm(r.chamfer.linearDeviationMm)}</td><td>draft／公差未知</td></tr>}
        {r.features?.map(f=><tr key={f.id}><th>{f.type}（圖面 {f.drawingStatus}）</th><td>{f.actual?'有特徵紀錄':'尚未驗收'}</td><td>—</td><td>draft</td></tr>)}
      </tbody></table></div><p data-testid="measurement-overcut">過切：{r.overcut===true?'有':r.overcut===null?'未評估（公差待確認）':'未發現'}</p>
      {r.operationsComplete&&s.completedSteps.includes(8)&&campaign.data.currentLevel<3&&<><p>保留全部實際誤差進入下一關；這只記錄教學操作，未宣告尺寸合格。</p><button onClick={()=>run(()=>campaign.next())}>保存實際工件 → 下一關</button></>}
    </div>}
    {(error||campaign.error||demo.error)&&<p role="alert">{error||campaign.error||demo.error}</p>}
    <details><summary>槌柄流程</summary><ol>{HANDLE_LEVELS.map((d,i)=><li key={d.id}>{i<campaign.data.currentLevel?'操作已記錄 · ':i===campaign.data.currentLevel?'目前 · ':''}{d.title}</li>)}</ol></details>
    <a href="#/lathe">前往自由車床</a>
  </section>;
}
