export const SAMPLE_LEVELS = [
  {
    id: 'lathe_01',
    title: '第一關：外圓粗車與端面切削',
    machine: 'lathe',
    machineName: '普通車床 16K20',
    workpiece: {
      type: 'cylinder',
      diameter: 30,
      length: 100,
      material: 'aluminum',
    },
    allowedTools: ['turning_tool', 'caliper'],
    objective: {
      operation: 'external_turning',
      targetDiameter: 25,
      targetLength: 40,
      tolerance: '±0.05 mm',
    },
    description: '使用外徑精車刀對 Ø30 鋁棒進行端面削平與階梯外圓車削至 Ø25mm。',
  },
  {
    id: 'milling_01',
    title: '第二關：平面端銑與溝槽銑削',
    machine: 'milling',
    machineName: '立式銑床',
    workpiece: {
      type: 'block',
      width: 100,
      height: 40,
      length: 60,
      material: 'aluminum',
    },
    allowedTools: ['end_mill', 'face_mill', 'caliper'],
    objective: {
      operation: 'slotting',
      slotWidth: 16,
      slotDepth: 5,
      tolerance: '±0.1 mm',
    },
    description: '使用四刃立銑刀在方塊工件頂面精確銑削一條 16mm 寬度對稱溝槽。',
  },
  {
    id: 'drill_01',
    title: '第三關：定位鑽孔與深孔加工',
    machine: 'drill',
    machineName: '桌上鑽床 TB 145',
    workpiece: {
      type: 'block',
      width: 100,
      height: 40,
      length: 60,
      material: 'aluminum',
    },
    allowedTools: ['drill_bit', 'caliper'],
    objective: {
      operation: 'drilling',
      holeDiameter: 12,
      holeDepth: 25,
      tolerance: '±0.1 mm',
    },
    description: '操作鑽床進給手柄，控制套筒 (Quill) 進給深度，鑽出 Ø12mm 垂直通孔。',
  },
];

export default function LevelsPage() {
  return (
    <main className="info-page levels-page">
      <div className="info-header">
        <a className="back-link" href="#/">← 返回首頁</a>
        <h1>加工關卡規劃預覽 (Level System Preview)</h1>
        <p className="subtitle">Data-Driven Machining Challenges & Objectives</p>
      </div>

      <div className="levels-notice">
        <span className="badge">架構契約已就緒 (Machine System v1.0 Frozen)</span>
        <p>
          本頁面展示未來 Level System 的資料描述格式。在正式關卡實作時，Level Runner 僅需讀取關卡 JSON 中的 <code>machine</code>、<code>workpiece</code> 與 <code>allowedTools</code>，即可自動透過 <code>MachineRegistry</code>、<code>WorkpieceRegistry</code> 與 <code>ToolRegistry</code> 動態組裝 3D 場景。
        </p>
      </div>

      <div className="levels-grid">
        {SAMPLE_LEVELS.map(lvl => (
          <article className="level-card" key={lvl.id}>
            <div className="level-badge">{lvl.machine.toUpperCase()}</div>
            <h2>{lvl.title}</h2>
            <p className="level-desc">{lvl.description}</p>

            <div className="level-details">
              <div>
                <span>指定工具機：</span>
                <strong>{lvl.machineName}</strong>
              </div>
              <div>
                <span>工件規格：</span>
                <strong>
                  {lvl.workpiece.type === 'cylinder'
                    ? `圓棒 Ø${lvl.workpiece.diameter}×${lvl.workpiece.length}mm`
                    : `方塊 ${lvl.workpiece.width}×${lvl.workpiece.height}×${lvl.workpiece.length}mm`}
                </strong>
              </div>
              <div>
                <span>允許刀具：</span>
                <strong>{lvl.allowedTools.join(', ')}</strong>
              </div>
              <div>
                <span>目標公差：</span>
                <strong>{lvl.objective.tolerance}</strong>
              </div>
            </div>

            <div className="level-json">
              <details>
                <summary>檢視 Level JSON 契約資料</summary>
                <pre>{JSON.stringify(lvl, null, 2)}</pre>
              </details>
            </div>

            <a className="level-action" href={`#/${lvl.machine}`}>
              進入 {lvl.machineName} 場景體驗 →
            </a>
          </article>
        ))}
      </div>
    </main>
  );
}
