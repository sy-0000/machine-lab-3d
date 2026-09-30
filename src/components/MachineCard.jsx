import { useEffect, useRef, useState } from 'react';
import MachineIcon from './MachineIcon.jsx';
import { prefetchMachine } from '../prewarm/prewarm.js';

// 首頁的機台卡片：卡片表面滑開，露出底下的繪本動畫（public/previews/<id>.html?preview），預覽這台機器大致怎麼加工。
// - 有滑鼠的裝置：滑鼠停在卡片上一下子就滑開，移開就滑回來。
// - 手機、平板：按卡片角落的「▶ 看原理動畫」滑開，「✕ 收起」滑回來；卡片捲出畫面也會自動收起。
// 卡片表面本身是連結；滑開後露出的動畫區也是同一個連結（點一下進入教室）。
const canHover = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
const HOVER_DELAY = 180; // 停留多久才掀開（快速滑過、捲動頁面時不會一直翻動）

export default function MachineCard({ machine, theme }) {
  const card = useRef(null), frame = useRef(null), timer = useRef(0), loaded = useRef(false);
  const [src, setSrc] = useState(null), [open, setOpen] = useState(false);
  const href = `#/${machine.id}`;
  const post = message => { if (loaded.current) frame.current?.contentWindow?.postMessage(message, location.origin); };
  const load = () => setSrc(s => s ?? `${import.meta.env.BASE_URL}previews/${machine.id}.html?preview&theme=${theme}`);

  // 有滑鼠時，首頁閒置就先載入預覽頁（載入後停在第一格，不播放、不佔效能）；觸控裝置等按了按鈕才載入，省流量
  useEffect(() => {
    if (!canHover) return;
    const id = typeof requestIdleCallback === 'function' ? requestIdleCallback(load, { timeout: 3000 }) : setTimeout(load, 1200);
    return () => (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));
  }, [machine.id]); // eslint-disable-line react-hooks/exhaustive-deps -- 換主題用 postMessage，不重新載入

  useEffect(() => { post({ type: 'theme', theme }); }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { post({ type: open ? 'play' : 'pause' }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);

  // 觸控裝置：卡片捲出畫面就收起（動畫停下，不耗電）
  useEffect(() => {
    if (canHover || !open) return;
    const io = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) setOpen(false); });
    io.observe(card.current);
    return () => io.disconnect();
  }, [open]);

  const enter = () => {
    prefetchMachine(machine.id);
    if (!canHover) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), HOVER_DELAY);
  };
  const leave = () => { if (!canHover) return; clearTimeout(timer.current); setOpen(false); };
  const toggle = () => { load(); setOpen(o => !o); };

  return (
    <div ref={card} className={`machine-card${open && src ? ' is-previewing' : ''}`} onPointerEnter={enter} onPointerLeave={leave}>
      {src && (
        <iframe
          ref={frame} className="card-preview" src={src} title={`${machine.name}加工原理動畫預覽`}
          tabIndex={-1} aria-hidden="true"
          onLoad={() => { loaded.current = true; post({ type: 'theme', theme }); if (open) post({ type: 'play' }); }}
        />
      )}
      {/* 滑開後露出的動畫區：點一下一樣進入教室（與卡片表面是同一個連結，鍵盤只需停一次） */}
      <a className="card-preview-link" href={href} tabIndex={-1} aria-hidden="true" />
      <a className="card-face" href={href}>
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
      </a>
      {!canHover && (
        <button type="button" className="card-preview-toggle" aria-expanded={open} onClick={toggle}>
          {open ? '✕ 收起' : '▶ 看原理動畫'}
        </button>
      )}
      <span className="card-preview-tag" aria-hidden="true"><span className="tag-name">{machine.name} · 加工原理預覽　</span>點一下進入 →</span>
    </div>
  );
}
