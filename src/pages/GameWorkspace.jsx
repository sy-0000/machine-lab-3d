import { useEffect, useState, useRef, useCallback } from 'react';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MACHINES } from '../machines/catalog.js';
import useMachineControls from '../hooks/useMachineControls.js';
import MachineScene from '../components/MachineScene.jsx';
import ControlPanel from '../components/ControlPanel.jsx';
import DeveloperPanel from '../components/DeveloperPanel.jsx';

export default function GameWorkspace({ initialMachineId = 'lathe' }) {
  const [currentId, setCurrentId] = useState(initialMachineId || 'lathe');
  const [machineInstance, setMachineInstance] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState(0);

  const controls = useMachineControls(model);
  const abortControllerRef = useRef(null);

  const loadMachine = useCallback(async (targetId) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abort = new AbortController();
    abortControllerRef.current = abort;

    setError('');
    setProgress(5);
    setCurrentId(targetId);

    try {
      const instance = await MachineRegistry.load(targetId, {
        onProgress: p => setProgress(p),
        signal: abort.signal,
      });

      if (!abort.signal.aborted) {
        setMachineInstance(instance);
        setModel(instance.runtime);
        setProgress(100);
        // Sync URL hash for deep linking and history
        if (location.hash !== `#/${targetId}`) {
          history.replaceState(null, '', `#/${targetId}`);
        }
        return instance;
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        setError(err.message);
        setMachineInstance(null);
        setModel(null);
      }
    }
    return null;
  }, []);

  useEffect(() => {
    loadMachine(initialMachineId || 'lathe');
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      MachineRegistry.unload();
    };
  }, [initialMachineId, loadMachine]);

  const currentDef = MACHINES.find(m => m.id === currentId) || {
    name: machineInstance?.name || '工具機',
    subtitle: machineInstance?.config?.subtitle || '',
    number: '01',
  };

  const handleRefresh = () => {
    setVersion(v => v + 1);
  };

  return (
    <main className="game-workspace">
      <div className="intro">
        <div>
          <a className="back-link" href="#/">← 返回機器選單</a>
          <h1>{currentDef.name}互動教室</h1>
          <p>{currentDef.subtitle}</p>
        </div>

        <div className="machine-switcher" role="tablist" aria-label="切換工具機">
          {MACHINES.map(m => (
            <button
              key={m.id}
              role="tab"
              aria-selected={currentId === m.id}
              className={`switcher-tab ${currentId === m.id ? 'active' : ''}`}
              onClick={() => loadMachine(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <span className="lesson-tag">
          動態模組載入 · {currentDef.number}
        </span>
      </div>

      <div className="workspace">
        <div className="left-column">
          <MachineScene
            name={currentDef.name}
            model={model}
            controls={controls}
            error={error}
            progress={progress}
            onError={setError}
          />

          <DeveloperPanel
            currentMachineId={currentId}
            onSelectMachine={loadMachine}
            currentMachineInstance={machineInstance}
            onRefresh={handleRefresh}
          />

          <section className="status-panel">
            <h2>即時狀態 (Machine DRO & Telemetry)</h2>
            <div className="telemetry">
              <div>
                <span>主軸</span>
                <strong>{model?.rpm > 0 ? '運轉中' : '已停止'}</strong>
              </div>
              <div>
                <span>設定／實際 RPM</span>
                <strong>
                  {controls.rpm} / {Math.round(model?.rpm || 0)}
                </strong>
              </div>
              {model?.config.axes.map(a => (
                <div key={a.id}>
                  <span>{a.label}</span>
                  <strong>{(model.offsets[a.id] || 0).toFixed(3)}</strong>
                </div>
              ))}
              {machineInstance?.currentTool && (
                <div className="telemetry-highlight">
                  <span>掛載刀具</span>
                  <strong>{machineInstance.currentTool.name}</strong>
                </div>
              )}
              {machineInstance?.currentWorkpiece && (
                <div className="telemetry-highlight">
                  <span>掛載工件</span>
                  <strong>{machineInstance.currentWorkpiece.name}</strong>
                </div>
              )}
            </div>
            <div role="status" className={`notice ${controls.warning.level}`}>
              {controls.warning.text}
            </div>
          </section>

          {model && (
            <section className="status-panel mapping-status">
              <h2>節點核對與模型限制</h2>
              <p>
                {model.audit.filter(a => a.found).length} 筆節點參照已找到；
                {model.errors.length} 項對照問題。
              </p>
              {model.errors.length > 0 && (
                <div role="alert" className="missing-parts">
                  {model.errors.map(e => (
                    <p key={e}>{e}</p>
                  ))}
                </div>
              )}
              <ul>
                {model.config.notes.map(note => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
              <details>
                <summary>查看節點、軸向、Pivot 與 Mount Points</summary>
                <pre>
                  {JSON.stringify(
                    {
                      mounts: model.config.mounts,
                      axes: model.config.axes,
                      wheels: model.config.wheels,
                      spindle: model.config.spindle,
                      audit: model.audit,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </section>
          )}
        </div>

        <ControlPanel controls={controls} model={model} />
      </div>
    </main>
  );
}
