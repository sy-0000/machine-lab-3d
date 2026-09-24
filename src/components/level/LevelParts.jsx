import { useEffect, useState } from 'react';

export const PHASES = [
  { id: 'brief', label: '任務' },
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
    <strong>{mm}:{ss}</strong><span>{left === 0 ? '時間到！請停主軸並繳交' : '實作時間'}</span>
  </div>;
}

export function Stars({ count }) {
  return <p className="stars" role="img" aria-label={`${count} 顆星`} data-testid="stars">
    {[1, 2, 3].map(i => <span key={i} className={i <= count ? 'on' : ''}>★</span>)}
  </p>;
}

export function TargetList({ items }) {
  return <dl className="target-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
