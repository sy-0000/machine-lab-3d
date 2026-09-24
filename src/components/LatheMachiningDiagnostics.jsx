const show=v=>v==null?'—':v.toFixed(3);
export default function LatheMachiningDiagnostics({session,run}) {
  const state=session?.getState(),m=state?.machining;
  if(!m)return <p>裝上可切削毛胚後顯示刀尖診斷。</p>;
  return <fieldset aria-label="車床加工除錯">
    <legend>刀尖與機械座標（mm）</legend>
    <p>X machine／直徑：{show(m.xRadialMm==null?null:m.xRadialMm*2)}；X 徑向：<output data-testid="cut-x-radius">{show(m.xRadialMm)}</output></p>
    <p>Z machine：{show(m.physicalZMm)}；中心高誤差：<output data-testid="cut-height">{show(m.heightErrorMm)}</output></p>
    <p>Work offset：X 徑向 {show(m.datumMm.X)}／Z {show(m.datumMm.Z)}</p>
    <p>夾持區 Z：{m.clamping.startZMm}–{m.clamping.endZMm}；最近事件：{m.events.at(-1)?.code||'無'}</p>
    <button disabled={!session.canCommand()||state.busy||state.running||state.rpm>0||state.leverAngle!==0} onClick={()=>run({type:'machining.alignCenter'})}>停機校正中心高</button>
  </fieldset>;
}
