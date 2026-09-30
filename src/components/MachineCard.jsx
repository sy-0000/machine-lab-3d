import { useEffect, useRef, useState } from 'react';
import MachineIcon from './MachineIcon.jsx';
import { prefetchMachine } from '../prewarm/prewarm.js';

// 首頁的機台卡片。滑鼠停在卡片上一下子，卡片表面滑開，露出底下的繪本動畫（public/previews/<id>.html?preview），
// 預覽這台機器大致怎麼加工；滑鼠移開，卡片滑回來。只在有滑鼠的裝置上啟用，觸控裝置維持原本的卡片。
const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
const HOVER_DELAY = 180; // 停留多久才掀開（快速滑過、捲動頁面時不會一直翻動）

export default function MachineCard({ machine, theme }) {
  const frame = useRef(null), timer = useRef(0), loaded = useRef(false);
  const [src, setSrc] = useState(null), [open, setOpen] = useState(false);
  const post = message => { if (loaded.current) frame.current?.contentWindow?.postMessage(message, location.origin); };

  // 首頁閒置時再載入預覽頁（載入後停在第一格，不播放、不佔效能）
  useEffect(() => {
    if (!canHover) return;
    const load = () => setSrc(`${import.meta.env.BASE_URL}previews/${machine.id}.html?preview&theme=${theme}`);
    const id = typeof requestIdleCallback === 'function' ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1200);
    return () => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));
  }, [machine.id]); // eslint-disable-line react-hooks/exhaustive-deps -- 換主題用 postMessage，不重新載入

  useEffect(() => { post({ type: 'theme', theme }); }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { post({ type: open ? 'play' : 'pause' }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = () => {
    prefetchMachine(machine.id);
    if (!canHover) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY);
  };
  const leave = () => { clearTimeout(timer.current); setOpen(false); };

  return (
    <a className={`machine-card${open && src ? ' is-previewing' : ''}`} href={`#/${machine.id}`} onPointerEnter={enter} onPointerLeave={leave}>
      {src && (
        <iframe
          ref={frame} className="card-preview" src={src} title={`${machine.name}加工原理動畫預覽`}
          tabIndex={-1} aria-hidden="true"
          onLoad={() => { loaded.current = true; post({ type: 'theme', theme }); if (open) post({ type: 'play' }); }}
        />
      )}
      <div className="card-face">
        <div className="card-visual" aria-hidden="true"><MachineIcon id={machine.id} /></div>
        <div className="card-content">
          <span className="card-number">{machine.number} / INTERACTIVE LESSON</span>
          <h2>
            {machine.name}
            <span>↗</span>
          </h2>
          <small>{machine.subtitle}</small>
          <p>{machine.description}</p>
          <span className="card-action">進入互動教室 →</span>
        </div>
      </div>
      <span className="card-preview-tag" aria-hidden="true">{machine.name} · 加工原理預覽　點一下進入 →</span>
    </a>
  );
}
