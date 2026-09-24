import { useState } from 'react';
import './LatheMachiningPanel.css';
const show=v=>v==null?'—':(Math.abs(v)<0.0005?0:v).toFixed(3);

export default function LatheMachiningPanel({session,controls,model,levelMode=false}) {
  const [x,setX]=useState(''),[z,setZ]=useState('');
  const [axis,setAxis]=useState('X'),[step,setStep]=useState(0.1),[message,setMessage]=useState('');
  const state=session?.getState(),m=state?.machining;
  const stopped=!!state&&!state.running&&state.rpm===0&&state.leverAngle===0;
  const run=async command=>{
    controls.stopInput();
    try {const result=await session.command(command);if(!result.ok)throw new Error(result.reason);
      setMessage(command.type==='workpiece.save'?'工件已儲存（覆蓋本機存檔）':'');
    }catch(error){setMessage(error.message);}
  };
  const move=(a,value,mode='absolute')=>{
    if(String(value).trim()===''||!Number.isFinite(Number(value)))return;
    run({type:'machining.move',axis:a,valueMm:Number(value),mode,...(a==='X'?{representation:'diameter'}:{})});
  };
  const wheel=model?.config.wheels.find(w=>w.drives===(axis==='X'?'y':'x'));
  const hold=d=>controls.hold(wheel.id,d*(axis==='X'?-1:1));
  const release=()=>controls.stopInput();
  return <aside className="panel lathe-machining" aria-label="車床加工面板">
    <h2>車床加工</h2>
    <fieldset disabled={!session?.canCommand()||state?.busy}>
      <section><h3>加工狀態</h3>
        <p>主軸：{state?.rpm>0?'運轉中':state?.running?'啟動中':'已停止'} · <output data-testid="cut-rpm">{state?.rpm||0}</output> RPM</p>
        <p>使用刀具：{state?.activeCuttingTool?.name||state?.activeCuttingTool?.id||'未掛載'}</p>
        <p>刀尖接觸：<output data-testid="cut-contact">{m?.contact?'是':'否'}</output></p>
        {m?.unsafe?<p role="alert" className="notice danger">刀尖進入夾頭危險區，本段禁止切削。請退刀。</p>:<p className="console-help">{m?'請避開夾頭與夾持區。':'先建立毛胚，開始加工。'}</p>}
        {m&&!m.centerAligned&&<p role="alert">刀尖未對準中心高，請在開發者面板停機校正／選用車刀。</p>}
      </section>
      <section><h3>工件座標</h3>
        <div className="lathe-readouts"><div><span>X 工件座標／直徑模式</span><strong><output data-testid="cut-x-diameter">{show(m?.xDiameterMm)}</output> mm</strong></div>
          <div><span>Z 工件座標</span><strong><output data-testid="cut-z">{show(m?.zMm)}</output> mm</strong></div></div>
        <div className="lathe-buttons">{['X','Z'].map(a=><button key={a} disabled={!m} onClick={()=>run({type:'machining.datum',axis:a,valueMm:0,...(a==='X'?{representation:'diameter'}:{})})}>{a} 歸零</button>)}</div>
        <button disabled={!m} onClick={()=>run({type:'machining.clearDatum'})}>清除工件座標</button>
        <p className="console-help">歸零只設定讀值基準，不移動刀具。X 讀值變化 1 mm = 徑向位移 0.5 mm；不是工件直徑。</p>
      </section>
      <section><h3>尺寸量測</h3><p>初始毛胚：Ø20 × 300 mm</p>
        <dl><dt>目前長度</dt><dd><output data-testid="cut-length">{show(m?.lengthMm)}</output> mm</dd>
          <dt>刀尖所在位置直徑</dt><dd>Ø <output data-testid="cut-stock-diameter">{show(m?.diameterAtTipMm)}</output> mm</dd></dl>
      </section>
      <section><h3>加工控制</h3>
        {!levelMode&&<button disabled={!stopped} onClick={()=>run({type:'workpiece.createHandle'})}>建立毛胚 Ø20 × 300 mm</button>}
        <div className="lathe-buttons"><button disabled={state?.running||model?.emergency||!model?.pivots[model?.config.spindle.node]} onClick={()=>run({type:'spindle.start'})}>▶ 啟動主軸</button><button disabled={stopped} onClick={()=>run({type:'spindle.stop'})}>■ 停止主軸</button></div>
        <label>加工模式<select aria-label="加工模式" disabled={!m} value={m?.mode||'turning'} onChange={e=>run({type:'machining.mode',mode:e.target.value})}><option value="turning">外徑車削</option><option value="facing">端面車削</option></select></label>
        <fieldset disabled={!m}><label>操作手輪<select aria-label="操作手輪" value={axis} onChange={e=>{release();setAxis(e.target.value);}}><option value="X">X 徑向手輪</option><option value="Z">Z 縱向手輪</option></select></label>
          <label>微調讀值<select aria-label="微調讀值" value={step} onChange={e=>setStep(Number(e.target.value))}>{[0.1,1,5].map(s=><option key={s} value={s}>{s} mm</option>)}</select></label>
          <div className="lathe-buttons">{[-1,1].map(d=><button key={d} onClick={()=>move(axis,d*step,'relative')}>{axis}{d<0?'−':'＋'} 微調</button>)}</div>
          <div className="lathe-buttons">{[-1,1].map(d=><button key={d} disabled={!wheel} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);hold(d);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release} onKeyDown={e=>{if([' ','Enter'].includes(e.key)&&!e.repeat){e.preventDefault();hold(d);}}} onKeyUp={release} onContextMenu={e=>e.preventDefault()}>按住 {axis}{d<0?'−':'＋'}</button>)}</div>
          <details><summary>移動到工件座標</summary>{[['X',x,setX],['Z',z,setZ]].map(([a,value,set])=><div className="lathe-target" key={a}><label>{a} 工件座標 (mm)<input aria-label={a+' 工件座標目標 (mm)'} type="number" step="0.1" value={value} onChange={e=>set(e.target.value)}/></label><button disabled={value===''} onClick={()=>move(a,value)}>移動 {a}</button></div>)}</details>
        </fieldset>
        <p className="console-help">X+ 退刀，X− 向中心進刀；Z+ 遠離夾頭。數字只移動刀尖，切削須啟動主軸。</p>
        {m&&<p className="console-help">端面：先退刀至外圓外，Z 定在前端 {m.facingMaxDepthMm} mm 內，再向中心進刀至 X 工件座標 {show(-2*m.datumMm.X)}。目前端面 Z 工件座標 {show(m.lengthMm-m.datumMm.Z)}；掃到中心才削短。</p>}
        {!levelMode&&<><div className="lathe-buttons"><button disabled={!m} onClick={()=>run({type:'workpiece.save'})}>儲存槌柄</button><button disabled={!stopped} onClick={()=>run({type:'workpiece.load'})}>載入槌柄</button></div>
        <small>儲存會覆蓋本機工件存檔；新建／載入會清除工件座標基準。</small></>}
      </section>
    </fieldset>
    {message&&<p role="status">{message}</p>}
  </aside>;
}
