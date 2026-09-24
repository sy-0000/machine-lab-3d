import { useEffect, useState } from 'react';
import { HANDLE_LEVELS, taperRange } from '../../levels/handleCampaign.js';
import { Stepper, PracticeTimer, DemoBar, DemoStatus, Checklist, TargetList } from './LevelParts.jsx';

const mm = n => n == null ? '—' : Number(n.toFixed(3)).toString();
const labels = { draft: '待老師確認', 'not-evaluated': '未評估', 'within-tolerance': '合格', overcut: '過切', 'not-yet-to-size': '還沒車到', 'incomplete-range': '長度不足' };
// Level 1's ten checks, grouped into the four things a student actually does.
const GROUPS = [['準備', [0, 1]], ['對刀', [2, 3, 4, 5, 6]], ['車削', [7]], ['收尾', [8, 9]]];

export default function HandleLevel({ campaign, controls, operate }) {
  const [, refresh] = useState(0), [error, setError] = useState(''), [phase, setPhase] = useState('brief');
  const [x, setX] = useState(''), [z, setZ] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => campaign?.subscribe(() => refresh(n => n + 1)), [campaign]);
  const s = campaign?.level.getState();
  // Reloading with a mounted working copy resumes practice; a running demo always shows the demo step.
  useEffect(() => { if (s?.mounted && phase === 'brief') setPhase('practice'); }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!campaign) return <section className="panel level-panel">正在載入槌柄流程…</section>;
  const level = campaign.level, def = campaign.definition, demo = campaign.demo, r = s.result;
  const shown = demo.lease ? 'demo' : phase === 'result' && !r ? 'practice' : phase;
  const run = async fn => { controls.stopInput(true); try { await fn(); setError(''); } catch (e) { setError(e.message); } };
  const range = def.taper ? taperRange(level.exportWorkingCopy(), def.taper) : null;
  const step = def.steps[s.currentStep];
  const startPractice = () => run(async () => { if (!level.getState().mounted) await level.mount(); setPhase('practice'); setAttempt(a => a + 1); });
  const retry = () => run(async () => { await campaign.retry(); await level.mount(); setPhase('practice'); setAttempt(a => a + 1); });
  const inspect = () => run(async () => { level.inspect(); setPhase('result'); });
  const next = () => run(async () => { await campaign.next(); setPhase('brief'); });
  const hint = i => i === 7 && def.stage !== 'basic' ? def.summary : def.steps[i].hint;
  const groups = GROUPS.map(([title, ids]) => ({ title, steps: ids.map(i => ({ title: def.steps[i].title, done: s.completedSteps.includes(i), current: i === s.currentStep, hint: hint(i) })) }));
  const targets = [['毛胚', 'Ø20 × 300 mm'], ['總長', '240 mm']];
  if (def.taper) targets.push(['錐段', `長 ${def.taper.lengthMm}，Ø${def.taper.largeDiameterMm} → Ø${def.taper.smallDiameterMm}`]);
  if (def.stage === 'end') targets.push(['倒角', '自由端 1×45°']);
  if (def.stage === 'finish') targets.push(['壓花／螺紋', '規格待確認']);

  return <>
    <section className="panel level-panel" aria-label="槌柄關卡">
      <div className="level-head"><span className="level-tag">槌柄 · Level {campaign.data.currentLevel + 1} / {HANDLE_LEVELS.length}</span><h2>{def.title}</h2></div>
      <Stepper phase={shown} />
      <DemoStatus demo={demo} total={demo.commands?.length || 0} testId="demo-status" />
      <p data-testid="level-step" className="sr-only">{step ? `Step ${s.currentStep + 1} ${step.title}` : '操作完成'}</p>

      {shown === 'brief' && <div className="level-body">
        <p>{def.summary}</p>
        <TargetList items={targets} />
        {def.stage === 'finish' && <p role="status">製程待確認：壓花／螺紋尚未加工，不能判定成功。可保留存檔，待補圖面資料。</p>}
        {range &&<p className="op-help">你的工件錐段位置：Z {range.map(mm).join('–')} mm（依自己的 Z 歸零換算）。</p>}
        <div className="op-row">
          <button onClick={() => run(() => campaign.demoStart())} disabled={s.busy}>觀看示範</button>
          <button className="primary" onClick={startPractice} disabled={s.busy}>{s.mounted ? '繼續實作' : '開始實作'}</button>
        </div>
        {demo.status === 'finished' && <p className="op-help">示範完成。按「開始實作」換你操作。</p>}
      </div>}

      {shown === 'demo' && <div className="level-body">
        <p>觀察刀具怎麼靠近、歸零、再進刀切削。示範使用正式機台與工件副本。</p>
        <DemoBar demo={demo} total={demo.commands?.length || 0}
          onReplay={() => run(async () => { await demo.stop(); await campaign.demoStart(); })} onSkip={() => run(() => demo.stop())} />
      </div>}

      {shown === 'practice' && <div className="level-body">
        <PracticeTimer running={!demo.lease} resetKey={`${campaign.data.currentLevel}-${attempt}`} />
        <Checklist groups={groups} />
        {['taper', 'end'].includes(def.stage) && <fieldset disabled={!s.mounted} className="op-details line-feed">
          <legend>X/Z 聯動進給（錐度、倒角）</legend>
          <div className="op-row"><label>X 終點（直徑）<input aria-label="聯動 X" type="number" value={x} onChange={e => setX(e.target.value)} /></label>
            <label>Z 終點<input aria-label="聯動 Z" type="number" value={z} onChange={e => setZ(e.target.value)} /></label></div>
          <button disabled={x === '' || z === ''} onClick={() => run(async () => { const result = campaign.machine.command({ type: 'machining.line', xDiameterMm: Number(x), zMm: Number(z) }); if (!result.ok) throw new Error(result.reason); })}>X/Z 聯動進給</button>
          <small>刀尖沿直線走到輸入的終點（工件座標）；先退刀定位再靠刀。</small>
        </fieldset>}
        {def.stage === 'finish' && <p role="status">製程待確認：壓花／螺紋尚未加工，不能判定成功。可保留存檔，待補圖面資料。</p>}
        <div className="op-row">
          <button onClick={() => setPhase('brief')}>看任務／示範</button>
          <button className="primary" disabled={!s.mounted} onClick={inspect}>檢查加工結果</button>
        </div>
      </div>}

      {shown === 'result' && r && <div className="level-body" data-testid="level-result">
        <p role="status" className={'result-banner ' + (r.complete ? 'pass' : r.status === 'fail' ? 'fail' : 'draft')}>
          {r.complete ? '驗收通過！' : r.status === 'fail' ? '有尺寸沒有達標，可以回去修正或重來。' : r.operationsComplete ? '操作完成！尺寸公差待老師確認。' : '還沒完成全部操作步驟。'}</p>
        <div className="level-measurement-scroll"><table aria-label="尺寸驗收結果"><thead><tr><th>項目</th><th>目標</th><th>實際</th><th>差</th><th>狀態</th></tr></thead><tbody>
          <tr data-testid="length-measurement"><th scope="row">總長</th><td>{r.length.targetMm}</td><td>{mm(r.length.actualMm)}</td><td>{mm(r.length.errorMm)}</td><td>{labels[r.length.status]}</td></tr>
          <tr data-testid="diameter-measurement"><th scope="row">外徑（練習減料）</th><td>—</td><td>{mm(r.observedCutDiameter?.minMm)}</td><td>—</td><td>不評分</td></tr>
          {r.taper && <><tr><th scope="row">錐長</th><td>{def.taper.lengthMm}</td><td>{mm(r.taper.coverageMm)}</td><td>{mm(r.taper.coverageMm - def.taper.lengthMm)}</td><td>{labels[r.taper.status]}</td></tr>
            <tr><th scope="row">大端 Ø</th><td>{def.taper.largeDiameterMm}</td><td>{mm(r.taper.largeDiameterMm)}</td><td>{mm(r.taper.largeDiameterMm - def.taper.largeDiameterMm)}</td><td>{labels[r.taper.status]}</td></tr>
            <tr><th scope="row">小端 Ø</th><td>{def.taper.smallDiameterMm}</td><td>{mm(r.taper.smallDiameterMm)}</td><td>{mm(r.taper.smallDiameterMm - def.taper.smallDiameterMm)}</td><td>{labels[r.taper.status]}</td></tr></>}
          {r.chamfer && <tr><th scope="row">1×45° 倒角</th><td>1</td><td>{mm(r.chamfer.coverageMm)}</td><td>—</td><td>待老師確認</td></tr>}
          {r.features?.map(f => <tr key={f.id}><th scope="row">{f.type}</th><td>待確認</td><td>{f.actual ? '有紀錄' : '—'}</td><td>—</td><td>待老師確認</td></tr>)}
        </tbody></table></div>
        <p className="op-help" data-testid="measurement-overcut">過切：{r.overcut === true ? '有' : r.overcut === null ? '未評估（公差待確認）' : '未發現'}</p>
        <div className="op-row">
          <button onClick={() => setPhase('practice')}>回到實作</button>
          <button onClick={retry}>重來這一關</button>
          {r.operationsComplete && s.completedSteps.includes(8) && campaign.data.currentLevel < HANDLE_LEVELS.length - 1 &&
            <button className="primary" onClick={next}>保存實際工件 → 下一關</button>}
        </div>
        {r.operationsComplete && campaign.data.currentLevel < HANDLE_LEVELS.length - 1 && <p className="op-help">下一關會接著使用你現在車出來的工件（包含誤差）。</p>}
      </div>}

      <p className="level-foot" data-testid="campaign-save">自動存檔 · 第 {campaign.data.currentLevel + 1} 關 · 已完成 {campaign.data.completedLevels.length}/{HANDLE_LEVELS.length}</p>
      {(error || campaign.error || demo.error) && <p role="alert" className="notice caution">{error || campaign.error || demo.error}</p>}
    </section>
    <div className="machining-sidebar" hidden={shown !== 'practice'}>{operate}</div>
  </>;
}
