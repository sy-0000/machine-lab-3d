import { ToolRegistry } from '../tools/ToolRegistry.js';

export default function ToolsPage() {
  const tools = ToolRegistry.getAvailableTools();

  return (
    <main className="info-page tools-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>標準切削刀具與量具介紹</h1>
        <p className="subtitle">Cutting Tool Catalog & Dimensional Standards</p>
      </div>

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
