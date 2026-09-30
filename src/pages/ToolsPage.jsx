import { useRef, useState } from 'react';
import SteampunkToolbox from '../components/SteampunkToolbox.jsx';
import { TOOLS as TOOLBOX_TOOLS } from '../vendor/steampunk-toolbox/src/config/tools.config.js';

// 工具盒頁面（#/tools）。之後要改內容：
// - 3D 工具盒與工具介紹卡片：名稱、數量、說明都來自 src/vendor/steampunk-toolbox/src/config/tools.config.js
//   （3D 面板與卡片共用同一份資料）；卡片上的分類標籤在下面的 CATEGORY
const CATEGORY = {
  'vernier-caliper': '量具', 'steel-ruler': '量具', 'try-square': '量具',
  'hex-key': '手工具', files: '手工具', 'center-punch': '手工具', scriber: '手工具',
  'paint-brush': '清潔', 'brass-brush': '清潔',
  'knurling-tool': '車床刀具',
  'jaw-covers': '夾持輔助', shims: '夾持輔助',
  'safety-glasses': '安全防護',
};

export default function ToolsPage() {
  const toolbox = useRef(null);
  const [active, setActive] = useState(-1);

  return (
    <main className="info-page tools-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>工具盒</h1>
        <p className="subtitle">TOOLBOX · 加工實習常用工具</p>
      </div>

      <SteampunkToolbox ref={toolbox} onChange={setActive} />

      <section className="toolbox-cards" aria-label="工具盒裡的工具">
        <h2 className="toolbox-subhead">工具盒裡有什麼</h2>
        <p className="toolbox-lead">加工實習時隨身帶著的量具與手工具。在上方的工具盒點選工具，或按下面的卡片，就能把它拿起來轉著看。</p>
        <div className="tools-grid">
          {TOOLBOX_TOOLS.map((tool, i) => (
            <button type="button" className={`tool-card${active === i ? ' is-active' : ''}`} key={tool.id} onClick={() => toolbox.current?.showTool(i)} aria-pressed={active === i}>
              <div className="tool-badge">{CATEGORY[tool.id] ?? '工具'}</div>
              <h2>{tool.name}<span className="tool-qty">數量 {tool.quantity}</span></h2>
              <p className="tool-desc">{tool.description}</p>
              <span className="tool-look">{active === i ? '● 正在展示' : '在工具盒中查看 ›'}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
