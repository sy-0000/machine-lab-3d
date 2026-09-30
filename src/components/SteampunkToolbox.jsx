import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { mountToolbox } from '../vendor/steampunk-toolbox/src/mount.js';
import { prewarmToolbox } from '../prewarm/prewarm.js';
import '../styles/toolbox.css';

// 蒸汽龐克互動工具盒（src/vendor/steampunk-toolbox）嵌進工具盒頁面。
// 場景自己開 renderer 與迴圈（不經過 R3F）；這裡只負責容器、全螢幕與生命週期。
// ref.showTool(i)：從頁面上的卡片直接拿起第 i 件工具。
export default function SteampunkToolbox({ ref, onChange }) {
  const stageRef = useRef(null), canvasRef = useRef(null), uiRef = useRef(null), api = useRef(null), queued = useRef(-1);
  const change = useRef(onChange);
  change.current = onChange;
  const [ready, setReady] = useState(false), [showing, setShowing] = useState(false), [error, setError] = useState(false);

  // 瀏覽器原生全螢幕；不支援或被擋下時（iPhone Safari、內嵌的 iframe）改用蓋滿視窗的樣式
  const [native, setNative] = useState(false), [pseudo, setPseudo] = useState(false);
  const fullscreen = native || pseudo;
  const fullscreenRef = useRef(fullscreen);
  fullscreenRef.current = fullscreen;
  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  const toggleFullscreen = () => {
    if (native) return document.exitFullscreen().catch(() => {});
    if (pseudo) return setPseudo(false);
    if (!document.fullscreenEnabled || !stageRef.current?.requestFullscreen) return setPseudo(true);
    stageRef.current.requestFullscreen().catch(() => setPseudo(true));
  };
  useEffect(() => {
    if (!pseudo) return;
    // Esc 在展示中是「放回盒中」，回到瀏覽後再按才離開全螢幕
    const onKey = e => { if (e.key === 'Escape' && !showing) setPseudo(false); };
    document.documentElement.classList.add('toolbox-locked');
    addEventListener('keydown', onKey);
    return () => { document.documentElement.classList.remove('toolbox-locked'); removeEventListener('keydown', onKey); };
  }, [pseudo, showing]);

  useEffect(() => {
    let handle = null, cancelled = false;
    // 貼圖在背景執行緒畫（首頁閒置時通常已經畫好），畫好才分段建場景；等待期間齒輪照常轉、頁面可以捲動
    (async () => {
      await prewarmToolbox();
      if (cancelled) return;
      const built = await mountToolbox(canvasRef.current, uiRef.current, {
        onReady: () => setReady(true),
        onChange: i => { setShowing(i >= 0); change.current?.(i); },
      });
      if (cancelled) return built.dispose(); // 建好之前就離開頁面了
      handle = built;
      handle.setZoom(fullscreenRef.current);
      api.current = handle;
      if (queued.current >= 0) handle.showTool(queued.current); // 場景還在載入時就按了卡片
    })().catch(e => {
      console.error('工具盒場景載入失敗', e);
      setError(true);
    });
    return () => { cancelled = true; api.current = null; handle?.dispose(); };
  }, []);

  useEffect(() => { api.current?.setZoom(fullscreen); }, [fullscreen]);

  useImperativeHandle(ref, () => ({
    showTool: i => {
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (api.current) api.current.showTool(i);
      else queued.current = i;
    },
  }), []);

  return (
    <div ref={stageRef} className={`toolbox-stage${fullscreen ? ' is-fullscreen' : ''}${pseudo ? ' is-pseudo' : ''}`}>
      <div ref={canvasRef} className="toolbox-canvas" />
      <div ref={uiRef} className="toolbox-ui" />
      <div className={`toolbox-veil${ready || error ? ' is-gone' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="24" cy="24" r="7" /><path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M9.9 38.1l4.2-4.2M33.9 14.1l4.2-4.2" /><circle cx="24" cy="24" r="14" /></svg>
      </div>
      {error && <p className="toolbox-error">瀏覽器不支援 WebGL，請啟用硬體加速後重新整理。</p>}
      <button type="button" className="toolbox-fs" aria-pressed={fullscreen} onClick={toggleFullscreen} title={fullscreen ? '離開全螢幕' : '全螢幕'}>
        {fullscreen ? '🗗 離開全螢幕' : '⛶ 全螢幕'}
      </button>
      <p className={`toolbox-hint${showing ? ' is-hidden' : ''}`}>拖曳旋轉視角 · 點選工具拿起來看{fullscreen ? ' · 滾輪縮放' : ''}</p>
    </div>
  );
}
