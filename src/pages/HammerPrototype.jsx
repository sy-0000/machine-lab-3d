import { useEffect, useRef, useState } from 'react';
import HammerPrototypeScene from '../components/HammerPrototypeScene.jsx';
import { STOCK, HAMMER_LEVELS, SAVE_KEY, createAttempt, advanceAttempt, validateSave, blankProfile, cutProfile } from '../levels/hammerPrototype.js';
import '../styles/hammer-prototype.css';

function Profile({ attempt }) {
  const points = attempt.profile.map((r, i) => [20 + i * STOCK.spacing * 3, 55 - r * 2]);
  const lower = attempt.profile.map((r, i) => [20 + i * STOCK.spacing * 3, 55 + r * 2]).reverse();
  return <svg className="prototype-profile" viewBox="0 0 460 115" role="img" aria-label="工件剩餘半徑輪廓">
    <path d={'M' + [...points, ...lower].map(p => p.join(',')).join(' L') + ' Z'} fill="#9db8c7" stroke="#d4e5ee" />
    <line x1="20" x2="440" y1="55" y2="55" stroke="#425b69" strokeDasharray="4 4" />
    {attempt.marks.map(m => <line key={m.position} x1={20 + m.position * 3} x2={20 + m.position * 3} y1="31" y2="79" stroke="#b27835" opacity={0.4 + m.severity * 0.6} />)}
    <path d={'M' + (20 + attempt.position * 3) + ',10 l-5,-8 h10 Z'} fill="#e9bd66" />
    <text x="20" y="105" fill="#a9bdc6" fontSize="11">夾持端 0 mm</text><text x="357" y="105" fill="#a9bdc6" fontSize="11">前端 140 mm</text>
  </svg>;
}
const phaseText = { ready: '等待歸零', running: '加工中', paused: '已暫停', stopping: '到點減速停機', complete: '加工完成' };
function entryAttempt(index) {
  let profile = blankProfile(), marks = [];
  for (let i = 0; i < index; i++) {
    const previous = HAMMER_LEVELS[i];
    profile = cutProfile(profile, previous.start, previous.end, previous.radius, previous);
  }
  if (index > 0) try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (validateSave(data) && data.completedLevel === index - 1) { profile = data.profile; marks = data.marks; }
  } catch { /* Standard workpiece remains available when storage is unavailable. */ }
  return createAttempt(index, profile, marks);
}
export default function HammerPrototype({ initialLevelIndex = 0, initialDemo = false }) {
  const [entry] = useState(() => entryAttempt(initialLevelIndex));
  const [attempt, setAttempt] = useState(() => initialDemo ? {...entry, phase: 'running', zero: HAMMER_LEVELS[initialLevelIndex].start, demo: true} : entry);
  const [saved, setSaved] = useState(null);
  const [notice, setNotice] = useState(initialDemo ? '正在播放本關示範；返回練習即可親自操作。' : initialLevelIndex > 0 ? '已載入前端加工工件：優先沿用上一關成果，沒有存檔時使用標準握柄。' : '先觀看示範，或歸零後開始引導練習。');
  const baseline = useRef(entry);
  const practice = useRef(entry);
  const level = HAMMER_LEVELS[attempt.levelIndex];
  const active = ['running', 'stopping'].includes(attempt.phase);
  useEffect(() => {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (validateSave(data)) setSaved(data);
    } catch { setNotice('無法讀取先前成果，仍可從第一關開始。'); }
  }, []);
  useEffect(() => {
    if (!active) return;
    let frame, last = performance.now();
    function tick(now) {
      const dt = (now - last) / 1000; last = now;
      setAttempt(s => advanceAttempt(s, dt));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    const pause = () => {
      if (document.hidden) {
        setAttempt(s => ({...s, phase: 'paused', rpm: 0}));
        setNotice('分頁已離開，練習自動暫停。回來後按繼續。');
      }
    };
    document.addEventListener('visibilitychange', pause);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', pause); };
  }, [active]);
  useEffect(() => {
    if (attempt.phase !== 'complete') return;
    if (attempt.demo) { setNotice('示範完成。按「返回練習」恢復你的工件與操作狀態。'); return; }
    const data = {version: 1, completedLevel: attempt.levelIndex, profile: attempt.profile, marks: attempt.marks};
    setSaved(data);
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      setNotice('尺寸加工完成，成果已儲存在此瀏覽器。' + (attempt.marks.length ? '表面有停留刀痕，可重試比較。' : '可進入下一關或重試。'));
    } catch { setNotice('尺寸加工完成；瀏覽器無法儲存，仍可在本頁接續下一關。'); }
  }, [attempt.phase, attempt.demo, attempt.levelIndex, attempt.profile, attempt.marks]);
  function demo() {
    practice.current = {...attempt, profile: [...attempt.profile], marks: attempt.marks.map(m => ({...m}))};
    setAttempt({...createAttempt(attempt.levelIndex, baseline.current.profile, baseline.current.marks), phase: 'running', zero: level.start, demo: true});
    setNotice('示範：自動設定零點、啟動主軸並進給，到終點自動停止。');
  }
  function restorePractice() {
    setAttempt(practice.current || createAttempt());
    setNotice('已回到練習，示範沒有改動你的工件。');
  }
  function retry() {
    setAttempt(createAttempt(baseline.current.levelIndex, baseline.current.profile, baseline.current.marks));
    setNotice('已還原本關起始工件，請重新歸零。');
  }
  function next(data) {
    const index = data.completedLevel + 1;
    if (index >= HAMMER_LEVELS.length) return;
    const fresh = createAttempt(index, data.profile, data.marks);
    baseline.current = fresh; setAttempt(fresh);
    setNotice('已繼承上一關的半徑輪廓與刀痕，請設定本關零點。');
  }
  const travelled = attempt.zero === null ? null : attempt.zero - attempt.position;
  return <main className="hammer-prototype">
    <a className="back-link" href="#/levels">← 返回關卡選擇</a>
    <div className="prototype-heading"><div><span className="eyebrow green">HAMMER / 加工體驗</span><h1>{level.title}</h1><p>{level.description}</p></div><a href="#/lathe">完整機台自由操作 →</a></div>
    <p className="prototype-note">加工局部試作 · 尺寸為測試值 · 引導模式到點自停；尚未與完整車床刀尖座標連接。</p>
    <div className="prototype-layout">
      <section className="prototype-view"><HammerPrototypeScene attempt={attempt} /><Profile attempt={attempt} />
        <p>毛胚 Ø{STOCK.radius * 2} × {STOCK.length} mm。輪廓只會減小；褐色環紋是停留造成的表面效果。</p>
      </section>
      <aside className="prototype-panel">
        <span className="eyebrow">{attempt.demo ? '示範播放' : '引導練習'}</span><h2>{phaseText[attempt.phase]}</h2>
        <ol><li>觀看示範，了解進給方向。</li><li>歸零後啟動主軸與進給。</li><li>到點停機，保存工件供下一關使用。</li></ol>
        <dl className="prototype-dro">
          <div><dt>刀具位置</dt><dd data-testid="tool-position">{attempt.position.toFixed(2)} mm</dd></div>
          <div><dt>相對進給量</dt><dd data-testid="travel">{travelled === null ? '尚未歸零' : travelled.toFixed(2) + ' mm'}</dd></div>
          <div><dt>剩餘距離</dt><dd>{Math.max(0, attempt.position - level.end).toFixed(2)} mm</dd></div>
          <div><dt>進給速度</dt><dd>{attempt.phase === 'running' && attempt.feedEnabled && attempt.rpm >= 500 ? attempt.demo ? 600 : level.feed : 0} mm/min</dd></div>
          <div><dt>目標直徑</dt><dd>Ø{level.radius * 2} mm</dd></div>
          <div><dt>主軸轉速</dt><dd>{Math.round(attempt.rpm)} RPM</dd></div>
        </dl>
        <div className="prototype-buttons">
          {!attempt.demo && <button onClick={demo} disabled={active || attempt.phase === 'paused'}>觀看本關示範</button>}
          {attempt.demo ? <button onClick={restorePractice}>返回練習</button> : <>
            <button disabled={attempt.phase !== 'ready'} onClick={() => {setAttempt(s => ({...s, zero: s.position})); setNotice('已將目前刀具位置設為零點，刀具沒有移動。');}}>座標歸零</button>
            <button className="primary" disabled={attempt.phase !== 'ready' || attempt.zero === null} onClick={() => {setAttempt(s => ({...s, phase: 'running'})); setNotice('正在進給。可按「停止進給」觀察同一位置的停留刀痕。');}}>啟動主軸與進給</button>
          </>}
          <button disabled={!['running', 'paused'].includes(attempt.phase)} onClick={() => setAttempt(s => ({...s, phase: s.phase === 'paused' ? 'running' : 'paused', rpm: 0}))}>{attempt.phase === 'paused' ? '繼續加工' : '暫停全部'}</button>
          <button disabled={attempt.phase !== 'running' || attempt.demo} onClick={() => setAttempt(s => ({...s, feedEnabled: !s.feedEnabled, dwell: 0}))}>{attempt.feedEnabled ? '停止進給（主軸續轉）' : '恢復進給'}</button>
          {!attempt.demo && <button onClick={retry}>重試本關</button>}
        </div>
        <p className="prototype-message" role="status">{notice}</p>
        <p data-testid="marks-count">停留刀痕：{attempt.marks.length} 處</p>
        <p className="prototype-note">停止進給並保持主軸旋轉約 1.5 秒後出現刀痕；只是有上限的表面效果，不會無限切深。</p>
        {attempt.phase === 'complete' && !attempt.demo && attempt.levelIndex === 0 && <button className="primary" onClick={() => next({completedLevel: 0, profile: attempt.profile, marks: attempt.marks})}>沿用工件進入第二關</button>}
        {attempt.phase === 'complete' && !attempt.demo && attempt.levelIndex === 1 && <p>兩關測試完成。已保存握柄與前端輪廓；後續可擴充階梯、壓花與螺紋。</p>}
        {saved?.completedLevel === 0 && attempt.phase === 'ready' && attempt.levelIndex === 0 && !attempt.demo && <button onClick={() => next(saved)}>讀取已儲存工件，接續第二關</button>}
        {attempt.levelIndex === 1 && !attempt.demo && <button onClick={() => { const fresh = createAttempt(); baseline.current = fresh; setAttempt(fresh); setNotice('開始新的第一關練習。'); }}>回第一關重新製作</button>}
      </aside>
    </div>
  </main>;
}
