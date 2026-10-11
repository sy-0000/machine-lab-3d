import { useEffect, useRef, useState } from 'react';
import { takePendingSession, XR_SESSION_INIT } from '../components/VrEntryButton.jsx';
import './world.css';

// #/world：VR 世界的容器。three.js 世界（world.js）再動態載入一次，這個頁面本身很小。
// 從首頁「進入 VR」過來時，首頁已經開好 XR session，這裡交給世界接手；離開 VR 後回到首頁。
// 桌機直接開這個網址：滑鼠拖曳繞看、點選物件，F 開關 FPS、L 回大門口；裝了 Immersive Web Emulator 時也能按「進入 VR」。
export default function WorldPage() {
  const container = useRef(null), world = useRef(null);
  const [status, setStatus] = useState('正在載入 3D 世界…'), [ready, setReady] = useState(false), [xrSupported, setXrSupported] = useState(false);

  useEffect(() => {
    let live = true, session = takePendingSession();
    const leave = () => { if (location.hash === '#/world') location.hash = '#/'; };
    // 世界還沒建好就在頭盔裡離開了：直接回首頁
    const endedEarly = () => { session = null; leave(); };
    session?.addEventListener('end', endedEarly, { once: true });
    navigator.xr?.isSessionSupported?.('immersive-vr').then(ok => { if (live) setXrSupported(ok); }, () => {});
    (async () => {
      const { createWorld } = await import('./world.js');
      if (!live) return;
      const w = createWorld(container.current, { onStatus: setStatus, onExitVR: leave });
      world.current = w;
      setReady(true);
      if (session) {
        session.removeEventListener('end', endedEarly);
        await w.enterVR(session);
      }
      await w.ready;
    })().catch(error => {
      console.error(error);
      if (live) setStatus('無法載入 3D 世界：' + error.message);
      session?.end().catch(() => {});
    });
    return () => {
      live = false;
      session?.removeEventListener('end', endedEarly);
      world.current?.dispose();
      world.current = null;
    };
  }, []);

  const enter = async () => {
    try {
      const session = await navigator.xr.requestSession('immersive-vr', XR_SESSION_INIT);
      await world.current?.enterVR(session);
    } catch (error) {
      setStatus('無法進入 VR：' + (error?.message || error));
    }
  };

  return <main className="world-page">
    <div ref={container} className="world-canvas" />
    <div className="world-bar">
      <a className="back-link" href="#/">← 返回首頁</a>
      {status && <span className="world-status" role="status">{status}</span>}
      <span className="world-hint">拖曳繞看 · 點選物件 · F 開關 FPS · L 回大門口</span>
      {xrSupported && <button type="button" className="primary" disabled={!ready} onClick={enter}>🥽 進入 VR</button>}
    </div>
  </main>;
}
