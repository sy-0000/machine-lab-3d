import { useEffect, useState, useRef, useCallback } from 'react';
import { MachineSession } from '../machining/MachineSession.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MACHINES } from '../machines/catalog.js';
import useMachineControls from '../hooks/useMachineControls.js';
import MachineScene from '../components/MachineScene.jsx';
import ControlPanel from '../components/ControlPanel.jsx';
import LatheMachiningPanel from '../components/LatheMachiningPanel.jsx';
import DeveloperPanel from '../components/DeveloperPanel.jsx';
import { HAMMER_LEVELS } from '../levels/hammerPrototype.js';
import { LevelSession } from '../levels/LevelSession.js';
import LevelPanel from '../components/LevelPanel.jsx';
import { HandleCampaignSession } from '../levels/HandleCampaignSession.js';
import CampaignPanel from '../components/CampaignPanel.jsx';
import HeadCampaignPanel from '../components/HeadCampaignPanel.jsx';
import {HeadCampaignSession} from '../levels/HeadCampaignSession.js';
import {HeadCampaignStore} from '../levels/HeadCampaignStore.js';
import {HEAD_LEVELS} from '../levels/headCampaign.js';

export default function GameWorkspace({ initialMachineId = 'lathe', levelDefinition = null, campaignMode=false,headCampaign=false }) {
  const [currentId, setCurrentId] = useState(initialMachineId || 'lathe');
  const [machineInstance, setMachineInstance] = useState(null);
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null);
  const levelRef=useRef(null);
  const [levelSession,setLevelSession]=useState(null);
  const controls = useMachineControls(session);
  const abortControllerRef = useRef(null);

  const loadMachine = useCallback(async (targetId) => {
    if (sessionRef.current && !sessionRef.current.canCommand()) throw new Error('機台輸入已鎖定');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abort = new AbortController();
    abortControllerRef.current = abort;

    levelRef.current?.dispose();levelRef.current=null;setLevelSession(null);
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setSession(null);setModel(null);setMachineInstance(null);
    setError('');
    setProgress(5);
    setCurrentId(targetId);

    try {
      const instance = await MachineRegistry.load(targetId, {
        onProgress: p => setProgress(p),
        signal: abort.signal,
      });

      if (!abort.signal.aborted) {
        const nextSession = new MachineSession(instance,(levelDefinition||headCampaign)?{workpieceStore:{
          save(){throw new Error('正式關卡不寫入自由加工存檔');},load(){throw new Error('正式關卡使用獨立 working copy');},
        }}:undefined);
        if(headCampaign){levelRef.current=new HeadCampaignSession(nextSession);setLevelSession(levelRef.current);}
        else if(levelDefinition){levelRef.current=campaignMode?new HandleCampaignSession(nextSession):new LevelSession(levelDefinition,nextSession);setLevelSession(levelRef.current);}
        sessionRef.current = nextSession;
        setSession(nextSession);
        setMachineInstance(instance);
        setModel(instance.runtime);
        setProgress(100);
        // Sync URL hash for deep linking and history
        if (!levelDefinition && !headCampaign && location.hash !== `#/${targetId}`) {
          history.replaceState(null, '', `#/${targetId}`);
        }
        return nextSession;
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        setError(err.message);
        setMachineInstance(null);
        setModel(null);
      }
    }
    return null;
  }, [levelDefinition,campaignMode,headCampaign]);

  useEffect(() => {
    if(headCampaign){try{loadMachine(HEAD_LEVELS[new HeadCampaignStore().load().currentLevel].machine);}catch(e){setError(e.message);}}
    else loadMachine(initialMachineId || 'lathe');
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      levelRef.current?.dispose();levelRef.current=null;
      sessionRef.current?.dispose();
      sessionRef.current = null;
      MachineRegistry.unload();
    };
  }, [initialMachineId, loadMachine,headCampaign]);

  const currentDef = MACHINES.find(m => m.id === currentId) || {
    name: machineInstance?.name || '工具機',
    subtitle: machineInstance?.config?.subtitle || '',
    number: '01',
  };

  const handleUnload = async () => {
    if (sessionRef.current && !sessionRef.current.canCommand()) throw new Error('機台輸入已鎖定');
    abortControllerRef.current?.abort();
    sessionRef.current?.dispose(); sessionRef.current = null;
    setSession(null);setModel(null);setMachineInstance(null);
    await MachineRegistry.unload();
  };

  return (
    <main className="game-workspace">
      <div className="intro">
        <div>
          <a className="back-link" href="#/">← 返回機器選單</a>
          <h1>{headCampaign?'槌頭製作流程':campaignMode?'槌柄製作流程':levelDefinition?.title||currentDef.name+'互動教室'}</h1>
          <p>{currentDef.subtitle}</p>
        </div>

        {!levelDefinition && !headCampaign && <div className="machine-switcher" role="tablist" aria-label="切換工具機">
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
        </div>}

        <span className="lesson-tag">
          {headCampaign?'正式槌頭關卡':levelDefinition?'正式槌柄關卡':'自由操作 · '+currentDef.number}
        </span>
      </div>

      {!levelDefinition && !headCampaign && <section className="classroom-modes" aria-label="教室學習模式"><div><strong>自由操作</strong><p>在下方探索機台；也可以先選擇一段加工示範。</p></div><div className="classroom-demo-links">{HAMMER_LEVELS.map(level => <a key={level.id} href={'#/demo/'+level.id}>{level.title.replace(/^第.關：/, '')}示範 ↗</a>)}<a href="#/levels">查看關卡目標 →</a></div></section>}

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

          {!levelDefinition && !headCampaign && <DeveloperPanel
            currentMachineId={currentId}
            onSelectMachine={loadMachine}
            currentMachineInstance={machineInstance}
            session={session}
            controls={controls}
            model={model}
            onUnload={handleUnload}
          />}

          {currentId !== 'lathe' && <section className="status-panel">
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
              {controls.state?.lathe && <>
                <div><span>教學 X／直徑相對值</span><strong>{controls.state.lathe.xDiameterMm.toFixed(2)} mm</strong></div>
                <div><span>教學 Z／長度相對值</span><strong>{controls.state.lathe.zMm.toFixed(2)} mm</strong></div>
              </>}
              {model?.config.axes.map(a => (
                <div key={a.id}>
                  <span>{a.label}</span>
                  <strong>{((model.offsets[a.id] || 0) * 1000).toFixed(2)} mm</strong>
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
          </section>}


        </div>

        {currentId === 'lathe'
          ? <div className="machining-sidebar">{levelDefinition&&(campaignMode?<CampaignPanel campaign={levelSession} controls={controls}/>:<LevelPanel levelSession={levelSession} controls={controls}/>)}
            <LatheMachiningPanel session={session} controls={controls} model={model} levelMode={!!levelDefinition}/></div>
          : headCampaign?<div className="machining-sidebar"><HeadCampaignPanel campaign={levelSession} session={session} controls={controls} onNext={()=>loadMachine(HEAD_LEVELS[new HeadCampaignStore().load().currentLevel].machine)}/><ControlPanel key={currentId} controls={controls} model={model} /></div>
          : <ControlPanel key={currentId} controls={controls} model={model} />}
      </div>
    </main>
  );
}
