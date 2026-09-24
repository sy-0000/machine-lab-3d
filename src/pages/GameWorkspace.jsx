import { useEffect, useState, useRef, useCallback } from 'react';
import { MachineSession } from '../machining/MachineSession.js';
import { MachineRegistry } from '../machines/core/MachineRegistry.js';
import { MACHINES } from '../machines/catalog.js';
import useMachineControls from '../hooks/useMachineControls.js';
import MachineScene from '../components/MachineScene.jsx';
import OperatePanel from '../components/OperatePanel.jsx';
import ChallengeLevel from '../components/level/ChallengeLevel.jsx';

/** One 3D workspace for the classroom (challenge = null) and the three machine challenges. */
export default function GameWorkspace({ initialMachineId = 'lathe', challenge = null }) {
  const [currentId, setCurrentId] = useState(challenge?.machine || initialMachineId || 'lathe');
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [session, setSession] = useState(null);
  const sessionRef = useRef(null), abortControllerRef = useRef(null);
  const controls = useMachineControls(session);

  const loadMachine = useCallback(async (targetId) => {
    if (sessionRef.current && !sessionRef.current.canCommand()) throw new Error('機台輸入已鎖定');
    abortControllerRef.current?.abort();
    const abort = new AbortController();
    abortControllerRef.current = abort;
    sessionRef.current?.dispose(); sessionRef.current = null;
    setSession(null); setModel(null); setError(''); setProgress(5); setCurrentId(targetId);
    try {
      const instance = await MachineRegistry.load(targetId, { onProgress: p => setProgress(p), signal: abort.signal });
      if (abort.signal.aborted) return null;
      // Challenges never write the classroom's free workpiece save.
      const nextSession = new MachineSession(instance, challenge ? { workpieceStore: {
        save() { throw new Error('關卡不寫入自由加工存檔'); }, load() { throw new Error('關卡每次都用新毛胚'); },
      } } : undefined);
      sessionRef.current = nextSession;
      setSession(nextSession); setModel(instance.runtime); setProgress(100);
      if (!challenge && location.hash !== `#/${targetId}`) history.replaceState(null, '', `#/${targetId}`);
      return nextSession;
    } catch (err) {
      if (!abort.signal.aborted) { setError(err.message); setModel(null); }
    }
    return null;
  }, [challenge]);

  useEffect(() => {
    loadMachine(challenge?.machine || initialMachineId || 'lathe');
    return () => {
      abortControllerRef.current?.abort();
      sessionRef.current?.dispose(); sessionRef.current = null;
      MachineRegistry.unload();
    };
  }, [initialMachineId, loadMachine, challenge]);

  const currentDef = MACHINES.find(m => m.id === currentId) || { name: '工具機', subtitle: '', number: '01' };
  const operate = <OperatePanel key={currentId} session={session} controls={controls} model={model} machineId={currentId} levelMode={!!challenge} />;

  return (
    <main className="game-workspace">
      <div className="intro">
        <div>
          <a className="back-link" href={challenge ? '#/levels' : '#/'}>{challenge ? '← 返回關卡列表' : '← 返回首頁'}</a>
          <h1>{challenge ? challenge.title : currentDef.name + '教室'}</h1>
          <p>{currentDef.subtitle}</p>
        </div>
        {!challenge && <div className="machine-switcher" role="tablist" aria-label="切換工具機">
          {MACHINES.map(m => <button key={m.id} role="tab" aria-selected={currentId === m.id} className={`switcher-tab ${currentId === m.id ? 'active' : ''}`} onClick={() => loadMachine(m.id)}>{m.name}</button>)}
        </div>}
      </div>

      <div className="workspace">
        <MachineScene name={currentDef.name} model={model} controls={controls} error={error} progress={progress} onError={setError} />
        <div className="machining-sidebar">
          {challenge ? <ChallengeLevel challenge={challenge} session={session} controls={controls} operate={operate} /> : operate}
        </div>
      </div>
    </main>
  );
}
