import { useEffect, useState } from 'react';

// 首頁的「進入 VR」：只有瀏覽器回報支援 immersive-vr（Quest 瀏覽器、或裝了 Immersive Web Emulator）才出現。
// 按下時立刻在這次點擊裡開啟 XR session（瀏覽器要求由使用者手勢觸發），再切到 #/world 動態載入 3D 世界，
// 世界建好後用 takePendingSession() 接手這個 session。這個檔案不載入 three.js，首頁的載入量不變。
export const XR_SESSION_INIT = { optionalFeatures: ['local-floor', 'bounded-floor'] };
let pending = null;
/** #/world 取走首頁開好的 session（沒有則為 null） */
export function takePendingSession() {
  const session = pending;
  pending = null;
  return session;
}

export default function VrEntryButton() {
  const [supported, setSupported] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    navigator.xr?.isSessionSupported?.('immersive-vr').then(ok => { if (live) setSupported(ok); }, () => {});
    return () => { live = false; };
  }, []);
  if (!supported) return null;
  const enter = async () => {
    setError('');
    try {
      pending = await navigator.xr.requestSession('immersive-vr', XR_SESSION_INIT);
      pending.addEventListener('end', () => { pending = null; }, { once: true });
      location.hash = '#/world';
    } catch (e) {
      setError('無法進入 VR：' + (e?.message || e));
    }
  };
  return <div className="vr-entry">
    <button type="button" className="primary" onClick={enter}>🥽 進入 VR</button>
    {error && <p role="alert" className="notice caution">{error}</p>}
  </div>;
}
