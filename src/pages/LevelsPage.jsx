import { HAMMER_LEVELS, STOCK } from '../levels/hammerPrototype.js';
export default function LevelsPage() {
 return <main className="info-page levels-page">
  <div className="info-header"><a className="back-link" href="#/">← 返回首頁</a><span className="eyebrow green">製作一把槌子</span><h1>加工關卡預覽</h1><p className="subtitle">先了解加工目標，再開始體驗。每關都可以觀看局部加工動畫。</p></div>
  <div className="lesson-summary"><strong>01 握柄 → 02 前端</strong><p>從 Ø{STOCK.radius * 2} × {STOCK.length} mm 圓棒開始，逐關完成槌柄。第二關優先沿用第一關成果；尚未完成時，使用標準握柄工件練習。</p></div>
  <div className="levels-grid">{HAMMER_LEVELS.map((level,index)=><article className="level-card lesson-card" key={level.id}>
   <span className="level-badge">車床 · {String(index+1).padStart(2,'0')}</span><h2>{level.title}</h2><p className="level-desc">{level.description}</p>
   <h3>本關目標</h3><ul className="lesson-objectives"><li>設定進給零點，觀察主軸與刀具移動。</li><li>將 {level.end}–{level.start} mm 區段加工至 Ø{level.radius*2} mm。</li><li>完成 {level.start-level.end} mm 進給，在目標位置停止。</li><li>{index===0?'保留加工後工件，供前端加工使用。':'保留握柄輪廓，完成前端較細的接合區。'}</li></ul>
   <p className="lesson-stock">起始工件：{index===0?'固定尺寸圓棒':'上一關成果／標準握柄工件'}</p>
   <div className="lesson-actions"><a className="level-action" href={'#/experience/'+level.id}>開始體驗 →</a><a href={'#/demo/'+level.id}>觀看示範</a></div>
  </article>)}</div>
  <p className="lesson-roadmap">後續課程：階梯與錐度 → 壓花 → 螺紋 → 槌頭加工 → 組裝。完成後將逐步開放。</p>
 </main>;
}
