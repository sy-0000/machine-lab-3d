import { useEffect, useMemo, useState } from 'react';
import { CHALLENGES, grade } from '../../levels/challenges.js';
import { Stepper, PracticeTimer, TargetList, Stars, STAR_STEP, STAR_OFFSET } from './LevelParts.jsx';
import { saveBestStars } from '../../levels/progress.js';

const mm = n => n == null ? '—' : Number(n.toFixed(3)).toString();
const PRAISE = ['還沒達到目標尺寸，再試一次！', '完成了，尺寸再準一點會更好。', '不錯！很接近目標尺寸。', '完美！尺寸都在目標內。'];

/** One timed challenge: task → practice → submit → stars. Every start uses fresh stock. */
export default function ChallengeLevel({ challenge, session, controls, operate, chime }) {
  const [phase, setPhase] = useState('brief'), [result, setResult] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { setPhase('brief'); setResult(null); setError(''); }, [challenge.id, session]);
  const s = controls.state, running = !!s && (s.running || s.rpm > 0);
  const index = CHALLENGES.indexOf(challenge), next = CHALLENGES[index + 1];
  const run = async fn => { controls.stopInput(true); try { setError(''); await fn(); } catch (e) { setError(e.message); } };
  const send = async command => { const r = await session.command(command); if (!r.ok) throw new Error(r.reason); };
  const start = () => run(async () => {
    await send({ type: 'machine.reset' });
    if (challenge.tool) await send({ type: 'tool.select', toolId: challenge.tool });
    await send(challenge.machine === 'lathe' ? { type: 'workpiece.createHandle' } : { type: 'workpiece.mountState', state: challenge.createStock() });
    setResult(null); setPhase('practice'); setAttempt(a => a + 1);
  });
  // Live readout of the mounted stock, like measuring it with calipers between passes. Recomputed only when
  // material is removed (cutCount) or fresh stock is mounted.
  const live = useMemo(() => {
    if (phase !== 'practice' || !session || s?.busy || !s?.workpiece?.machinable) return null;
    try { return challenge.live(session.exportWorkpieceState()); } catch { return null; }
  }, [phase, session, s?.busy, s?.workpiece?.machinable, s?.cutCount, attempt, challenge]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = () => run(async () => {
    const graded = grade(challenge, session.exportWorkpieceState());
    setResult({ ...graded, newBest: saveBestStars(challenge.id, graded.stars), key: Date.now() }); setPhase('result');
    chime?.(graded.stars, { step: STAR_STEP, offset: STAR_OFFSET });
  });

  return <>
    <section className="panel level-panel" aria-label="關卡">
      <div className="level-head"><span className="level-tag">第 {index + 1} 關 / {CHALLENGES.length} · {challenge.minutes} 分鐘</span><h2>{challenge.title}</h2></div>
      <Stepper phase={phase} />

      {phase === 'brief' && <div className="level-body">
        <p>{challenge.goal}</p>
        <TargetList items={[['毛胚', challenge.stock], ...challenge.targets]} />
        <ol className="step-hints">{challenge.steps.map(step => <li key={step}>{step}</li>)}</ol>
        <button className="primary" disabled={!session || s?.busy} onClick={start}>開始（{challenge.minutes} 分鐘）</button>
      </div>}

      {phase === 'practice' && <div className="level-body">
        <PracticeTimer seconds={challenge.minutes * 60} running resetKey={`${challenge.id}-${attempt}`} />
        <TargetList items={challenge.targets} />
        {live && <div className="live-measure" aria-label="目前工件尺寸"><h3>目前工件尺寸</h3><TargetList items={live} /></div>}
        <details className="op-details"><summary>操作步驟提示</summary><ol className="step-hints">{challenge.steps.map(step => <li key={step}>{step}</li>)}</ol></details>
        <div className="op-row">
          <button onClick={start} disabled={s?.busy || running}>換新毛胚重來</button>
          <button className="primary" onClick={submit} disabled={s?.busy || running}>繳交</button>
        </div>
        {running && <p className="op-help">停止主軸後才能繳交。</p>}
      </div>}

      {phase === 'result' && result && <div className="level-body result-reveal" data-testid="challenge-result" key={result.key} style={{ '--after': Math.max(1, result.stars) * STAR_STEP + .5 + 's' }}>
        <Stars count={result.stars} animate />
        {result.newBest && result.stars > 0 && <p className="new-best">新紀錄！</p>}
        <p role="status" className={'result-banner ' + (result.stars === 3 ? 'pass' : result.stars ? 'draft' : 'fail')}>{PRAISE[result.stars]}</p>
        <div className="level-measurement-scroll"><table aria-label="尺寸結果"><thead><tr><th>項目</th><th>目標</th><th>實際</th><th>差</th><th>星</th></tr></thead><tbody>
          {result.rows.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.target}</td><td>{mm(r.actual)}</td><td>{r.error == null ? '—' : (r.error > 0 ? '+' : '') + mm(r.error)}</td><td>{'★'.repeat(r.stars) || '—'}</td></tr>)}
        </tbody></table></div>
        <div className="op-row">
          <button onClick={() => setPhase('practice')}>回到實作</button>
          <button onClick={start} disabled={running}>再玩一次</button>
          {next ? <a className="level-action primary-link" href={'#/challenge/' + next.id}>下一關：{next.title.split('：')[0]} →</a>
            : <a className="level-action primary-link" href="#/levels">回到關卡列表</a>}
        </div>
      </div>}

      {error && <p role="alert" className="notice caution">{error}</p>}
    </section>
    <div className="machining-sidebar" hidden={phase !== 'practice'}>{operate}</div>
  </>;
}
