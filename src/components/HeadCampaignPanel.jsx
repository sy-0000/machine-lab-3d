import {useEffect,useState} from 'react';
const text=v=>v==null?'待確認':typeof v==='object'?JSON.stringify(v):typeof v==='number'?v.toFixed(3):String(v);
export default function HeadCampaignPanel({campaign,session,controls,onNext}){
  const [,refresh]=useState(0),[error,setError]=useState(''),[position,setPosition]=useState({xMm:'0',yMm:'10',zMm:'21'});
  useEffect(()=>campaign?.subscribe(()=>refresh(n=>n+1)),[campaign]);
  if(!campaign)return <section className="panel">載入槌頭流程…</section>;
  const c=campaign,d=c.definition,s=session.getState(),p=s.headMachining?.tipMm,result=c.data.measurements,locked=!!c.demo.lease;
  const action=async fn=>{try{setError('');await fn();controls.refresh();refresh(n=>n+1);}catch(e){setError(e.message);}};
  const command=cmd=>action(()=>c.send(cmd));
  const target=()=>{if(Object.values(position).some(v=>v.trim()===''||!Number.isFinite(Number(v))))throw new Error('請輸入有效的 mm 座標');return Object.fromEntries(Object.entries(position).map(([k,v])=>[k,Number(v)]));};
  return <section className="panel head-campaign" aria-label="槌頭加工控制">
    <h2>{d.title}</h2><p>{d.hint}</p>
    <p data-testid="head-step">目前步驟：{!c.mounted?'裝夾本關 checkpoint':result?'檢查結果':s.running?'實際加工中':'對刀／啟動主軸／停機檢查'}</p>
    <p data-testid="head-checkpoint">獨立槌頭存檔 · r{c.data.currentLevel} · {c.data.specVersion}</p>
    <p>毛胚 20×20×90；基本尺寸 18.5×18.5×86 mm。公差、孔 Y、孔深／通孔、牙深待確認；完成操作不等於圖面驗收。</p>
    <div className="lesson-actions">
      <button disabled={locked||s.busy} onClick={()=>action(()=>c.start())}>開始／繼續槌頭操作</button>
      <button disabled={locked||s.busy} onClick={()=>action(()=>c.demoStart())}>觀看槌頭示範</button>
      <button disabled={locked||s.busy} onClick={()=>action(()=>c.retry())}>Retry 槌頭本關</button>
    </div>
    <p data-testid="head-demo">Demo：{c.demo.status} {c.demo.error}</p>
    {locked&&<div className="lesson-actions">
      <button onClick={()=>action(()=>c.demo.status==='paused'?c.demo.resume():c.demo.pause())}>{c.demo.status==='paused'?'繼續示範':'暫停示範'}</button>
      <button onClick={()=>action(async()=>{await c.demo.stop();await c.demoStart();})}>重新播放</button>
      <button onClick={()=>action(()=>c.demo.stop())}>跳過示範／返回操作</button>
    </div>}
    <h3>加工狀態</h3><p data-testid="head-spindle">主軸：{s.running&&s.rpm>0?'運轉中':'已停止'} · {s.activeCuttingTool?.name??'未裝刀'}</p>
    <p data-testid="head-tip">刀尖 X {text(p?.xMm)} / Y {text(p?.yMm)} / Z {text(p?.zMm)} mm</p>
    <p>X 圖面左端→右端；Y 毛胚前側→後側；Z 毛胚底面向上。座標不是尺寸輸入。</p>
    <p data-testid="head-bounds">實際包絡：長 {text(s.headMachining?.bounds.lengthMm)} × 寬 {text(s.headMachining?.bounds.widthMm)} × 高 {text(s.headMachining?.bounds.heightMm)} mm</p>
    <p data-testid="head-operations">實際加工紀錄：{s.headMachining?.operations??0}</p>
    <fieldset disabled={locked||s.busy||!c.mounted}><legend>加工控制</legend>
      <div className="lesson-actions"><button onClick={()=>command({type:'spindle.start'})}>啟動槌頭主軸</button><button onClick={()=>command({type:'spindle.stop'})}>停止槌頭主軸</button></div>
      {Object.entries(position).map(([key,value])=><label key={key} style={{display:'block'}}>{key[0].toUpperCase()} 刀尖目標 (mm) <input style={{maxWidth:'8rem'}} aria-label={'槌頭 '+key[0].toUpperCase()+' 目標'} type="number" step="0.5" value={value} onChange={e=>setPosition({...position,[key]:e.target.value})}/></label>)}
      {d.machine==='milling'?<button onClick={()=>action(()=>c.send({type:'head.move',...target()}))}>X/Y/Z 聯動進給</button>:<>
        <button disabled={s.running||s.rpm>0} onClick={()=>action(()=>{const {xMm,yMm}=target();return c.send({type:'head.setup',xMm,yMm});})}>停機 X/Y 裝夾定位</button>
        <button onClick={()=>action(()=>c.send({type:'head.move',zMm:target().zMm}))}>鑽床 Z 進給</button>
      </>}
      <p>也可操作下方手輪。Demo 的 0.5 mm 試銑／2 mm 試鑽是練習路徑，不是圖面要求。</p>
      <button disabled={s.running||s.rpm>0} onClick={()=>action(()=>c.inspect())}>檢查槌頭尺寸</button>
    </fieldset>
    {result&&<><p data-testid="head-result">尺寸驗收：{result.status} · 本關實切：{result.operationsComplete?'已記錄':'尚未完成'}</p>
      <div style={{overflowX:'auto'}}><table><thead><tr><th>項目</th><th>目標</th><th>實際</th><th>誤差</th><th>規格／驗收</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.label}><td>{r.label}</td><td>{text(r.target)}</td><td>{text(r.actual)}</td><td>{text(r.error)}</td><td>{r.confirmation} / {r.status}{r.note&&<small> {r.note}</small>}</td></tr>)}</tbody></table></div>
      {c.data.currentLevel<3?<button disabled={locked||!result.operationsComplete||s.running||s.rpm>0} onClick={()=>action(async()=>{c.next();await onNext();})}>保存槌頭實際工件 → 下一關</button>:<p>實際工件已保存；尚缺圖面資料，不宣稱可組裝合格。</p>}
    </>}
    {(error||c.error)&&<p role="alert">{error||c.error}</p>}
  </section>;
}
