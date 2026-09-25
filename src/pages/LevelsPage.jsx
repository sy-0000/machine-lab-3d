import { CHALLENGES } from '../levels/challenges.js';

const MACHINE = { lathe: '車床', milling: '銑床', drill: '鑽床' };

export default function LevelsPage() {
  return <main className="info-page levels-page">
    <div className="info-header"><a className="back-link" href="#/">← 返回首頁</a><span className="eyebrow green">加工挑戰</span><h1>加工關卡</h1>
      <p className="subtitle">三台機台各一關，每關 5–8 分鐘。車到指定尺寸後繳交，依誤差得到 1–3 顆星。</p></div>
    <ol className="challenge-cards">
      {CHALLENGES.map((c, i) => <li key={c.id} className="challenge-card">
        <span className="node-dot">{i + 1}</span>
        <div className="challenge-card-body">
          <small>{MACHINE[c.machine]} · {c.minutes} 分鐘</small>
          <h2>{c.title.split('：')[1]}</h2>
          <p>{c.goal}</p>
          <dl className="target-list">{c.targets.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </div>
        <a className="level-action primary-link" href={'#/challenge/' + c.id}>開始 →</a>
      </li>)}
    </ol>
    <div className="level-howto"><h2>每一關怎麼玩</h2><ol><li><b>任務</b>看目標尺寸與步驟</li><li><b>實作</b>限時內自己操作機台</li><li><b>繳交</b>停主軸後繳交</li><li><b>星數</b>依尺寸誤差給 1–3 顆星</li></ol></div>
  </main>;
}
