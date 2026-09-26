import { ToolRegistry } from '../tools/ToolRegistry.js';

// 工具盒頁面（#/tools）。之後要改內容：
// - 上方的介紹與分類：直接改下面的 TOOLBOX_SECTIONS 與文字
// - 下方的刀具卡片：資料來自 src/tools/tool.config.js（機台加工也會用到，改名稱或尺寸要小心）
const TOOLBOX_SECTIONS = [
  { title: '量具', text: '【佔位】例如游標卡尺、分厘卡、量錶……之後補上用途與使用方式。' },
  { title: '手工具', text: '【佔位】例如夾頭扳手、內六角扳手、毛刷、鐵屑鉤……之後補上用途與注意事項。' },
  { title: '夾持工具', text: '【佔位】例如虎鉗、壓板、頂心……之後補上用途。' },
  { title: '切削刀具', text: '【佔位】例如車刀、立銑刀、面銑刀、鑽頭、絲攻……之後補上用途。' },
];

export default function ToolsPage() {
  const tools = ToolRegistry.getAvailableTools();

  return (
    <main className="info-page tools-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>工具盒</h1>
        <p className="subtitle">TOOLBOX · 加工實習常用工具</p>
      </div>

      <section className="toolbox-placeholder" aria-label="工具盒內容（準備中）">
        <p className="toolbox-note">【佔位】這裡之後會介紹加工實習時通常會用到的工具。內容準備中。</p>
        <div className="toolbox-sections">
          {TOOLBOX_SECTIONS.map(s => <article key={s.title}><h2>{s.title}</h2><p>{s.text}</p></article>)}
        </div>
      </section>

      <h2 className="toolbox-subhead">目前網站使用的刀具與量具</h2>

      <div className="tools-grid">
        {tools.map(tool => (
          <article className="tool-card" key={tool.id}>
            <div className="tool-badge">{tool.type.toUpperCase()}</div>
            <h2>{tool.name}</h2>
            <p className="tool-desc">{tool.description}</p>

            <div className="tool-specs">
              <h3>幾何尺寸與規格</h3>
              <ul>
                {Object.entries(tool.dimensions).map(([key, val]) => (
                  <li key={key}>
                    <span>{key}：</span>
                    <strong>{Array.isArray(val) ? val.join(' ~ ') : val}</strong>
                  </li>
                ))}
              </ul>
            </div>

            <div className="tool-footer">
              <div className="compatible">
                <span>適用機台：</span>
                <strong>{tool.compatibleMachines?.join(', ') || '通用'}</strong>
              </div>
              {tool.operations && (
                <div className="operations">
                  <span>加工工序：</span>
                  <strong>{tool.operations.join(' · ')}</strong>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
