import { useEffect, useState, useRef, useCallback } from 'react';
import { MachineSession } from '../machining/MachineSession.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MACHINES } from '../machines/catalog.js';
import useMachineControls from '../hooks/useMachineControls.js';
import MachineScene from '../components/MachineScene.jsx';
import OperatePanel from '../components/OperatePanel.jsx';
import HandleLevel from '../components/level/HandleLevel.jsx';
import HeadLevel from '../components/level/HeadLevel.jsx';
import { HandleCampaignSession } from '../levels/HandleCampaignSession.js';
import { HeadCampaignSession } from '../levels/HeadCampaignSession.js';
import { HeadCampaignStore } from '../levels/HeadCampaignStore.js';
import { HEAD_LEVELS } from '../levels/headCampaign.js';

/** One 3D workspace for the classroom (campaign = null) and both level campaigns ('handle' | 'head'). */
export default function GameWorkspace({ initialMachineId = 'lathe', campaign = null }) {
  const [currentId, setCurrentId] = useState(initialMachineId || 'lathe');
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState(null);
  const [levelSession, setLevelSession] = useState(null);
  const sessionRef = useRef(null), levelRef = useRef(null), abortControllerRef = useRef(null);
  const controls = useMachineControls(session);

  const loadMachine = useCallback(async (targetId) => {
    if (sessionRef.current && !sessionRef.current.canCommand()) throw new Error('機台輸入已鎖定');
    abortControllerRef.current?.abort();
    const abort = new AbortController();
    abortControllerRef.current = abort;

    levelRef.current?.dispose(); levelRef.current = null; setLevelSession(null);
    sessionRef.current?.dispose(); sessionRef.current = null;
    setSession(null); setModel(null); setError(''); setProgress(5); setCurrentId(targetId);

    try {
      const instance = await MachineRegistry.load(targetId, { onProgress: p => setProgress(p), signal: abort.signal });
      if (abort.signal.aborted) return null;
      const nextSession = new MachineSession(instance, campaign ? { workpieceStore: {
        save() { throw new Error('正式關卡不寫入自由加工存檔'); }, load() { throw new Error('正式關卡使用獨立 working copy'); },
      } } : undefined);
      if (campaign === 'head') levelRef.current = new HeadCampaignSession(nextSession);
      else if (campaign === 'handle') levelRef.current = new HandleCampaignSession(nextSession);
      setLevelSession(levelRef.current);
      sessionRef.current = nextSession;
      setSession(nextSession); setModel(instance.runtime); setProgress(100);
      if (!campaign && location.hash !== `#/${targetId}`) history.replaceState(null, '', `#/${targetId}`);
      return nextSession;
    } catch (err) {
      if (!abort.signal.aborted) { setError(err.message); setModel(null); }
    }
    return null;
  }, [campaign]);

  const headMachine = () => HEAD_LEVELS[new HeadCampaignStore().load().currentLevel].machine;
  useEffect(() => {
    if (campaign === 'head') { try { loadMachine(headMachine()); } catch (e) { setError(e.message); } }
    else loadMachine(initialMachineId || 'lathe');
    return () => {
      abortControllerRef.current?.abort();
      levelRef.current?.dispose(); levelRef.current = null;
      sessionRef.current?.dispose(); sessionRef.current = null;
      MachineRegistry.unload();
    };
  }, [initialMachineId, loadMachine, campaign]);

  const currentDef = MACHINES.find(m => m.id === currentId) || { name: '工具機', subtitle: '', number: '01' };
  const operate = <OperatePanel key={currentId} session={session} controls={controls} model={model} machineId={currentId} levelMode={!!campaign} />;

  return (
    <main className="game-workspace">
      <div className="intro">
        <div>
          <a className="back-link" href={campaign ? '#/levels' : '#/'}>{campaign ? '← 返回關卡路線' : '← 返回首頁'}</a>
          <h1>{campaign === 'head' ? '槌頭製作' : campaign === 'handle' ? '槌柄製作' : currentDef.name + '教室'}</h1>
          <p>{currentDef.subtitle}</p>
        </div>
        {!campaign && <div className="machine-switcher" role="tablist" aria-label="切換工具機">
          {MACHINES.map(m => <button key={m.id} role="tab" aria-selected={currentId === m.id} className={`switcher-tab ${currentId === m.id ? 'active' : ''}`} onClick={() => loadMachine(m.id)}>{m.name}</button>)}
        </div>}
      </div>

      <div className="workspace">
        <MachineScene name={currentDef.name} model={model} controls={controls} error={error} progress={progress} onError={setError} />
        <div className="machining-sidebar">
          {campaign === 'handle' ? <HandleLevel campaign={levelSession} controls={controls} operate={operate} />
            : campaign === 'head' ? <HeadLevel campaign={levelSession} session={session} controls={controls} operate={operate} onNext={() => loadMachine(headMachine())} />
            : operate}
        </div>
      </div>
    </main>
  );
}
