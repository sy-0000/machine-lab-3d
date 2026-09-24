import { useEffect, useState } from 'react';

export const PHASES = [
  { id: 'brief', label: '任務' },
  { id: 'demo', label: '示範' },
  { id: 'practice', label: '實作' },
  { id: 'result', label: '結果' },
];

export function Stepper({ phase }) {
  const index = PHASES.findIndex(p => p.id === phase);
  return <ol className="level-stepper" aria-label="關卡流程">
    {PHASES.map((p, i) => <li key={p.id} className={i < index ? 'done' : i === index ? 'current' : ''} aria-current={i === index ? 'step' : undefined}>
      <span>{i + 1}</span>{p.label}</li>)}
  </ol>;
}

/** Practice countdown (default 5 min). Only a reminder: nothing stops when it reaches zero. */
export function PracticeTimer({ seconds = 300, running, resetKey }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds, resetKey]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(id);
  }, [running, resetKey]);
  const mm = String(Math.floor(left / 60)).padStart(2, '0'), ss = String(left % 60).padStart(2, '0');
  return <div className={'practice-timer' + (left === 0 ? ' over' : left <= 60 ? ' warn' : '')} role="timer" aria-label="實作倒數">
    <strong>{mm}:{ss}</strong><span>{left === 0 ? '時間到！可以繼續或檢查結果' : '實作時間'}</span>
  </div>;
}

export function DemoBar({ demo, total, onReplay, onSkip }) {
  const status = { loading: '準備示範…', playing: '示範中', paused: '已暫停', restoring: '還原工件…', finished: '示範完成', error: '示範錯誤', idle: '待播放' }[demo.status] || demo.status;
  const progress = total ? Math.round(Math.min(demo.index, total) / total * 100) : 0;
  return <div className="demo-bar">
    <div className="demo-progress" aria-hidden="true"><span style={{ width: progress + '%' }} /></div>
    <p>{status}<small>（在工件副本上真實加工，不影響你的工件）</small></p>
    {demo.lease && <fieldset disabled={['loading', 'restoring'].includes(demo.status)} className="op-row">
      <button onClick={() => demo.status === 'paused' ? demo.resume() : demo.pause()}>{demo.status === 'paused' ? '繼續示範' : '暫停示範'}</button>
      <button onClick={onReplay}>重新播放</button>
      <button onClick={onSkip}>跳過示範／返回操作</button>
    </fieldset>}
  </div>;
}

/** Grouped checklist: groups = [{title, steps:[{title, done, current, hint}]}]. */
export function Checklist({ groups }) {
  const current = groups.flatMap(g => g.steps).find(s => s.current);
  return <div className="checklist">
    <ol>{groups.map(g => {
      const done = g.steps.every(s => s.done), active = g.steps.some(s => s.current);
      // Only the group being worked on lists its steps; the others collapse to one line.
      return <li key={g.title} className={done ? 'done' : active ? 'current' : ''}>
        <strong>{done ? '✓ ' : ''}{g.title}<small> {g.steps.filter(s => s.done).length}/{g.steps.length}</small></strong>
        {active && <ul>{g.steps.map(s => <li key={s.title} className={s.done ? 'done' : s.current ? 'current' : ''}>{s.done ? '✓' : s.current ? '▸' : '○'} {s.title}</li>)}</ul>}
      </li>;
    })}</ol>
    {current?.hint && <p className="checklist-hint"><b>提示</b>{current.hint}</p>}
  </div>;
}

/** Always-present demo status for assistive tech (and tests), whichever step is showing. */
export function DemoStatus({ demo, total, testId }) {
  return <p className="sr-only" role="status" data-testid={testId}>示範：{demo.status} {demo.lease ? `${demo.index}/${total}` : ''}</p>;
}

export function TargetList({ items }) {
  return <dl className="target-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
