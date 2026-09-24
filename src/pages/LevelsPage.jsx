import { HAMMER_LEVELS, STOCK } from '../levels/hammerPrototype.js';
import { LEVEL_1 } from '../levels/level1.js';
import { HANDLE_LEVELS } from '../levels/handleCampaign.js';
import { CampaignStore } from '../levels/CampaignStore.js';
import {HeadCampaignStore} from '../levels/HeadCampaignStore.js';
import {HEAD_LEVELS} from '../levels/headCampaign.js';
export default function LevelsPage() {
 let progress,error='';try{progress=new CampaignStore().load();}catch(e){error=e.message;}
 let headProgress,headError='';try{headProgress=new HeadCampaignStore().load();}catch(e){headError=e.message;}
 return <main className="info-page levels-page">
  <div className="info-header"><a className="back-link" href="#/">← 返回首頁</a><span className="eyebrow green">製作一把槌子</span><h1>加工關卡</h1><p className="subtitle">正式 Level 1 使用完整車床與真實加工工件。</p></div>
  <article className="level-card" aria-label="正式 Level 1"><span className="level-badge">正式 Level 1 · 車床</span><h2>{LEVEL_1.title}</h2><p>從 Ø{LEVEL_1.initialWorkpiece.stock.radiusMm*2} × {LEVEL_1.initialWorkpiece.stock.lengthMm} mm 毛胚開始，練習裝夾、X/Z 對刀、端面與基礎外徑減料。</p><p>圖面總長：{LEVEL_1.targets.finalLengthMm??'待確認'} mm；正式公差待確認，尚不能宣稱圖面驗收合格。</p><a className="level-action" href={'#/level/'+LEVEL_1.id}>開始 Level 1 →</a></article>
  <section className="panel" aria-label="槌柄 Campaign 進度"><h2>槌柄製作流程</h2>
    <ol>{HANDLE_LEVELS.map((d,i)=><li key={d.id}>{d.title} — {i<(progress?.currentLevel??0)?'操作已記錄／尺寸尚未全部驗收':i===(progress?.currentLevel??0)?'目前關卡':'尚未進入'}</li>)}</ol>
    <p>Level 1 不要求整段 Ø16.3；Ø16.3／Ø9.3 用於 Level 2 錐段。未知公差與後續製程不算通過。</p>
    <a href="#/campaign/handle">開始／繼續槌柄 Campaign →</a>{error&&<p role="alert">{error}；未覆寫存檔。</p>}
  </section>
  <section className="panel" aria-label="槌頭 Campaign 進度"><h2>槌頭製作流程</h2>
    <ol>{HEAD_LEVELS.map((d,i)=><li key={d.id}>{d.title} — {i<(headProgress?.currentLevel??0)?'操作已記錄／圖面待完整驗收':i===(headProgress?.currentLevel??0)?'目前關卡':'尚未進入'}</li>)}</ol>
    <p>毛胚 20×20×90 → 基本尺寸 18.5×18.5×86；銑床 → 鑽床 → M10。工件與槌柄分開保存。</p>
    <a href="#/campaign/head">開始／繼續槌頭 Campaign →</a>{headError&&<p role="alert">{headError}；未覆寫存檔。</p>}
  </section>
  <h2>舊版局部加工原型</h2><p>以下為既有流程展示，尺寸不是正式 Level 1 圖面。</p>
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
