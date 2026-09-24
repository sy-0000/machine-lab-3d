import { useState } from 'react';
import { CampaignStore, CAMPAIGN_KEY } from '../levels/CampaignStore.js';
import { HeadCampaignStore, HEAD_CAMPAIGN_KEY } from '../levels/HeadCampaignStore.js';

const HANDLE = [
  { title: '基礎車削', machine: '車床', note: '對刀、端面、總長 240' },
  { title: '錐度車削', machine: '車床', note: 'Ø16.3 → Ø9.3，長 100' },
  { title: '端部成形', machine: '車床', note: '端段 20、倒角 1×45°' },
  { title: '壓花／螺紋', machine: '車床', note: '規格待確認', draft: true },
];
const HEAD = [
  { title: '基本尺寸', machine: '銑床', note: '20×20×90 → 18.5×18.5×86' },
  { title: '外形斜面', machine: '銑床', note: '倒角 1.5×45°、3×45°' },
  { title: 'Ø8.5 鑽孔', machine: '鑽床', note: '攻牙底孔' },
  { title: 'M10 攻牙', machine: '鑽床', note: '沿用自己的底孔' },
];
// Handle level 4 has no confirmed spec yet, so finishing levels 1–3 opens the head track.
const HEAD_UNLOCK = 3;

function load(Store) { try { return { data: new Store().load() }; } catch (e) { return { error: e.message }; } }

function Track({ name, levels, progress, href, locked, lockText, onReset }) {
  const current = progress?.currentLevel ?? 0, done = progress?.completedLevels.length ?? 0;
  return <section className={'route-track' + (locked ? ' locked' : '')} aria-label={name + '路線'}>
    <div className="route-head"><h2>{name}</h2><span>{locked ? '🔒 ' + lockText : `完成 ${done} / ${levels.length}`}</span></div>
    <ol className="route-nodes">{levels.map((l, i) => {
      const state = locked ? 'locked' : i < done ? 'done' : i === current ? 'current' : 'locked';
      return <li key={l.title} className={'route-node ' + state}>
        <span className="node-dot">{state === 'done' ? '✓' : i + 1}</span>
        <div><strong>{l.title}</strong><small>{l.machine} · {l.note}</small></div>
        {state === 'current' && <a className="level-action" href={href}>{done || progress?.working?.operationHistory?.length ? '繼續' : '開始'} →</a>}
        {l.draft && state !== 'locked' && <em>待確認</em>}
      </li>;
    })}</ol>
    {!locked && done + (progress?.working?.operationHistory?.length ? 1 : 0) > 0 && <button className="route-reset" onClick={onReset}>重新開始{name}</button>}
  </section>;
}

export default function LevelsPage() {
  const [, setVersion] = useState(0);
  const handle = load(CampaignStore), head = load(HeadCampaignStore);
  const handleDone = handle.data?.completedLevels.length ?? 0, headDone = head.data?.completedLevels.length ?? 0;
  const reset = (key, name) => { if (confirm(`確定要清除${name}的進度，從毛胚重新開始嗎？`)) { try { localStorage.removeItem(key); } catch { /* storage blocked */ } setVersion(v => v + 1); } };
  return <main className="info-page levels-page">
    <div className="info-header"><a className="back-link" href="#/">← 返回首頁</a><span className="eyebrow green">製作一把槌子</span><h1>加工關卡</h1>
      <p className="subtitle">先車槌柄，再銑、鑽槌頭，最後把兩個自己做的零件組起來。每一關的工件都接著上一關的實際成果。</p></div>
    <div className="route-map">
      <Track name="槌柄" levels={HANDLE} progress={handle.data} href="#/campaign/handle" onReset={() => reset(CAMPAIGN_KEY, '槌柄')} />
      <Track name="槌頭" levels={HEAD} progress={head.data} href="#/campaign/head" locked={handleDone < HEAD_UNLOCK} lockText="完成槌柄第 1–3 關後開放" onReset={() => reset(HEAD_CAMPAIGN_KEY, '槌頭')} />
      <section className="route-track assembly locked" aria-label="組裝">
        <div className="route-head"><h2>組裝</h2><span>🔒 即將推出</span></div>
        <p>槌柄＋槌頭 → 完整槌子。{handleDone >= HEAD_UNLOCK && headDone >= HEAD.length - 1 ? '兩個零件都已完成，等組裝關卡開放。' : '完成兩條路線後開放。'}</p>
      </section>
    </div>
    {(handle.error || head.error) && <div role="alert" className="notice caution">存檔讀取失敗：{handle.error || head.error}。
      {handle.error && <button onClick={() => reset(CAMPAIGN_KEY, '槌柄')}>清除槌柄存檔</button>}{head.error && <button onClick={() => reset(HEAD_CAMPAIGN_KEY, '槌頭')}>清除槌頭存檔</button>}</div>}
    <div className="level-howto"><h2>每一關怎麼玩</h2><ol><li><b>任務</b>看圖面與目標尺寸</li><li><b>示範</b>看一次正式機台的示範（可跳過）</li><li><b>實作</b>5 分鐘，照清單自己操作</li><li><b>結果</b>對照實際尺寸，進下一關或重來</li></ol></div>
  </main>;
}
