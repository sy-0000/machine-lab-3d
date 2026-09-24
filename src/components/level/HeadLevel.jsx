import { useEffect, useRef, useState } from 'react';
import { HEAD_LEVELS } from '../../levels/headCampaign.js';
import { Stepper, PracticeTimer, DemoBar, DemoStatus, Checklist, TargetList } from './LevelParts.jsx';

const text = v => v == null ? '待確認' : typeof v === 'object' ? JSON.stringify(v) : typeof v === 'number' ? v.toFixed(3) : String(v);
const statusText = { pass: '合格', overcut: '過切', 'under-target': '還沒到尺寸', draft: '待老師確認' };
const TARGETS = {
  'head-basic': [['毛胚', '20 × 20 × 90 mm'], ['目標', '18.5 × 18.5 × 86 mm']],
  'head-profile': [['左端倒角', '1.5 × 45°'], ['右端倒角', '3 × 45°'], ['R1.5', '製程待確認']],
  'head-drill': [['底孔', 'Ø8.5'], ['位置', '距左端 40 mm'], ['孔深', '待確認']],
  'head-tap': [['螺紋', 'M10'], ['底孔', '沿用 Ø8.5'], ['牙深', '待確認']],
};

export default function HeadLevel({ campaign, session, controls, operate, onNext }) {
  const [, refresh] = useState(0), [error, setError] = useState(''), [phase, setPhase] = useState('brief'), [attempt, setAttempt] = useState(0);
  const [position, setPosition] = useState({ xMm: '0', yMm: '10', zMm: '21' });
  const seen = useRef({});
  useEffect(() => campaign?.subscribe(() => refresh(n => n + 1)), [campaign]);
  useEffect(() => { seen.current = {}; if (campaign?.mounted) setPhase('practice'); }, [campaign]);
  if (!campaign) return <section className="panel level-panel">載入槌頭流程…</section>;
  const c = campaign, d = c.definition, s = session.getState(), h = s.headMachining, result = c.data.measurements, locked = !!c.demo.lease;
  const shown = locked ? 'demo' : phase === 'result' && !result ? 'practice' : phase;
  const action = async fn => { try { setError(''); await fn(); controls.refresh(); refresh(n => n + 1); } catch (e) { setError(e.message); } };
  const drill = d.machine === 'drill';

  // Checklist from what actually happened since this attempt was mounted.
  const running = s.running && s.rpm > 0, inputOps = c.data.revisions.at(-1).state.operationHistory.length;
  const f = seen.current;
  if (c.mounted) { f.mounted = true; if (running) f.started = true; if (h?.contact) f.touched = true; }
  const cut = (h?.operations ?? 0) > inputOps, stopped = cut && !s.running && s.rpm === 0;
  const groups = [
    { title: '準備', steps: [{ title: '裝夾工件', done: !!f.mounted, hint: '按「開始實作」把本關工件夾到虎鉗上。' },
      ...(drill ? [{ title: '停機定位 X/Y', done: !!f.started, hint: '停機時在下方輸入孔位，按「停機 X/Y 裝夾定位」。' }] : [])] },
    { title: drill ? '鑽孔' : '銑削', steps: [
      { title: '啟動主軸', done: !!f.started, hint: '按「▶ 啟動主軸」。' },
      { title: '刀具接觸工件', done: !!f.touched || cut, hint: '慢慢靠近，看到接觸光圈亮起就是碰到了。可在這裡歸零。' },
      { title: drill ? (d.operation === 'tapping' ? '向下攻牙' : '向下鑽入') : '進給切削', done: cut, hint: d.hint }] },
    { title: '收尾', steps: [{ title: '停止主軸', done: stopped, hint: '停止主軸並等完全停轉。' },
      { title: '檢查尺寸', done: !!result, hint: '按「檢查尺寸」讀取真實工件尺寸。' }] },
  ];
  let marked = false;
  for (const g of groups) for (const step of g.steps) if (!step.done && !marked) { step.current = marked = true; }
  const start = () => action(async () => { await c.start(); seen.current = {}; setPhase('practice'); setAttempt(a => a + 1); });
  const target = () => { if (Object.values(position).some(v => v.trim() === '' || !Number.isFinite(Number(v)))) throw new Error('請輸入有效的 mm 座標'); return Object.fromEntries(Object.entries(position).map(([k, v]) => [k, Number(v)])); };

  return <>
    <section className="panel level-panel head-campaign" aria-label="槌頭關卡">
      <div className="level-head"><span className="level-tag">槌頭 · Level {c.data.currentLevel + 1} / {HEAD_LEVELS.length} · {drill ? '鑽床' : '銑床'}</span><h2>{d.title}</h2></div>
      <Stepper phase={shown} />
      <DemoStatus demo={c.demo} total={c.demo.commands?.length || 0} testId="head-demo" />
      <p data-testid="head-step" className="sr-only">{!c.mounted ? '裝夾本關 checkpoint' : result ? '檢查結果' : s.running ? '實際加工中' : '對刀／啟動主軸／停機檢查'}</p>

      {shown === 'brief' && <div className="level-body">
        <p>{d.hint}</p>
        <TargetList items={TARGETS[d.id] || []} />
        <div className="op-row">
          <button disabled={s.busy} onClick={() => action(() => c.demoStart())}>觀看示範</button>
          <button className="primary" disabled={s.busy} onClick={start}>{c.mounted ? '繼續實作' : '開始實作'}</button>
        </div>
        {c.demo.status === 'finished' && <p className="op-help">示範完成。按「開始實作」換你操作。</p>}
      </div>}

      {shown === 'demo' && <div className="level-body">
        <p>{drill ? '觀察鑽頭如何對準孔位、開主軸、再向下進給。' : '觀察刀具如何靠近工件、開主軸、再進給切削。'}</p>
        <DemoBar demo={c.demo} total={c.demo.commands?.length || 0}
          onReplay={() => action(async () => { await c.demo.stop(); await c.demoStart(); })} onSkip={() => action(() => c.demo.stop())} />
      </div>}

      {shown === 'practice' && <div className="level-body">
        <PracticeTimer running={!locked} resetKey={`${c.data.currentLevel}-${attempt}`} />
        <Checklist groups={groups} />
        <p className="op-help" data-testid="head-bounds">目前工件：長 {text(h?.bounds.lengthMm)} × 寬 {text(h?.bounds.widthMm)} × 高 {text(h?.bounds.heightMm)} mm</p>
        <details className="op-details">
          <summary>{drill ? '孔位定位與 Z 進給' : '輸入座標移動'}</summary>
          <p className="op-help" data-testid="head-tip">刀尖（工件座標）X {text(h?.tipMm?.xMm)} / Y {text(h?.tipMm?.yMm)} / Z {text(h?.tipMm?.zMm)} mm</p>
          <p className="op-help">X 圖面左端→右端；Y 前側→後側；Z 底面向上。</p>
          <fieldset disabled={locked || s.busy || !c.mounted} className="op-target-grid">
            {Object.entries(position).map(([key, value]) => <label key={key}>{key[0].toUpperCase()} 刀尖目標<input aria-label={'槌頭 ' + key[0].toUpperCase() + ' 目標'} type="number" step="0.5" value={value} onChange={e => setPosition({ ...position, [key]: e.target.value })} /></label>)}
            {drill ? <>
              <button disabled={s.running || s.rpm > 0} onClick={() => action(() => { const { xMm, yMm } = target(); return c.send({ type: 'head.setup', xMm, yMm }); })}>停機 X/Y 裝夾定位</button>
              <button onClick={() => action(() => c.send({ type: 'head.move', zMm: target().zMm }))}>鑽床 Z 進給</button>
            </> : <button onClick={() => action(() => c.send({ type: 'head.move', ...target() }))}>X/Y/Z 聯動進給</button>}
          </fieldset>
        </details>
        <p className="sr-only" data-testid="head-spindle">主軸：{s.running && s.rpm > 0 ? '運轉中' : '已停止'} · {s.activeCuttingTool?.name ?? '未裝刀'}</p>
        <p className="sr-only" data-testid="head-operations">實際加工紀錄：{h?.operations ?? 0}</p>
        <div className="op-row">
          <button onClick={() => setPhase('brief')}>看任務／示範</button>
          <button className="primary" disabled={!c.mounted || s.running || s.rpm > 0} onClick={() => action(() => { c.inspect(); setPhase('result'); })}>檢查尺寸</button>
        </div>
      </div>}

      {shown === 'result' && result && <div className="level-body">
        <p data-testid="head-result" role="status" className={'result-banner ' + (result.status === 'pass' ? 'pass' : result.status === 'fail' ? 'fail' : 'draft')}>
          {result.operationsComplete ? (result.status === 'pass' ? '尺寸合格！' : '操作完成！尺寸公差待老師確認。') : '還沒有實際加工紀錄。'}<small> ({result.status})</small></p>
        <div className="level-measurement-scroll"><table aria-label="尺寸驗收結果"><thead><tr><th>項目</th><th>目標</th><th>實際</th><th>差</th><th>狀態</th></tr></thead><tbody>
          {result.rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{text(r.target)}</td><td>{text(r.actual)}</td><td>{r.error == null ? '—' : text(r.error)}</td><td>{statusText[r.status] || r.status}{r.note && <small> {r.note}</small>}</td></tr>)}
        </tbody></table></div>
        <div className="op-row">
          <button onClick={() => setPhase('practice')}>回到實作</button>
          <button disabled={locked || s.busy} onClick={() => action(async () => { await c.retry(); seen.current = {}; setPhase('practice'); setAttempt(a => a + 1); })}>重來這一關</button>
          {c.data.currentLevel < HEAD_LEVELS.length - 1 && <button className="primary" disabled={locked || !result.operationsComplete || s.running || s.rpm > 0}
            onClick={() => action(async () => { c.next(); setPhase('brief'); await onNext(); })}>保存槌頭實際工件 → 下一關</button>}
        </div>
        {c.data.currentLevel >= HEAD_LEVELS.length - 1 && <p className="op-help">槌頭工件已保存。組裝關卡即將開放。</p>}
      </div>}

      <p className="level-foot" data-testid="head-checkpoint">自動存檔 · 槌頭第 {c.data.currentLevel + 1} 關 · r{c.data.currentLevel} · {c.data.specVersion}</p>
      {(error || c.error) && <p role="alert" className="notice caution">{error || c.error}</p>}
    </section>
    <div className="machining-sidebar" hidden={shown !== 'practice'}>{operate}</div>
  </>;
}
