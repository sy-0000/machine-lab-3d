import LatheMachiningDiagnostics from './LatheMachiningDiagnostics.jsx';
import ControlPanel from './ControlPanel.jsx';
import { useState, useEffect } from 'react';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { WorkpieceRegistry } from '../workpieces/WorkpieceRegistry.js';

export default function DeveloperPanel({
  currentMachineId,
  onSelectMachine,
  currentMachineInstance,
  session,
  controls,
  model,
  onUnload,
}) {
  const [open, setOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(currentMachineId || 'lathe');
  const [selectedTool, setSelectedTool] = useState('turning_tool');
  const [selectedWorkpiece, setSelectedWorkpiece] = useState('cylinder_30x100');
  const [logMessage, setLogMessage] = useState('');

  const machines = MachineRegistry.getAvailableMachines();
  const tools = ToolRegistry.getToolsForMachine(currentMachineId).filter(tool => tool.type !== 'measuring');
  const workpieces = WorkpieceRegistry.getAvailablePresets();

  useEffect(() => {
    if (currentMachineId) {
      setSelectedMachine(currentMachineId);
      // Pick appropriate default tool
      if (currentMachineId === 'milling') setSelectedTool('end_mill');
      else if (currentMachineId === 'drill') setSelectedTool('drill_bit');
      else setSelectedTool('turning_tool');
    }
  }, [currentMachineId]);

  const showLog = msg => {
    setLogMessage(msg);
    setTimeout(() => setLogMessage(''), 4000);
  };

  const handleLoadMachine = async () => {
    try {
      showLog(`正在載入機台：${selectedMachine}...`);
      await onSelectMachine(selectedMachine);
      showLog(`機台 ${selectedMachine} 載入完成`);
    } catch (e) {
      showLog(`載入機台失敗：${e.message}`);
    }
  };

  const handleUnloadMachine = async () => {
    try {
      await onUnload();
      showLog('已卸載目前機台，場景已清空');
    } catch (e) {
      showLog(`卸載失敗：${e.message}`);
    }
  };

  const run = async (target, command) => {
    if (!target) throw new Error('請先載入機台');
    const result = await target.command(command);
    if (!result.ok) throw new Error(result.reason);
  };
  const handleMountTool = async () => {
    try { await run(session, {type:'tool.select',toolId:selectedTool || null}); showLog('刀具已更新'); }
    catch (error) { showLog('掛載刀具錯誤：' + error.message); }
  };
  const handleMountWorkpiece = async () => {
    try { await run(session, selectedWorkpiece ? {type:'workpiece.mount',spec:selectedWorkpiece} : {type:'workpiece.unmount'}); showLog('工件已更新'); }
    catch (error) { showLog('掛載工件錯誤：' + error.message); }
  };
  const handleResetMachine = async () => {
    try { await run(session, {type:'machine.reset'}); showLog('機台座標與狀態已重設'); }
    catch (error) { showLog(error.message); }
  };
  const applyPreset = async (mId, tId, wpId) => {
    try {
      setSelectedMachine(mId);setSelectedTool(tId);setSelectedWorkpiece(wpId);
      const nextSession = await onSelectMachine(mId);
      await run(nextSession, {type:'workpiece.mount',spec:wpId});
      await run(nextSession, {type:'tool.select',toolId:tId});
      showLog('快速組合已掛載');
    } catch (error) { showLog('套用組合失敗：' + error.message); }
  };

  return (
    <div className="developer-panel-container">
      <button
        className="developer-toggle-btn"
        onClick={() => setOpen(v => !v)}
        title="開啟/關閉 開發者測試面板"
        aria-label="開發者測試面板"
      >
        🛠️ {open ? '隱藏開發者面板' : '開發者測試面板'}
      </button>

      {open && (
        <div className="developer-panel" role="region" aria-label="開發者測試控制">
          <div className="dev-header">
            <h3>開發者測試面板 (Dev Test Panel)</h3>
            <small>Machine System v1.0 獨立模組調試</small>
          </div>

          <div className="dev-section">
            <label htmlFor="dev-machine-select">工具機模組 (Machine):</label>
            <div className="dev-row">
              <select
                id="dev-machine-select"
                value={selectedMachine}
                onChange={e => setSelectedMachine(e.target.value)}
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
              <button className="dev-btn primary" onClick={handleLoadMachine}>
                載入 (Load)
              </button>
              <button className="dev-btn" onClick={handleUnloadMachine}>
                卸載 (Unload)
              </button>
            </div>
          </div>

          <div className="dev-section">
            <label htmlFor="dev-workpiece-select">工件系統 (Workpiece):</label>
            <div className="dev-row">
              <select
                id="dev-workpiece-select"
                value={selectedWorkpiece}
                onChange={e => setSelectedWorkpiece(e.target.value)}
              >
                <option value="">-- 無工件 (None) --</option>
                {workpieces.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button className="dev-btn" onClick={handleMountWorkpiece}>
                掛載工件
              </button>
            </div>
          </div>

          {currentMachineId === 'lathe' && <div className="dev-section">
            <LatheMachiningDiagnostics session={session} run={async command=>{
              try { await run(session,command); } catch(error) { showLog(error.message); }
            }}/>
          </div>}

          <div className="dev-section">
            <label htmlFor="dev-tool-select">刀具系統 (Tool):</label>
            <div className="dev-row">
              <select
                id="dev-tool-select"
                value={selectedTool}
                onChange={e => setSelectedTool(e.target.value)}
              >
                <option value="">-- 無刀具 (None) --</option>
                {tools.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="dev-btn" onClick={handleMountTool}>
                掛載刀具
              </button>
            </div>
          </div>

          <div className="dev-section">
            <label>快速調試組合 (Quick Presets):</label>
            <div className="dev-preset-grid">
              <button
                className="dev-preset-btn"
                onClick={() => applyPreset('lathe', 'turning_tool', 'cylinder_30x100')}
              >
                Lathe + Turning Tool
              </button>
              <button
                className="dev-preset-btn"
                onClick={() => applyPreset('lathe', 'threading_tool', 'cylinder_30x100')}
              >
                Lathe + Threading Tool
              </button>
              <button
                className="dev-preset-btn"
                onClick={() => applyPreset('milling', 'end_mill', 'block_100x60x40')}
              >
                Milling + End Mill
              </button>
              <button
                className="dev-preset-btn"
                onClick={() => applyPreset('drill', 'drill_bit', 'block_100x60x40')}
              >
                Drill + Drill Bit
              </button>
            </div>
          </div>

          <div className="dev-section">
            <div className="dev-row">
              <button className="dev-btn" onClick={handleResetMachine}>
                ↺ 重設機台 (Reset)
              </button>
            </div>
          </div>

          <div className="dev-status">
            <div>
              <span>目前機台：</span>
              <strong>{currentMachineInstance?.name || '無 (未載入)'}</strong>
            </div>
            <div>
              <span>目前刀具：</span>
              <strong>{currentMachineInstance?.currentTool?.name || '未掛載'}</strong>
            </div>
            <div>
              <span>目前工件：</span>
              <strong>{currentMachineInstance?.currentWorkpiece?.name || '未掛載'}</strong>
            </div>
          </div>

          {logMessage && <div className="dev-log">{logMessage}</div>}
          {currentMachineId === 'lathe' && <details><summary>機台原始控制（診斷）</summary><ControlPanel controls={controls} model={model} diagnostic/></details>}
        </div>
      )}
    </div>
  );
}
