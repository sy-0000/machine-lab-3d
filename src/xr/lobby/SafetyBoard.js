// 玄關左牆的工安告示板：黃銅框＋紙面，顯示 src/data/safety-rules.json（與桌機工安頁同一份，文字不改）。
// 一節一頁，太長的節自動續頁；翻到最後一頁算讀完。下方有上一頁／下一頁／退後按鈕。
// 尺寸：紙面 1.40 × 0.98 m、貼圖 2048 × 1434（約 1460 px/m，接近 Quest 3 在 1 m 處的解析度）；
// 站在 1 m 外時內文字高約 3.7 cm、節標題約 5 cm。原點在紙面中心，+Z 朝讀者。
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import rules from '../../data/safety-rules.json';
import { canvasTexture, FONT_SANS, FONT_SERIF } from '../ui/canvasText.js';
import { brassButton, buttonFace } from '../ui/buttons.js';
import { add } from '../../vendor/steampunk-workshop/src/utils/geometry.js';

const W = 2048, H = 1434, PAD = 96, BODY = 54, LINE = 86, HEAD_TOP = 236, FOOT = 1330;
export const BOARD_SIZE = { width: 1.4, height: 1.4 * H / W };
const bodyFont = strong => `${strong ? 700 : 400} ${BODY}px ${FONT_SANS}`;

// 把一條規則（文字片段）依寬度斷行；回傳每行的片段 [{ text, strong }]
function layoutItem(ctx, segments, width) {
  const lines = [[]];
  let x = 0;
  for (const seg of segments) for (const ch of seg.text) {
    ctx.font = bodyFont(seg.strong);
    const w = ctx.measureText(ch).width;
    if (x + w > width && x > 0) { lines.push([]); x = 0; if (!ch.trim()) continue; }
    const line = lines[lines.length - 1], last = line[line.length - 1];
    if (last && last.strong === !!seg.strong) last.text += ch; else line.push({ text: ch, strong: !!seg.strong });
    x += w;
  }
  return lines;
}

// 依可用高度把各節切成頁：[{ title, sectionIndex, items: [lines…], continued }]
function paginate(ctx) {
  const pages = [], textWidth = W - PAD * 2 - 60, maxLines = Math.floor((FOOT - HEAD_TOP - 40) / LINE);
  rules.sections.forEach((section, sectionIndex) => {
    let page = { title: section.title, sectionIndex, items: [], used: 0, continued: false };
    for (const item of section.items) {
      const lines = layoutItem(ctx, item, textWidth);
      if (page.used + lines.length > maxLines && page.items.length) {
        pages.push(page);
        page = { title: section.title, sectionIndex, items: [], used: 0, continued: true };
      }
      page.items.push(lines);
      page.used += lines.length + 0.35;
    }
    pages.push(page);
  });
  return pages;
}

export function createSafetyBoard(M) {
  const surface = canvasTexture(W, H), { ctx, texture } = surface;
  const pages = paginate(ctx);
  let index = 0;
  const listeners = new Set();

  function draw() {
    const page = pages[index];
    ctx.fillStyle = '#f6eedb'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,90,50,.25)'; ctx.lineWidth = 3; ctx.strokeRect(36, 36, W - 72, H - 72);
    ctx.fillStyle = '#8a6a42'; ctx.font = `500 38px ${FONT_SANS}`; ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; ctx.fillText(rules.title, PAD, 70);
    ctx.textAlign = 'right'; ctx.fillText(`第 ${index + 1} 頁 / ${pages.length}`, W - PAD, 70);
    ctx.textAlign = 'left'; ctx.fillStyle = '#3b2a1c'; ctx.font = `900 72px ${FONT_SERIF}`;
    ctx.fillText(page.title + (page.continued ? '（續）' : ''), PAD, 128);
    ctx.fillStyle = '#b8893f'; ctx.fillRect(PAD, 222, W - PAD * 2, 5);
    let y = HEAD_TOP + 20;
    for (const lines of page.items) {
      ctx.fillStyle = '#9c6a2b'; ctx.beginPath(); ctx.arc(PAD + 18, y + BODY * 0.55, 9, 0, Math.PI * 2); ctx.fill();
      for (const line of lines) {
        let x = PAD + 60;
        for (const run of line) {
          ctx.font = bodyFont(run.strong); ctx.fillStyle = run.strong ? '#7a1f12' : '#2f2218';
          ctx.fillText(run.text, x, y);
          x += ctx.measureText(run.text).width;
        }
        y += LINE;
      }
      y += LINE * 0.35;
    }
    ctx.textAlign = 'center'; ctx.font = `500 36px ${FONT_SANS}`;
    ctx.fillStyle = index === pages.length - 1 ? '#2f6b3a' : '#8a6a42';
    ctx.fillText(index === pages.length - 1 ? '已讀到最後一頁' : '請按「下一頁」繼續閱讀', W / 2, FOOT + 20);
    texture.needsUpdate = true;
  }

  const root = new Group();
  root.name = 'SafetyBoard';
  const { width: bw, height: bh } = BOARD_SIZE;
  add(root, new BoxGeometry(bw + 0.14, bh + 0.14, 0.05), M.brassAged, 'Frame', [0, 0, -0.03]);
  add(root, new BoxGeometry(bw + 0.2, 0.05, 0.08), M.brass, 'TopRail', [0, bh / 2 + 0.095, -0.01]);
  const paper = add(root, new PlaneGeometry(bw, bh), new MeshBasicMaterial({ map: texture, toneMapped: false }), 'Paper', [0, 0, 0.0]);
  paper.userData.noHighlight = true;
  // 點紙面 → 走到告示板前（由大門口區域處理）
  const hit = add(root, new BoxGeometry(bw, bh, 0.02), new MeshBasicMaterial({ visible: false }), 'PaperHit', [0, 0, 0.012]);
  hit.userData.noHighlight = true;

  const faces = { prev: buttonFace('上一頁', 'prev'), next: buttonFace('下一頁', 'next'), back: buttonFace('退後', 'back') };
  const buttons = {};
  for (const [key, x] of [['prev', -0.46], ['next', 0], ['back', 0.46]]) {
    const b = brassButton(faces[key], { width: 0.4, height: 0.13 });
    b.object.position.set(x, -bh / 2 - 0.15, 0.02);
    b.object.name = `SafetyButton_${key}`;
    root.add(b.object);
    buttons[key] = b.object;
  }
  root.traverse(o => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = true; });

  const go = i => { index = Math.max(0, Math.min(pages.length - 1, i)); draw(); listeners.forEach(fn => fn(index + 1, pages.length)); };
  draw();
  return {
    object: root,
    paper: hit,
    buttons,
    pages: pages.length,
    get page() { return index + 1; },
    /** fn(page, pages)：翻頁時呼叫（page 從 1 起算） */
    onPage(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    next() { go(index + 1); },
    prev() { go(index - 1); },
    dispose() { listeners.clear(); texture.dispose(); Object.values(faces).forEach(f => f.texture.dispose()); },
  };
}
